import { discoverFeeds, guessFeedUrls, looksLikeFeed, parseFeed, parseOpml, toOpml, type ParsedFeed } from './feed';
import { ITEMS_PER_FEED, type RssFeed, type RssItem, type RssLibrary } from './rss-types';
import type { RssStorage } from './storage';

/** Downloads a feed or page as text; injected so tests and the browser preview can stub it. */
export type TextFetcher = (url: string) => Promise<{ finalUrl: string; contentType: string; body: string }>;

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
/** Feeds refreshed at once. */
const CONCURRENCY = 4;

function normalizeInput(input: string): string {
  const t = input.trim();
  if (!t) throw new Error('Paste a feed or site address.');
  const raw = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t.replace(/^feed:(\/\/)?/i, 'https://') : `https://${t}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('That isn’t a web address.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('That isn’t a web address.');
  return u.toString();
}

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase();

/** The RSS tab's feeds and articles, kept in memory and written through to storage. */
export class RssStore {
  private lib: RssLibrary = { feeds: [], items: [] };
  private listeners = new Set<() => void>();
  /** Feeds being refreshed right now. */
  refreshing = new Set<string>();

  constructor(private readonly storage: RssStorage, private readonly fetchText: TextFetcher) {}

  async init() {
    this.lib = await this.storage.load();
    this.emit();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.lib;

  private emit() {
    this.lib = { ...this.lib };
    for (const fn of this.listeners) fn();
  }

  unreadCount(feedId?: string): number {
    let n = 0;
    for (const i of this.lib.items) if (!i.read && (!feedId || i.feedId === feedId)) n++;
    return n;
  }

  /** Finds the feed behind a feed or site address and follows it. Returns the feed (an existing one if already followed). */
  async follow(input: string, folder = ''): Promise<{ feed: RssFeed; existed: boolean }> {
    const url = normalizeInput(input);
    const known = this.lib.feeds.find((f) => sameUrl(f.url, url) || (f.siteUrl && sameUrl(f.siteUrl, url)));
    if (known) return { feed: known, existed: true };
    const { feedUrl, parsed } = await this.locate(url);
    const again = this.lib.feeds.find((f) => sameUrl(f.url, feedUrl));
    if (again) return { feed: again, existed: true };
    const feed: RssFeed = {
      id: uid(),
      url: feedUrl,
      title: parsed.title || new URL(feedUrl).hostname.replace(/^www\./, ''),
      siteUrl: parsed.siteUrl,
      description: parsed.description,
      folder,
      lastFetchedAt: now(),
      lastError: null,
      createdAt: now(),
    };
    await this.storage.saveFeeds([feed]);
    this.lib.feeds = [...this.lib.feeds, feed];
    await this.merge(feed, parsed);
    this.emit();
    return { feed, existed: false };
  }

  /** The feed for an address: the address itself, a feed its page names, or a usual feed path on the site. */
  private async locate(url: string): Promise<{ feedUrl: string; parsed: ParsedFeed }> {
    const page = await this.fetchText(url);
    if (looksLikeFeed(page.body)) return { feedUrl: page.finalUrl || url, parsed: parseFeed(page.body, page.finalUrl || url) };
    const candidates = [...discoverFeeds(page.body, page.finalUrl || url), ...guessFeedUrls(page.finalUrl || url)];
    for (const c of candidates) {
      try {
        const res = await this.fetchText(c);
        if (looksLikeFeed(res.body)) return { feedUrl: res.finalUrl || c, parsed: parseFeed(res.body, res.finalUrl || c) };
      } catch {
        // Try the next one.
      }
    }
    throw new Error('Couldn’t find a feed on that site. Paste the feed’s own address if you know it.');
  }

  /** Adds new articles and updates changed ones, keeping read and starred marks. Returns how many were new. */
  private async merge(feed: RssFeed, parsed: ParsedFeed): Promise<number> {
    const mine = this.lib.items.filter((i) => i.feedId === feed.id);
    const byGuid = new Map(mine.map((i) => [i.guid, i]));
    const changed: RssItem[] = [];
    let added = 0;
    const at = now();
    for (const p of parsed.items) {
      if (!p.guid || (!p.url && !p.title)) continue;
      const old = byGuid.get(p.guid);
      if (old) {
        if (old.title !== p.title || old.summary !== p.summary || old.url !== p.url || old.imageUrl !== p.imageUrl) {
          const next = { ...old, title: p.title, summary: p.summary, url: p.url, imageUrl: p.imageUrl || old.imageUrl, author: p.author, publishedAt: p.publishedAt ?? old.publishedAt };
          byGuid.set(p.guid, next);
          changed.push(next);
        }
        continue;
      }
      const item: RssItem = { id: uid(), feedId: feed.id, ...p, read: false, starred: false, fetchedAt: at };
      byGuid.set(p.guid, item);
      changed.push(item);
      added++;
    }
    if (changed.length) await this.storage.saveItems(changed);
    // Keep the newest articles; starred ones always stay.
    const all = [...byGuid.values()].sort((a, b) => (b.publishedAt ?? b.fetchedAt).localeCompare(a.publishedAt ?? a.fetchedAt));
    const drop = all.slice(ITEMS_PER_FEED).filter((i) => !i.starred).map((i) => i.id);
    if (drop.length) await this.storage.deleteItems(drop);
    const dropped = new Set(drop);
    this.lib.items = [...this.lib.items.filter((i) => i.feedId !== feed.id), ...all.filter((i) => !dropped.has(i.id))];
    return added;
  }

  /** Reads one feed again. Failures are kept on the feed, not thrown. */
  async refresh(feedId: string): Promise<number> {
    const feed = this.lib.feeds.find((f) => f.id === feedId);
    if (!feed || this.refreshing.has(feedId)) return 0;
    this.refreshing.add(feedId);
    this.emit();
    let added = 0;
    let next: RssFeed;
    try {
      const res = await this.fetchText(feed.url);
      const parsed = parseFeed(res.body, res.finalUrl || feed.url);
      added = await this.merge(feed, parsed);
      next = { ...feed, siteUrl: feed.siteUrl || parsed.siteUrl, description: feed.description || parsed.description, lastFetchedAt: now(), lastError: null };
    } catch (e) {
      next = { ...feed, lastFetchedAt: now(), lastError: e instanceof Error ? e.message : String(e) };
    }
    await this.storage.saveFeeds([next]);
    this.lib.feeds = this.lib.feeds.map((f) => (f.id === feedId ? next : f));
    this.refreshing.delete(feedId);
    this.emit();
    return added;
  }

  /** Reads every feed (or those not read for `olderThanMs`). Returns how many new articles came in. */
  async refreshAll(olderThanMs = 0): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const queue = this.lib.feeds.filter((f) => !olderThanMs || !f.lastFetchedAt || Date.parse(f.lastFetchedAt) < cutoff).map((f) => f.id);
    let added = 0;
    const work = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) added += await this.refresh(id);
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, work));
    return added;
  }

  private async patchItems(ids: string[], patch: (i: RssItem) => RssItem | null) {
    const want = new Set(ids);
    const changed: RssItem[] = [];
    const items = this.lib.items.map((i) => {
      if (!want.has(i.id)) return i;
      const next = patch(i);
      if (!next) return i;
      changed.push(next);
      return next;
    });
    if (!changed.length) return;
    await this.storage.saveItems(changed);
    this.lib.items = items;
    this.emit();
  }

  setRead(ids: string[], read: boolean) {
    return this.patchItems(ids, (i) => (i.read === read ? null : { ...i, read }));
  }

  /** Marks every article read, or those of one feed. */
  markAllRead(feedId?: string) {
    return this.setRead(this.lib.items.filter((i) => !i.read && (!feedId || i.feedId === feedId)).map((i) => i.id), true);
  }

  setStarred(id: string, starred: boolean) {
    return this.patchItems([id], (i) => (i.starred === starred ? null : { ...i, starred }));
  }

  async updateFeed(id: string, patch: Partial<Pick<RssFeed, 'title' | 'folder'>>) {
    const feed = this.lib.feeds.find((f) => f.id === id);
    if (!feed) return;
    const next = { ...feed, ...patch };
    await this.storage.saveFeeds([next]);
    this.lib.feeds = this.lib.feeds.map((f) => (f.id === id ? next : f));
    this.emit();
  }

  /** Moves every feed in category `from` to `to` ('' for none). */
  async renameCategory(from: string, to: string) {
    const changed = this.lib.feeds.filter((f) => f.folder === from).map((f) => ({ ...f, folder: to.trim() }));
    if (!changed.length) return;
    await this.storage.saveFeeds(changed);
    const byId = new Map(changed.map((f) => [f.id, f]));
    this.lib.feeds = this.lib.feeds.map((f) => byId.get(f.id) ?? f);
    this.emit();
  }

  /** True when a feed with this address is already followed. */
  isFollowing(url: string) {
    return this.lib.feeds.some((f) => sameUrl(f.url, url));
  }

  async unfollow(id: string) {
    await this.storage.deleteFeeds([id]);
    this.lib.feeds = this.lib.feeds.filter((f) => f.id !== id);
    this.lib.items = this.lib.items.filter((i) => i.feedId !== id);
    this.emit();
  }

  /** Follows the feeds in an OPML file without reading them yet. Returns the new feeds and how many were already followed. */
  async importOpml(xml: string): Promise<{ added: RssFeed[]; existing: number }> {
    const listed = parseOpml(xml);
    if (!listed.length) throw new Error('No feeds found in that file.');
    const added: RssFeed[] = [];
    let existing = 0;
    for (const o of listed) {
      let url: string;
      try {
        url = normalizeInput(o.url);
      } catch {
        continue;
      }
      if ([...this.lib.feeds, ...added].some((f) => sameUrl(f.url, url))) {
        existing++;
        continue;
      }
      added.push({ id: uid(), url, title: o.title || new URL(url).hostname, siteUrl: o.siteUrl, description: '', folder: o.folder, lastFetchedAt: null, lastError: null, createdAt: now() });
    }
    if (added.length) {
      await this.storage.saveFeeds(added);
      this.lib.feeds = [...this.lib.feeds, ...added];
      this.emit();
    }
    return { added, existing };
  }

  exportOpml(): string {
    return toOpml(this.lib.feeds.map((f) => ({ url: f.url, title: f.title, siteUrl: f.siteUrl, folder: f.folder })));
  }
}
