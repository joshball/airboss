---
title: 'Architecture Review: UI library and themes'
date: 2026-05-02
category: architecture
feature: ui-library-themes
branch: main
reviewer: architecture
scope: 'libs/ui, libs/themes, libs/activities, libs/help'
review_status: done
status: unread
counts:
  critical: 2
  major: 4
  minor: 3
  nit: 2
closed_out: 2026-05-04
---

# Architecture Review -- UI library and themes

Scope: presentation-layer libs only -- `libs/ui/`, `libs/themes/`, `libs/activities/`, `libs/help/`. Apps and BCs were read for context only (consumer call sites verified) and are not in scope for fixes here.

Architectural rules audited (from CLAUDE.md + ADR 002):

- Cross-lib imports use `@ab/*` aliases (never relative paths across lib boundaries).
- Intra-lib imports use relative paths.
- Dependency direction: `constants -> types -> bc/engine -> apps`. Presentation libs (`themes`, `ui`) sit alongside / below apps and must not depend on apps or BCs.
- `package.json` `dependencies` accurately declares every `@ab/*` import the lib makes.
- Module organization: what belongs in `libs/ui` vs `libs/activities` vs `libs/help` (per CLAUDE.md monorepo map -- "domain-coupled visual components" -> `activities`, generic primitives -> `ui`).

## Summary

Two structural problems jump out and they're related. First, `libs/ui` and `libs/help` form an undeclared circular dependency at the module level: `libs/ui/components/InfoTip.svelte` imports `helpRegistry` from `@ab/help`, and `libs/help/src/ui/PageHelp.svelte` imports `Drawer` from `@ab/ui/components/Drawer.svelte`. The cycle is reachable in real consumer code (apps register help and use InfoTip on the same page). The package.json declares only one direction of the edge (`ui -> help`), so the reverse import is also a missing-dependency issue.

Second, `libs/ui` has accumulated two domain-specific subdirectories (`handbooks/` and `library/`) whose components are only consumed by `apps/study/library/*` routes and pull `@ab/constants` aviation enums (handbook read statuses, reference kinds, aviation topics). These are app-specific surface chrome, not generic primitives -- they belong either inside `apps/study/src/lib/` or in a domain-coupled lib (`libs/aviation/ui/` already exists for exactly this purpose), and their presence in `@ab/ui` blurs the "generic vs domain-coupled" line that ADR 002 and CLAUDE.md draw.

`libs/activities/package.json` declares zero dependencies but the components import `@ab/bc-sim` and `@ab/constants`. That's a manifest bug: the lib works today only because the workspace resolves aliases via tsconfig paths, but the package metadata lies about what it needs.

`libs/themes/` is clean: dependency direction is correct (`themes -> constants` only), no relative imports cross the lib boundary, surface-specific theme bundles (`sim/glass`, `study/sectional`, `study/flightdeck`) are co-located inside themes as a registry rather than leaking into surfaces, and the `index.ts` documents the runtime-vs-component split clearly.

`libs/help/` schema/registry/markdown/search code is well-bounded; the cycle and the `@ab/aviation` ReferenceText subpath import are the only architectural concerns there.

## Issues

### CRITICAL: Circular dependency between `@ab/ui` and `@ab/help`

File: `libs/ui/src/components/InfoTip.svelte:28`, `libs/help/src/ui/PageHelp.svelte:22`

Problem: `libs/ui/src/components/InfoTip.svelte` does `import { helpRegistry } from '@ab/help'`. `libs/help/src/ui/PageHelp.svelte` does `import Drawer from '@ab/ui/components/Drawer.svelte'`. Both edges are real -- both components ship to apps that consume them on the same routes -- so this is a runtime cycle, not just a type one. `libs/ui/package.json` only declares the `ui -> help` edge; the reverse is undeclared (see also the next finding).

Rule: Dependency direction must be acyclic. ADR 002 places `themes` and `ui` in the Presentation layer; `help` is a content/registry lib that already sits at the Presentation layer too. Two presentation libs cannot mutually depend on each other.

Fix: Pick a single direction and break the other. Two reasonable options:

