import type { Bookmark, BookmarkType, Library } from './types';
import { parseYouTubeUrl } from './youtube-url';

export const BACKUP_VERSION = 1;

/** One bookmark read from an import file, before it is merged into the library. */
export interface ImportItem {
  url: string;
  type: BookmarkType;
  youtubeId: string;
  dedupeKey: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  channelName?: string;
  categoryName?: string | null;
  tagNames?: string[];
  durationSec?: number | null;
  publishedAt?: string | null;
  viewCount?: number | null;
  itemCount?: number | null;
  notes?: string;
  watched?: boolean;
  createdAt?: string;
}

export interface ParsedImport {
  items: ImportItem[];
  /** Entries that were not YouTube links. */
  invalid: number;
  /** Entries repeated inside the file itself (kept once). */
  repeated: number;
}

export type ExportFormat = 'json' | 'csv' | 'txt';

// ---------- export ----------

export function exportJson(lib: Library, now = new Date()): string {
  return JSON.stringify(
    {
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      categories: lib.categories,
      tags: lib.tags,
      bookmarks: lib.bookmarks,
    },
    null,
    1,
  );
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_COLUMNS = ['url', 'type', 'title', 'channel', 'description', 'category', 'tags', 'watched', 'added', 'notes'];

export function exportCsv(lib: Library): string {
  const cat = new Map(lib.categories.map((c) => [c.id, c.name]));
  const tag = new Map(lib.tags.map((t) => [t.id, t.name]));
  const rows = lib.bookmarks.map((b) => [
    b.url, b.type, b.title, b.channelName, b.description, b.categoryId ? cat.get(b.categoryId) ?? '' : '',
    b.tagIds.map((t) => tag.get(t)).filter(Boolean).join(';'), b.watched ? 'yes' : 'no', b.createdAt, b.notes,
  ]);
  return [CSV_COLUMNS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function exportTxt(lib: Library): string {
  return lib.bookmarks.map((b) => b.url).join('\n') + '\n';
}

// ---------- import ----------

function fromUrl(url: string): Pick<ImportItem, 'url' | 'type' | 'youtubeId' | 'dedupeKey'> | null {
  const p = parseYouTubeUrl(url);
  return p && { url: p.url, type: p.type, youtubeId: p.youtubeId, dedupeKey: p.dedupeKey };
}

function finish(items: (ImportItem | null)[]): ParsedImport {
  const seen = new Map<string, ImportItem>();
  let invalid = 0;
  let repeated = 0;
  for (const it of items) {
    if (!it) invalid++;
    else if (seen.has(it.dedupeKey)) {
      repeated++;
      const first = seen.get(it.dedupeKey)!;
      first.watched = first.watched || it.watched;
    } else seen.set(it.dedupeKey, it);
  }
  return { items: [...seen.values()], invalid, repeated };
}

function validDate(s: unknown): string | undefined {
  if (typeof s === 'number') return new Date(s).toISOString();
  if (typeof s === 'string' && !Number.isNaN(Date.parse(s))) return new Date(s).toISOString();
  return undefined;
}

export function parseJsonBackup(text: string): ParsedImport {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.bookmarks)) throw new Error('This file is not a TubeMarks backup (no "bookmarks" list).');
  if (typeof data.version === 'number' && data.version > BACKUP_VERSION) {
    throw new Error(`This backup was made by a newer version of TubeMarks (format ${data.version}).`);
  }
  const cat = new Map<string, string>((data.categories ?? []).map((c: any) => [c.id, c.name]));
  const tag = new Map<string, string>((data.tags ?? []).map((t: any) => [t.id, t.name]));
  return finish(
    data.bookmarks.map((b: Partial<Bookmark> & Record<string, any>): ImportItem | null => {
      const base = typeof b.url === 'string' ? fromUrl(b.url) : null;
      if (!base) return null;
      return {
        ...base,
        title: b.title || undefined,
        description: b.description || undefined,
        thumbnailUrl: b.thumbnailUrl || undefined,
        channelName: b.channelName || undefined,
        categoryName: b.categoryId ? cat.get(b.categoryId) ?? null : null,
        tagNames: (b.tagIds ?? []).map((t: string) => tag.get(t)).filter(Boolean) as string[],
        durationSec: b.durationSec ?? null,
        publishedAt: b.publishedAt ?? null,
        viewCount: b.viewCount ?? null,
        itemCount: b.itemCount ?? null,
        notes: b.notes || undefined,
        watched: !!b.watched,
        createdAt: validDate(b.createdAt),
      };
    }),
  );
}

/** Minimal RFC 4180 parser: quoted cells, doubled quotes, CRLF or LF. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function parseCsv(text: string): ParsedImport {
  const rows = parseCsvRows(text.replace(/^﻿/, ''));
  if (!rows.length) return { items: [], invalid: 0, repeated: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string, ...alts: string[]) => [name, ...alts].map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iUrl = col('url', 'link');
  if (iUrl < 0) throw new Error('The CSV needs a "url" column.');
  const [iTitle, iChannel, iDesc, iCat, iTags, iWatched, iAdded, iNotes] = [
    col('title'), col('channel'), col('description'), col('category'), col('tags'), col('watched'), col('added', 'date added', 'createdat'), col('notes'),
  ];
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
  return finish(
    rows.slice(1).map((r): ImportItem | null => {
      const base = fromUrl(get(r, iUrl));
      if (!base) return null;
      return {
        ...base,
        title: get(r, iTitle) || undefined,
        channelName: get(r, iChannel) || undefined,
        description: get(r, iDesc) || undefined,
        categoryName: get(r, iCat) || null,
        tagNames: get(r, iTags).split(';').map((t) => t.trim()).filter(Boolean),
        watched: /^(yes|true|1)$/i.test(get(r, iWatched)),
        createdAt: validDate(get(r, iAdded)),
        notes: get(r, iNotes) || undefined,
      };
    }),
  );
}

/** Plain text or browser-bookmarks HTML: every link in it. */
export function parseLinks(text: string): ParsedImport {
  const found = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? text.split(/\s+/).filter(Boolean);
  return finish(found.map((u) => fromUrl(u.replace(/&amp;/g, '&'))));
}

export function parseImportFile(name: string, text: string): ParsedImport {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return parseJsonBackup(text);
  if (lower.endsWith('.csv')) return parseCsv(text);
  return parseLinks(text);
}
