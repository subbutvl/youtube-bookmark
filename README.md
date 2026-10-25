# TubeMarks: YouTube bookmark manager

A desktop app (Windows, macOS, Linux) for saving YouTube links. Paste a video, Short, playlist or channel link and TubeMarks sorts it by type, fetches its title, thumbnail, one-line description, category and tags from the YouTube Data API, and shows everything in a searchable card grid. Clicking a card opens it in your web browser.

Built with [Tauri 2](https://tauri.app), React and TypeScript. Your library is a local SQLite database; nothing is sent anywhere except the metadata lookups to YouTube.

## Features

- Add, edit and delete links; paste many at once
- Automatic grouping: Videos, Shorts, Playlists, Channels
- Title, thumbnail, 1-line description, category and tags from YouTube (Data API v3)
- Add, rename, recolor, merge and delete categories and tags
- Card grid: 5 cards per row at 1200 px, 6 at 1440 px; compact mode fits more
- Search (title, channel, description, category, tags, notes), sort and filter
- History: when each link was added, grouped by day
- Watched / unwatched, toggled by hand (eye button on each card)
- Duplicates are never stored: `youtu.be/ID`, `watch?v=ID&t=2s`, `?si=…`, `/@name/videos` and so on all count as the same bookmark
- Import / export: full JSON backup, CSV, or plain list of links
- Light, dark and system themes

## Run it

You need [Node.js](https://nodejs.org) 20+ and Rust, plus Tauri's system prerequisites. On Windows that's the "Desktop development with C++" workload from Visual Studio Build Tools and WebView2 (already on Windows 10/11). Full list: <https://tauri.app/start/prerequisites/>.

```bash
npm install
npm run tauri dev      # opens the app with hot reload
npm run tauri build    # makes an installer in src-tauri/target/release/bundle/
```

`npm run dev` alone opens a browser preview that keeps data in the browser instead of SQLite. It's handy for UI work.

## YouTube API key

Without a key, bookmarks show only their thumbnail and link. To fetch titles, descriptions, categories and tags, open **Settings** in the app and paste a YouTube Data API v3 key. It's checked with YouTube and saved in the app's local database.

For development you can instead put it in `.env.local` (git-ignored):

```bash
cp .env.example .env.local
# then set VITE_YOUTUBE_API_KEY=...
```

Never commit the key. Restrict it to the YouTube Data API v3 in Google Cloud Console. A lookup costs 1 quota unit per 50 videos or playlists and 1 per channel, so the free 10,000 units a day cover thousands of bookmarks.

## Moving bookmarks from the old app

Use **Import / Export → Choose file** with the converted `*.ytbm.json` file and pick **Merge with my library**. Titles, thumbnails, categories and tags are fetched from YouTube right after the import. Duplicates are skipped and counted.

## Project layout

```
src/
  lib/youtube-url.ts   URL → type, id and duplicate key
  lib/youtube-api.ts   YouTube Data API v3 client (batched)
  lib/library.ts       all library operations (add, dedupe, edit, tags, import)
  lib/storage.ts       SQLite (desktop) and in-memory (browser/tests) storage
  lib/backup.ts        JSON / CSV / text import and export
  lib/view.ts          search, sort, filter and History grouping
  components/          cards and dialogs
src-tauri/
  migrations/          SQLite schema
  src/lib.rs           Tauri setup, plugins, file read/write commands
```

```bash
npm test               # unit tests
```

Where the data lives: the database file `tubemarks.db` is in the app's data folder (on Windows, `%APPDATA%\com.subbutvl.tubemarks\`).
