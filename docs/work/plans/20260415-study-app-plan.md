---
title: Study App Implementation Plan
date: 2026-04-15
status: proposed
machine: joshball-mbp
branch: docs/study-app-plan
triggered_by: "OK, so lets build a plan for the study app"
context: Post-pivot. First surface app in Option 7 architecture. Joshua is user zero -- will use this to study for CFI return.
---

# Study App Implementation Plan

The study app (`apps/study/`) is the first surface app in the [Option 7 architecture](../../platform/MULTI_PRODUCT_ARCHITECTURE_OPTIONS.md). It hosts quiz/card/rep products. Joshua will use it immediately to study for his return to flying -- every flashcard he writes while studying becomes product content.

**Products hosted (MVP):** [Spaced Memory Items (prd:prof:spaced-memory-items)](../../vision/products/proficiency/spaced-memory-items/PRD.md), [Decision Reps (prd:prof:decision-reps)](../../vision/products/proficiency/decision-reps/PRD.md), [Calibration Tracker (prd:prof:calibration-tracker)](../../vision/products/proficiency/calibration-tracker/PRD.md)

**Products deferred:** Ten-Minute Ticker (prd:prof:ten-minute-ticker), WX Calls (prd:prof:wx-calls), Plate Reading Drills (prd:prof:plate-reading-drills), all event prep products (prd:evt:bfr-sprint through prd:evt:recency-recovery)

## Architecture Decisions

### Reuse from existing libs

| Lib               | What we reuse                                                       |
| ----------------- | ------------------------------------------------------------------- |
| `libs/auth/`      | `createAuth()`, `requireAuth()`, cross-subdomain cookies            |
| `libs/db/`        | Shared Drizzle connection                                           |
| `libs/ui/`        | FocusShell, Header, Button, Badge, Panel, StatCard, ProgressBar, etc |
| `libs/themes/`    | `aviation` theme + `focus` family                                   |
| `libs/constants/` | Add `STUDY_*` routes, `PORTS.STUDY`, `HOSTS.STUDY`, `SCHEMAS.STUDY` |
| `libs/utils/`     | ID generators -- add `crd_`, `rev_`, `rep_`, `rat_` prefixes        |

### New code

| New thing                | Location                                           | Why                                                                                    |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------------                     |
| `libs/bc/study/`         | New [BC](../../decisions/002-LIB_STRUCTURE.md) lib | Spaced rep, cards, reviews, scenarios, calibration. All biz logic.                     |
| `study` DB schema        | New Postgres namespace                             | Cards, reviews, scenarios, calibration. Separate from course/etc.                      |
| Study-specific constants | `libs/constants/src/study.ts`                      | Domains, card types, review ratings, FSRS parameters                                   |
| ConfidenceSlider         | `libs/ui/`                                         | Shared component for prd:prof:spaced-memory-items review + prd:prof:decision-reps reps |

### Key decision: one BC, not three

[Spaced Memory Items (prd:prof:spaced-memory-items)](../../vision/products/proficiency/spaced-memory-items/PRD.md), [Decision Reps (prd:prof:decision-reps)](../../vision/products/proficiency/decision-reps/PRD.md), and [Calibration Tracker (prd:prof:calibration-tracker)](../../vision/products/proficiency/calibration-tracker/PRD.md) share data models heavily -- calibration reads from both cards and reps, both produce confidence+result tuples. One `libs/bc/study/` ([bounded context](../../decisions/002-LIB_STRUCTURE.md) -- the domain-driven design pattern we use to organize business logic in libs) with sub-modules (`cards.ts`, `reps.ts`, `calibration.ts`, `srs.ts`) is cleaner than three separate BCs.

### Key decision: FSRS-5 over SM-2

**Background:** Spaced repetition is a learning technique where you review material at increasing intervals -- the better you know something, the longer you wait before reviewing it again. The scheduling algorithm decides *when* to show each card next based on how well you remembered it.

Two competing algorithms:

