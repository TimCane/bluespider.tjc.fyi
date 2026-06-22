# bluespider

Climbing gym route catalogue. What's on the walls right now, plus set/strip and
grade-feedback history. The source of truth is markdown in this repo; the admin
is a thin authoring layer that commits markdown back to `main`.

See [PLAN.md](./PLAN.md) for the full design.

## Stack

- Astro 5 (node adapter), strict TypeScript, Tailwind v4.
- Public catalogue pages are prerendered; `/regrade`, `/admin` and `/api/*` are
  server-rendered.
- Deployed on Coolify (Nixpacks reads the `build`/`start` scripts).

## Develop

```sh
pnpm install
pnpm dev
```

- `pnpm build` - production build
- `pnpm start` - run the built server
- `pnpm check` - typecheck
- `pnpm format` - prettier

## Content

Markdown collections under `src/content/`: `areas`, `walls`, `sets`, `routes`.
Schemas and ids are defined in `src/content.config.ts`. A bad entry fails the
build.

## Admin

`/admin` is a single-password authoring UI. On submit it writes markdown (and an
optional image) and makes one atomic commit to `main` via the GitHub Git Data
API; Coolify then rebuilds. Content commits go straight to `main` - a CMS
exception to the usual PR rule, since this is data, not code.

Required env vars (server-only, set in the Coolify dashboard):

| Variable         | Purpose                                                       |
| ---------------- | ------------------------------------------------------------ |
| `ADMIN_PASSWORD` | Shared password for the admin login.                         |
| `SESSION_SECRET` | Secret used to sign the session cookie.                      |
| `GITHUB_TOKEN`   | Fine-grained PAT, single repo, contents read/write.          |
| `GITHUB_REPO`    | Target repo as `owner/name`.                                 |
| `GITHUB_BRANCH`  | Optional, defaults to `main`.                                |

The gym timezone (for the `/regrade` 14-day cutoff) is the `GYM_TZ` constant in
`src/lib/dates.ts`.
