# Spaced Memory Items

> Anki-quality flashcards for aviation knowledge, built into the `study` app.
> Write cards while you study; the FSRS-5 scheduler decides when you see each
> one next. The primary user is Joshua (user zero) rebuilding PPL/IR/CPL/CFI
> after a long gap, but the model generalises to any pilot who needs
> retention practice.

## The journey

The feature lives under `/memory/*` in the `study` app. All routes are
gated by [apps/study/src/routes/(app)/+layout.server.ts](../../apps/study/src/routes/(app)/+layout.server.ts)
which calls `requireAuth(event)`; unauthenticated visitors bounce to
`/login?redirectTo=...` and come back after sign-in.

### 1. Sign in

`/login` renders a clean form and (in dev) a dev-account panel showing
`joshua@ball.dev` and `learner@airboss.test`. Clicking a dev button
populates the fields. Submit POSTs to itself (SvelteKit form action) which
forwards to better-auth's `/api/auth/sign-in/email` and sets a session
cookie on `.airboss.test` (cross-subdomain ready for the future `spatial`,
`audio`, `hangar` apps). redirectTo is validated to reject backslash +
CR/LF injection.

- [apps/study/src/routes/login/+page.server.ts](../../apps/study/src/routes/login/+page.server.ts)
- [apps/study/src/routes/login/+page.svelte](../../apps/study/src/routes/login/+page.svelte)
- [apps/study/src/hooks.server.ts](../../apps/study/src/hooks.server.ts) (the `/api/auth` passthrough)

### 2. Land on the Memory dashboard

`/memory` (root of the (app) layout currently redirects here) shows:

- **Due now** tile (highlighted when > 0), **Reviewed today**, **Streak**,
  **Active cards** total.
- **By state**: per-state counts (new / learning / review / relearning).
- **By domain**: per-domain active count, due count, mastery bar
  (stability > 30 days). Domain names link to `/memory/browse?domain=...`.
- Quick actions: Browse · New card · Start review.

Dashboard stats are computed in one BC call that fans out into five
parallel queries (`Promise.all`) so the page meets the spec's 200ms budget
at 1k cards.

- [apps/study/src/routes/(app)/memory/+page.server.ts](../../apps/study/src/routes/(app)/memory/+page.server.ts)
- [apps/study/src/routes/(app)/memory/+page.svelte](../../apps/study/src/routes/(app)/memory/+page.svelte)
- [libs/bc/study/src/stats.ts](../../libs/bc/study/src/stats.ts)

### 3. Create a card

`/memory/new` has a 5-field form: Front, Back, Domain (14 options with
human labels), Type (basic/cloze/regulation/memory_item), Tags
(comma-separated). The Front textarea autofocuses on mount, and Cmd/Ctrl+Enter
submits from any field. Two submit buttons:

- **Save** -> redirect to the new card's detail page.
- **Save and add another** -> redirect back to `/memory/new` with the
  domain, card type, and tags pre-filled in the next form. A success
  banner links to the just-saved card.

Validation lives in `libs/bc/study/src/validation.ts` (zod). The route
layer surfaces field-level errors; the BC layer re-validates as
defense-in-depth. Invalid inputs don't round-trip through the DB.

- [apps/study/src/routes/(app)/memory/new/+page.server.ts](../../apps/study/src/routes/(app)/memory/new/+page.server.ts)
- [apps/study/src/routes/(app)/memory/new/+page.svelte](../../apps/study/src/routes/(app)/memory/new/+page.svelte)
- [libs/bc/study/src/cards.ts](../../libs/bc/study/src/cards.ts) (`createCard`)
- [libs/bc/study/src/validation.ts](../../libs/bc/study/src/validation.ts) (`newCardSchema`)

### 4. Browse cards

