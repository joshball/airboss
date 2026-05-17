---
feature: study-app-surfaces
category: patterns
date: 2026-05-01
branch: main
issues_found: 11
critical: 0
major: 4
minor: 5
nit: 2
status: unread
review_status: done
---

## Status as of 2026-05-04

Re-greped main against every finding. All 11 findings closed.

| Severity | Finding                                                       | Verdict | Evidence                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR    | LibraryRegulationsKind discriminants use magic strings        | CLOSED  | route logic moved into `libs/bc/study/src/regulations.ts`; thin adapters dispatch via `LIBRARY_REGULATIONS_KINDS` constant + `parseRegulationKind` helper                                                                                |
| MAJOR    | Inline pathname `'/lens'` in app layout                       | CLOSED  | `libs/constants/src/routes.ts:306` -- `ROUTES.LENS = '/lens'`. `apps/study/src/routes/(app)/+layout.svelte:112` -- `pathMatches(page.url.pathname, ROUTES.LENS)`                                                                         |
| MAJOR    | handbook-asset URL shape not in ROUTES                        | CLOSED  | `ROUTES.HANDBOOK_ASSET(path)` exists; all three figure-URL builders route through it (`library/handbook/[slug]/[chapter]/+page.svelte:40`, `[section]/+page.svelte:185`, `library/regulations/[kind]/[group]/[section]/+page.svelte:32`) |
| MAJOR    | `?domain=...` deep links bypass `QUERY_PARAMS.DOMAIN`         | CLOSED  | every grep'd call site (`memory/+page.svelte:395`, `calibration/+page.svelte:178`, `dashboard/_panels/*Panel.svelte`, `lens/weakness/+page.svelte`, `reps/+page.svelte:115`) now uses `${QUERY_PARAMS.DOMAIN}=${...}`                    |
| MINOR    | `QUERY_PARAMS.CREATED` defined but server inlines `'created'` | CLOSED  | `apps/study/src/routes/(app)/memory/new/+page.server.ts:86` -- `[QUERY_PARAMS.CREATED]: created.id`                                                                                                                                      |
| MINOR    | `?created=...` inline in reps redirect                        | CLOSED  | `apps/study/src/routes/(app)/reps/new/+page.server.ts:127` -- `${QUERY_PARAMS.CREATED}=${...}`                                                                                                                                           |
| MINOR    | `?mode=...` inline in dev references page                     | CLOSED  | `apps/study/src/routes/(dev)/references/+page.svelte:29` -- `${QUERY_PARAMS.MODE}=${mode}`                                                                                                                                               |
| MINOR    | `'required'` / `'recommended'` inline in credentials detail   | CLOSED  | `credentials/[slug]/+page.svelte:25-26` uses `CREDENTIAL_PREREQ_KINDS.REQUIRED` / `.RECOMMENDED`                                                                                                                                         |
| MINOR    | Toast duration `3000` magic number duplicated                 | CLOSED  | `libs/constants` exposes `TOAST_DISMISS_MS`; `plans/[id]/+page.svelte:19,63` imports + uses it. Memory toast pieces moved into the review-session component, no longer using bare 3000                                                   |
| NIT      | `min-height: 100vh` on login page                             | CLOSED  | `apps/study/src/routes/login/+page.svelte:126` -- `min-height: 100dvh`                                                                                                                                                                   |
| NIT      | `max-height: 120px` on calibration sparkline                  | CLOSED  | `apps/study/src/routes/(app)/calibration/+page.svelte:808` -- `max-height: 7.5rem`                                                                                                                                                       |

## Summary

The study app routes are largely well-disciplined: `ROUTES` is consistently used for path constants and parameterized URLs, `QUERY_PARAMS` is used for most search-param keys, design tokens are used end-to-end (no hex/rgb/hsl), Svelte 5 runes are used everywhere (no `$:`, `<slot>`, `export let`), no raw `nanoid()` / `ulid()` calls, no raw SQL, no `any`, no non-null assertions, and `@ab/*` aliases are used on every cross-lib import.

Findings cluster in three areas: (1) the `LIBRARY_REGULATIONS_KINDS` enum is bypassed in five files under `apps/study/src/routes/(app)/library/regulations/` -- magic-string discriminants (`'14-cfr'`, `'aim'`, `'ac'`, `'ntsb'`, `'49-cfr'`) are used in switch/equality despite the constant set existing for exactly this purpose; (2) deep-link URL building hardcodes `?domain=...` in seven places instead of routing through `QUERY_PARAMS.DOMAIN`; (3) one inline pathname guard (`'/lens'`) and one inline query key (`created`) in route servers. The `handbook-asset/[...path]` route is missing from `ROUTES` so three figure-URL builders inline the path. A handful of toast-duration `setTimeout(_, 3000)` literals are not routed through a constant, while one local file declares `SHARE_TOAST_MS = 2000` ad hoc instead of pushing the constant into `libs/constants/`.

