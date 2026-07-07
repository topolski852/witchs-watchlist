# The Witch's Watchlist 🌙

A personal anime-tracking PWA, built to replace TV Time. Single-user, no
accounts, no backend — everything lives in your browser's IndexedDB, with
AniList used only as a metadata lookup.

See [witchs-watchlist-prompt.md](witchs-watchlist-prompt.md) for the full spec.

## Development

```bash
npm install
npm run dev
```

## Data safety

- All watch data lives in IndexedDB, versioned (`schemaVersion`) so future
  updates can migrate it instead of wiping it.
- Export to JSON / Import from JSON is on the **Data** tab — use it often.
- The app also keeps the last 3 export snapshots automatically (rotated on
  every export or import) as a local safety net.
- The `TVTime Data/` export folder and any `*backup*.json` files are
  git-ignored on purpose — that's personal watch history and should never
  end up in this (or any) repo.

## Deploying

Pushing to `main` builds and deploys to GitHub Pages via
`.github/workflows/deploy.yml`. The Vite `base` path assumes the repo is
named `witchs-watchlist`; override with the `VITE_BASE_PATH` env var if it's
ever renamed.
