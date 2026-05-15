---
session: 9d89e07b-d64e-478c-bf06-b7658c4674b5
date: 2026-05-15
branch: main
type: walkthrough
---

# Walkthrough -- vitest test-DB isolation + seed orphan fixes

Three PRs merged to main this session: #982 (test infra), #986 (seed
fixes), #987 (bug closure). No new user-facing pages -- the work is
test infrastructure plus a seed-pipeline correctness fix. The visible
payoff is that the `/library` spines now surface every reference doc
the seed produces.

## Setup

```bash
cd /Users/joshua/src/_me/aviation/airboss
git checkout main
git pull --ff-only
bun install
bun run db reset --force
```

## Test 1 -- Vitest no longer touches the dev DB

**Command**: `bun run test`

**How to test manually**:

1. Record the dev DB reference count:

   ```bash
   PGPASSWORD=airboss psql -h localhost -p 5435 -U airboss -d airboss \
     -tAc "SELECT count(*) FROM study.reference;"
   ```

2. Run the full vitest suite: `bun run test`
3. Record the dev DB reference count again (same command).
4. Confirm the dedicated test DB exists and is seeded:

   ```bash
   PGPASSWORD=airboss psql -h localhost -p 5435 -U airboss -d airboss_unit_test \
     -tAc "SELECT count(*) FROM study.reference;"
   ```

**What to look for**: the `airboss` count is identical before and
after. `airboss_unit_test` exists with ~80 reference rows. Vitest's
`globalSetup` drops + recreates + seeds `airboss_unit_test` once per
`bun test` invocation (~4s); `vitest.setup.ts` force-pins
`DATABASE_URL` so tests physically cannot reach the dev DB.

**Known caveats**: a full `bun run vitest --run libs/bc/study/ scripts/db/`
sweep showed ~22 failures with `FATAL 57P01 ProcessInterrupts` -- a
parallel-worker DB-connection-termination issue, NOT a regression from
this session. The 4 target test files all pass individually. See the
unfinished file.

## Test 2 -- The 14cfr14 orphan is gone

**Command**:
`bun run vitest --run scripts/db/seed-references-from-manifest.test.ts`

**How to test manually**:

1. On a freshly-seeded DB, check for the off-corpus Part 14 row:

   ```bash
   PGPASSWORD=airboss psql -h localhost -p 5435 -U airboss -d airboss \
     -c "SELECT * FROM study.reference WHERE document_slug='14cfr14';"
   ```

2. Run the CFR seed-shape contract test (command above).

**What to look for**: zero `14cfr14` rows. The CFR contract test passes
(was failing with `Missing: 14cfr14`). If your dev DB has the legacy
orphan baked in from before this fix, run
`bun scripts/db/cleanup-cfr-part-14-orphan.ts` once.

## Test 3 -- Library spines surface every reference

**URL**: `http://localhost:5173/library` (study app)

**How to test manually**:

1. `bun run dev`
2. Sign in as Abby (`abby@airboss.test` / `Pa33word!`)
3. Walk these routes:

   | Route                                                    | Expect                                            |
   | -------------------------------------------------------- | -------------------------------------------------- |
   | `http://localhost:5173/library`                          | All four spines populated                          |
   | `http://localhost:5173/library/cert/private`             | PHAK, AFH, AvWx, Risk-Management all listed        |
   | `http://localhost:5173/library/cert/instrument`          | IFH listed                                         |
   | `http://localhost:5173/library/cert/cfi`                 | Aviation Instructor's Handbook listed              |
   | `http://localhost:5173/library/topic/human-factors`      | FAA-P-8740-25 (Personal Minimums Checklist) listed |
   | `http://localhost:5173/library/topic/weather`            | FAA-P-8740-25 listed                               |
   | `http://localhost:5173/library/topic/certification`      | FAA-S-8081-14 (PPL PTS) listed                     |
   | `http://localhost:5173/library/regulations`              | 14 CFR Parts list -- NO Part 14; Parts 23/61/91 ok |
   | `http://localhost:5173/library/regulations/14-cfr/23`    | Part 23 sections render                            |

**What to look for**: each doc appears in its listing and clicking
through opens its render page with no 404. Before this session, 7
reference rows were unreachable from any spine on a fresh seed.

**Known caveats**: route paths discovered from
`apps/study/src/routes/(app)/library/` -- the `[cert]` / `[topic]` /
`[slug]` segments are parameterised; the cert/topic values used above
are confirmed against `CERT_VALUES` and `AVIATION_TOPICS`.

## Test 4 -- Migration unit tests still green

**Command**:
`bun run vitest --run scripts/db/migrate-references-to-structured.test.ts`

**What to look for**: 36/36 pass. Includes two new regression tests
(`14 CFR 23 -> part 23`, `14 CFR 25 -> part 25`) and updated edition
assertions for the pinned handbook patterns.