No critical violations. Patterns are mostly load-bearing in the right direction; the gaps look like additions where the next-developer pattern wasn't picked up rather than systemic drift.

## Issues

### MAJOR: `LibraryRegulationsKind` discriminants use magic strings instead of `LIBRARY_REGULATIONS_KINDS`

**File**:

- `apps/study/src/routes/(app)/library/regulations/+page.server.ts` (lines 28-36)
- `apps/study/src/routes/(app)/library/regulations/[kind]/+page.server.ts` (lines 84-148)
- `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/+page.server.ts` (lines 62-145)
- `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts` (lines 47-60)

**Problem**: These files compare/switch on `kind` against bare string literals (`'14-cfr'`, `'49-cfr'`, `'aim'`, `'ac'`, `'ntsb'`) despite `LIBRARY_REGULATIONS_KINDS` being defined in `@ab/constants` and used elsewhere -- e.g. `apps/study/src/routes/(app)/library/+page.server.ts:64-73` does it the right way. The other library loader (`+page.server.ts:64-73`) is the model.

**Rule**: "All literal values in `libs/constants/`. Enums, routes, ports, config." (CLAUDE.md). When an enum constant set exists, it must be used.

**Fix**: Replace string literals with `LIBRARY_REGULATIONS_KINDS.CFR_14` / `.CFR_49` / `.AIM` / `.AC` / `.NTSB`. Five files, mechanical change. Convergent finding -- fix once across all five.

### MAJOR: Inline pathname `'/lens'` in app layout

**File**: `apps/study/src/routes/(app)/+layout.svelte:102`

**Problem**:

```typescript
const lensActive = $derived(page.url.pathname.startsWith('/lens'));
```

Every other nav-active check in this file routes through `ROUTES.*` constants (lines 94-110). This one is the odd one out.

**Rule**: "All routes go through `ROUTES`... Never write a path string inline."

**Fix**: Add a `ROUTES.LENS = '/lens'` constant (sibling to `LENS_HANDBOOK` / `LENS_WEAKNESS`) and use `page.url.pathname.startsWith(ROUTES.LENS)`. The umbrella prefix already exists implicitly -- making it explicit also documents it.

### MAJOR: `handbook-asset` URL shape not in `ROUTES`

**File**:

- `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte:127-129`
- `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.svelte:36-40`
- `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.svelte:32`

**Problem**: Three different files build asset URLs as `/handbook-asset/${stripped}`. The `handbook-asset/[...path]/+server.ts` route exists but has no entry in `libs/constants/src/routes.ts`, so the path is duplicated three times.

**Rule**: "All routes go through `ROUTES`... Routes with parameters are typed functions."

**Fix**: Add `HANDBOOK_ASSET: (path: string) => `/handbook-asset/${path}` as const` to `ROUTES` and call it from all three figure-URL builders.

### MAJOR: `?domain=...` deep links bypass `QUERY_PARAMS.DOMAIN`

**File**:

- `apps/study/src/routes/(app)/memory/+page.svelte:395`
- `apps/study/src/routes/(app)/calibration/+page.svelte:178`
- `apps/study/src/routes/(app)/dashboard/_panels/ScheduledRepsPanel.svelte:24`
- `apps/study/src/routes/(app)/dashboard/_panels/DueReviewsPanel.svelte:30`
- `apps/study/src/routes/(app)/dashboard/_panels/WeakAreasPanel.svelte:19`
- `apps/study/src/routes/(app)/lens/weakness/+page.svelte:63-64`
- `apps/study/src/routes/(app)/lens/weakness/[severity]/+page.svelte:57-58`
- `apps/study/src/routes/(app)/reps/+page.svelte:115`

**Problem**: Eight files inline `?domain=${...}` or `?domain=${encodeURIComponent(...)}` instead of using `QUERY_PARAMS.DOMAIN`. The constant exists (`libs/constants/src/routes.ts:42`) and is the same value being typed into each call site.

**Rule**: "No magic strings/numbers. Use `libs/constants/`." (CLAUDE.md). The fact that all eight call sites pre-filter the same browse target on the same param tells you this should be a single helper.

**Fix**: Either build the URL as `${ROUTES.MEMORY_BROWSE}?${QUERY_PARAMS.DOMAIN}=${encodeURIComponent(slug)}` everywhere, or add helpers `MEMORY_BROWSE_DOMAIN(domain)` / `REPS_BROWSE_DOMAIN(domain)` to `ROUTES` and replace at all eight sites. The helper version closes the convergent finding once and gets future deep links for free.

### MINOR: `QUERY_PARAMS.CREATED` defined but server inlines `'created'`

