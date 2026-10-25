import { describe, expect, it } from 'vitest';
import { firstLine, parseDuration, YouTubeApi, YouTubeApiError } from './youtube-api';

function fakeFetch(routes: Record<string, (params: URLSearchParams) => unknown>, calls: string[] = []) {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const name = url.pathname.split('/').pop()!;
    calls.push(`${name}?${url.searchParams}`);
    const body = routes[name]?.(url.searchParams);
    if (body === undefined) return new Response(JSON.stringify({ error: { message: 'nope' } }), { status: 404 });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

describe('helpers', () => {
  it('parses ISO durations', () => {
    expect(parseDuration('PT12M48S')).toBe(768);
    expect(parseDuration('PT1H')).toBe(3600);
    expect(parseDuration('P1DT2S')).toBe(86402);
    expect(parseDuration(undefined)).toBeNull();
  });
  it('keeps only the first non-empty line of a description', () => {
    expect(firstLine('\n  Hello world  \nmore')).toBe('Hello world');
    expect(firstLine('x'.repeat(200)).length).toBe(140);
  });
});

describe('YouTubeApi.fetchMany', () => {
  it('batches videos, maps categories and trims tags', async () => {
    const calls: string[] = [];
    const api = new YouTubeApi('KEY', fakeFetch({
      videos: (p) => ({
        items: p.get('id')!.split(',').map((id) => ({
          id,
          snippet: {
            title: `Title ${id}`,
            description: 'Line one\nLine two',
            channelTitle: 'Chan',
            channelId: 'UCchan',
            categoryId: '27',
            tags: ['Claude Code', 'AI', 'ai', 'one', 'two', 'three', 'four'],
            thumbnails: { high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
            publishedAt: '2026-01-01T00:00:00Z',
          },
          contentDetails: { duration: 'PT4M5S' },
          statistics: { viewCount: '1234' },
        })),
      }),
      videoCategories: () => ({ items: [{ id: '27', snippet: { title: 'Education' } }] }),
      playlists: () => ({ items: [{ id: 'PL1', snippet: { title: 'List', channelTitle: 'Chan', thumbnails: {} }, contentDetails: { itemCount: 24 } }] }),
      channels: (p) => (p.get('forHandle') === '@known' ? { items: [{ snippet: { title: 'Known', customUrl: '@known', thumbnails: { default: { url: 'u' } } }, statistics: { videoCount: '10' } }] } : { items: [] }),
    }, calls));

    const ids = Array.from({ length: 60 }, (_, i) => `vid${String(i).padStart(8, '0')}`);
    const res = await api.fetchMany([
      ...ids.map((youtubeId) => ({ type: 'video' as const, youtubeId })),
      { type: 'playlist', youtubeId: 'PL1' },
      { type: 'channel', youtubeId: '@known' },
      { type: 'channel', youtubeId: '@unknown' },
    ]);

    expect(calls.filter((c) => c.startsWith('videos?'))).toHaveLength(2); // 50 + 10
    expect(calls.filter((c) => c.startsWith('videoCategories?'))).toHaveLength(1);
    const v = res.get(`video:${ids[0]}`)!;
    expect(v).toMatchObject({ title: `Title ${ids[0]}`, description: 'Line one', categoryName: 'Education', durationSec: 245, viewCount: 1234 });
    expect(v.channelUrl).toBe('https://www.youtube.com/channel/UCchan');
    expect(res.get('channel:@known')?.channelUrl).toBe('https://www.youtube.com/@known');
    expect(v.tags).toEqual(['claude-code', 'ai', 'one', 'two', 'three']);
    expect(res.get('playlist:PL1')?.itemCount).toBe(24);
    expect(res.get('channel:@known')?.title).toBe('Known');
    expect(res.has('channel:@unknown')).toBe(false);
  });

  it('surfaces API errors with their reason', async () => {
    const api = new YouTubeApi('BAD', (async () =>
      new Response(JSON.stringify({ error: { message: 'API key not valid', errors: [{ reason: 'badRequest' }] } }), { status: 400 })) as typeof fetch);
    await expect(api.verifyKey()).rejects.toBeInstanceOf(YouTubeApiError);
  });
});
