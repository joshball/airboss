---
status: in-progress
trigger: REFERENCES.md "Future architecture" section -> stand up `apps/flightbag/` as the canonical reader app
source: docs/platform/REFERENCES.md (decision 2026-05-03)
related:
  - docs/platform/REFERENCES.md
  - docs/platform/IDEAS.md (apps/flightbag references reader app)
  - docs/decisions/019-reference-identifier-system/decision.md
---

# Scaffold `apps/flightbag/` + `libs/library/` + URL helpers

## Problem

Today `/library/...` reader routes live inside `apps/study/`. That works for now but creates cross-app friction: when sim, FIRC, or a future avionics app needs to deep-link a citation (e.g. PHAK §2.3, 14 CFR 91.103), they either build their own reader (a different URL per app for the same content) or link into study's URL space (cross-app dependency, plus auth-gated by study's `(app)` group). Citations have to be **shareable across surfaces**, including links a user copies from sim and pastes elsewhere.

`docs/platform/REFERENCES.md` (Future architecture, 2026-05-03) decided the canonical home for reference rendering is a dedicated public reader: `apps/flightbag/`. URL constants live in `libs/constants/src/routes.ts` (`ROUTES.FLIGHTBAG_*`); a URI-bridge helper lives in `libs/sources/`; rendering primitives live in a new `libs/library/`.

This work package is **scaffold only**. It stands up the new app, the new lib, the route constants, and the URI-to-URL helper, with placeholder page bodies that prove the data pipe end-to-end. It does NOT migrate study's existing `/library/...` routes or rewire any citation chip; those follow-ons happen in separate WPs.

## Goals

- New SvelteKit app at `apps/flightbag/` boots, builds, and serves placeholder routes for every reference shape REFERENCES.md tracks.
- New lib at `libs/library/` exposes stub rendering primitives (`<RenderedSection>`, `<CitationChip>`).
- `libs/constants/src/routes.ts` carries `ROUTES.FLIGHTBAG_*` constants for handbook (slug + edition + chapter + section), AIM (chapter + section + paragraph), CFR (title + part + section), AC (doc + revision), ACS (doc + area + task).
- New helper at `libs/sources/src/url-for-reference.ts` exports `urlForReference(uri: SourceId)` that parses the `airboss-ref:` URI and dispatches to the matching `ROUTES.FLIGHTBAG_*` constant.
- `bun run check` clean. Smoke build passes. Tests cover each corpus shape end-to-end through `urlForReference`.
- No inline path strings anywhere in `apps/flightbag/` source; all URLs go through `ROUTES.FLIGHTBAG_*`.

## Non-goals

- **No migration of study's `/library/...` routes.** Those stay where they are; a follow-on WP will move them after this scaffold proves the pipe.
- **No rewire of study's citation chips.** A separate WP will switch them from `LIBRARY_*` to `urlForReference()` once flightbag actually renders content.
- **No hangar admin dashboard.** That's a sibling concern (`apps/hangar/admin/references/`) per IDEAS.md; separate WP.
- **No auth.** flightbag is a public reader for now. If usage data later argues for visibility rules, a follow-on WP adds them.
- **No theme polish.** Use defaults; design is a downstream WP.
- **No e2e tests.** Smoke build is the gate for scaffold; Playwright coverage follows when real content lands.

## Scope: what gets created

### `libs/constants/src/routes.ts` -- new entries

| Constant | Shape |
|----------|-------|
| `ROUTES.FLIGHTBAG_HOME`               | `/`                                                       |
| `ROUTES.FLIGHTBAG_HANDBOOK`           | `/handbook/{slug}/{edition}`                              |
| `ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER`   | `/handbook/{slug}/{edition}/{chapter}`                    |
| `ROUTES.FLIGHTBAG_HANDBOOK_SECTION`   | `/handbook/{slug}/{edition}/{chapter}/{section}`          |
| `ROUTES.FLIGHTBAG_AIM_PARAGRAPH`      | `/aim/{chapter}/{section}/{paragraph}`                    |
| `ROUTES.FLIGHTBAG_CFR_SECTION`        | `/cfr/{title}/{part}/{section}`                           |
| `ROUTES.FLIGHTBAG_AC`                 | `/ac/{doc}/{rev}`                                         |
| `ROUTES.FLIGHTBAG_ACS_TASK`           | `/acs/{doc}/area/{area}/task/{task}`                      |