**File**: `apps/study/src/routes/(app)/memory/new/+page.server.ts:86`

**Problem**:

```typescript
const next = new URLSearchParams({
    created: created.id,
    [QUERY_PARAMS.DOMAIN]: parsed.data.domain,
    ...
});
```

The first key is bare string `created:` while sibling keys use `[QUERY_PARAMS.DOMAIN]` / `[QUERY_PARAMS.CARD_TYPE]`. `QUERY_PARAMS.CREATED` exists at `libs/constants/src/routes.ts:28`.

**Rule**: "No magic strings/numbers. Use `libs/constants/`."

**Fix**: `[QUERY_PARAMS.CREATED]: created.id`. Same file already uses computed keys for other params.

### MINOR: `?created=...` inline in reps redirect

**File**: `apps/study/src/routes/(app)/reps/new/+page.server.ts:119`

**Problem**:

```typescript
redirect(303, `${ROUTES.REPS_BROWSE}?created=${encodeURIComponent(created.id)}`);
```

Same `created` query key -- `QUERY_PARAMS.CREATED` exists.

**Rule**: Same as above.

**Fix**: `redirect(303, ${ROUTES.REPS_BROWSE}?${QUERY_PARAMS.CREATED}=${encodeURIComponent(created.id)});`.

### MINOR: `?mode=...` inline in dev references page

**File**: `apps/study/src/routes/(dev)/references/+page.svelte:28`

**Problem**:

```svelte
<a href={`?mode=${mode}`} ...>
```

`QUERY_PARAMS.MODE` is defined (`libs/constants/src/routes.ts:95`) for exactly this dev page (the comment says "Render-mode override on /references dev page").

**Rule**: Same as above.

**Fix**: `href={`?${QUERY_PARAMS.MODE}=${mode}`}`.

### MINOR: `'required'` / `'recommended'` inline in credentials detail

**File**: `apps/study/src/routes/(app)/credentials/[slug]/+page.svelte:19-20`

**Problem**:

```typescript
const requiredPrereqs = $derived(prereqs.filter((p) => p.kind === 'required'));
const recommendedPrereqs = $derived(prereqs.filter((p) => p.kind === 'recommended'));
```

`CREDENTIAL_PREREQ_KINDS.REQUIRED` / `.RECOMMENDED` exist (`libs/constants/src/credentials.ts:145-146`) and are used elsewhere (e.g. `libs/bc/study/src/credentials.ts:155`).

**Rule**: "No magic strings/numbers. Use `libs/constants/`."

**Fix**: Import `CREDENTIAL_PREREQ_KINDS` from `@ab/constants` and compare against `CREDENTIAL_PREREQ_KINDS.REQUIRED` / `.RECOMMENDED`.

### MINOR: Toast duration `3000` is a magic number duplicated across files

**File**:

- `apps/study/src/routes/(app)/memory/[id]/+page.svelte:101, 131`
- `apps/study/src/routes/(app)/plans/[id]/+page.svelte:62`

**Problem**: Bare `setTimeout(..., 3000)` for toast auto-dismiss. The same magic number appears in three places with the same semantics ("a successful save toast lingers for ~3 seconds"). Sibling file `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:84` declares its own `const SHARE_TOAST_MS = 2000` locally -- both should be hoisted.

**Rule**: "No magic strings/numbers. Use `libs/constants/`."

**Fix**: Add `TOAST_DISMISS_MS` (or per-purpose constants `EDIT_TOAST_MS` + `SHARE_TOAST_MS`) to `libs/constants/src/ui.ts` and route all four call sites through it. A single constant fits if "auto-dismiss after success" is one design rule.

### NIT: `min-height: 100vh` on login page; everywhere else uses `100dvh`

**File**: `apps/study/src/routes/login/+page.svelte:112`

**Problem**: Three other places (`+error.svelte:59`, `(app)/+layout.svelte:340, 344`) use `min-height: 100dvh` -- the dynamic-viewport unit that handles mobile address-bar collapse. Login uses the older `100vh`.

**Rule**: Internal consistency / token compliance.

**Fix**: Change to `min-height: 100dvh`.

### NIT: `max-height: 120px` on calibration sparkline

**File**: `apps/study/src/routes/(app)/calibration/+page.svelte:808`

**Problem**: The only non-breakpoint, non-hairline raw-px height value in the surfaces under review. Dashboard/grid `minmax(...px, 1fr)` and 1-3px borders are the project convention; an inline 120px max-height for an SVG sparkline is the outlier.

**Rule**: "No hex/rgb/px in components, rem-based..." -- the project's design-token compliance rule.

**Fix**: Express as a rem (e.g. `7.5rem`) or hoist into a layout token. Trivial conversion; mainly a consistency item.