- **[SM-2](https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm)** (SuperMemo Algorithm 2) -- the original spaced repetition algorithm, created by Piotr Wozniak in 1987. Used by early Anki versions and most flashcard apps. It tracks one number per card ("ease factor" -- how easy the card is for you) and uses that to schedule the next review. Simple but crude: fixed initial intervals, no separation between how stable a memory is vs. how difficult the material is, and poor handling of "lapses" (when you forget something you previously knew).

- **[FSRS-5](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)** (Free Spaced Repetition Scheduler, version 5) -- a modern open-source replacement created by Jarrett Ye, adopted by [Anki](https://apps.ankiweb.net/) (the most widely used flashcard app) since version 23.10. Instead of one number per card, FSRS tracks two: **stability** (how many days until you have a 90% chance of forgetting) and **difficulty** (how inherently hard the material is for you). This lets it schedule reviews more accurately, especially after lapses.

**Why FSRS-5 for us:**

- Open-source ([MIT license](https://github.com/open-spaced-repetition/ts-fsrs)), well-documented, proven at scale in Anki.
- The two-variable model (stability + difficulty) maps well to aviation domains -- some material is inherently harder (complex regulations vs. simple memory items).
- ~100 lines of pure TypeScript math with 19 tunable parameters. No dependencies. Easy to implement in `libs/bc/study/src/srs.ts`, easy to unit test.
- Collecting review data from day one means we can optimize the 19 parameters from real usage data later (FSRS supports this).
- Reference implementation: [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (TypeScript, MIT).

### Key decision: Decision Reps don't use the tick engine

The [tick engine](../../platform/SCENARIO_ENGINE_SPEC.md) (`libs/engine/`) is for multi-step interactive simulations with student behavior models -- the kind used in the [instrument scan exercises](../../../course/L05-Implementation/features/instrument-scan/spec.md) and FIRC scenarios where the learner watches a situation unfold over many ticks and intervenes at decision points. Decision Reps ([prd:prof:decision-reps](../../vision/products/proficiency/decision-reps/PRD.md)) are much simpler: single-decision micro-scenarios where you read a situation, choose an option, and see the outcome. No tick loop, no student model, no real-time progression. Just a `study.scenario` table with options + outcomes.

---

## Phase 1: App Shell

A running SvelteKit app at `study.firc.test:7650` with login, authenticated shell, empty dashboard.

### Files to create

| File                                              | Purpose                                   |
| ------------------------------------------------- | ----------------------------------------- |
| `apps/study/package.json`                         | `@firc/study`, port 7650                  |
| `apps/study/svelte.config.js`                     | Adapter-node, `@firc/*` aliases           |
| `apps/study/vite.config.ts`                       | SvelteKit plugin                          |
| `apps/study/tsconfig.json`                        | Extends `.svelte-kit/tsconfig.json`       |
| `apps/study/src/app.html`                         | `data-theme-id="aviation"`, focus family  |
| `apps/study/src/app.d.ts`                         | `App.Locals` with session/user            |
| `apps/study/src/hooks.server.ts`                  | Auth handler (copy sim pattern)           |
| `apps/study/src/routes/+layout.svelte`            | Theme CSS, layout                         |
| `apps/study/src/routes/(app)/+layout.svelte`      | FocusShell + nav (Memory, Reps, Calibration) |
| `apps/study/src/routes/(app)/+page.svelte`        | Dashboard: due cards, reps, streak        |
| `apps/study/src/routes/(public)/login/+page.svelte` | Login page                             |

### Config changes

| File                          | Change                               |
| ----------------------------- | ------------------------------------ |
| `libs/constants/src/ports.ts` | Add `STUDY: 7650`                    |
| `libs/constants/src/hosts.ts` | Add `STUDY: 'study.firc.test'`       |
| `libs/constants/src/schemas.ts` | Add `STUDY: 'study'`               |
| `tsconfig.json` (root)       | Add `@firc/bc/study` path alias      |

**MVP:** app runs, login works, empty dashboard renders.

---

## Phase 2: Spaced Memory Items (prd:prof:spaced-memory-items)

### Database schema (`study` namespace)

Schema uses [Drizzle ORM](https://orm.drizzle.team/) (our TypeScript ORM for PostgreSQL) with the `study` [database namespace](../../decisions/004-DATABASE_NAMESPACES.md) (Postgres schema that isolates study tables from other domains like `course`, `identity`, etc.).

**Notation legend:** `PK` = primary key, `FK` = foreign key, `jsonb` = PostgreSQL JSON column, `timestamptz` = timestamp with timezone, `real` = floating-point number. IDs use our [two-tier ID strategy](../../decisions/010-ID_STRATEGY.md): prefix + [ULID](https://github.com/ulid/spec) (Universally Unique Lexicographically Sortable Identifier -- like UUID but sortable by time). Prefixes: `crd_` = card, `rev_` = review, `rep_` = scenario, `rat_` = rep attempt.

```sql
study.card
  id              text PK              -- crd_{ulid}
  user_id         text NOT NULL        -- FK identity.bauth_user
  front           text NOT NULL        -- question/prompt (markdown)
  back            text NOT NULL        -- answer/explanation (markdown)
  domain          text NOT NULL        -- regulations, weather, airspace, etc.
  tags            jsonb DEFAULT '[]'
  card_type       text NOT NULL        -- basic, cloze, regulation, memory_item
  source          text                 -- manual, ntsb, route-walk
  status          text NOT NULL DEFAULT 'active'
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()

study.review
  id              text PK              -- rev_{ulid}
  card_id         text NOT NULL FK
  user_id         text NOT NULL
  rating          smallint NOT NULL    -- 1=again, 2=hard, 3=good, 4=easy
  confidence      smallint             -- 1-5 pre-reveal (feeds prd:prof:calibration-tracker)
  stability       real NOT NULL        -- FSRS stability after review
  difficulty      real NOT NULL        -- FSRS difficulty after review
  elapsed_days    real NOT NULL
  scheduled_days  real NOT NULL
  state           text NOT NULL        -- new, learning, review, relearning
  due_at          timestamptz NOT NULL
  reviewed_at     timestamptz NOT NULL DEFAULT now()
  answer_ms       integer

study.card_state (materialized current state -- avoids scanning all reviews)
  card_id         text NOT NULL
  user_id         text NOT NULL
  stability       real NOT NULL
  difficulty      real NOT NULL
  state           text NOT NULL
  due_at          timestamptz NOT NULL
  last_review_id  text FK
  review_count    integer NOT NULL DEFAULT 0
  lapse_count     integer NOT NULL DEFAULT 0
  PRIMARY KEY (card_id, user_id)
```

### BC lib: `libs/bc/study/`

| File                  | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `src/schema.ts`       | Drizzle schema for `study` namespace               |
| `src/srs.ts`          | FSRS-5 algorithm. Pure functions, ~100 lines.      |
| `src/srs.test.ts`     | Unit tests with known FSRS test vectors            |
| `src/cards.ts`        | Card CRUD, `getDueCards(userId)`                   |
| `src/reviews.ts`      | `submitReview()` -- runs FSRS, writes review + card_state |
| `src/stats.ts`        | Dashboard stats: due count, reviewed today, streak |

### App routes

| Route                               | Purpose                              |
| ----------------------------------- | ------------------------------------ |
| `(app)/memory/+page.svelte`         | Memory dashboard: due count, start review |
| `(app)/memory/review/+page.svelte`  | Card review flow: front -> reveal -> rate |
| `(app)/memory/new/+page.svelte`     | Card creation form                   |
| `(app)/memory/browse/+page.svelte`  | Card browser with domain/search filters |
| `(app)/memory/[id]/+page.svelte`    | Card detail/edit                     |

**MVP:** create cards, review due cards with FSRS scheduling, see due count per domain. Enough to start studying regs and airspace.

**Deferred:** card templates (regulation fill-in, plate quiz), image upload, import/export, audio, shared decks, offline.

---

## Phase 3: Decision Reps (prd:prof:decision-reps)

### Database additions

```sql
study.scenario
  id              text PK              -- rep_{ulid}
  title           text NOT NULL
  situation       text NOT NULL        -- markdown
  options         jsonb NOT NULL       -- [{id, text, isCorrect, outcome, whyNot}]
  teaching_point  text NOT NULL        -- markdown
  domain          text NOT NULL
  difficulty      text NOT NULL        -- beginner, intermediate, advanced
  phase_of_flight text                 -- preflight, takeoff, cruise, approach, etc.
  source          text                 -- manual, ntsb-case-id
  reg_references  jsonb DEFAULT '[]'
  status          text NOT NULL DEFAULT 'active'
  created_at      timestamptz NOT NULL DEFAULT now()

study.rep_attempt
  id              text PK              -- rat_{ulid}
  scenario_id     text NOT NULL FK
  user_id         text NOT NULL
  chosen_option   text NOT NULL
  is_correct      boolean NOT NULL
  confidence      smallint             -- 1-5 (feeds prd:prof:calibration-tracker)
  answer_ms       integer
  attempted_at    timestamptz NOT NULL DEFAULT now()
```

### BC additions

| File                     | Purpose                              |
| ------------------------ | ------------------------------------ |
| `src/scenarios.ts`       | Scenario CRUD, `getNextScenarios()`, `submitAttempt()` |
| `src/scenarios.test.ts`  | Unit tests                           |

### App routes

| Route                              | Purpose                               |
| ---------------------------------- | ------------------------------------- |
| `(app)/reps/+page.svelte`         | Reps dashboard: available, stats      |
| `(app)/reps/session/+page.svelte`  | Rep flow: situation -> confidence -> choose -> outcome |
| `(app)/reps/browse/+page.svelte`   | Scenario browser                      |
| `(app)/reps/new/+page.svelte`      | Scenario creation form                |

**MVP:** author micro-scenarios, run rep sessions with confidence rating + outcome reveal. ~50 scenarios across 4 domains for useful rotation.

**Deferred:** adaptive difficulty, aircraft-type variants, missed-reps-to-cards integration.

---

## Phase 4: Calibration Tracker (prd:prof:calibration-tracker)

### No new tables

Calibration data comes from existing columns:

- `study.review.confidence` + `study.review.rating` (rating >= 3 = correct)
- `study.rep_attempt.confidence` + `study.rep_attempt.is_correct`

### BC additions

| File                      | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `src/calibration.ts`      | Aggregate confidence vs accuracy by domain/bucket |
| `src/calibration.test.ts` | Unit tests with known data sets                  |

### Shared component

`libs/ui/src/components/ConfidenceSlider.svelte` -- 1-5 discrete slider (Wild Guess, Uncertain, Maybe, Probably, Certain). Used in prd:prof:spaced-memory-items review flow and prd:prof:decision-reps rep flow. Shows on ~50% of reviews (deterministic hash, not random).

### App route

`(app)/calibration/+page.svelte` -- five-bucket bar chart, per-domain breakdown, 30-day trend. CSS-only chart initially, no charting library.

**MVP:** confidence slider appears during reviews/reps, calibration page shows predicted vs. actual accuracy per domain. "I'm overconfident about weather but calibrated on regs" at a glance.

---

## Open Questions for Joshua

1. **Theme.** Sim uses `glass-cockpit`. Study should probably use `aviation` + `focus` family (lighter, more text-focused). Confirm?
2. **Domain taxonomy.** The [learning INDEX](../../vision/learning/INDEX.md) lists 14 domains. Encode as enum in constants, or freeform text?
3. **Port.** I picked 7650 (pattern: sim=7600, hangar=7610, ops=7620, runway=7640). OK?
4. **Confidence frequency.** Ask confidence on ~50% of reviews, or every time? Higher = more calibration data but more friction.
5. **Card creation while reviewing.** Quick "create related card" action from the review screen? Supports "building IS studying" but adds UI complexity.
6. **Scenario authoring.** Create decision rep scenarios in study app directly, or in hangar? For personal use, in-app is faster. Recommend: study app for now, migrate to hangar later.

---

## Phase 5: Dashboards

Three dashboards, all in the hangar app (`apps/hangar/` -- the content authoring and project management surface, see [ARCHITECTURE.md](../../platform/ARCHITECTURE.md)). These give Joshua a live view of product development progress and personal learning progress without reading markdown files.

### Why hangar, not study

The study app is the pilot-facing learning tool -- it's where you go to *study*. Dashboards are the builder/manager view -- "how is the project going?" and "how is my learning going across all domains?" That's hangar's job (see the [post-pivot app mapping](../../platform/MULTI_PRODUCT_ARCHITECTURE_OPTIONS.md) -- hangar handles content authoring + admin + product tracking). Same user (Joshua), different mode (building vs. studying).

### Data sources

The dashboards draw from two kinds of data:

**Product progress** -- derived from [PRD](../../vision/INDEX.md) frontmatter (the YAML metadata block at the top of each product spec file) in `docs/vision/products/`. Each PRD has fields like `status`, `priority`, `prd_depth`, `last_worked`, `depends_on` (see the [full frontmatter spec](../../vision/INDEX.md)). A build script parses all 53 PRDs and generates a JSON summary. The dashboard reads the JSON. No database needed -- it's a static build pattern.

**Learning progress** -- derived from the study app's database tables (`study.card_state`, `study.review`, `study.rep_attempt` -- see Phase 2 and Phase 3 schemas above). This is live data that requires the PostgreSQL DB.

### 5A: Product Progress Dashboard

The "daydreaming room" in a browser. Browse all 53 product ideas from the [vision board](../../vision/INDEX.md) without opening markdown files.

**What it shows:**

- All 53 products in a sortable/filterable grid
- Sort by: priority (default), last worked, status, category, personal need
- Filter by: category (pre-flight, proficiency, etc.), status (idea/exploring/building/shipped), platform mode, audience, complexity
- Each product card shows: name, ID, tagline, status badge, priority, last worked date
- Click through to the PRD file (rendered markdown or link to source)
- Summary stats at top: X ideas, Y exploring, Z building, W shipped

**How it works:**

A `scripts/build-product-index.ts` script:

1. Globs `docs/vision/products/**/PRD.md`
2. Parses YAML frontmatter from each (using a YAML parser like [yaml](https://github.com/eemeli/yaml))
3. Writes `apps/hangar/static/data/product-index.json`
4. Runs as a pre-build step or on-demand via `bun run build:product-index`

The hangar dashboard page reads the JSON at build time (or fetches it as a static asset). No database, no API -- just parsed markdown metadata rendered as a [Svelte 5](https://svelte.dev/docs/svelte/overview) grid component.

**Routes (in hangar app):**

| Route                                    | Purpose                            |
| ---------------------------------------- | ---------------------------------- |
| `(app)/dashboard/products/+page.svelte`  | Product grid with filters and sort |
| `(app)/dashboard/products/+page.ts`      | Load product-index.json            |

**MVP:** grid of 53 products with status badges, sortable by priority. Filter by category. Click to open PRD. Takes ~2 hours to build once the script exists.

### 5B: Learning Progress Dashboard

Tracks progress across the [14 learning domains](../../vision/learning/INDEX.md) (regulations, weather, airspace, glass cockpits, IFR procedures, VFR operations, aerodynamics, teaching methodology, ADM/human factors, safety/accident analysis, aircraft systems, flight planning, emergency procedures, FAA practical standards).

**What it shows:**

- 14 learning domains in a table
- Per-domain: cards created, cards due, cards mastered (stability > 30 days), accuracy rate, last studied date
- Per-domain: scenarios attempted, accuracy rate, [calibration score](../../vision/products/proficiency/calibration-tracker/PRD.md) (predicted confidence vs. actual accuracy)
- Overall: total cards, daily streak, review heatmap (like GitHub's contribution graph -- green squares for days you studied), [calibration curve](../../vision/products/proficiency/calibration-tracker/PRD.md) (see Phase 4)
- Weak domains highlighted (lowest accuracy, most overdue cards)
- "What to study today" recommendation based on which domains have the most due cards + lowest accuracy

**Data source:** [Drizzle ORM](https://orm.drizzle.team/) queries against `study.card`, `study.card_state`, `study.review`, `study.rep_attempt` tables (see Phase 2-3 schemas). Grouped by the `domain` column on cards and scenarios.

**Routes (in hangar app):**

| Route                                      | Purpose                                 |
| ------------------------------------------ | --------------------------------------- |
| `(app)/dashboard/learning/+page.svelte`    | Learning overview with domain breakdown |
| `(app)/dashboard/learning/+page.server.ts` | Aggregate queries against study schema  |

**MVP:** table of 14 domains with card counts, due counts, accuracy. Heatmap of review activity. "Weakest domain" callout. Requires Phase 2 ([Spaced Memory Items, prd:prof:spaced-memory-items](../../vision/products/proficiency/spaced-memory-items/PRD.md)) data to exist first -- build this after you've been studying for a week.

### 5C: Session Start Page (context-switch support)

This addresses the diversity-driven work style: "I want to work on [NTSB Story (prd:aud:ntsb-story)](../../vision/products/audio/ntsb-story/PRD.md) today, not what I worked on yesterday." Each morning, this page shows all active workstreams with "where you left off" summaries so you can pick what to work on without losing context.

**What it shows:**

- "Last time you worked on [X], you were at [state]. Here's the brief."
- List of all active workstreams with last-touched date and a 1-2 line status
- Click any workstream to get the re-entry brief and jump in

**How it works:**

A `docs/work/workstreams/` directory where each active workstream has a `STATUS.md` with frontmatter:

```yaml
---
workstream: spaced-memory-items
product_id: prd:prof:spaced-memory-items
last_worked: 2026-04-20
status: building
next_step: Wire up FSRS-5 algorithm to review submission flow
blockers: none
---
```

These are updated at the end of each work session (manually or by Claude). The session start page in hangar reads them all (same glob-and-parse-YAML pattern as the product dashboard) and presents the "pick what to work on" view.

**Routes (in hangar app):**

| Route                             | Purpose                                   |
| --------------------------------- | ----------------------------------------- |
| `(app)/dashboard/+page.svelte`    | Session start / workstream picker         |
| `(app)/dashboard/+page.server.ts` | Load workstream statuses + learning stats |

**MVP:** list of active workstreams with last-worked dates and next-step summaries. No fancy UI -- just the information needed to context-switch without losing momentum.

### Build order for dashboards

1. **5A (Product Progress)** first -- it's static data, no DB dependency, immediately useful for browsing the [vision board](../../vision/INDEX.md) in a browser instead of VS Code.
2. **5C (Session Start)** second -- supports the diversity-driven work style from day one.
3. **5B (Learning Progress)** third -- needs study app data to exist first (cards, reviews, scenarios from Phases 2-3).

---

## What We Are NOT Building Yet

- Mobile app / PWA / offline
- Audio mode, image upload, import/export
- Card templates beyond basic text Q&A
- Shared decks / community content
- Auto-generation from FAR/AIM
- Integration hooks between products (missed rep -> card)
- Turborepo build orchestration
- Ten-Minute Ticker (prd:prof:ten-minute-ticker), WX Calls (prd:prof:wx-calls), Plate Drills (prd:prof:plate-reading-drills), all event prep products (prd:evt:bfr-sprint through prd:evt:recency-recovery)
