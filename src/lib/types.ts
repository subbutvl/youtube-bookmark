export type BookmarkType = 'video' | 'short' | 'playlist' | 'channel';
export type MetadataStatus = 'pending' | 'ok' | 'partial' | 'failed';

export interface Bookmark {
  id: string;
  url: string;
  type: BookmarkType;
  youtubeId: string;
  /** `${type}:${normalized id}`; unique, so a link can never be stored twice. */
  dedupeKey: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelName: string;
  /** Link to the uploader's channel (for a channel bookmark, the channel itself). */
  channelUrl: string;
  categoryId: string | null;
  tagIds: string[];
  durationSec: number | null;
  publishedAt: string | null;
  viewCount: number | null;
  itemCount: number | null;
  notes: string;
  watched: boolean;
  createdAt: string;
  updatedAt: string;
  metadataStatus: MetadataStatus;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Library {
  bookmarks: Bookmark[];
  categories: Category[];
  tags: Tag[];
}

export const TYPE_LABELS: Record<BookmarkType, string> = {
  video: 'Video',
  short: 'Short',
  playlist: 'Playlist',
  channel: 'Channel',
};

export const TYPE_PLURALS: Record<BookmarkType, string> = {
  video: 'Videos',
  short: 'Shorts',
  playlist: 'Playlists',
  channel: 'Channels',
};

export const CATEGORY_COLORS = [
  '#C27A2C', '#3B6FE0', '#5E8C4A', '#7A55C7', '#B5466B',
  '#2B8A8A', '#A0632F', '#5A6ACF', '#8A8F2E', '#C24F3D',
];
