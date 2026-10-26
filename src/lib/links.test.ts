import { describe, expect, it } from 'vitest';
import { exportLinksHtml, exportLinksJson, parseBookmarksHtml, parseChromiumBookmarks, parseLinkImportFile, parseLinksCsv } from './link-backup';
import { LinkStore, type MetaFetcher } from './link-store';
import { nearKey, parseLink } from './link-url';
import { applyLinkView, DEFAULT_LINK_VIEW, groupByDomain, linkKpis } from './link-view';
import { parsePageMeta } from './page-meta';
import { routeUrls } from './route';
import { MemoryStorage } from './storage';
import { findNearDuplicates } from '../components/DuplicatesDialog';

const meta: MetaFetcher = async (url) => ({
  finalUrl: url,
  title: `Title of ${new URL(url).pathname}`,
  description: 'A page',
  imageUrl: '',
  faviconUrl: '',
  siteName: '',
  keywords: ['web', 'reading'],
});

async function makeStore(fetcher: MetaFetcher = meta) {
  const storage = new MemoryStorage();
  const store = new LinkStore(storage.links, fetcher);
  await store.init();
  return { store, storage };
}

describe('parseLink', () => {
  it('normalizes for duplicates and strips tracking', () => {
    const a = parseLink('https://www.Example.com/post/?utm_source=x&b=2&a=1#top')!;
    const b = parseLink('example.com/post?a=1&b=2')!;
    expect(a.dedupeKey).toBe('example.com/post?a=1&b=2');
    expect(b.dedupeKey).toBe(a.dedupeKey);
    expect(a.url).not.toContain('utm_source');
    expect(a.domain).toBe('example.com');
  });
  it('rejects non-web input', () => {
    expect(parseLink('hello')).toBeNull();
    expect(parseLink('mailto:a@b.com')).toBeNull();
    expect(parseLink('ftp://x.com/file')).toBeNull();
  });
  it('near key ignores the query', () => {
    expect(nearKey(parseLink('https://x.com/a?page=2')!.dedupeKey)).toBe('x.com/a');
  });
});

describe('routeUrls', () => {
  it('sends YouTube links to YouTube and the rest to Links', () => {
    const r = routeUrls('https://youtu.be/dQw4w9WgXcQ github.com/a/b nonsense');
    expect(r.youtube).toHaveLength(1);
    expect(r.links).toEqual(['github.com/a/b']);
    expect(r.invalid).toEqual(['nonsense']);
  });
});

describe('parsePageMeta', () => {
  it('prefers Open Graph and resolves relative URLs', () => {
    const html = `<html><head><title>Plain &amp; simple</title>
      <meta property="og:title" content="OG title">
      <meta name="description" content="Desc here">
      <meta property="og:image" content="/img.png">
      <meta name="keywords" content="Rust, Web Dev, rust">
      <link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/touch.png">
      </head><body></body></html>`;
    const m = parsePageMeta(html, 'https://site.dev/a/b');
    expect(m.title).toBe('OG title');
    expect(m.description).toBe('Desc here');
    expect(m.imageUrl).toBe('https://site.dev/img.png');
    expect(m.faviconUrl).toBe('https://site.dev/touch.png');
    expect(m.keywords).toEqual(['rust', 'web-dev']);
  });
  it('falls back to <title> and /favicon.ico', () => {
    const m = parsePageMeta('<head><title>Only &#8211; title</title></head>', 'https://a.io/x');
    expect(m.title).toBe('Only – title');
    expect(m.faviconUrl).toBe('https://a.io/favicon.ico');
  });
});

