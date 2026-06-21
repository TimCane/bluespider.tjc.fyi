# Climbing gym route catalogue - plan

**Stack:** Astro 5 (node adapter, hybrid), strict TS, Tailwind, frontend-design
pass for a restrained/editorial identity. Public catalogue pages are
prerendered; a server-rendered admin handles on-site data entry. Deployed via
Coolify on a Hetzner VPS.

**Purpose:** gym catalogue only - what's up now plus set/strip and
grade-feedback history. No personal ticks. Source of truth is markdown in git;
the admin is a thin authoring layer that commits markdown.

## Collections (2)

```
src/content/
  walls/the-cave_01.md
  sets/2026-06-01_the-cave_01/index.md
  sets/2026-06-01_the-cave_01/image.png   # optional
```

- **Wall** - `number`, `area` (string display name, e.g. "The Cave"),
  `features` (string[] tags). id = `{areaSlug}_{number}` (`the-cave_01`).
- **Set** - `wall: reference('walls')`, `setDate`, `stripDate?`, `setter`
  (string), `discipline` (`lead|top-rope|both`), `image?`, and `routes`: an
  array of `{ colour, initialGrade, finalGrade? }`. Body = optional set notes.
  id = `{setDate}_{areaSlug}_{wall}`.

Routes are embedded on the Set (no independent identity in v1); area is free
text on the Wall (admin offers a dropdown of existing areas plus "new" to avoid
typos).

## Enums

- **Grade ladder** (French, ordered, sort by index):
  `4, 4+, 5, 5+, 6a, 6a+, 6b, 6b+, 6c, 6c+, 7a, 7a+, 7b, 7b+, 7c, 7c+, 8a`.
- **Colour:** `red, orange, yellow, green, blue, purple, pink, black, white,
  grey, teal` -> `colour->hex` chip map (white/yellow get borders/dark text).

## Rules / derived

- **Current set** = the wall's set with no `stripDate`. **Current routes** = the
  current set's `routes`.
- **Official grade** (per route) = `finalGrade ?? initialGrade`; show
  `initial -> final` when changed.
- Colour is unique within a set's `routes`.
- **Area order** on Home defaults to alphabetical; an optional `AREA_ORDER`
  config array overrides it if a physical order is wanted.

## Pages

- **`/`** - walls grouped by `area` (alphabetical / `AREA_ORDER`) -> walls by
  `number` -> current-set card: image, setter, set date, route chips ordered by
  grade.
- **`/walls/[wall]`** - current set plus reverse-chron past sets.
- **`/sets/[set]`** - full route list, setter, set/strip dates, image, notes.
- **`/regrade`** - dedicated page: routes on current sets where
  `setDate <= today-14d` and `finalGrade` empty.
- **`/admin`** - mobile-first authoring UI (server-rendered), single-password
  auth.
- **`/api/commit`** - server endpoint that writes markdown + image and commits.
- No per-route pages, no filter views in v1.

## Authoring (on-site admin)

- **Goal:** enter data from your phone at the gym; git stays the source of truth.
- **Flow:** form submit -> server writes files -> single atomic commit to `main`
  via the GitHub Git Data API (blobs -> tree -> commit -> update ref) -> Coolify
  deploy webhook rebuilds (~1-2 min) -> live.
- **New set:** pick area (existing or new) / wall / date / setter / discipline,
  plus a colour + grades per route; writes one set file (`index.md` with the
  `routes` array) plus the uploaded `image.png`, and auto-stamps the previous
  current set's `stripDate = new setDate`. One commit, two files.
- **Regrade:** edit a route's `finalGrade` in the set file.
- **Auth:** single shared password (v1).
- **GitHub access:** fine-grained PAT (single repo, contents read/write), stored
  as a Coolify env var, server-side only.
- **Live state:** admin reads current repo content via the GitHub API to fill
  dropdowns and find the previous current set, so it is never stale between
  rebuilds.
- **Images:** committed as uploaded (no client-side compression). Raw phone
  photos will grow the repo over time.
- **No offline:** assumes gym connectivity.
- Content commits go directly to `main` - a CMS exception to the usual PR rule,
  since this is data, not code.
