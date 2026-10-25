import { describe, expect, it } from 'vitest';
import { parseYouTubeUrl, splitUrls } from './youtube-url';

describe('parseYouTubeUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=_0xa6RVqTC8', 'video', '_0xa6RVqTC8', 'https://www.youtube.com/watch?v=_0xa6RVqTC8'],
    ['https://youtu.be/QcCTQ0pyjME?si=W088vpZLHJXr0MCe', 'video', 'QcCTQ0pyjME', 'https://www.youtube.com/watch?v=QcCTQ0pyjME'],
    ['youtube.com/watch?v=2bFF8yd-G00&t=2s', 'video', '2bFF8yd-G00', 'https://www.youtube.com/watch?v=2bFF8yd-G00&t=2s'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 'video', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ?si=x', 'video', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/abcdefghijk?feature=share', 'short', 'abcdefghijk', 'https://www.youtube.com/shorts/abcdefghijk'],
    ['https://www.youtube.com/playlist?list=PLabc123', 'playlist', 'PLabc123', 'https://www.youtube.com/playlist?list=PLabc123'],
    ['https://www.youtube.com/@appliedwithai/videos', 'channel', '@appliedwithai', 'https://www.youtube.com/@appliedwithai'],
    ['https://www.youtube.com/channel/UCabcdefghijklmnop', 'channel', 'UCabcdefghijklmnop', 'https://www.youtube.com/channel/UCabcdefghijklmnop'],
    ['https://www.youtube.com/c/SomeName', 'channel', 'c/SomeName', 'https://www.youtube.com/c/SomeName'],
  ])('%s → %s', (input, type, id, url) => {
    const p = parseYouTubeUrl(input);
    expect(p).toMatchObject({ type, youtubeId: id, url });
  });

  it('treats different forms of one video as the same bookmark', () => {
    const keys = [
      'https://youtu.be/QcCTQ0pyjME?si=abc',
      'https://www.youtube.com/watch?v=QcCTQ0pyjME',
      'https://www.youtube.com/watch?v=QcCTQ0pyjME&list=TLPQMDIwMzIwMjbVGyiQu_fjuA&index=6',
      'https://www.youtube.com/watch?v=QcCTQ0pyjME&t=2s',
    ].map((u) => parseYouTubeUrl(u)?.dedupeKey);
    expect(new Set(keys)).toEqual(new Set(['video:QcCTQ0pyjME']));
  });

  it('treats channel handles case-insensitively and ignores tabs', () => {
    const a = parseYouTubeUrl('https://www.youtube.com/@AppliedWithAI/featured');
    const b = parseYouTubeUrl('https://www.youtube.com/@appliedwithai');
    expect(a?.dedupeKey).toBe(b?.dedupeKey);
  });

  it('keeps a real playlist id from a watch URL but ignores temporary queues', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz')?.playlistId).toBe('PLxyz');
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=TLPQabc')?.playlistId).toBeUndefined();
  });

  it.each(['', 'hello', 'https://vimeo.com/123', 'https://www.youtube.com/', 'https://www.youtube.com/watch?v=short'])(
    'rejects %j',
    (input) => expect(parseYouTubeUrl(input)).toBeNull(),
  );
});

describe('splitUrls', () => {
  it('splits on lines, spaces and commas', () => {
    expect(splitUrls('a\nb  c,d\n\n')).toEqual(['a', 'b', 'c', 'd']);
  });
});
