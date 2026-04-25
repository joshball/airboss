# Theme system knowledge base

Documents capture what eight iterations taught us about building a theme system for a monorepo of surface-typed Svelte apps, plus the as-built state post Option A (PRs #78 - #85, #105, #114, #183, #190, 2026-04) so a new agent can see the shape in the running code.

## If you just need to use the system

Start at **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** -- "I want to style X, here's the token." That covers ~95% of day-to-day work.

## Documents

1. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - one-page cheat sheet. Which token / primitive / tone do I reach for, right now.
2. **[01-LESSONS.md](01-LESSONS.md)** - what eight prior iterations taught us. What kept working, what kept failing, why. Read before changing the architecture.
3. **[02-ARCHITECTURE.md](02-ARCHITECTURE.md)** - the as-built reference architecture. Directory shape, layered token model, contract types, registry, derivation, emission, pre-hydration, appearance cookie. The shape currently in `libs/themes/` on main.
4. **[03-ENFORCEMENT.md](03-ENFORCEMENT.md)** - lint rules, codemods, contrast tests, CI gates. The tools that make the system stick.
5. **[04-VOCABULARY.md](04-VOCABULARY.md)** - complete token-name catalog, derived from `libs/themes/vocab.ts` + the emit pipeline.
6. **[05-OVERHAUL-2026-04.md](05-OVERHAUL-2026-04.md)** - how Option A actually landed. Wave graph, file-ownership scoping rule, compat-alias bridge strategy, appearance-toggle UX. The "how" companion to 02's "what".

## The executive summary

A theme system survives if and only if:

- Token names are **role-based** (`ink`, `surface`, `action`, `signal`, `edge`), not ranked (`primary`, `secondary`).
- Composition has **three axes max**: `theme`, `appearance` (light/dark), `layout`.
- Values are **derived, not enumerated**: declare a base color, math produces hover/active/wash/edge/ink.
- **TypeScript is the source of truth**; CSS is emitted from it. Never hand-sync two lists.
- **Enforcement ships with the architecture** — lint rule, codemod, contrast tests, CI gates. Documentation doesn't enforce anything.
- **FOUC is handled from day one** via a pre-hydration script, not retrofitted.
- **App-specific vocabulary stays app-scoped** via TypeScript import boundaries.

## The graveyard

What seven iterations tried and abandoned:

- Over-semantic vocabularies (airboss-v1's 100+ `InformationType` enum) — adoption can't keep up.
- More than three axes (airboss-ng's chrome axis, peepfood-launchpad's 5-axis preset matrix) — testing surface explodes, usage fragments.
- Hand-synced TypeScript + CSS token lists — drift inevitable.
- Adoption-by-documentation (airboss-v1's 11 deleted rollout docs) — without teeth, nobody migrates.
- Deferred contrast testing — every iteration meant to, none did.
- Deferred FOUC handling — always a painful retrofit when it lands.
- Layout templates bundled into themes — 12 combinations to test, half get untested.

## For the next project

If you're building a theme system from scratch in a fresh project:

1. Start with `02-ARCHITECTURE.md` §"Directory layout" and scaffold the dirs and files.
2. Copy `04-VOCABULARY.md` directly into `libs/themes/vocab.ts` — don't invent new names.
3. Implement `03-ENFORCEMENT.md` §1 (lint rule) *before* shipping the first theme. Land with an empty ignore file.
4. Implement `03-ENFORCEMENT.md` §3 (contrast tests) *before* shipping the second theme.
5. Add the pre-hydration script (`02-ARCHITECTURE.md` §"Pre-hydration") on day one.
6. Resist adding a fourth axis. Resist adding rank words. Resist adding tokens you can't name a use for.

## For this project (airboss)

See the [airboss plan and work packages](../../work-packages/README.md) for how these docs translate into the specific sequence of changes landing in airboss. The plan is derived directly from these four docs — if the plan ever conflicts with the docs, the docs win.