1. Move the `Drawer` shell out of `@ab/ui` into a leaf lib (or keep it in `@ab/ui` and have `@ab/help` re-implement a lightweight drawer for its own page-help affordance). PageHelp is the only off-app consumer of Drawer in `libs/help`, and the drawer pattern is mostly chrome.
2. Invert: move `helpRegistry` lookup out of `InfoTip.svelte`. Have callers pass the `helpId`-resolved page (or a `getHelpPage(id)` callback) as a prop, so `@ab/ui` stays a leaf and `@ab/help` is the only side that knows the registry. This matches the rest of `@ab/ui` -- generic components don't reach into domain registries.

Option 2 is cheaper and aligns with the "ui is generic primitives" principle. Apps already import both libs; the resolver lives at the call site naturally.

### CRITICAL: `libs/help` imports `@ab/ui` without declaring it

File: `libs/help/package.json`

Problem: `libs/help/src/ui/PageHelp.svelte` imports `@ab/ui/components/Drawer.svelte`, but `libs/help/package.json` `dependencies` lists only `@ab/aviation`, `@ab/constants`, `@ab/utils`. The `@ab/ui` edge is undeclared. This works today because tsconfig path aliases resolve regardless of package.json, but the workspace dependency graph is wrong -- a hoist or extraction step would break.

Rule: `package.json` `dependencies` must declare every cross-lib `@ab/*` import. CLAUDE.md "Import Rules" section is enforced via the manifest; aliases are the import shape, dependencies are the declaration.

Fix: After resolving the cycle (previous finding), reconcile the manifest. If the cycle is broken by removing the `help -> ui` edge, drop nothing; if the `ui -> help` edge is what's broken, remove `@ab/help` from `libs/ui/package.json` instead. Whichever direction survives must be the only one declared.

### MAJOR: `libs/activities/package.json` declares no dependencies despite importing two libs

File: `libs/activities/package.json`

Problem: The manifest is `{ "name": "@ab/activities", "private": true, "type": "module" }` with no `dependencies` block. But `libs/activities/src/pfd/Pfd.svelte`, `airspeed-arcs.ts`, and the entire `cockpit-panel/` tree import `@ab/bc-sim` and `@ab/constants`. Same alias-vs-manifest mismatch as the help->ui finding, but for two libs.

Rule: Manifest must declare every cross-lib import. ADR 002's lib categories also depend on this -- if `activities` is presentation that depends on `bc-sim` (Domain), the manifest needs to say so for the dependency-direction audit to even be possible.

Fix: Add `"dependencies": { "@ab/bc-sim": "workspace:*", "@ab/constants": "workspace:*" }` to `libs/activities/package.json`. Also add an `exports` field matching the consumption pattern (`./pfd/*`, `./cockpit-panel/*`, `./crosswind-component/*`) -- consumers already import via subpath, the manifest should formalize it like `libs/ui` does.

### MAJOR: `libs/ui/handbooks/*` is domain-coupled study-app chrome, not generic UI

File: `libs/ui/src/handbooks/` (9 components)

Problem: Every component in `libs/ui/src/handbooks/` is consumed only by `apps/study/src/routes/(app)/library/handbook/*` and `apps/study/.../regulations/*`. They import aviation-domain enums from `@ab/constants` (`HANDBOOK_AMENDMENT_BADGE_LABEL`, `HANDBOOK_NOTES_MAX_LENGTH`, `HANDBOOK_READ_STATUSES`, errata kinds) -- this is FAA-handbook-specific UI, not a generic primitive. Per CLAUDE.md monorepo map, `libs/activities/` is "domain-coupled visual components"; `libs/ui/` is generic. These components fit `activities`' definition but were placed in `ui`.

Rule: ADR 002 separates "Presentation -- design system, components, layouts" (`ui`) from domain logic. CLAUDE.md monorepo map reinforces: domain-coupled visual components go to `activities`. Mixing handbook-specific chrome into the generic library makes the boundary meaningless and forces every consumer of `@ab/ui` to share the handbook surface area.

Fix: Move `libs/ui/src/handbooks/*` out of `@ab/ui`. Two viable destinations:

1. `libs/aviation/src/ui/handbooks/` -- already has `ReferenceCard`, `ReferenceText`, `ReferenceSidebar` for the same domain. Best fit; co-locates with the references it cites.
2. `apps/study/src/lib/handbook/` -- if the components are purely study-surface chrome and won't be reused. Cheaper, locks them to one app.

