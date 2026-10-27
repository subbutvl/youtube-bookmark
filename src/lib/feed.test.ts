import { describe, expect, it } from 'vitest';
import { discoverFeeds, looksLikeFeed, parseFeed, parseOpml, toOpml } from './feed';
import { RssStore, type TextFetcher } from './rss-store';
import { MemoryStorage } from './storage';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Example &amp; Co</title>
  <link>https://example.com/</link>
  <description>News from Example</description>
  <item>
    <title><![CDATA[First <post>]]></title>
    <link>https://example.com/1</link>
    <guid isPermaLink="false">id-1</guid>
    <pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate>
    <dc:creator>Ann</dc:creator>
    <description><![CDATA[<p>Hello <b>world</b></p><img src="/pic.jpg">]]></description>
  </item>
  <item>
    <title>Second</title>
    <link>/2</link>
    <enclosure url="https://cdn.example.com/2.png" type="image/png" length="1"/>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <link href="https://blog.test/" rel="alternate"/>
  <link href="https://blog.test/atom.xml" rel="self"/>
  <entry>
    <title type="html">Entry &lt;one&gt;</title>
    <link rel="alternate" href="https://blog.test/one"/>
    <id>tag:blog.test,2026:1</id>
    <updated>2026-10-20T10:00:00Z</updated>
    <author><name>Bo</name></author>
    <summary>Short text</summary>
  </entry>
</feed>`;

describe('feed parsing', () => {
  it('reads RSS 2.0', () => {
    expect(looksLikeFeed(RSS)).toBe(true);
    const f = parseFeed(RSS, 'https://example.com/feed');
    expect(f).toMatchObject({ title: 'Example & Co', siteUrl: 'https://example.com/', description: 'News from Example' });
    expect(f.items).toHaveLength(2);
    expect(f.items[0]).toMatchObject({ guid: 'id-1', title: 'First', url: 'https://example.com/1', summary: 'Hello world', author: 'Ann', imageUrl: 'https://example.com/pic.jpg', publishedAt: '2026-10-26T08:00:00.000Z' });
    expect(f.items[1]).toMatchObject({ guid: 'https://example.com/2', url: 'https://example.com/2', imageUrl: 'https://cdn.example.com/2.png', publishedAt: null });
  });

  it('reads Atom', () => {
    const f = parseFeed(ATOM, 'https://blog.test/atom.xml');
    expect(f).toMatchObject({ title: 'Atom Blog', siteUrl: 'https://blog.test/' });
    expect(f.items[0]).toMatchObject({ guid: 'tag:blog.test,2026:1', title: 'Entry', url: 'https://blog.test/one', author: 'Bo', summary: 'Short text', publishedAt: '2026-10-20T10:00:00.000Z' });
  });

  it('refuses a web page', () => {
    expect(() => parseFeed('<html><head></head></html>', 'https://x.com')).toThrow(/feed/);
  });

  it('finds feeds a page links to', () => {
    const html = `<html><head>
      <link rel="alternate" type="application/rss+xml" title="Posts" href="/feed.xml">
      <link rel="alternate" type="application/rss+xml" title="Comments" href="/comments.xml">
      <link rel="stylesheet" href="/s.css">
    </head><body></body></html>`;
    expect(discoverFeeds(html, 'https://site.com/blog/')).toEqual(['https://site.com/feed.xml']);
  });

  it('reads and writes OPML with folders', () => {
    const opml = `<opml version="2.0"><body>
      <outline text="Tech"><outline type="rss" text="A" xmlUrl="https://a.com/rss" htmlUrl="https://a.com"/></outline>
      <outline type="rss" title="B" xmlUrl="https://b.com/feed"/>
    </body></opml>`;
    const feeds = parseOpml(opml);
    expect(feeds).toEqual([
      { url: 'https://a.com/rss', title: 'A', siteUrl: 'https://a.com', folder: 'Tech' },
      { url: 'https://b.com/feed', title: 'B', siteUrl: '', folder: '' },
    ]);
    expect(parseOpml(toOpml(feeds))).toEqual(feeds);
  });
});

describe('RssStore', () => {
  const pages: Record<string, string> = {
    'https://example.com/': '<html><head><link rel="alternate" type="application/rss+xml" href="/feed"></head></html>',
    'https://example.com/feed': RSS,
  };
  const fetcher: TextFetcher = async (url) => {
    if (!(url in pages)) throw new Error('404');
    return { finalUrl: url, contentType: '', body: pages[url] };
  };

  it('follows a site through its feed, keeps read marks on refresh, and survives a reload', async () => {
    const storage = new MemoryStorage();
    const store = new RssStore(storage.rss, fetcher);
    await store.init();
    const { feed, existed } = await store.follow('example.com');
    expect(existed).toBe(false);
    expect(feed).toMatchObject({ url: 'https://example.com/feed', title: 'Example & Co' });
    expect(store.unreadCount()).toBe(2);
    const first = store.getSnapshot().items.find((i) => i.guid === 'id-1')!;
    await store.setRead([first.id], true);
    await store.setStarred(first.id, true);
    expect(await store.refresh(feed.id)).toBe(0);
    expect(store.unreadCount()).toBe(1);
    expect((await store.follow('https://example.com/feed')).existed).toBe(true);

    const again = new RssStore(storage.rss, fetcher);
    await again.init();
    const kept = again.getSnapshot().items.find((i) => i.guid === 'id-1')!;
    expect(kept).toMatchObject({ read: true, starred: true });
    await again.markAllRead();
    expect(again.unreadCount()).toBe(0);
    await again.unfollow(feed.id);
    expect(again.getSnapshot()).toEqual({ feeds: [], items: [] });
  });

  it('files feeds under categories and renames them', async () => {
    const storage = new MemoryStorage();
    const store = new RssStore(storage.rss, fetcher);
    await store.init();
    const { feed } = await store.follow('https://example.com/feed', 'Coding');
    expect(feed.folder).toBe('Coding');
    expect(store.isFollowing('https://example.com/feed/')).toBe(true);
    await store.renameCategory('Coding', 'Dev');
    expect(store.getSnapshot().feeds[0].folder).toBe('Dev');
  });

  it('records a failed refresh on the feed', async () => {
    const storage = new MemoryStorage();
    const store = new RssStore(storage.rss, fetcher);
    await store.init();
    const { feed } = await store.follow('https://example.com/feed');
    delete pages['https://example.com/feed'];
    await store.refreshAll();
    expect(store.getSnapshot().feeds[0]).toMatchObject({ id: feed.id, lastError: '404' });
    pages['https://example.com/feed'] = RSS;
  });
});
