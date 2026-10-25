import type { BookmarkType } from './types';

/** Metadata fetched from the YouTube Data API v3 for one bookmark. */
export interface FetchedMetadata {
  title: string;
  description: string;
  thumbnailUrl: string;
  channelName: string;
  channelUrl: string;
  categoryName: string | null;
  tags: string[];
  durationSec: number | null;
  publishedAt: string | null;
  viewCount: number | null;
  itemCount: number | null;
}

export interface MetadataRequest {
  type: BookmarkType;
  youtubeId: string;
}

const API = 'https://www.googleapis.com/youtube/v3';
const BATCH = 50; // the API accepts up to 50 ids per call
/** YouTube tags can run to dozens per video; keep the first few as bookmark tags. */
export const MAX_FETCHED_TAGS = 5;

export class YouTubeApiError extends Error {
  constructor(message: string, readonly status: number, readonly reason?: string) {
    super(message);
  }
}

type Fetch = typeof fetch;

interface Thumbs {
  [size: string]: { url: string } | undefined;
}

/** First line of a description, trimmed to about 140 characters. */
export function firstLine(text: string, max = 140): string {
  const line = (text ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** ISO 8601 duration ("PT1H2M3S") to seconds. */
export function parseDuration(iso: string | undefined): number | null {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

function bestThumb(t: Thumbs | undefined): string {
  for (const size of ['maxres', 'standard', 'high', 'medium', 'default']) {
    const url = t?.[size]?.url;
    if (url) return url;
  }
  return '';
}

function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags ?? []) {
    const name = t.trim().toLowerCase().replace(/\s+/g, '-').replace(/^#/, '');
    if (name && name.length <= 30 && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
    if (out.length === MAX_FETCHED_TAGS) break;
  }
  return out;
}

function channelLink(id: string | undefined): string {
  return id ? `https://www.youtube.com/channel/${id}` : '';
}

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export class YouTubeApi {
  private categoryNames = new Map<string, string>();

  constructor(private readonly apiKey: string, private readonly fetchFn: Fetch = fetch.bind(globalThis)) {}

  private async get(path: string, params: Record<string, string>): Promise<any> {
    const qs = new URLSearchParams({ ...params, key: this.apiKey });
    const res = await this.fetchFn(`${API}/${path}?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = body?.error;
      throw new YouTubeApiError(err?.message ?? `YouTube API error ${res.status}`, res.status, err?.errors?.[0]?.reason);
    }
    return body;
  }

  /** Checks the key with the cheapest possible call (1 quota unit). */
  async verifyKey(): Promise<void> {
    await this.get('videoCategories', { part: 'snippet', regionCode: 'US' });
  }

  private async categoryName(id: string | undefined): Promise<string | null> {
    if (!id) return null;
    if (!this.categoryNames.has(id)) {
      const body = await this.get('videoCategories', { part: 'snippet', id });
      for (const item of body.items ?? []) this.categoryNames.set(item.id, item.snippet.title);
    }
    return this.categoryNames.get(id) ?? null;
  }

  private async videos(ids: string[]): Promise<Map<string, FetchedMetadata>> {
    const out = new Map<string, FetchedMetadata>();
    for (const batch of chunks(ids, BATCH)) {
      const body = await this.get('videos', { part: 'snippet,contentDetails,statistics', id: batch.join(','), maxResults: '50' });
      const missing = [...new Set((body.items ?? []).map((i: any) => i.snippet?.categoryId).filter((c: string) => c && !this.categoryNames.has(c)))];
      if (missing.length) {
        const cats = await this.get('videoCategories', { part: 'snippet', id: missing.join(',') });
        for (const c of cats.items ?? []) this.categoryNames.set(c.id, c.snippet.title);
      }
      for (const item of body.items ?? []) {
        const s = item.snippet ?? {};
        out.set(item.id, {
          title: s.title ?? '',
          description: firstLine(s.description ?? ''),
          thumbnailUrl: bestThumb(s.thumbnails),
          channelName: s.channelTitle ?? '',
          channelUrl: channelLink(s.channelId),
          categoryName: await this.categoryName(s.categoryId),
          tags: cleanTags(s.tags),
          durationSec: parseDuration(item.contentDetails?.duration),
          publishedAt: s.publishedAt ?? null,
          viewCount: item.statistics?.viewCount != null ? Number(item.statistics.viewCount) : null,
          itemCount: null,
        });
      }
    }
    return out;
  }

  private async playlists(ids: string[]): Promise<Map<string, FetchedMetadata>> {
    const out = new Map<string, FetchedMetadata>();
    for (const batch of chunks(ids, BATCH)) {
      const body = await this.get('playlists', { part: 'snippet,contentDetails', id: batch.join(','), maxResults: '50' });
      for (const item of body.items ?? []) {
        const s = item.snippet ?? {};
        out.set(item.id, {
          title: s.title ?? '',
          description: firstLine(s.description ?? ''),
          thumbnailUrl: bestThumb(s.thumbnails),
          channelName: s.channelTitle ?? '',
          channelUrl: channelLink(s.channelId),
          categoryName: null,
          tags: [],
          durationSec: null,
          publishedAt: s.publishedAt ?? null,
          viewCount: null,
          itemCount: item.contentDetails?.itemCount ?? null,
        });
      }
    }
    return out;
  }

  private async channel(youtubeId: string): Promise<FetchedMetadata | null> {
    const params: Record<string, string> = { part: 'snippet,statistics' };
    if (youtubeId.startsWith('@')) params.forHandle = youtubeId;
    else if (youtubeId.startsWith('UC')) params.id = youtubeId;
    else if (youtubeId.startsWith('user/')) params.forUsername = youtubeId.slice(5);
    else params.forHandle = `@${youtubeId.replace(/^c\//, '')}`; // c/ custom URLs usually match the handle
    const body = await this.get('channels', params);
    const item = body.items?.[0];
    if (!item) return null;
    const s = item.snippet ?? {};
    return {
      title: s.title ?? '',
      description: firstLine(s.description ?? ''),
      thumbnailUrl: bestThumb(s.thumbnails),
      channelName: s.customUrl ?? youtubeId,
      channelUrl: s.customUrl?.startsWith('@') ? `https://www.youtube.com/${s.customUrl}` : channelLink(item.id),
      categoryName: null,
      tags: [],
      durationSec: null,
      publishedAt: s.publishedAt ?? null,
      viewCount: null,
      itemCount: item.statistics?.videoCount != null ? Number(item.statistics.videoCount) : null,
    };
  }

  /**
   * Fetches metadata for many bookmarks, batching videos and playlists.
   * Results are keyed by `${type}:${youtubeId}`; ids YouTube doesn't know are absent.
   */
  async fetchMany(requests: MetadataRequest[]): Promise<Map<string, FetchedMetadata>> {
    const out = new Map<string, FetchedMetadata>();
    const videoIds = [...new Set(requests.filter((r) => r.type === 'video' || r.type === 'short').map((r) => r.youtubeId))];
    const playlistIds = [...new Set(requests.filter((r) => r.type === 'playlist').map((r) => r.youtubeId))];
    const vids = await this.videos(videoIds);
    const lists = await this.playlists(playlistIds);
    for (const r of requests) {
      const meta = r.type === 'playlist' ? lists.get(r.youtubeId) : r.type === 'channel' ? null : vids.get(r.youtubeId);
      if (meta) out.set(`${r.type}:${r.youtubeId}`, meta);
    }
    for (const r of requests.filter((x) => x.type === 'channel')) {
      const meta = await this.channel(r.youtubeId);
      if (meta) out.set(`channel:${r.youtubeId}`, meta);
    }
    return out;
  }
}
