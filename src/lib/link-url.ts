/** Query parameters that only track where a click came from; dropped before saving. */
const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|mkt_tok|ref_src|ref_url|si|spm|share_source|vero_id)$/i;

export interface ParsedLink {
  /** The URL to save and open: the input minus tracking parameters. */
  url: string;
  /** Normalized form used to spot duplicates. */
  dedupeKey: string;
  /** Host without www. */
  domain: string;
}

/**
 * Parses a web link. Accepts bare hosts ("example.com/page") by assuming https.
 * Returns null for anything that isn't an http(s) URL with a dotted host.
 */
export function parseLink(input: string): ParsedLink | null {
  let raw = input.trim().replace(/^<|>$/g, '');
  if (!raw) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    if (!/^[\w-]+(\.[\w-]+)+([/:?#]|$)/.test(raw)) return null;
    raw = `https://${raw}`;
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  const url = u.toString();

  const domain = u.hostname.toLowerCase().replace(/^www\./, '');
  const params = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  const port = u.port ? `:${u.port}` : '';
  let path = u.pathname.replace(/\/+$/, '').replace(/\/index\.(html?|php)$/i, '');
  if (!path) path = '';
  return { url, dedupeKey: `${domain}${port}${path}${query}`, domain };
}

/** Looser key for "Find duplicates": the same page with any query string. */
export function nearKey(dedupeKey: string): string {
  return dedupeKey.replace(/\?.*$/, '').toLowerCase();
}

/** Google's favicon service, used until (or when) the page's own icon isn't known. */
export function fallbackFavicon(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
