# Watchlog

Personal anime/anime movie/movie/series tracker with poster search, cross-device sync via
Neon Postgres, and a simple passcode gate. This is its own separate project — its own repo,
its own Vercel deployment, its own Neon database.

## 1. Create the Neon database

1. Sign up at https://neon.tech (free tier is enough).
2. Create a new project, e.g. `watchlog`.
3. Open the SQL editor in the Neon console and run everything in `schema.sql`.
4. Copy the connection string (starts with `postgresql://...`).

## 2. Get a free TMDB API key (for movie/series posters)

1. Sign up at https://www.themoviedb.org/signup.
2. Go to Settings > API, request a free "Developer" API key (approved instantly for
   personal use).
3. Copy the API key (the "API Key (v3 auth)" value, not the read access token).

Anime posters come from Jikan (MyAnimeList's public API) and need no key or signup.

## 3. Choose a passcode (optional but recommended)

Since the site is a public URL synced through a shared database, set `WATCHLOG_PASSCODE`
to any password you like. Only requests with the matching passcode can add, edit, or
delete entries — the page itself still loads and is viewable without it. If you leave
this env var unset entirely, editing is open to anyone with the link.

## 4. Local setup (optional, to test before deploying)

```bash
cp .env.example .env.local
# fill in your real values in .env.local
npm install
npm run dev
```

Visit http://localhost:3000. Click "Unlock editing" and enter your passcode once — it's
remembered in your browser after that.

## 5. Deploy to Vercel

1. Push this folder to a new GitHub repo.
2. In Vercel, "Add New Project" and import that repo.
3. In Settings > Environment Variables, add all three:
   - `DATABASE_URL`
   - `TMDB_API_KEY`
   - `WATCHLOG_PASSCODE`
4. Deploy. Vercel auto-detects the Next.js app, no extra config needed.

## How it works

- Type a title into the search bar and pick the right match from the poster results —
  title, poster, and (for anime) total episode count are filled in automatically.
- Anime and series get an episode counter; movies and anime movies just move through
  want to watch / watching / completed.
- The "Continue watching" strip at the top always shows what's currently in progress,
  most recently updated first — that's the quick answer to "where was I?"
- Data lives in Neon, so it's the same list on your phone, laptop, wherever you're
  signed in with the passcode.

## Notes

- Jikan (the anime API) is free with no key but is rate-limited to a few requests per
  second — fine for normal use, but don't machine-gun the search box.
- If TMDB_API_KEY is missing, anime search still works; movie/series search will return
  an error until it's set.
