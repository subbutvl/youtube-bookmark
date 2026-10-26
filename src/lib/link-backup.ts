import { csvCell, parseCsvRows, type ImportItem } from './backup';
import { LINK_FLAGS, type Link, type LinkFlag, type LinkLibrary } from './link-types';
import type { LinkImportItem } from './link-store';
import { parseLink } from './link-url';
import { parseYouTubeUrl } from './youtube-url';

export const LINK_BACKUP_VERSION = 1;
const BACKUP_KIND = 'tubemarks-links';

export interface ParsedLinkImport {
  items: LinkImportItem[];
  /** YouTube links found in the file; they go to the YouTube library instead. */
  youtube: ImportItem[];
  invalid: number;
  /** Entries repeated inside the file itself (kept once). */
  repeated: number;
  /** The file had folders (a browser's bookmarks), so they can be re-applied to links already saved. */
  hasFolders?: boolean;
}

export type LinkExportFormat = 'json' | 'html' | 'csv';

// ---------- export ----------

export function exportLinksJson(lib: LinkLibrary, now = new Date()): string {
  return JSON.stringify({ kind: BACKUP_KIND, version: LINK_BACKUP_VERSION, exportedAt: now.toISOString(), categories: lib.categories, tags: lib.tags, links: lib.links }, null, 1);
}

export const LINK_CSV_COLUMNS = ['url', 'title', 'site', 'description', 'category', 'tags', 'viewed', 'flags', 'opened', 'added', 'notes'];

