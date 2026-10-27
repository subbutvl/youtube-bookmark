import type { Category, MetadataStatus, Tag } from './types';

/** Manual flags a link can carry, in any combination. */
export type LinkFlag = 'trending' | 'later' | 'must';
export const LINK_FLAGS: LinkFlag[] = ['trending', 'later', 'must'];
export const FLAG_LABELS: Record<LinkFlag, string> = { trending: 'Trending', later: 'Later', must: 'Must' };

/** The tabs that hold web links. Each link belongs to one, decided by its site when saved. */
export type LinkSection = 'links' | 'git' | 'wiki';
export const SECTION_LABELS: Record<LinkSection, string> = { links: 'Links', git: 'Git', wiki: 'Wikipedia' };

const GIT_HOSTS = new Set(['github.com', 'gist.github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org', 'sourceforge.net', 'git.sr.ht']);

/** Which tab a link from this site belongs in. */
export function sectionFor(domain: string): LinkSection {
  if (GIT_HOSTS.has(domain)) return 'git';
  if (domain === 'wikipedia.org' || domain.endsWith('.wikipedia.org')) return 'wiki';
  return 'links';
}

/** Most links pinned to the quick launch bar. */
export const QUICK_LAUNCH_MAX = 15;

export interface Link {
  id: string;
  /** As saved, minus tracking parameters. */
  url: string;
  /** Normalized URL; unique, so a page can never be stored twice. */
  dedupeKey: string;
  /** Host without www, e.g. github.com. */
  domain: string;
  title: string;
  description: string;
  faviconUrl: string;
  imageUrl: string;
  siteName: string;
  categoryId: string | null;
  tagIds: string[];
  notes: string;
  /** Set the first time the link is opened; can be toggled by hand. A link that was never opened counts as New. */
  viewed: boolean;
  flags: LinkFlag[];
  openCount: number;
  lastOpenedAt: string | null;
  /** Position in the quick launch bar, or null when not pinned. */
  quickLaunch: number | null;
  createdAt: string;
  updatedAt: string;
  metadataStatus: MetadataStatus;
  section: LinkSection;
  /** A group the user made by hand, shown like a site group; null when not grouped. */
  groupName: string | null;
}

export interface LinkLibrary {
  links: Link[];
  categories: Category[];
  tags: Tag[];
}

/** A link counts as New until it is first opened. */
export const isNew = (l: Link) => l.openCount === 0 && !l.viewed;
