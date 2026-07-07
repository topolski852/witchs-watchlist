# Claude Code Prompt: "The Witch's Watchlist"

Copy everything below into Claude Code as your project prompt.

---

## Project Overview

Build a personal anime tracking Progressive Web App (PWA) called **"The Witch's Watchlist"**. This replaces TV Time (shutting down), is used by a single person (me), and needs to run well on a **Samsung Galaxy Z Flip 7** (foldable phone — narrow cover-screen mode AND unfolded mode should both be usable, so responsive design matters).

This is NOT a multi-user app. No login, no accounts, no social features, no recommendations. Just me, tracking anime I watch.

## Core Data Priority — READ THIS FIRST

**The watched data is the single most important part of this app.** I have ~12,000 episodes of watch history. Data loss is unacceptable.

Requirements:
1. All user data (watch history, statuses, rewatch counts, custom lists) must be stored **separately from app code/logic** — e.g., in a dedicated local database (IndexedDB) or exported/imported JSON file, never hardcoded or tied to a specific app version.
2. Include a **versioned data schema** (e.g., `{ "schemaVersion": 1, "data": {...} }`) so future app updates can migrate old data forward without breaking or wiping it.
3. Build an **Export to JSON** and **Import from JSON** feature from day one, so I can back up my data manually anytime, move it between devices, or recover it if something goes wrong.
4. Never perform destructive operations (delete/overwrite) on stored data without an explicit confirmation step.
5. Consider automatic local backups (e.g., keep last 3 export snapshots in storage) as a safety net.

## Data Source: AniList API

Use the **AniList GraphQL API** (https://anilist.co/graphiql, endpoint `https://graphql.anilist.co`, free, no API key required) for:
- Anime search (title, cover image URL, format, status)
- Episode count
- Average episode duration (minutes)
- Cover art (stored as a URL reference only — never download/store the actual image binary, to keep storage tiny)

Allow me to **override the cover art** with a custom image URL per entry (simple text field, not an upload) — this replicates TV Time's "change cover art" feature without needing image storage.

## Watch Status Categories

Each anime in my list needs one of these statuses (custom to how I actually watch, not the generic MAL/AniList defaults):
- **Watching** — actively watching, not caught up
- **Caught Up** — ongoing show, but I'm current with all released episodes
- **Completed** — finished the full series
- **Stopped** — I dropped/stopped watching partway through
- **Plan to Watch** — on my list, haven't started

## Episode & Rewatch Tracking

- Episode-level checkboxes/list per anime (mark individual episodes watched)
- **Rewatch count at both the show level and the episode level** — I need to know how many times I've rewatched a whole series, and be able to track rewatches of individual episodes too
- Support partial rewatches (e.g., rewatching only certain episodes, not the whole show)

## Watch Time Calculation

Calculate total time spent watching anime using: `episodes watched × average episode runtime` (from AniList data).

**Critical distinction (TV Time didn't do this):** Track and display watch time in two separate buckets:
- **New watch time** — time from first-time watches
- **Rewatch time** — time from rewatches

Show both individually and as a combined total, so I can see how much of my total hours came from rewatching vs. new content.

## TV Time Data Migration

I need to pull my existing watch history out of TV Time and into this app before it shuts down. Since TV Time doesn't have a documented public export API, help me:
1. Figure out the best available method to extract my data before the shutdown (options may include: TV Time's own export/settings feature if one exists, scraping my profile/watch history page, or requesting a personal data export if TV Time offers one under GDPR/CCPA-style requests).
2. Write an import script/parser that maps whatever TV Time export format I obtain into this app's schema (matching shows to AniList IDs where possible, since titles may not match exactly).
3. Flag any shows that can't be automatically matched to an AniList entry so I can manually resolve them.

**Do this step early** — TV Time shuts down on the 15th, so the data extraction is time-sensitive and should be prioritized before other polish work.

## Custom Lists

Support user-created custom lists, separate from watch-status tracking, e.g.:
- Favorite Shows
- Favorite Movies

These lists should support **both anime and non-anime entries** (e.g., RWBY, A Silent Voice, Your Name) since some favorites won't be in the anime-only tracking system. For non-AniList entries, allow manual entry (title + optional custom cover URL) since they won't come from the AniList API.

## Platform / Device Notes

- Must work well as an installable PWA (add to home screen) on Android, optimized for the **Samsung Galaxy Z Flip 7** — test/design for both the small cover screen aspect ratio and the larger unfolded/main screen.
- No app store distribution needed — sideloaded/PWA is fine.
- Offline-first is nice-to-have but not required, since data is stored locally anyway.

## Explicitly Out of Scope

- No recommendations engine
- No social features, reviews, or ratings from other users
- No live-action TV or movie tracking (anime + the custom favorites lists only)
- No user accounts/authentication

## Suggested Build Order

1. Data schema design + local storage (IndexedDB) with export/import — get this rock-solid first
2. TV Time data extraction + import mapping
3. AniList search + add-to-list flow
4. Status tracking + episode checkboxes + rewatch counts
5. Watch time calculations (new vs. rewatch)
6. Custom lists (favorites)
7. UI polish for Z Flip 7 form factor + witchy visual theme (purple accents, hat/moon iconography — optional flavor, not required for function)
