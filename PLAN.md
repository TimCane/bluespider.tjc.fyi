# Climbing gym route catalogue - plan

**Stack:** Astro 5 (node adapter, hybrid), strict TS, Tailwind, frontend-design
pass for a restrained/editorial identity. Public catalogue pages are
prerendered; `/regrade`, `/admin`, and `/api/commit` are server-rendered.
Deployed via Coolify on a Hetzner VPS.

**Purpose:** gym catalogue only - what's up now plus set/strip and
grade-feedback history. No personal ticks. Source of truth is markdown in git;
the admin is a thin authoring layer that commits markdown.

## Collections (4)

```
src/content/
  areas/the-cave.md
  walls/the-cave_01.md
  sets/2026-06-01_the-cave_01/index.md
  sets/2026-06-01_the-cave_01/image.jpg   # optional
  routes/2026-06-01_the-cave_01_green.md
```

- **Area** - `name`, `order` (int). id = slug of name, article included
  (`the-cave`).
- **Wall** - `number` (int, unique within its area), `area: reference('areas')`,
  `features` (free-text string[] tags). id = `{area}_{number}` (`the-cave_01`).
- **Set** - `wall: reference('walls')`, `setDate`, `stripDate?`, `setters`
  (string[]), `discipline` (`lead|top-rope|both`), `image?`. Body = optional set
  notes. id = `{setDate}_{wall}` (`2026-06-01_the-cave_01`); at most one set per
  wall per calendar day.
- **Route** - `set: reference('sets')`, `colour` (enum), `initialGrade` (enum),
  `finalGrade?` (enum). Body = optional route notes/beta. id = `{set}_{colour}`.

A route lives and dies with its set: re-setting a wall mints all-new routes with
no link to the previous set's. History is "sets over time on a wall", not "a
line over time".

## Enums

- **Grade ladder** (French, ordered, sort by index):
  `4, 4+, 5, 5+, 6a, 6a+, 6b, 6b+, 6c, 6c+, 7a, 7a+, 7b, 7b+, 7c, 7c+, 8a`.
  `initialGrade` is always set (setter's best guess); extend the array if a
  grade outside the range ever appears.
- **Colour:** `red, orange, yellow, green, blue, purple, pink, black, white,
  grey, teal` -> `colour->hex` chip map (white/yellow get borders/dark text).
  Unique within a set; sets run 3-5 routes, so the 11-colour ceiling never bites.

## Rules / derived

- **Current set** = the wall's set with no `stripDate`; at most one per wall,
  upheld by the admin's auto-stamp (not structurally). A wall may have no current
  set (stripped, awaiting reset). **Current routes** = routes whose set is
  current.
- **Official grade** (per route) = `finalGrade ?? initialGrade`; show
  `initial -> final` when changed.
- Colour is unique within a set (route natural key).
- `setters` render as a list.
- **Area order** on Home is `area.order` (ascending).

## Pages

- **`/`** (prerendered) - areas (by `order`) -> walls (by `number`) -> current-set
  card: image, setters, set date, route chips ordered by grade. A wall with no
  current set shows a muted "stripped" marker in place of a card.
- **`/walls/[wall]`** (prerendered) - current set plus reverse-chron past sets.
- **`/sets/[set]`** (prerendered) - full route list, setters, set/strip dates,
  image, notes.
- **`/regrade`** (SSR) - routes on current sets where `setDate <= today-14d`
  (gym-local) and `finalGrade` empty. Server-rendered so the 14-day cutoff stays
  live between rebuilds.
- **`/admin`** (SSR) - mobile-first authoring UI, single-password auth.
- **`/api/commit`** (SSR) - server endpoint that writes markdown + image and
  commits.
- No per-route pages, no filter views in v1.

## Authoring (on-site admin)

- **Goal:** enter data from your phone at the gym; git stays the source of truth.
- **Flow:** form submit -> server writes files -> single atomic commit to `main`
  via the GitHub Git Data API (blobs -> tree -> commit -> update ref) -> Coolify
  deploy webhook rebuilds (~1-2 min) -> live.
- **Scope:** admin creates, edits, and deletes areas, walls, sets, and routes,
  plus regrade and strip actions.
- **New area:** pick "new", enter `name`; `order` auto-appends (`max + 1`).
- **New wall:** pick "new", enter `number` + `features`, under an existing or
  new area; writes a wall file.
- **New set:** pick (or create) area / wall, plus date / setters / discipline and
  a colour + grades per route; writes the set folder (`index.md` + uploaded
  `image.<ext>`) and one route file per colour, and auto-stamps the previous
  current set's `stripDate = new setDate`. One atomic commit - `2 + N` files,
  plus the new area and/or wall file when those are created in the same flow.
- **Edit:** open any set (current or past), change its frontmatter or route
  files, re-commit only the changed files. Regrade (set a route's `finalGrade`)
  is the common case.
- **Strip:** stamp `stripDate` on a wall's current set without creating a new
  one; the wall goes empty until reset. One-file commit.
- **Delete:** cascades - deleting a set removes its folder + route files;
  deleting a wall removes its sets/routes; deleting an area removes its whole
  subtree. Guarded by a typed confirmation. Deleting a current set leaves the
  previous set stripped (wall stays empty); re-open it by editing if wanted.
- **Concurrency:** single-author. On a ref-update conflict, the server refetches
  head, rebuilds the tree, and retries once, then surfaces an error.
- **Auth:** single shared password -> signed, expiring session cookie (secret in
  a Coolify env var).
- **GitHub access:** fine-grained PAT (single repo, contents read/write), stored
  as a Coolify env var, server-side only.
- **Live state:** admin reads current repo content via the GitHub API to fill
  dropdowns and find the previous current set, so it is never stale between
  rebuilds.
- **Images:** committed as uploaded with their original extension (no
  client-side compression). Raw phone photos will grow the repo over time.
- **No offline:** assumes gym connectivity.
- Content commits go directly to `main` - a CMS exception to the usual PR rule,
  since this is data, not code.