All parameterised entries are typed functions returning `as const` template literal strings.

### `libs/sources/src/url-for-reference.ts` -- new helper

```ts
export function urlForReference(uri: SourceId): string;
```

Parses the URI (via the existing `parseIdentifier` + per-corpus locator parsers) and dispatches on `corpus`:

| Corpus      | Output |
|-------------|--------|
| `handbooks` | `ROUTES.FLIGHTBAG_HANDBOOK*` (depth depends on locator) |
| `aim`       | `ROUTES.FLIGHTBAG_AIM_PARAGRAPH(chapter, section, paragraph)` |
| `regs`      | `ROUTES.FLIGHTBAG_CFR_SECTION(title, part, section)` |
| `ac`        | `ROUTES.FLIGHTBAG_AC(docNumber, revision)` |
| `acs`       | `ROUTES.FLIGHTBAG_ACS_TASK(slug, area, task)` |
| other       | `ROUTES.FLIGHTBAG_HOME` (corpus not yet covered by flightbag) |

Returns the URL path (no origin); callers prefix with the flightbag origin via `siblingOrigin` when the link crosses app boundaries.

### `libs/library/` -- new lib

| File | Purpose |
|------|---------|
| `package.json`              | `@ab/library` workspace package; deps on `@ab/constants`, `@ab/sources`, `@ab/ui` |
| `src/index.ts`              | Barrel re-exports |
| `src/RenderedSection.svelte`| Stub component that renders a `body` markdown string into a `<section>` |
| `src/CitationChip.svelte`   | Stub component that renders an `airboss-ref:` URI as a link via `urlForReference` |
| `src/index.test.ts`         | Smoke test that the components import + render |

The stubs are intentionally minimal -- enough to prove the lib is wired into the workspace and the URL bridge works. Real rendering (figure resolution, footnotes, adjacency groups, token substitution) belongs to a downstream WP.

### `apps/flightbag/` -- new app

Modeled after `apps/avionics/` (the most recent app scaffold). Dev port `9640` allocated in `libs/constants/src/ports.ts`.

| Route | Purpose |
|-------|---------|
| `/`                                                                             | Corpus index (placeholder) |
| `/handbook/[slug]/[edition]/+page.svelte`                                       | Handbook landing |
| `/handbook/[slug]/[edition]/[chapter]/+page.svelte`                             | Handbook chapter |
| `/handbook/[slug]/[edition]/[chapter]/[section]/+page.svelte`                   | Handbook section (leaf reader) |
| `/aim/[chapter]/[section]/[paragraph]/+page.svelte`                             | AIM paragraph |
| `/cfr/[title]/[part]/[section]/+page.svelte`                                    | CFR section |
| `/ac/[doc]/[rev]/+page.svelte`                                                  | AC root (whole-doc until promoted) |
| `/acs/[doc]/area/[area]/task/[task]/+page.svelte`                               | ACS task |

Each placeholder page uses the URI corresponding to its params to call into `@ab/sources` resolvers and pass the resolved body markdown into `<RenderedSection>` from `@ab/library`. This proves the pipe works end-to-end.

## Out of scope (captured here, not implemented)

- Migrating study's `/library/...` routes to flightbag (separate WP)
- Rewiring study citation chips through `urlForReference()` (separate WP)
- The hangar references admin dashboard (separate WP, IDEAS.md entry)
- Auth gates on flightbag (deferred -- public reader by default)
- Theme polish on the placeholder pages (deferred)
- Playwright e2e suite for flightbag (smoke build is the gate at scaffold; e2e ships with real content)

## Acceptance criteria

- `bun run check` clean (0 errors, 0 warnings).
- `bun --cwd apps/flightbag run build` succeeds.
- `urlForReference` covers handbooks (4 depths), AIM, CFR, AC, ACS shapes; tests pass.
- New `ROUTES.FLIGHTBAG_*` constants exist with parameter-encoded function signatures.
- `libs/library/` is wired into the workspace; tests pass.
- Grep `apps/flightbag/src` for `'/handbook/'` / `'/cfr/'` / `'/aim/'` / `'/ac/'` / `'/acs/'` returns zero raw matches (every URL must come from `ROUTES.FLIGHTBAG_*`).
- `docs/platform/REFERENCES.md` updated: "Future architecture" -> "Current architecture (scaffolded 2026-05-03)".