Pick (1). The component set is reusable across surfaces (firc app will need the same handbook reader), and `@ab/aviation` already has a `ui/` subdir for exactly this kind of domain-coupled component.

### MAJOR: `libs/ui/library/LibraryCard.svelte` is study-library chrome, not generic UI

File: `libs/ui/src/library/LibraryCard.svelte`

Problem: Same shape as the previous finding. `LibraryCard` imports `AVIATION_TOPIC_LABELS`, `REFERENCE_KIND_LABELS`, `ROUTES` from `@ab/constants` and is consumed only by `apps/study/src/routes/(app)/library/*` (cert, aircraft, topic, regulations). Hardcodes aviation taxonomy; not a generic card primitive.

Rule: Same as previous -- `libs/ui` is generic primitives; aviation-domain cards belong in `libs/aviation` or the consuming app.

Fix: Move to `libs/aviation/src/ui/LibraryCard.svelte` alongside `ReferenceCard`. The "library" prefix in the path is also a study-feature word, not a UI-primitive word -- the destination should drop the `library/` directory layer.

### MAJOR: `libs/help` imports a `.svelte` file from `@ab/aviation` via subpath without declaring an exports contract

File: `libs/help/src/ui/HelpSection.svelte:2` -- `import ReferenceText from '@ab/aviation/ui/ReferenceText.svelte';`

Problem: `@ab/aviation` package.json has no `exports` field. The subpath works only because tsconfig path alias `@ab/aviation/*` -> `libs/aviation/src/*` resolves it. There's no declared public API for the `ui/` subdir, so any reorganization of `libs/aviation/src/ui/` silently breaks `@ab/help`. `libs/ui/package.json` solved the same problem with explicit `exports` (`./components/*`, `./handbooks/*`, etc.).

Rule: When one lib reaches into another lib's filesystem layout via subpath, the target lib must publish that subpath in `exports`. Otherwise it's an undocumented coupling.

Fix: Add an `exports` field to `libs/aviation/package.json` declaring the `ui/*` subpath (and the index entry). Mirrors `libs/ui` and `libs/help` shape.

### MINOR: `libs/ui/src/index.ts` re-exports `Tone`/`TONES`/`isTone` from `@ab/themes`

File: `libs/ui/src/index.ts:19`

Problem: The barrel re-exports tone vocabulary from `@ab/themes` "so callers don't have to import from two packages for a single prop." Convenient, but it means a non-Svelte caller importing the `ui` barrel pulls a transitive `@ab/themes` evaluation. More importantly, it creates two import paths for the same identity (`@ab/themes` and `@ab/ui`) -- a subtle vector for two-copy bugs and inconsistent grep results when refactoring.

Rule: Keep public API surface minimal. Re-exports across lib boundaries should serve a clear architectural purpose (e.g. "ui is the only public face for theme tokens"); convenience aliasing tends to drift.

Fix: Drop the re-export. Callers import `Tone` from `@ab/themes` directly. The `Banner`/`StatTile`/`Badge` components inside `@ab/ui` already do this; consumers can do the same.

### MINOR: Theme surface-bundles auto-register via index side-effect imports

File: `libs/themes/index.ts:95-98`

Problem: `libs/themes/index.ts` ends with side-effect imports of all four theme bundles (`airboss-default`, `study/sectional`, `study/flightdeck`, `sim/glass`). Importing the barrel always registers every theme, even on a surface that uses only one. Vitest, scripts, and the avionics surface all pay the registration cost.

Rule: Side-effect-loading registries from a barrel forces global state on every consumer. Better to expose `register*` functions and let the consuming app decide what to load.

Fix: Move the registration imports out of the index. Provide a `registerAllThemes()` helper, and let each app's root layout call it (or import only the bundles it ships). Alternatively, accept the current design but document the side-effect contract loudly in the barrel header. This is a minor correctness/perf concern, not a structural rule violation.

### MINOR: `libs/themes` has no `exports` field but consumers reach deep subpaths

File: `libs/themes/package.json`

