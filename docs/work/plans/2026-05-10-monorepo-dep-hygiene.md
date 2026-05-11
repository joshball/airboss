---
title: Monorepo dep hygiene -- declare deps where they're used
date: 2026-05-10
machine: airboss-dev
branch: main
triggering_prompt: Investigating d3-geo missing-dep error -- surfaced wider duplicate-and-undeclared dep pattern across the monorepo
context: |
  Symptom: `bun run charts validate` failed with "Cannot find package 'd3-geo'" after PR #803 fixed `d3-geo-projection`.
  Root cause of that single failure was a stale `bun install`; root cause of the *class* of failure is that many workspaces
  consume packages they don't declare, relying on root-hoisting as a contract. A different package manager, a stricter
  install profile, or an external consumer would break.

  This plan defines the cleanup scope, the categorization rules, and the shipping order. It is *not* a work package
  (per CLAUDE.md WP rules: refactors and dep cleanups don't earn a WP). It's a multi-PR cleanup tracked here.
---

# Monorepo dep hygiene

## Problem

Three distinct symptoms surfaced by [scripts/dep-audit.ts](../../scripts/dep-audit.ts) (to be authored as part of step 0):

### Problem 1 -- Duplicated runtime deps

Eight packages are declared in **both** root `devDependencies` AND a workspace's `dependencies`. The workspace declaration is correct; the root declaration is redundant and lies about what's "dev-only".

| Package             | Root section | Declared in workspace          |
| ------------------- | ------------ | ------------------------------ |
| `d3-contour`        | devDeps      | `@ab/wx-charts`                |
| `d3-geo`            | devDeps      | `@ab/wx-charts`                |
| `d3-geo-projection` | devDeps      | `@ab/wx-charts`                |
| `drizzle-orm`       | devDeps      | `@ab/sources`                  |
| `smol-toml`         | devDeps      | `@ab/aviation`                 |
| `topojson-client`   | devDeps      | `@ab/wx-charts`                |
| `yaml`              | devDeps      | `@ab/sources`, `@ab/wx-charts` |
| `zod`               | devDeps      | `@ab/wx-charts`                |

### Problem 2 -- Workspaces import packages they don't declare

18 packages are imported by one-or-more workspace `src/` files but absent from that workspace's `package.json`. They resolve only because bun hoists them from root `node_modules`. A fresh clone with hoisting disabled, an external consumer, or a stricter installer would fail.

The worst offenders (by workspace-count):

| Package                                                          | Undeclared workspaces                                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest`                                                         | 22 workspaces                                                                                                                                           |
| `drizzle-orm`                                                    | 10 workspaces (@ab/study, @ab/auth, @ab/audit, @ab/hangar-jobs, @ab/hangar-sync, @ab/db, @ab/bc-study, @ab/bc-hangar, @ab/bc-ingest-review, @ab/bc-sim) |
| `svelte`                                                         | 10 workspaces                                                                                                                                           |
| `@testing-library/svelte`                                        | 8 workspaces                                                                                                                                            |
| `@sveltejs/kit`                                                  | 7 workspaces                                                                                                                                            |
| `zod`                                                            | 5 workspaces                                                                                                                                            |
| `@sveltejs/adapter-node`, `@sveltejs/vite-plugin-svelte`, `vite` | 5 apps each                                                                                                                                             |
| `@testing-library/user-event`                                    | 4 workspaces                                                                                                                                            |
| `better-auth`, `yaml`                                            | 3 workspaces each                                                                                                                                       |
| `@testing-library/jest-dom`                                      | 2 workspaces                                                                                                                                            |
| `postgres`, `resend`, `shiki`, `ts-fsrs`, `ulidx`                | 1 workspace each (single-owner -- should clearly be in that workspace, not root)                                                                        |

### Problem 3 -- Root has both true-root deps and pseudo-root deps mixed together

Two packages are legitimately only used by `scripts/`, `tools/`, `tests/`, or `drizzle/` (root-level surface, not a workspace): `@playwright/test` and `bun` (the latter implicit / installed globally). Everything else in root devDeps should either move to a workspace or stay as a toolchain shared dep.

## Design decisions

### Decision 1 -- "Where a package is used, that's where it's declared"

The end-state is: every workspace declares every package it imports. Root retains only:

- Tools that operate on the repo as a whole (`@biomejs/biome`, `@playwright/test`, `drizzle-kit`, `svelte-check`, `typescript`).
- `@types/*` packages for hoisted-types-only consumption (no runtime cost; this is the standard monorepo pattern).
- The toolchain shared deps (`vite`, `vitest`, `svelte`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, `@sveltejs/adapter-node`) -- these are toolchain-level singletons in this repo and *also* get declared by every workspace that imports them, mirroring the pattern bun/pnpm catalog support. The duplication here is intentional, not redundancy.
- `happy-dom` -- declared by every workspace that runs vitest, but also at root so vitest's auto-config picks it up.

This is the "explicit > implicit" trade: a slightly noisier set of package.json files, in exchange for zero reliance on hoisting as a resolution contract.

### Decision 2 -- One PR per phase, each independently revertable

Five phases (see below). Each phase is one PR. Each PR runs `bun run check all` clean. No phase depends on a later phase having landed; rolling back any one phase keeps the others working.

### Decision 3 -- No version drift

When promoting / demoting a package between root and workspace, the version string is copied verbatim. The lockfile is regenerated; the resolution must not change. If the regenerated lockfile shows version movement, that's a signal something is wrong with the move -- pause and investigate before committing.

### Decision 4 -- Audit script lives in the repo

`scripts/dep-audit.ts` is the source of truth for "is the cleanup done?". It walks every workspace's `src/`, collects bare-package imports, and reports duplicates + undeclared + root-only. Re-run after every phase; the report shrinks monotonically until empty.

The script also gets wired into `bun run check` as a new step (`dep-audit`) once Phase 5 lands, so future PRs that introduce undeclared deps fail before merge.

## Phases

### Phase 0 -- Author audit script

- File: `scripts/dep-audit.ts`
- Output: three sections (duplicates, undeclared, root-only)
- Reads `package.json` files, walks `src/` of every workspace, regex-extracts bare-package imports
- Single PR. No package.json edits yet -- this is the measurement tool.

Acceptance: `bun run track audit-deps` (new script entry) prints the audit. `--json` flag for machine-readable output. Re-runs in <2s.

### Phase 1 -- Demote fully-duplicated runtime deps (5 packages)

Of the eight duplicates from Problem 1, only five are fully-duplicate (every consuming workspace already declares them): `d3-contour`, `d3-geo`, `d3-geo-projection`, `smol-toml`, `topojson-client`. Remove from root devDeps.

The remaining three (`drizzle-orm`, `yaml`, `zod`) are partially-duplicated: declared at some consuming workspaces and undeclared at others. Removing them from root in Phase 1 would break the undeclared consumers. These move to **Phase 3** (their dedicated phase, which adds workspace declarations and removes the root entry in one PR).

- Files: `package.json` (root), `bun.lock`
- Commands: edit, `bun install`, audit
- Risk: trivial. Every consumer already has the workspace declaration.

Acceptance: dep-audit shows the duplicated set shrunk to the three Phase-3 packages. `bun run check all` clean.

### Phase 2 -- Declare deps for single-owner imports (5 packages, 5 workspaces)

Single-owner packages where exactly one workspace imports them: `postgres` (@ab/db), `resend` (@ab/auth), `shiki` (@ab/help), `ts-fsrs` (@ab/bc-study), `ulidx` (@ab/utils).

- Files: per-workspace `package.json`, root `package.json` (remove the now-orphaned root dep), `bun.lock`
- Risk: low. Each move is local to one workspace and one importer.

Acceptance: `dep-audit` reports zero "undeclared" entries for these five. `bun run check all` clean.

### Phase 3 -- Declare deps for multi-owner BC / data layer (4 packages)

`drizzle-orm` (10 workspaces), `better-auth` (3), `yaml` (3), `zod` (5).

- Per-workspace adds; root entry removed (drizzle-orm, better-auth, yaml, zod are not toolchain singletons).
- This is the largest scope phase -- ~21 workspace package.json edits.
- Risk: medium. Higher chance of version-pin mismatch surfacing across workspaces. If any workspace ends up with a different resolved version than expected, halt and reconcile.

Acceptance: dep-audit reports zero "undeclared" entries for these four. `bun run check all` clean. `bun run smoke` clean (catches drizzle-orm hot-path issues that types alone miss).

### Phase 4 -- Declare deps for SvelteKit toolchain (7 packages, every app + several libs)

`@sveltejs/kit` (7 workspaces), `@sveltejs/adapter-node` (5), `@sveltejs/vite-plugin-svelte` (5), `svelte` (10), `vite` (5), `vitest` (22), `@testing-library/*` (2-8 each).

- Per-workspace adds; root entries **kept** (toolchain singletons).
- Largest by edit-count; lowest risk per edit (each is "add a line to package.json"); easy to validate (svelte-check / `bun run check types`).

Acceptance: dep-audit reports zero "undeclared" entries for any toolchain package. `bun run check all` clean.

### Phase 5 -- Wire dep-audit into bun run check

- File: `scripts/check.ts`, `scripts/dep-audit.ts`
- Add a new check step (`dep-audit`) that fails if `dep-audit --strict` finds duplicates or undeclared
- One PR

Acceptance: introducing a bad dep (test by reverting a Phase 1-4 change in a throwaway branch) causes `bun run check` to fail.

## What's deliberately NOT in this plan

- **Version unification across workspaces.** If two workspaces declare different versions of the same package, that's a separate concern (often legitimate; the version-mismatch error you'd hit at install time is the natural surfacing). This plan copies versions verbatim; it does not converge them.
- **Replacing `@types/*` at root.** Root-hoisted `@types/*` is the standard monorepo pattern and is fine.
- **Migrating away from bun workspaces.** Out of scope.
- **Catalog support** (bun/pnpm "catalog" feature for shared toolchain pinning). Worth revisiting after Phase 4 lands; the duplication that bothers people about toolchain deps in every workspace is exactly what catalog solves.

## Out of scope -- explicit decisions per CLAUDE.md "no undecided considerations" rule

| Item                                             | Decision                                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bun catalog adoption                             | Defer with trigger: revisit when Phase 4 lands and the toolchain duplication is visible. If catalog support is stable in bun by then, file follow-on. |
| Version unification across workspaces            | Drop. Separate concern, separate plan if needed.                                                                                                      |
| Replace `bun install` with stricter installer    | Drop. The audit script + check step gives us the same guarantee without changing tooling.                                                             |
| Convert root `devDependencies` to `dependencies` | Drop. Root has no runtime; the devDeps label is correct for everything that stays at root.                                                            |
| Add a "no relative imports across libs" check    | Out of scope here; that's a separate import-hygiene concern (CLAUDE.md already mandates @ab/* aliases).                                               |

## Order of operations

1. **Phase 0** (audit script) -- ship first; everything else measures against it
2. **Phase 1** (duplicates) -- smallest, lowest risk, fastest signal
3. **Phase 2** (single-owner) -- clear wins
4. **Phase 3** (multi-owner data layer) -- risk-bearing; do third so the easy wins are banked first
5. **Phase 4** (toolchain) -- largest by edit volume; do last so the audit script has caught the easy cases first
6. **Phase 5** (wire into check) -- gate; locks the cleanup in

Each phase is one PR. Total: 6 PRs.

## Validation per phase

| Phase | Validator                                                                               |
| ----- | --------------------------------------------------------------------------------------- |
| 0     | `bun run dep-audit` prints expected structure; counts match the numbers in this doc     |
| 1     | dep-audit duplicates = 0                                                                |
| 2     | dep-audit undeclared shrinks by 5 single-owner packages                                 |
| 3     | dep-audit undeclared shrinks by drizzle-orm, better-auth, yaml, zod; `bun run smoke` ok |
| 4     | dep-audit undeclared = 0                                                                |
| 5     | dep-audit gate fails on a synthetic bad dep                                             |

## Risk register

| Risk                                                                  | Likelihood | Mitigation                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 3 surfaces a drizzle-orm version-pin mismatch across workspaces | Medium     | Copy version verbatim from current root. If two workspaces end up at different resolved versions in the lockfile, that's the surface of an existing problem -- pause, reconcile, decide whether to unify or accept the mismatch in this WP or a follow-on. |
| Removing root dep removes a transitive `peerDependency` resolution    | Low        | After each phase, `bun install` + `bun run check all`. A peerDeps issue surfaces as a missing-peer warning at install time.                                                                                                                                |
| External consumer of `@ab/*` exists that this would break             | Zero       | Repo is private, all-rights-reserved per memory `project_license_and_hosting.md`; no external consumers exist.                                                                                                                                             |
| Phase 4 cross-workspace `vitest` version pin diverges                 | Low        | All workspaces use the same vitest config from root today; copying the same version string keeps that property. Risk only if a workspace independently wants a different vitest version, which is a separate decision.                                     |

## Tracking

- This file is the canonical plan -- update each phase as PRs land
- No work-package directory needed (refactor, not a feature, per CLAUDE.md WP threshold)
- Per-phase progress tracked inline below

### Phase progress

- [x] Phase 0 -- audit script (PR #805)
- [x] Phase 1 -- demote 5 fully-duplicated deps (PR #806; revised from 8, see plan note above)
- [x] Phase 2 -- single-owner declarations (PR #807)
- [x] Phase 3 -- multi-owner data layer (PR #809)
- [x] Phase 4 -- toolchain declarations (PR #810)
- [x] Phase 5 -- wire into `bun run check` (this PR)

### Final state

```text
$ bun run dep-audit
=== DUPLICATED (0) === (none)
=== UNDECLARED (0) === (none)
=== ROOT-ONLY (2) ===  @playwright/test, bun  (legitimate)
```

The cleanup is complete. The `dep-audit` step in `bun run check` will fail any future PR that introduces an undeclared dep or a root/workspace duplicate.