describe('LinkStore', () => {
  it('adds, refuses duplicates, and fills details from the page', async () => {
    const { store } = await makeStore();
    const r = await store.addUrls('https://a.com/one\nhttps://www.a.com/one/\nb.org');
    expect(r.added).toHaveLength(2);
    expect(r.duplicates).toHaveLength(1);
    await store.refreshMetadata(r.added.map((l) => l.id));
    const one = store.getSnapshot().links.find((l) => l.domain === 'a.com')!;
    expect(one.title).toBe('Title of /one');
    expect(one.metadataStatus).toBe('ok');
    expect(one.tagIds).toHaveLength(2);
    const again = await store.addUrls('a.com/one');
    expect(again.added).toHaveLength(0);
    expect(again.duplicates[0].existing.id).toBe(one.id);
  });

  it('counts bulk progress even without a progress callback', async () => {
    const { store } = await makeStore();
    // Imported links don't start a fetch of their own, unlike addUrls.
    // More links than fetch workers, so later fetches report the earlier ones as done.
    await store.importItems(Array.from({ length: 10 }, (_, n) => parseLink(`https://a.com/${n}`)!), 'merge');
    const seen: number[] = [];
    const stop = store.subscribe(() => store.progress && seen.push(store.progress.done));
    await store.refreshMetadata(store.getSnapshot().links.map((l) => l.id));
    stop();
    expect(Math.max(...seen)).toBeGreaterThan(0);
    expect(store.progress).toBeNull();
  });

  it('opening marks viewed and clears New; flags combine', async () => {
    const { store } = await makeStore();
    const [l] = (await store.addUrls('x.com/a')).added;
    await store.markOpened(l.id);
    await store.setFlag([l.id], 'must', true);
    await store.setFlag([l.id], 'later', true);
    const now = store.getSnapshot().links[0];
    expect(now.viewed).toBe(true);
    expect(now.openCount).toBe(1);
    expect(now.flags).toEqual(['later', 'must']);
  });

  it('keeps quick launch to 15 in order', async () => {
    const { store } = await makeStore();
    const r = await store.addUrls(Array.from({ length: 16 }, (_, i) => `https://s${i}.com`));
    for (const l of r.added.slice(0, 15)) await store.pin(l.id);
    await expect(store.pin(r.added[15].id)).rejects.toThrow(/15/);
    await store.reorderQuickLaunch([r.added[2].id, r.added[0].id]);
    expect(store.quickLaunch[0].id).toBe(r.added[2].id);
    await store.unpin(r.added[2].id);
    expect(store.quickLaunch).toHaveLength(14);
  });

  it('imports with folders as categories and tags, and survives a reload', async () => {
    const { store, storage } = await makeStore();
    const parsed = parseBookmarksHtml(BOOKMARKS_HTML);
    const res = await store.importItems(parsed.items, 'merge');
    expect(res.added).toBe(2);
    const reloaded = new LinkStore(storage.links, meta);
    await reloaded.init();
    const lib = reloaded.getSnapshot();
    expect(lib.links).toHaveLength(2);
    expect(lib.categories.map((c) => c.name)).toEqual(['Dev']);
    expect(lib.tags.map((t) => t.name)).toEqual(['rust']);
  });
});

const BOOKMARKS_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
  <DL><p>
    <DT><H3>Dev</H3>
    <DL><p>
      <DT><H3>Rust</H3>
      <DL><p>
        <DT><A HREF="https://doc.rust-lang.org/book/" ADD_DATE="1700000000">The Book</A>
        <DT><A HREF="https://www.youtube.com/watch?v=dQw4w9WgXcQ" ADD_DATE="1700000001">A video</A>
      </DL><p>
    </DL><p>
    <DT><A HREF="https://news.ycombinator.com/?utm_source=x">HN &amp; more</A>
    <DT><A HREF="javascript:void(0)">Bookmarklet</A>
  </DL><p>