Problem: Consumers import `@ab/themes/ThemeProvider.svelte`, `@ab/themes/picker/ThemePicker.svelte`, `@ab/themes/generated/tokens.css`. None of these paths are declared in `package.json` `exports`. Same shape as the `@ab/aviation` finding above.

Rule: Public subpaths should be declared in `exports`. Otherwise the lib's filesystem layout is the public API.

Fix: Add an `exports` field declaring `.`, `./ThemeProvider.svelte`, `./picker/*`, `./generated/*`. Mirrors `libs/ui` shape.

### NIT: `libs/ui` directory split is `components/` plus two domain folders

File: `libs/ui/src/`

Problem: After the handbooks/library moves above land, `libs/ui/src/` becomes `components/`, `lib/`, and `index.ts`. The `components/` subdirectory is then redundant -- everything in the lib is a component or its helper.

Rule: Naming nit only.

Fix: Once the domain folders are out, consider flattening `components/` to `src/` directly. Or keep it. Cosmetic.

### NIT: `libs/help/src/ui/` mixes UI components with `page-help-url.ts` URL helper

File: `libs/help/src/ui/page-help-url.ts`

Problem: The `ui/` directory holds `.svelte` components plus a pure-TS helper (`page-help-url.ts` and its test). Symmetric with how `libs/ui/src/lib/focus-trap.ts` is separated into a `lib/` subdir adjacent to `components/`.

Rule: Naming nit only.

Fix: Move `page-help-url.ts` + test into `libs/help/src/lib/` (new dir), leaving `ui/` for `.svelte` only. Mirrors `@ab/ui` shape.

## Status as of 2026-05-04

| # | Severity | Finding | Verdict |
|---|----------|---------|---------|
| 1 | Critical | Circular dep `@ab/ui` <-> `@ab/help` | CLOSED -- `InfoTip` no longer imports `helpRegistry`; calls into `setInfoTipHelpResolver`-injected resolver (`libs/ui/src/lib/info-tip-resolver.ts:34`). `libs/help` -> `@ab/ui` is the only remaining edge. |
| 2 | Critical | `libs/help/package.json` missing `@ab/ui` dep | CLOSED -- `libs/help/package.json:13-16` declares `@ab/ui` workspace dep. |
| 3 | Major | `libs/activities/package.json` no deps | CLOSED in this audit -- added `@ab/bc-sim`, `@ab/constants`, `@ab/ui` workspace deps. (`exports` field already in place.) |
| 4 | Major | `libs/ui/handbooks/*` is study-app domain chrome | CLOSED -- nine handbook components moved to `libs/aviation/src/ui/handbooks/`. |
| 5 | Major | `libs/ui/library/LibraryCard.svelte` is study-library chrome | CLOSED -- moved to `libs/aviation/src/ui/LibraryCard.svelte`. |
| 6 | Major | `libs/help` imports `@ab/aviation/ui/ReferenceText.svelte` without `exports` contract | CLOSED -- `libs/aviation/package.json:11` declares `./ui/*` subpath. |
| 7 | Minor | `libs/ui/src/index.ts` re-exports `Tone`/`TONES`/`isTone` | CLOSED in this audit -- re-export dropped, two call sites updated to import from `@ab/themes`, `tones.test.ts` moved to `libs/themes/__tests__/`. |
| 8 | Minor | Theme barrel registers all bundles via side-effect | CLOSED in this audit -- recommendation accepted "document the side-effect contract loudly"; barrel header now calls out the SIDE EFFECT explicitly with rationale. |
| 9 | Minor | `libs/themes` no `exports` field | CLOSED -- `libs/themes/package.json:5-13` declares `.`, `./ThemeProvider.svelte`, `./picker/*`, `./generated/*`. |
| 10 | Nit | `libs/ui/src/components/` could flatten | DROPPED -- cosmetic; current shape (`components/`, `lib/`, `index.ts`) is intentional and matches the `lib/` split for non-component helpers. |
| 11 | Nit | `libs/help/src/ui/page-help-url.ts` mixes TS helper with .svelte | DROPPED -- co-located helper + test is fine and the `ui/` directory has only one TS file. Cosmetic only. |

11 closed (9 fixed, 2 dropped as cosmetic-only). Feature now structurally clean.