`/memory/browse` is a `role="search"` filter bar + card list + pagination
(25 / page). Filters: domain, card type, source (personal / course /
product / imported), status (active / suspended / archived), free-text
search across front + back (ILIKE with escaped `%`, `_`, `\`). URL is the
source of truth for filter state so links share and the Back button works.

Two distinct empty states:

- **Deck is empty** (no active filters + 0 cards) -- onboarding CTA.
- **Over-filtered** (filters set + 0 matches) -- "clear filters" link.

Each row shows the front (truncated), domain badge, type badge, and
source / status pill if non-default. Rows are anchors, not JS onclick, so
middle-click opens in a new tab.

- [apps/study/src/routes/(app)/memory/browse/+page.server.ts](../../apps/study/src/routes/(app)/memory/browse/+page.server.ts)
- [apps/study/src/routes/(app)/memory/browse/+page.svelte](../../apps/study/src/routes/(app)/memory/browse/+page.svelte)
- [libs/bc/study/src/cards.ts](../../libs/bc/study/src/cards.ts) (`getCards`)

### 5. View / edit / manage a card

`/memory/[id]` shows:

- Front, back, tags.
- **Edit** / **Suspend** / **Archive** / **Reactivate** actions. Archive
  is styled as destructive (red border, `confirm()` dialog); it's
  reversible via Reactivate. Non-editable cards (course / product sources)
  show a "read-only" note and hide Edit.
- **Schedule** panel: state, due-in (human interval), stability, difficulty,
  review count, lapse count.
- **Recent reviews**: the 10 most recent reviews with rating, confidence,
  stability, next-due. Scoped to the caller's userId so URL guesses can't
  leak another learner's history.

- [apps/study/src/routes/(app)/memory/[id]/+page.server.ts](../../apps/study/src/routes/(app)/memory/[id]/+page.server.ts)
- [apps/study/src/routes/(app)/memory/[id]/+page.svelte](../../apps/study/src/routes/(app)/memory/[id]/+page.svelte)
- [libs/bc/study/src/cards.ts](../../libs/bc/study/src/cards.ts) (`getCard`, `updateCard`, `setCardStatus`)
- [libs/bc/study/src/stats.ts](../../libs/bc/study/src/stats.ts) (`getRecentReviewsForCard`)

### 6. Review session

`/memory/review` loads the next 20 due cards (ordered by due-at ascending)
and walks the learner through them one by one:

```text
front
   -> (on ~50% of cards) confidence 1..5 or Skip
   -> Show answer
   -> Again | Hard | Good | Easy  (with next-interval hints)
   -> submit -> next card
```

The confidence prompt is sampled deterministically by
`djb2(cardId + YYYY-MM-DD) % 10_000 / 10_000 < 0.5` so the same card on
the same day is always prompted or always not. Data feeds the (future)
Calibration Tracker.

Keyboard: Space/Enter reveals. 1..5 picks confidence (Escape skips).
1..4 or a/h/g/e rates.

On submit: BC function `submitReview` opens a transaction, locks the
`card_state` row `FOR UPDATE` (so concurrent submits serialize),
checks the 5-second idempotency window, runs FSRS (passing the correct
`lastReviewedAt`), inserts the review row, and upserts `card_state`.
If the server rejected the write, the UI stays on the same card and shows
a `role="alert"` error -- rating is NOT advanced, tally is NOT bumped. A
deleted-mid-session card (CardNotFoundError) or a status-mutated card
(CardNotReviewableError) are caught on the server and treated as "skip
and advance" per spec.

End of batch: session summary (per-rating tally) + "Reload queue" button
that refreshes via `invalidateAll()`.

- [apps/study/src/routes/(app)/memory/review/+page.server.ts](../../apps/study/src/routes/(app)/memory/review/+page.server.ts)
- [apps/study/src/routes/(app)/memory/review/+page.svelte](../../apps/study/src/routes/(app)/memory/review/+page.svelte)
- [libs/bc/study/src/reviews.ts](../../libs/bc/study/src/reviews.ts) (`submitReview`)
- [libs/bc/study/src/srs.ts](../../libs/bc/study/src/srs.ts) (FSRS-5 wrapper)

## Code map

### App surface

- Routes: [apps/study/src/routes/(app)/memory/](../../apps/study/src/routes/(app)/memory/)
- Root layout: [apps/study/src/routes/+layout.svelte](../../apps/study/src/routes/+layout.svelte)
- App layout + primary nav + skip link: [apps/study/src/routes/(app)/+layout.svelte](../../apps/study/src/routes/(app)/+layout.svelte)
- Auth guard: [apps/study/src/routes/(app)/+layout.server.ts](../../apps/study/src/routes/(app)/+layout.server.ts)
- Per-app auth factory + cookie helpers: [apps/study/src/lib/server/auth.ts](../../apps/study/src/lib/server/auth.ts), [cookies.ts](../../apps/study/src/lib/server/cookies.ts)
- Hooks (request id, session hydration, banned guard): [apps/study/src/hooks.server.ts](../../apps/study/src/hooks.server.ts)

### Study BC (`libs/bc/study/src/`)

- [cards.ts](../../libs/bc/study/src/cards.ts) -- createCard, updateCard, getCard, getCards, getDueCards, setCardStatus + typed errors
- [reviews.ts](../../libs/bc/study/src/reviews.ts) -- submitReview (tx + FOR UPDATE + idempotency)
- [stats.ts](../../libs/bc/study/src/stats.ts) -- dashboard, mastery, review stats, per-domain breakdown, recent-reviews
- [srs.ts](../../libs/bc/study/src/srs.ts) -- FSRS-5 wrapper around ts-fsrs
- [validation.ts](../../libs/bc/study/src/validation.ts) -- zod schemas shared between BC and routes
- [schema.ts](../../libs/bc/study/src/schema.ts) -- Drizzle `card` / `review` / `card_state` in the `study` namespace
- [index.ts](../../libs/bc/study/src/index.ts) -- public barrel

### Platform libs

- Constants: [libs/constants/src/study.ts](../../libs/constants/src/study.ts) (DOMAINS, CARD_TYPES, etc.)
- Auth lib: [libs/auth/src/](../../libs/auth/src/) (better-auth factory, cookies, logout, email)
- DB connection: [libs/db/src/connection.ts](../../libs/db/src/connection.ts)
- Logger + error-handler: [libs/utils/src/](../../libs/utils/src/)

### Tests and scripts

- Unit: [libs/bc/study/src/srs.test.ts](../../libs/bc/study/src/srs.test.ts), [libs/auth/src/auth.test.ts](../../libs/auth/src/auth.test.ts)
- Smoke: [scripts/smoke/study-bc.ts](../../scripts/smoke/study-bc.ts)
- Setup: [scripts/setup.ts](../../scripts/setup.ts)
- Dev seed: [scripts/db/seed-dev-users.ts](../../scripts/db/seed-dev-users.ts)
- Reset: [scripts/db/reset-study.ts](../../scripts/db/reset-study.ts)

## Key decisions

- **FSRS-5 via `ts-fsrs`, not a hand-rolled implementation.** The spec
  originally described "~100 lines of math"; using the MIT-licensed
  reference library avoids an easy-to-regress corner of the codebase.
  The wrapper exposes airboss-flavored types (`CardSchedulerState`,
  `ScheduleResult`, our CardState string enum) and hides ts-fsrs's enum
  numerics.
- **Denormalized `card_state.last_reviewed_at`.** ts-fsrs's scheduler
  computes `elapsed_days = now - last_review`. Passing null short-circuits
  that to 0, which silently routes every review through the short-term
  path and breaks stability growth. The denormalized column saves an
  extra review-history lookup inside `submitReview`.
- **FOR UPDATE + 5-second idempotency inside the tx.** Concurrent submits
  would otherwise both see "no recent review" and insert duplicates. Lock
  scope is per `(cardId, userId)`; hold time ~10-15ms.
- **Deterministic confidence sampling.** djb2 hash over `(cardId + UTC day)`
  keeps the prompt rate at 50% while giving the same card on the same day
  a stable decision -- no confusing "sometimes I get the slider, sometimes
  I don't" per card.
- **Typed BC errors.** `CardNotFoundError`, `CardNotEditableError`,
  `CardNotReviewableError`, `SourceRefRequiredError`. Routes catch by
  class; no `err.message.includes('not found')` string matching.
- **Archive over delete.** Cards never hard-delete through the UI.
  `review.card_id` uses `ON DELETE RESTRICT` so history can't be silently
  lost even if someone tries to delete at the DB level.
- **better-auth session cookieCache enabled (5-min maxAge).** Cuts DB
  round-trips on every authenticated request. Ban / revoke propagates
  within 5 min.
- **One BC for three features.** `libs/bc/study/` will absorb scenarios
  (Decision Reps) and calibration (Calibration Tracker) alongside cards;
  the schema, validation, and read interfaces all already live together
  rather than in three parallel packages.

## Operator notes

### URLs

The dev server lives at the same cross-subdomain shape as production, so
sessions, cookies, and deep-linking work the same locally as deployed.
`study.airboss.test` must resolve to `127.0.0.1` (step 1 of setup below
verifies this; OrbStack's `*.test` wildcard handles it on macOS).

| Area            | URL                                                          |
| --------------- | ------------------------------------------------------------ |
| Login           | `http://study.airboss.test:9600/login`                       |
| Dashboard       | `http://study.airboss.test:9600/memory`                      |
| Browse          | `http://study.airboss.test:9600/memory/browse`               |
| New card        | `http://study.airboss.test:9600/memory/new`                  |
| Card detail     | `http://study.airboss.test:9600/memory/{id}`                 |
| Review session  | `http://study.airboss.test:9600/memory/review`               |
| Logout (POST)   | `http://study.airboss.test:9600/logout`                      |
| Auth API        | `http://study.airboss.test:9600/api/auth/*`                  |
| DB Studio       | `http://localhost:4983/` (drizzle-kit studio)                |

Future surface apps claim `hangar.airboss.test`, `spatial.airboss.test`,
etc. on the same cookie domain so one sign-in unlocks the whole suite.

### First-time setup (one command)

```bash
bun run setup
```

This runs [scripts/setup.ts](../../scripts/setup.ts) which is idempotent:

1. Verify `/etc/hosts` maps `study.airboss.test` (and any future surface
   hosts from `@ab/constants` `HOSTS`) to `127.0.0.1`. If missing, the
   script prints the `sudo tee -a /etc/hosts` line to run and exits.
2. Install dependencies (`bun install`).
3. Write `.env` from `.env.example` with a freshly-generated
   `BETTER_AUTH_SECRET` (via `openssl rand -base64 32`).
4. Start the `airboss-db` Postgres container (`docker compose up -d db`).
5. Wait for `pg_isready`.
6. Push the Drizzle schema (`bunx drizzle-kit push`).
7. Seed the dev users.

Prerequisites: [Docker](https://www.docker.com/) or
[OrbStack](https://orbstack.dev/), plus [Bun](https://bun.sh/).
Everything else is bootstrapped by `setup`.

### Day-to-day

```bash
bun run dev              # start the study app on :9600
bun run check            # svelte-check + biome
bun run test             # vitest (20 specs at time of writing)
bun run smoke            # end-to-end BC smoke against local DB
```

Open [`http://study.airboss.test:9600/login`](http://study.airboss.test:9600/login),
sign in as `joshua@ball.dev` / `Pa33word!`. The session cookie is set on
`.airboss.test` so it'll flow to every surface app once they exist.

### Database ops

```bash
bun run db              # status: container, schemas, table counts (default)
bun run db up           # start the Postgres container
bun run db down         # stop it
bun run db push         # sync Drizzle schema to the DB (dev workflow)
bun run db studio       # open drizzle-kit Studio in a browser
bun run db seed         # (re)seed dev users (idempotent -- safe to re-run)
bun run db reset        # DROP + recreate DB, push schema, seed dev users
bun run db reset-study  # TRUNCATE study.card / card_state / review
                        # preserves auth tables so you stay signed in
bun run db psql         # open a psql shell in the DB container
```

Add `--force` / `-f` to skip the confirmation prompt on `reset` and `reset-study`.

`reset`, `reset-study`, and `seed` all refuse to run unless `DATABASE_URL` points
at a local-dev host (`localhost`, `127.0.0.1`, or `airboss-db`) and
`NODE_ENV` is not `production`. That lets you wire shared CI secrets
without risk of wiping a staging DB.

### Config env vars

| Var                  | Required?       | Notes                                                                 |
| -------------------- | --------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`       | yes             | Postgres connection string. `setup` writes the local dev default.     |
| `BETTER_AUTH_SECRET` | yes             | Session signing. `setup` generates one via `openssl rand -base64 32`. |
| `BETTER_AUTH_URL`    | prod only       | Base URL. Drives trustedOrigins (CSRF) + email links.                 |
| `RESEND_API_KEY`     | optional        | Transactional email. Absent -> email bodies log to console.           |
| `LOG_LEVEL`          | optional        | `debug` / `info` / `warn` / `error`. Default `info`.                  |
| `DB_POOL_SIZE`       | optional        | Postgres pool. Default 10.                                            |

### Troubleshooting

- **`ECONNREFUSED` hitting `study.airboss.test:9600`.** Vite binds to
  IPv4 loopback explicitly (`server.host = '127.0.0.1'` in
  [apps/study/vite.config.ts](../../apps/study/vite.config.ts)). If it
  still refuses, check `dscacheutil -q host -a name study.airboss.test`
  (macOS) returns `127.0.0.1`.
- **Login POST returns 200 but `/memory` redirects to `/login`.**
  Browser rejected the session cookie because the URL host didn't match
  `.airboss.test`. Visit via `http://study.airboss.test:9600`, not
  `localhost` -- cookies are intentionally cross-subdomain scoped.
- **`Missing /etc/hosts entries for: study.airboss.test`.** `bun run
  setup` prints the exact `sudo tee -a /etc/hosts` line to run.
- **`favicon.ico 404` in the logs.** Fixed -- the app serves an SVG
  favicon at [apps/study/static/favicon.svg](../../apps/study/static/favicon.svg).
- **`DATABASE_URL is not set`.** Run `bun run setup` or copy `.env.example`
  to `.env` manually.
- **`Refusing to seed/reset: DATABASE_URL does not point at a local dev
  database`.** The safety guard is doing its job. Unset `DATABASE_URL`
  or point it at a local host.

## Related docs

- PRD: [work-packages/spaced-memory-items/PRD.md](../work-packages/spaced-memory-items/PRD.md)
- Spec: [work-packages/spaced-memory-items/spec.md](../work-packages/spaced-memory-items/spec.md)
- Design: [work-packages/spaced-memory-items/design.md](../work-packages/spaced-memory-items/design.md)
- Tasks: [work-packages/spaced-memory-items/tasks.md](../work-packages/spaced-memory-items/tasks.md)
- Test plan: [work-packages/spaced-memory-items/test-plan.md](../work-packages/spaced-memory-items/test-plan.md)
- User stories: [work-packages/spaced-memory-items/user-stories.md](../work-packages/spaced-memory-items/user-stories.md)
- Review: [work-packages/spaced-memory-items/review.md](../work-packages/spaced-memory-items/review.md)
- ADR 011 (knowledge graph): [decisions/011-knowledge-graph-learning-system/decision.md](../decisions/011-knowledge-graph-learning-system/decision.md)

## Deferred / follow-ups

Full list with reasons lives in [review.md](../work-packages/spaced-memory-items/review.md).
The highest-signal items:

- **Production deploy prerequisites:** Drizzle migration artifacts (currently
  `db push` only) and `BETTER_AUTH_URL` set. Blocker before any shared DB.
- **A11y:** focus management on card advance, character-key-shortcut
  modifier, disabled-button contrast, `prefers-reduced-motion`.
- **Perf (at scale):** `(user_id, updated_at)` index on card, `pg_trgm` GIN
  for ILIKE search, partial index on card_state for active-only due queue.
- **UX polish:** dashboard new-user onboarding card, next-due timestamp on
  "all caught up", tags filter on browse.
- **Integration hooks:** `node_id` link to the future knowledge graph
  (additive column, not yet added).

## Change log

- `2026-04-19` -- initial ship on branch `build/spaced-memory-items`
  (11 commits: 1 foundation port, 4 feature phases, 5 fix commits, 1 review.md).
  FSRS-5 via ts-fsrs 5.3.2. 20 vitest specs. Review coverage: 14 review
  files under `docs/work/reviews/` (~450 individual findings).
