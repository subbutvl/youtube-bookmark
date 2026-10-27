/** Reading RSS 2.0, RSS 1.0 (RDF) and Atom feeds, and finding a site's feeds from its page. */

export interface FeedItem {
  /** The item's guid or id, else its link. */
  guid: string;
  title: string;
  url: string;
  summary: string;
  author: string;
  publishedAt: string | null;
  imageUrl: string;
}

export interface ParsedFeed {
  title: string;
  siteUrl: string;
  description: string;
  items: FeedItem[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function safeChar(n: number): string {
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

/** Element text: CDATA unwrapped, entities decoded. HTML inside stays as markup. */
function text(raw: string | undefined): string {
  if (!raw) return '';
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c) => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  s = decode(s);
  return s.trim();
}

/** Markup to plain text, for titles and summaries. */
export function plain(html: string, max = 400): string {
  const s = decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? '');
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Inner XML of the first element named one of `names` (prefixes as written, e.g. "dc:creator"). */
function child(xml: string, ...names: string[]): string | undefined {
  for (const n of names) {
    const m = xml.match(new RegExp(`<${esc(n)}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${esc(n)}>)`, 'i'));
    if (m) return m[1] ?? '';
  }
  return undefined;
}

/** Opening tags (with attributes) of every element named `name`. */
function tags(xml: string, name: string): Record<string, string>[] {
  return [...xml.matchAll(new RegExp(`<${esc(name)}\\s[^>]*>`, 'gi'))].map((m) => attrs(m[0]));
}

function blocks(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${esc(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc(name)}>`, 'gi'))].map((m) => m[1]);
}

function absolute(href: string, base: string): string {
  if (!href) return '';
  try {
    const u = new URL(href.trim(), base || undefined);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function date(s: string): string | null {
  if (!s) return null;
  const t = Date.parse(s.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function firstImage(html: string, base: string): string {
  const m = html.match(/<img\s[^>]*>/i);
  return m ? absolute(attrs(m[0]).src ?? '', base) : '';
}

function atomLink(xml: string, base: string): string {
  const links = tags(xml, 'link');
  const alt = links.find((l) => !l.rel || l.rel === 'alternate') ?? links[0];
  return absolute(alt?.href ?? '', base);
}

/** True when the text looks like a feed rather than a web page. */
export function looksLikeFeed(body: string): boolean {
  const head = body.slice(0, 2000);
  return /<(rss|feed|rdf:RDF)[\s>]/i.test(head);
}

/** Parses a feed. Throws when the text isn't RSS or Atom. */
export function parseFeed(xml: string, feedUrl: string): ParsedFeed {
  const body = xml.replace(/<!--[\s\S]*?-->/g, '');
  if (/<feed[\s>]/i.test(body.slice(0, 2000))) {
    const head = body.split(/<entry[\s>]/i)[0];
    const siteUrl = atomLink(head, feedUrl);
    const items = blocks(body, 'entry').map((e): FeedItem => {
      const url = atomLink(e, siteUrl || feedUrl);
      const content = text(child(e, 'content') ?? '');
      const summary = text(child(e, 'summary', 'media:description') ?? '') || content;
      const thumb = tags(e, 'media:thumbnail')[0]?.url ?? '';
      return {
        guid: text(child(e, 'id')) || url,
        title: plain(text(child(e, 'title')), 300),
        url,
        summary: plain(summary),
        author: plain(text(child(child(e, 'author') ?? '', 'name')), 100),
        publishedAt: date(text(child(e, 'published', 'updated'))),
        imageUrl: absolute(thumb, url) || firstImage(content || summary, url),
      };
    });
    return { title: plain(text(child(head, 'title')), 200), siteUrl, description: plain(text(child(head, 'subtitle')), 300), items };
  }
  if (/<(rss|rdf:RDF)[\s>]/i.test(body.slice(0, 2000))) {
    const channel = child(body, 'channel') ?? body;
    const head = channel.split(/<item[\s>]/i)[0];
    const siteUrl = absolute(text(child(head, 'link')), feedUrl);
    const items = blocks(body, 'item').map((it): FeedItem => {
      const url = absolute(text(child(it, 'link')), siteUrl || feedUrl) || absolute(text(child(it, 'guid')), feedUrl);
      const content = text(child(it, 'content:encoded') ?? '');
      const desc = text(child(it, 'description') ?? '') || content;
      const media = tags(it, 'media:thumbnail')[0]?.url || tags(it, 'media:content').find((m) => !m.medium || m.medium === 'image')?.url || '';
      const enclosure = tags(it, 'enclosure').find((e) => (e.type ?? '').startsWith('image/'))?.url ?? '';
      return {
        guid: text(child(it, 'guid')) || url || plain(text(child(it, 'title')), 300),
        title: plain(text(child(it, 'title')), 300),
        url,
        summary: plain(desc),
        author: plain(text(child(it, 'dc:creator', 'author')), 100),
        publishedAt: date(text(child(it, 'pubDate', 'dc:date'))),
        imageUrl: absolute(media || enclosure, url) || firstImage(content || desc, url),
      };
    });
    return { title: plain(text(child(head, 'title')), 200), siteUrl, description: plain(text(child(head, 'description')), 300), items };
  }
  throw new Error('This isn’t an RSS or Atom feed.');
}

/** Feeds a web page points to with <link rel="alternate">, best first. */
export function discoverFeeds(html: string, pageUrl: string): string[] {
  const head = html.split(/<\/head>/i)[0];
  const found: string[] = [];
  for (const m of head.matchAll(/<link\s[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (!/alternate/i.test(a.rel ?? '')) continue;
    if (!/(rss|atom|feed)\+xml|application\/xml|text\/xml/i.test(a.type ?? '')) continue;
    const url = absolute(a.href ?? '', pageUrl);
    if (url && !found.includes(url) && !/comments/i.test(a.title ?? '')) found.push(url);
  }
  return found;
}

/** Usual feed addresses to try when a page doesn't name one. */
export function guessFeedUrls(pageUrl: string): string[] {
  try {
    const u = new URL(pageUrl);
    return ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml'].map((p) => new URL(p, u.origin).toString());
  } catch {
    return [];
  }
}

export interface OpmlFeed {
  url: string;
  title: string;
  siteUrl: string;
  folder: string;
}

/** Feeds listed in an OPML file (the format other readers export). */
export function parseOpml(xml: string): OpmlFeed[] {
  const out: OpmlFeed[] = [];
  const folders: string[] = [];
  for (const m of xml.matchAll(/<outline\b[^>]*?(\/?)>|<\/outline>/gi)) {
    if (m[0].startsWith('</')) {
      folders.pop();
      continue;
    }
    const a = attrs(m[0]);
    const url = a.xmlurl ?? '';
    if (url) out.push({ url, title: a.title || a.text || '', siteUrl: a.htmlurl ?? '', folder: folders.filter(Boolean).join(' / ') });
    else if (!m[1]) folders.push(a.title || a.text || '');
    if (url && !m[1]) folders.push('');
  }
  return out;
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toOpml(feeds: OpmlFeed[]): string {
  const byFolder = new Map<string, OpmlFeed[]>();
  for (const f of feeds) byFolder.set(f.folder, [...(byFolder.get(f.folder) ?? []), f]);
  const line = (f: OpmlFeed, pad: string) => `${pad}<outline type="rss" text="${xmlEsc(f.title)}" title="${xmlEsc(f.title)}" xmlUrl="${xmlEsc(f.url)}"${f.siteUrl ? ` htmlUrl="${xmlEsc(f.siteUrl)}"` : ''}/>`;
  const body: string[] = [];
  for (const [folder, list] of byFolder) {
    if (!folder) body.push(...list.map((f) => line(f, '    ')));
    else body.push(`    <outline text="${xmlEsc(folder)}" title="${xmlEsc(folder)}">`, ...list.map((f) => line(f, '      ')), '    </outline>');
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>TubeMarks feeds</title></head>\n  <body>\n${body.join('\n')}\n  </body>\n</opml>\n`;
}
