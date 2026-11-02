import { firstLine } from './youtube-api';

export interface PageMeta {
  title: string;
  description: string;
  imageUrl: string;
  faviconUrl: string;
  siteName: string;
  /** From <meta name="keywords">, lowercased and hyphenated like YouTube tags. */
  keywords: string[];
}

/** Most keywords turned into tags, matching the YouTube side. */
export const MAX_PAGE_TAGS = 5;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return out;
}

function absolute(href: string, base: string): string {
  if (!href) return '';
  try {
    const u = new URL(decode(href), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

/** Reads title, description, preview image, favicon, site name and keywords from a page's HTML. */
export function parsePageMeta(html: string, pageUrl: string): PageMeta {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || html.length);
  const meta: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && !(key in meta)) meta[key] = decode(a.content);
  }
  let favicon = '';
  let bestRank = 0;
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const rel = (a.rel || '').toLowerCase();
    // Prefer a large touch icon, then a plain icon.
    const rank = rel.includes('apple-touch-icon') ? 3 : /(^|\s)icon(\s|$)/.test(rel) ? (a.sizes && parseInt(a.sizes, 10) >= 32 ? 2 : 1) : 0;
    if (rank > bestRank && a.href) {
      const href = absolute(a.href, pageUrl);
      if (href) {
        favicon = href;
        bestRank = rank;
      }
    }
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const keywords = (meta.keywords ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase().replace(/\s+/g, '-'))
    .filter((k, i, all) => k && k.length <= 30 && all.indexOf(k) === i)
    .slice(0, MAX_PAGE_TAGS);
  let origin = '';
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    // leave empty
  }
  return {
    title: (meta['og:title'] || meta['twitter:title'] || (titleTag ? decode(titleTag) : '')).slice(0, 300),
    description: firstLine(meta['og:description'] || meta.description || meta['twitter:description'] || ''),
    imageUrl: absolute(meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'] || '', pageUrl),
    faviconUrl: favicon || (origin ? `${origin}/favicon.ico` : ''),
    siteName: meta['og:site_name'] || meta['application-name'] || '',
    keywords,
  };
}