export function exportLinksCsv(lib: LinkLibrary): string {
  const cat = new Map(lib.categories.map((c) => [c.id, c.name]));
  const tag = new Map(lib.tags.map((t) => [t.id, t.name]));
  const rows = lib.links.map((l) => [
    l.url, l.title, l.domain, l.description, l.categoryId ? cat.get(l.categoryId) ?? '' : '', l.tagIds.map((t) => tag.get(t)).filter(Boolean).join(';'),
    l.viewed ? 'yes' : 'no', l.flags.join(';'), l.openCount, l.createdAt, l.notes,
  ]);
  return [LINK_CSV_COLUMNS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The bookmarks file every browser can import: one folder per category, tags as TAGS. */
export function exportLinksHtml(lib: LinkLibrary): string {
  const tag = new Map(lib.tags.map((t) => [t.id, t.name]));
  const line = (l: Link) => {
    const added = Math.floor(Date.parse(l.createdAt) / 1000);
    const tags = l.tagIds.map((t) => tag.get(t)).filter(Boolean).join(',');
    return `        <DT><A HREF="${esc(l.url)}" ADD_DATE="${added}"${tags ? ` TAGS="${esc(tags)}"` : ''}>${esc(l.title || l.url)}</A>\n`;
  };
  let out = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n';
  for (const c of [...lib.categories].sort((a, b) => a.name.localeCompare(b.name))) {
    const links = lib.links.filter((l) => l.categoryId === c.id);
    if (!links.length) continue;
    out += `    <DT><H3>${esc(c.name)}</H3>\n    <DL><p>\n${links.map(line).join('')}    </DL><p>\n`;
  }
  out += lib.links.filter((l) => !l.categoryId).map((l) => line(l).slice(4)).join('');
  return `${out}</DL><p>\n`;
}

// ---------- import ----------

/** A link as found in a file, before it is sorted into Links or YouTube. */
interface RawLink {
  url: string;
  title?: string;
  /** Folder names from the top, without the browser's own root folders. */
  folders?: string[];
  createdAt?: string;
  extra?: Partial<LinkImportItem>;
}

const tagName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-');

function finish(raws: RawLink[]): ParsedLinkImport {
  const links = new Map<string, LinkImportItem>();
  const youtube = new Map<string, ImportItem>();
  let invalid = 0;
  let repeated = 0;
  for (const r of raws) {
    // Each folder becomes a category named by its full path ("AI / Coding"), since the same
    // folder name can sit under different parents.
    const folders = r.folders?.map((f) => f.trim()).filter(Boolean) ?? [];
    const category = folders.length ? folders.join(' / ') : undefined;
    // What an earlier version made of nested folders, so re-applying folders can tidy them away.
    const folderTags = folders.slice(1).map(tagName);
    const yt = parseYouTubeUrl(r.url);
    if (yt) {
      if (youtube.has(yt.dedupeKey)) repeated++;
      else youtube.set(yt.dedupeKey, { url: yt.url, type: yt.type, youtubeId: yt.youtubeId, dedupeKey: yt.dedupeKey, title: r.title, categoryName: category ?? null, tagNames: [], createdAt: r.createdAt });
      continue;
    }
    const p = parseLink(r.url);
    if (!p) {
      invalid++;
      continue;
    }
    if (links.has(p.dedupeKey)) {
      repeated++;
      continue;
    }
    links.set(p.dedupeKey, { ...p, title: r.title || undefined, categoryName: category, tagNames: [], folderTags, createdAt: r.createdAt, ...r.extra });
  }
  return { items: [...links.values()], youtube: [...youtube.values()], invalid, repeated, hasFolders: raws.some((r) => !!r.folders?.length) };
}

function validDate(s: unknown): string | undefined {
  if (typeof s === 'number' && s > 0) return new Date(s).toISOString();
  if (typeof s === 'string' && s && !Number.isNaN(Date.parse(s))) return new Date(s).toISOString();
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .trim();
}

/** Browsers' own top-level folders; their contents count as unfiled. */
const ROOT_FOLDERS = /^(bookmarks bar|bookmarks toolbar|favorites bar|favourites bar|other bookmarks|other favorites|other favourites|mobile bookmarks|bookmarks menu|toolbar|menu|unsorted bookmarks)$/i;

/** The bookmarks.html every browser exports: folders, titles and dates. */
export function parseBookmarksHtml(html: string): ParsedLinkImport {
  const raws: RawLink[] = [];
  const stack: string[] = [];
  let pendingFolder: string | null = null;
  let depth = 0;
  for (const m of html.matchAll(/<(\/?)(dl|h3|a)\b([^>]*)>([^<]*)/gi)) {
    const [, close, tag, attrs, text] = m;
    const t = tag.toLowerCase();
    if (t === 'h3' && !close) pendingFolder = decodeEntities(text);
    else if (t === 'dl' && !close) {
      depth++;
      if (depth > 1) stack.push(pendingFolder ?? '');
      pendingFolder = null;
    } else if (t === 'dl' && close) {
      if (depth > 1) stack.pop();
      depth = Math.max(0, depth - 1);
    } else if (t === 'a' && !close) {
      const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1] ?? attrs.match(/href\s*=\s*'([^']*)'/i)?.[1];
      if (!href) continue;
      const added = Number(attrs.match(/add_date\s*=\s*"(\d+)"/i)?.[1]);
      const tags = attrs.match(/tags\s*=\s*"([^"]*)"/i)?.[1];
      const folders = stack.filter((f, i) => f && !(i === 0 && ROOT_FOLDERS.test(f)));
      raws.push({
        url: decodeEntities(href),
        title: decodeEntities(text),
        folders,
        createdAt: added > 0 ? new Date(added * 1000).toISOString() : undefined,
        extra: tags ? { tagNames: decodeEntities(tags).split(',').map(tagName).filter(Boolean) } : undefined,
      });
    }
  }
  return finish(raws);
}

interface ChromiumNode {
  type?: string;
  name?: string;
  url?: string;
  date_added?: string;
  children?: ChromiumNode[];
}

/** Chromium's date_added: microseconds since 1 January 1601. */
const fromChromiumTime = (s?: string) => {
  const us = Number(s);
  return us > 0 ? new Date(us / 1000 - 11_644_473_600_000).toISOString() : undefined;
};

/** The `Bookmarks` file Chrome, Edge and Brave keep in their profile folder. */
export function parseChromiumBookmarks(text: string): ParsedLinkImport {
  const data = JSON.parse(text);
  if (!data?.roots) throw new Error('This isn’t a Chrome or Edge bookmarks file.');
  const raws: RawLink[] = [];
  // The roots (bookmarks bar, other, mobile) aren't folders of the user's own.
  const walk = (children: ChromiumNode[], folders: string[]) => {
    for (const c of children) {
      if (c.type === 'url' && c.url) raws.push({ url: c.url, title: c.name, folders, createdAt: fromChromiumTime(c.date_added) });
      else if (Array.isArray(c.children)) walk(c.children, [...folders, c.name ?? '']);
    }
  };
  for (const root of Object.values(data.roots) as ChromiumNode[]) if (root && Array.isArray(root.children)) walk(root.children, []);
  return finish(raws);
}

