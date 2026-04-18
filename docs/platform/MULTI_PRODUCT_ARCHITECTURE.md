---
title: Multi-Product Architecture Decision
date: 2026-04-17
status: decided
parent: ./PIVOT.md
decided_from: ./MULTI_PRODUCT_ARCHITECTURE_OPTIONS.md
---

# Multi-Product Architecture Decision

## Decision

**Option 7: capability-surface apps in a new monorepo (`airboss`).**

Products are grouped by rendering surface -- what they need from the platform technically -- not by content theme. A weather quiz and a regulation quiz both live in `study/` because they share card UI and spaced rep infrastructure. A route map and an airport card both live in `spatial/` because they share map rendering and aeronautical data.

**Separate repo.** The pilot performance platform lives in `joshball/airboss`. FIRC stays in `joshball/firc-boss`. They share no code dependencies -- patterns were copied, not linked.

See [MULTI_PRODUCT_ARCHITECTURE_OPTIONS.md](MULTI_PRODUCT_ARCHITECTURE_OPTIONS.md) for the full options analysis.

## Why Option 7

- **Apps organized by rendering surface, not content theme.** Keeps dependency trees right-sized per app. Study app doesn't bundle map rendering. Spatial app doesn't bundle audio processing.
- **Design systems diverge where they should.** Study = mobile-first card UI. Spatial = maps. Avionics = instrument panels. Audio = player chrome.
- **Independent deploys.** Fix the spaced rep algorithm without redeploying the map app.
- **5-7 apps, not 15+.** Manageable overhead without cramming everything into one giant app.
- **Clear organizing principle.** "Where does this product go?" -> match the primary rendering surface.

## Why a separate repo

FIRC and the pilot performance platform are different products:

| | FIRC (firc-boss) | Pilot Performance (airboss) |
| --- | --- | --- |
| What it is | A structured course | A toolkit of products |
| Regulatory | FAA-approved (eventually) | None |
| Audience | CFIs, every 24 months | Every pilot, daily |
| Revenue model | Course fee | Cover-costs / open-source |
| Apps | sim, hangar, ops, runway | study, spatial, reflect, etc. |
| Status | 5 phases built | Scaffolded |

Mixing them creates confusion at every level -- naming (`@firc/*` vs `@ab/*`), docs, git history, CLAUDE.md rules. Clean separation now avoids untangling later.

## What it looks like today

```text
airboss/
  apps/
    study/              SvelteKit -- quiz, reps, spaced rep, calibration (port 9600)
  libs/
    constants/          Ports, hosts, routes, schemas, roles
    types/              Shared types, Zod schemas
    db/                 Drizzle connection (PostgreSQL)
    auth/               Identity, sessions
    ui/                 Svelte components
    themes/             Design tokens
    utils/              ID generators, helpers
    bc/
      study/            Spaced rep, cards, reviews, scenarios, calibration
```

## What it looks like at full build-out

Surface apps are created as products demand them, not speculatively:

```text
airboss/
  apps/
    study/              Quiz, reps, spaced rep, event prep, calibration
    spatial/            Route walkthrough, airport cards, airspace, maps
    avionics/           Glass cockpit trainer
    audio/              NTSB stories, daily decision, ATC comms, memory audio
    reflect/            Journals, heatmaps, currency tracking, decision diary
    firc/               FIRC course (migrated from firc-boss -- see below)
    hangar/             Content authoring + admin
    runway/             Public site
  libs/
    constants/          Enums, routes, ports, config
    types/              Shared types, Zod schemas
    db/                 Shared Drizzle connection
    auth/               Identity, sessions, permissions
    audit/              Action logging, content version history
    engine/             Scenario tick engine, scoring (migrated from firc-boss)
    learning/           Spaced rep algorithm (FSRS-5), progress, streaks
    spatial/            Airport/airspace/terrain data layer
    audio/              TTS, audio generation utils
    themes/             Design tokens, theme definitions
    ui/                 Svelte components, layout shells
    utils/              ID generators, helpers
    bc/
      study/            Cards, reviews, scenarios, calibration
      course/           Curriculum + content authoring (migrated from firc-boss)
      enrollment/       Learner progress + completion (migrated from firc-boss)
      evidence/         Scenario runs, scores (migrated from firc-boss)
      compliance/       FAA traceability (migrated from firc-boss, dormant unless needed)
```

## FIRC migration plan

FIRC will eventually migrate into `airboss` as a surface app. Not now -- the platform needs its own identity first.

**When:** after the study app has shipped its MVP (Spaced Memory Items + Decision Reps + Calibration Tracker) and the shared infrastructure (auth, db, themes, ui) is proven.

**What migrates:**

- `libs/engine/` -> `airboss/libs/engine/` (scenario tick engine, scoring)
- `libs/bc/course/` -> `airboss/libs/bc/course/` (curriculum + content)
- `libs/bc/enrollment/` -> `airboss/libs/bc/enrollment/` (learner progress)
- `libs/bc/evidence/` -> `airboss/libs/bc/evidence/` (scenario runs, scores)
- `libs/bc/compliance/` -> `airboss/libs/bc/compliance/` (FAA traceability)
- `libs/audit/` -> `airboss/libs/audit/` (action logging)
- `apps/sim/` -> `airboss/apps/firc/` (renamed -- it's the FIRC course surface)
- `apps/hangar/` -> `airboss/apps/hangar/` (content authoring for all products)
- `course/` -> `airboss/course/` (curriculum content layers L01-L05)

**What stays in firc-boss:** nothing, eventually. Once migration is complete, firc-boss becomes an archived repo. The 503 questions, AC 61-83K research, compliance pipeline, and all FIRC content live in airboss under the `firc/` surface app and `course/` content directory.

**What does NOT migrate prematurely:** everything. Don't move code until airboss is ready to receive it. The study app needs to prove the new repo's patterns work before we start porting FIRC infrastructure.

## Build order

Products built in the order they're needed, each creating its surface app when first required:

| Order | Product | Surface app | Status |
| ----- | ------- | ----------- | ------ |
| 1 | Spaced Memory Items | study | first build |
| 2 | Decision Reps | study | first build |
| 3 | Calibration Tracker | study | first build |
| 4 | Ten-Minute Ticker | study | after MVP |
| 5 | Route Walkthrough | spatial (new) | creates spatial app |
| 6 | Avionics Trainer | avionics (new) | creates avionics app |
| 7 | Recency Recovery | study | event prep |
| 8 | Per-Flight Journal | reflect (new) | creates reflect app |
| -- | FIRC migration | firc (new) | after study MVP proven |

## Open questions

- **Shared navigation.** How do multiple surface apps feel like one product to the pilot? Shared header/nav from `libs/ui/`, cross-app links, shared cookie domain. Needs design work before the second pilot-facing app ships.
- **Community products (G1-G5).** Own app or features within study/reflect? Defer until social features are real.
- **Lightweight/mobile products (IMSAFE, Passenger Brief, etc.).** PWA features of study app, or dedicated `quick/` app? Defer.
- **Turborepo.** Add when CI gets slow, not before. Plain Bun workspaces for now.

## References

- [Options analysis](MULTI_PRODUCT_ARCHITECTURE_OPTIONS.md) -- all 7 options evaluated
- [Pivot doc](PIVOT.md) -- why we moved from FIRC to pilot performance
- [Study app plan](../work/plans/20260415-study-app-plan.md) -- Phase 1-5 implementation plan
- [Product index](../vision/INDEX.md) -- all 53 product ideas with priority and status
