export interface RssFeed {
  id: string;
  /** The feed's own address (RSS or Atom). */
  url: string;
  title: string;
  siteUrl: string;
  description: string;
  /** Optional folder, e.g. from an OPML import. */
  folder: string;
  lastFetchedAt: string | null;
  /** Why the last refresh failed, or null. */
  lastError: string | null;
  createdAt: string;
}

export interface RssItem {
  id: string;
  feedId: string;
  guid: string;
  title: string;
  url: string;
  summary: string;
  author: string;
  publishedAt: string | null;
  imageUrl: string;
  read: boolean;
  starred: boolean;
  fetchedAt: string;
}

export interface RssLibrary {
  feeds: RssFeed[];
  items: RssItem[];
}

/** Articles kept per feed; older read ones are dropped (starred ones always stay). */
export const ITEMS_PER_FEED = 200;
