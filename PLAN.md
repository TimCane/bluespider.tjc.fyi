# Climbing gym route catalogue - plan

**Stack:** Astro 5, strict TS, Tailwind, frontend-design pass for a
restrained/editorial identity. Static build, deployed via Coolify on a Hetzner
VPS.

**Purpose:** gym catalogue only - what's up now plus set/strip and
grade-feedback history. No personal ticks.

## Collections (4)

```
src/content/
  areas/cave.md
  walls/cave_01.md
  sets/2026-06-01_cave_01/index.md
  sets/2026-06-01_cave_01/image.png   # optional
  routes/2026-06-01_cave_01_green.md
```

- **Area** - `name`, `order`. id = slug (`cave`).
- **Wall** - `number`, `area: reference('areas')`, `features` (string[] tags).
  id = `{area}_{wall}` (`cave_01`).
- **Set** - `wall: reference('walls')`, `setDate`, `stripDate?`, `setter`
  (string), `discipline` (`lead|top-rope|both`), `image?`. Body = set notes.
  id = `{setDate}_{area}_{wall}`.
- **Route** - `set: reference('sets')`, `colour` (enum), `initialGrade` (enum),
  `finalGrade?` (enum). Body = route notes. id = `{set}_{colour}`.

## Enums

- **Grade ladder** (French, ordered, sort by index):
  `4, 4+, 5, 5+, 6a, 6a+, 6b, 6b+, 6c, 6c+, 7a, 7a+, 7b, 7b+, 7c, 7c+, 8a`.
- **Colour:** `red, orange, yellow, green, blue, purple, pink, black, white,
  grey, teal` -> `colour->hex` chip map (white/yellow get borders/dark text).

## Rules / derived

- **Current set** = the wall's set with no `stripDate`. **Current routes** =
  routes whose set is current.
- **Official grade** = `finalGrade ?? initialGrade`; show `initial -> final`
  when changed.
- Colour is unique within a set (route natural key).

## Pages

- **`/`** - areas (by `order`) -> walls (by `number`) -> current-set card:
  image, setter, set date, route chips ordered by grade.
- **`/walls/[wall]`** - current set plus reverse-chron past sets.
- **`/sets/[set]`** - full route list, setter, set/strip dates, image, notes.
- **`/regrade`** - dedicated page: routes on current sets where
  `setDate <= today-14d` and `finalGrade` empty.
- No per-route pages, no filter views in v1.

## Tooling

- **`pnpm new-set`** scaffold - prompts area/wall/date/setter/discipline/colours,
  stamps the set folder plus route stubs, and auto-fills the previous current
  set's `stripDate = new setDate` (confirm prompt).
