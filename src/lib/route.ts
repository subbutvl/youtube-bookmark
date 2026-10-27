import { parseLink } from './link-url';
import { parseYouTubeUrl, splitUrls } from './youtube-url';

/** Sorts pasted links by library: YouTube links to the YouTube library, every other web link to Links. */
export function routeUrls(text: string): { youtube: string[]; links: string[]; invalid: string[] } {
  const out = { youtube: [] as string[], links: [] as string[], invalid: [] as string[] };
  for (const raw of splitUrls(text)) {
    if (parseYouTubeUrl(raw)) out.youtube.push(raw);
    else if (parseLink(raw)) out.links.push(raw);
    else out.invalid.push(raw);
  }
  return out;
}