</DL><p>`;

describe('link-backup', () => {
  it('reads browser bookmarks HTML with folders, dates and YouTube routing', () => {
    const p = parseBookmarksHtml(BOOKMARKS_HTML);
    expect(p.items.map((i) => i.domain)).toEqual(['doc.rust-lang.org', 'news.ycombinator.com']);
    expect(p.items[0]).toMatchObject({ title: 'The Book', categoryName: 'Dev', tagNames: ['rust'], createdAt: new Date(1700000000000).toISOString() });
    expect(p.items[1]).toMatchObject({ title: 'HN & more', categoryName: undefined });
    expect(p.youtube).toHaveLength(1);
    expect(p.youtube[0]).toMatchObject({ type: 'video', categoryName: 'Dev', tagNames: ['rust'] });
    expect(p.invalid).toBe(1);
  });

  it('reads Chrome and Edge Bookmarks files', () => {
    const file = JSON.stringify({
      roots: {
        bookmark_bar: { type: 'folder', name: 'Bookmarks bar', children: [
          { type: 'url', name: 'MDN', url: 'https://developer.mozilla.org/', date_added: '13300000000000000' },
          { type: 'folder', name: 'News', children: [{ type: 'url', name: 'BBC', url: 'https://www.bbc.co.uk/news' }, { type: 'url', name: 'BBC again', url: 'https://bbc.co.uk/news/' }] },
        ] },
        other: { type: 'folder', name: 'Other bookmarks', children: [] },
        synced: { type: 'folder', name: 'Mobile bookmarks', children: [{ type: 'url', name: 'Short', url: 'https://youtube.com/shorts/abcdefghijk' }] },
      },
      version: 1,
    });
    const p = parseChromiumBookmarks(file);
    expect(p.items).toHaveLength(2);
    expect(p.items[0].categoryName).toBeUndefined();
    expect(p.items[0].createdAt).toBe(new Date(13300000000000000 / 1000 - 11644473600000).toISOString());
    expect(p.items[1].categoryName).toBe('News');
    expect(p.repeated).toBe(1);
    expect(p.youtube).toHaveLength(1);
    expect(parseLinkImportFile('Bookmarks', file).items).toHaveLength(2);
  });

  it('round-trips the JSON backup and exports browser HTML', async () => {
    const { store } = await makeStore();
    const [l] = (await store.addUrls('https://a.com/x', { tagNames: ['t1'] })).added;
    await store.setCategoryByName([l.id], 'Read');
    await store.setFlag([l.id], 'must', true);
    await store.pin(l.id);
    const lib = store.getSnapshot();
    const back = parseLinkImportFile('b.tmlinks.json', exportLinksJson(lib));
    expect(back.items[0]).toMatchObject({ categoryName: 'Read', tagNames: ['t1'], flags: ['must'], quickLaunch: 0 });
    const html = exportLinksHtml(lib);
    expect(html).toContain('<H3>Read</H3>');
    expect(parseBookmarksHtml(html).items[0]).toMatchObject({ url: 'https://a.com/x', categoryName: 'Read' });
  });

  it('reads a CSV with a url column', () => {
    const p = parseLinksCsv('url,title,category,tags,flags\r\nhttps://a.com,A,Work,x;y,later;must\r\n');
    expect(p.items[0]).toMatchObject({ title: 'A', categoryName: 'Work', tagNames: ['x', 'y'], flags: ['later', 'must'] });
  });
});

describe('link view', () => {
  it('filters, sorts, counts and groups by site', async () => {
    const { store } = await makeStore();
    await store.addUrls('https://a.com/1 https://a.com/2 https://b.com/1');
    const lib = store.getSnapshot();
    const [first] = lib.links;
    await store.markOpened(first.id);
    const after = store.getSnapshot();
    expect(applyLinkView(after, { ...DEFAULT_LINK_VIEW, status: 'new' })).toHaveLength(2);
    expect(applyLinkView(after, { ...DEFAULT_LINK_VIEW, domain: 'a.com' })).toHaveLength(2);
    expect(applyLinkView(after, { ...DEFAULT_LINK_VIEW, sort: 'opened-most' })[0].id).toBe(first.id);
    const k = linkKpis(after.links);
    expect(k).toMatchObject({ total: 3, today: 3, week: 3, fresh: 2, viewedPct: 33 });
    const rows = groupByDomain(applyLinkView(after, { ...DEFAULT_LINK_VIEW, sort: 'domain' }));
    expect(rows.map((r) => r.kind)).toEqual(['group', 'link']);
  });

  it('finds near duplicates', async () => {
    const { store } = await makeStore(async (url) => ({ ...(await meta(url)), title: 'Same' }));
    const r = await store.addUrls('https://a.com/p?page=1 https://a.com/p?page=2 https://b.com/q');
    await store.refreshMetadata(r.added.map((l) => l.id));
    const groups = findNearDuplicates(store.getSnapshot().links);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });
});