export function parseLinksBackup(text: string): ParsedLinkImport {
  const data = JSON.parse(text);
  if (typeof data.version === 'number' && data.version > LINK_BACKUP_VERSION) throw new Error(`This backup was made by a newer version of TubeMarks (format ${data.version}).`);
  const cat = new Map<string, string>((data.categories ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  const tag = new Map<string, string>((data.tags ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  return finish(
    (data.links as Partial<Link>[]).map((l) => ({
      url: String(l.url ?? ''),
      title: l.title,
      createdAt: validDate(l.createdAt),
      extra: {
        description: l.description || undefined,
        faviconUrl: l.faviconUrl || undefined,
        imageUrl: l.imageUrl || undefined,
        siteName: l.siteName || undefined,
        categoryName: l.categoryId ? cat.get(l.categoryId) : undefined,
        tagNames: (l.tagIds ?? []).map((t) => tag.get(t)).filter((t): t is string => !!t),
        notes: l.notes || undefined,
        viewed: !!l.viewed,
        flags: (l.flags ?? []).filter((f): f is LinkFlag => LINK_FLAGS.includes(f)),
        openCount: l.openCount ?? 0,
        lastOpenedAt: l.lastOpenedAt ?? null,
        quickLaunch: l.quickLaunch ?? null,
        groupName: l.groupName ?? null,
      },
    })),
  );
}

export function parseLinksCsv(text: string): ParsedLinkImport {
  const rows = parseCsvRows(text.replace(/^﻿/, ''));
  if (!rows.length) return { items: [], youtube: [], invalid: 0, repeated: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iUrl = col('url', 'link', 'href');
  if (iUrl < 0) throw new Error('The CSV needs a "url" column.');
  const [iTitle, iDesc, iCat, iTags, iViewed, iFlags, iAdded, iNotes] = [
    col('title', 'name'), col('description'), col('category', 'folder'), col('tags'), col('viewed', 'read'), col('flags'), col('added', 'date added', 'createdat', 'created'), col('notes'),
  ];
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  return finish(
    rows.slice(1).map((r) => {
      const category = get(r, iCat);
      return {
        url: get(r, iUrl),
        title: get(r, iTitle),
        folders: category ? [category] : [],
        createdAt: validDate(get(r, iAdded)),
        extra: {
          description: get(r, iDesc) || undefined,
          tagNames: get(r, iTags).split(/[;,]/).map(tagName).filter(Boolean),
          viewed: /^(yes|true|1)$/i.test(get(r, iViewed)),
          flags: get(r, iFlags).split(/[;,]/).map((f) => f.trim().toLowerCase()).filter((f): f is LinkFlag => LINK_FLAGS.includes(f as LinkFlag)),
          notes: get(r, iNotes) || undefined,
        },
      };
    }),
  );
}

/** Any other text: every http(s) link in it. */
export function parseLinkText(text: string): ParsedLinkImport {
  const found = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? text.split(/\s+/).filter(Boolean);
  return finish(found.map((u) => ({ url: u.replace(/&amp;/g, '&') })));
}

export function parseLinkImportFile(name: string, text: string): ParsedLinkImport {
  const lower = name.toLowerCase();
  const trimmed = text.trimStart();
  if (lower.endsWith('.json') || lower === 'bookmarks' || trimmed.startsWith('{')) {
    const data = JSON.parse(text);
    if (data?.roots) return parseChromiumBookmarks(text);
    if (Array.isArray(data?.links)) return parseLinksBackup(text);
    if (Array.isArray(data?.bookmarks)) {
      // A TubeMarks YouTube backup: every link goes to the YouTube library.
      return finish(data.bookmarks.map((b: { url?: string; title?: string; createdAt?: string }) => ({ url: String(b.url ?? ''), title: b.title, createdAt: validDate(b.createdAt) })));
    }
    throw new Error('This JSON file isn’t a TubeMarks backup or a Chrome/Edge bookmarks file.');
  }
  if (lower.endsWith('.csv')) return parseLinksCsv(text);
  if (lower.endsWith('.html') || lower.endsWith('.htm') || /<!DOCTYPE NETSCAPE-Bookmark-file/i.test(trimmed)) return parseBookmarksHtml(text);
  return parseLinkText(text);
}
