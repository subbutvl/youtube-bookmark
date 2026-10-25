import type { BookmarkType } from './types';

export interface ParsedUrl {
  type: BookmarkType;
  /** Video id, playlist id, channel id (UC…), @handle, or c/… / user/… path. */
  youtubeId: string;
  dedupeKey: string;
  /** Canonical URL we store and open. */
  url: string;
  /** Playlist id when a watch URL also carried `&list=`. */
  playlistId?: string;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com']);

function cleanHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

/** Keeps a `t=` start time ("90", "1m30s") so the video opens at that point. */
function startTime(params: URLSearchParams): string | null {
  const t = params.get('t') ?? params.get('start');
  return t && /^\d+[smh]?(\d+[smh]?)*$/.test(t) ? t : null;
}

function video(type: 'video' | 'short', id: string, params: URLSearchParams): ParsedUrl {
  const base = type === 'short' ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
  const t = type === 'video' ? startTime(params) : null;
  const list = params.get('list');
  return {
    type,
    youtubeId: id,
    dedupeKey: `${type}:${id}`,
    url: t ? `${base}&t=${t}` : base,
    // Auto-generated mixes (RD…) and temporary queues (TL…) are not real playlists.
    playlistId: list && !/^(RD|TL)/.test(list) ? list : undefined,
  };
}

/**
 * Detects the bookmark type from a URL alone (no network), per the spec:
 * Shorts, then playlist, then video, then channel. Returns null for anything
 * that is not a recognisable YouTube link.
 */
export function parseYouTubeUrl(input: string): ParsedUrl | null {
  let raw = input.trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = cleanHost(u.hostname);
  const parts = u.pathname.split('/').filter(Boolean);
  const params = u.searchParams;

  if (host === 'youtu.be') {
    return parts[0] && VIDEO_ID.test(parts[0]) ? video('video', parts[0], params) : null;
  }
  if (!HOSTS.has(host)) return null;

  const [first, second] = parts;
  if (first === 'shorts' && second && VIDEO_ID.test(second)) return video('short', second, params);
  if (first === 'playlist') {
    const list = params.get('list');
    return list
      ? { type: 'playlist', youtubeId: list, dedupeKey: `playlist:${list}`, url: `https://www.youtube.com/playlist?list=${list}` }
      : null;
  }
  if (first === 'watch') {
    const v = params.get('v');
    return v && VIDEO_ID.test(v) ? video('video', v, params) : null;
  }
  if ((first === 'live' || first === 'embed' || first === 'v') && second && VIDEO_ID.test(second)) {
    return video('video', second, params);
  }
  if (first?.startsWith('@') && first.length > 1) {
    const handle = decodeURIComponent(first);
    return { type: 'channel', youtubeId: handle, dedupeKey: `channel:${handle.toLowerCase()}`, url: `https://www.youtube.com/${handle}` };
  }
  if (first === 'channel' && second?.startsWith('UC')) {
    return { type: 'channel', youtubeId: second, dedupeKey: `channel:${second}`, url: `https://www.youtube.com/channel/${second}` };
  }
  if ((first === 'c' || first === 'user') && second) {
    const id = `${first}/${second}`;
    return { type: 'channel', youtubeId: id, dedupeKey: `channel:${id.toLowerCase()}`, url: `https://www.youtube.com/${id}` };
  }
  return null;
}

/** Thumbnail we can show instantly, before any API call. */
export function instantThumbnail(type: BookmarkType, youtubeId: string): string {
  return type === 'video' || type === 'short' ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : '';
}

/** Splits pasted text into candidate links (one per line, or separated by spaces/commas). */
export function splitUrls(text: string): string[] {
  return text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}
