---
feature: full-repo
category: patterns
date: 2026-04-22
branch: main
issues_found: 17
critical: 3
major: 7
minor: 5
nit: 2
status: unread
review_status: pending
---

## Summary

`apps/study` and `libs/*` are largely disciplined on the "house style" rules: no `any`, no non-null assertions, no Svelte 4 patterns, no raw `nanoid()/ulid()` outside `@ab/utils`, no relative cross-lib imports, ROUTES used consistently for `goto`/`redirect`/`href`. The critical propagatable issue is in `apps/sim` (the Phase 0.5 playground from PR #53): the entire panel/instrument layer bypasses the design-token system -- **216 hex color occurrences** across 16 `.svelte` files, raw `rgba(0,0,0,0.75)` backdrops, bare `font-family: ui-monospace, monospace`, and literal rem/px spacing instead of `var(--ab-space-*)`. This is the pattern that will get copied into every future instrument panel, every new sim scenario surface, and eventually spatial/avionics apps. Secondary issues: `--ab-*` tokens are sometimes used with hex fallbacks (`var(--ab-color-fg, #666)`), magic-string `kind === 'card'` comparisons in the session engine despite `SESSION_ITEM_KINDS` existing in `@ab/constants`, inconsistent media-query breakpoints (no breakpoint tokens exist), and 208 `as Foo` type assertions -- most are defensible (enum narrowing after `includes(x as T)` guards, `Record<string, string>` label indexing), but several could use proper Zod parsing.

## Propagatable Patterns (top priority)

Ranked by "this will be copied into the next app, the next panel, the next page":

1. **Hex colors + raw `rgba()` in `.svelte` style blocks (critical, `apps/sim` only)** -- 216 hex occurrences across 16 files, 6 raw `rgba()` values. The new sim panels (`VSpeeds.svelte`, `ControlInputs.svelte`, `ScenarioStepBanner.svelte`, `WxPanel.svelte`, `ResetConfirm.svelte`, `KeybindingsHelp.svelte`, all 7 instruments) ignore the `--ab-color-*` token system entirely and hand-roll a dark-glass-cockpit palette. This palette is not declared anywhere. When the next instrument or overlay lands, it will copy these hex values. Representative: `apps/sim/src/lib/panels/VSpeeds.svelte:46-114`, `apps/sim/src/lib/panels/ControlInputs.svelte:83-245`, `apps/sim/src/lib/instruments/Altimeter.svelte:25`.

2. **Token-var with hex fallback: `var(--ab-color-fg, #666)` (major, 30 occurrences)** -- teaches future authors that hex fallbacks are fine. The hex fallback is a separate, undocumented palette that ships silently whenever the token fails to resolve (theme provider missing, typo in token name). Representative: `apps/sim/src/routes/+page.svelte:68,87,91,96,113,120,126,131,142`, `apps/sim/src/routes/[scenarioId]/+page.svelte:417-517`.

3. **Literal `rem` spacing instead of `--ab-space-*` tokens (major, `apps/study` + `apps/sim`)** -- 117 `font-size: Nrem` and hundreds of `padding/margin/gap: Nrem`. Tokens exist (`--ab-space-2xs` through `--ab-space-2xl`, `--ab-font-size-*`) and are used 269 times for font-size already, but spacing is almost entirely literal. This is the single biggest "drift" vector: when a theme is re-skinned (e.g., `tui` compression), these hard values do not track. Representative: `apps/study/src/routes/(app)/memory/+page.svelte:130-294`, `apps/study/src/routes/(app)/memory/review/+page.svelte:374-695`.

4. **Literal `border-radius: Npx` instead of `--ab-radius-*` (major, 58 occurrences)** -- tokens exist (`sharp`/`xs`/`sm`/`md`/`lg`/`pill`) and are used 148 times. The 58 literal uses include `border-radius: 999px` (should be `--ab-radius-pill`), `12px` (`--ab-radius-lg`), `8px` (`--ab-radius-md`), `4px`/`6px` (`--ab-radius-xs`/`--ab-radius-sm`). Representative: `apps/study/src/routes/(app)/memory/+page.svelte:171,203,266,297`, `apps/study/src/routes/(app)/memory/review/+page.svelte:386,410,443,475,486,536,594,654,661,695`, `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:352,367,375,397,436`.

5. **Media-query breakpoint magic numbers, no breakpoint token (major, 14 occurrences, 6 distinct values)** -- `@media (max-width: 480px|560px|639px|640px|960px|1023px)`. `639` vs `640` is a classic off-by-one between files. `libs/themes/tokens.css` has no `--ab-breakpoint-*` tokens and `libs/constants` has no `BREAKPOINTS`. The moment a new app lands, it will pick its own numbers. Representative: `apps/study/src/routes/(app)/dashboard/+page.svelte:123,136` (`1023px` and `639px`), `apps/study/src/routes/(app)/+layout.svelte:275` (`640px`), `apps/study/src/routes/(app)/calibration/+page.svelte:970` (`560px`).

6. **Bare `font-family: ui-monospace, monospace` instead of `--ab-font-family-mono` (major, 18 occurrences)** -- the token exists and is used 10 times in `apps/study/src/routes/(app)/dashboard/_panels/*.svelte`. Every other mono usage is hand-rolled. The study dashboard panels get it right; sim panels, review, knowledge slug, login, and `libs/ui/Select.svelte` (via `inherit`, which is fine) all drift. Representative: `apps/sim/src/lib/panels/ControlInputs.svelte:109,115,122,202`, `apps/study/src/routes/(app)/memory/review/+page.svelte:655`, `apps/study/src/routes/(app)/dashboard/+page.svelte:88,95,152`, `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte:596`.

7. **Magic-string `kind === 'card'` / `phase === 'front'` comparisons despite constants existing (major, 41+ `kind` + 13+ `phase` occurrences)** -- `SESSION_ITEM_KINDS.CARD`, `SESSION_ITEM_KINDS.REP`, `SESSION_ITEM_KINDS.NODE_START` are defined in `libs/constants/src/study.ts:612` and exported, but the session engine, tests, and UI use the raw string literals. The engine file `libs/bc/study/src/engine.ts:354,358,372-379` does 8 comparisons with raw `'card'`/`'rep'`. `apps/study/src/routes/(app)/session/start/+page.svelte:263,269,271` uses raw literals in conditionals. Same pattern with memory-review `phase` ('front'/'answer'/'confidence'/'complete'/'submitting') in `apps/study/src/routes/(app)/memory/review/+page.svelte:53,217,222,231,266,298,309,314,364` -- no `MEMORY_REVIEW_PHASES` constant exists.

## Issues

### critical: sim panel layer ships a parallel dark palette, zero token usage

- **File**: `apps/sim/src/lib/panels/VSpeeds.svelte:46-114`, `apps/sim/src/lib/panels/ControlInputs.svelte:83-245`, `apps/sim/src/lib/panels/ScenarioStepBanner.svelte:49-105`, `apps/sim/src/lib/panels/WxPanel.svelte:56-80`, `apps/sim/src/lib/panels/KeybindingsHelp.svelte:80-149`, `apps/sim/src/lib/panels/ResetConfirm.svelte:43-101`
- **Problem**: Six panel components and seven instrument components define 216 hex colors (`#1a1a1a`, `#2a2a2a`, `#f5f5f5`, `#bbb`, `#888`, `#999`, `#2fb856`, `#e0443e`, `#ffe270`, `#0c2a4a`, `#1f4a7a`, `#0c3a1a`, `#063b1c`, `#4a1210`, `#ffd1cf`, `#0a0a0a`, `#333`, `#444`, `#555`, `#777`, `#ccc`, `#aaa`, `#9bbfff`, `#9bffb0`, ...) plus 6 raw `rgba(...)` values for backdrops. None of them flow through `--ab-color-*`. The `tui` theme in `libs/themes/tokens.css` explicitly exists to serve dense instrument surfaces but the sim ignores it.
- **Rule**: `CLAUDE.md` Critical Rules: "All literal values in `libs/constants/`." Token-system intent documented in `libs/themes/tokens.css` header: "All hex colors live here. Primitives must not hardcode hex; they read through `var(--ab-*)`."
- **Fix**: Two paths. (a) Extend `libs/themes/tokens.css` with a `tui` dark-instrument palette (`--ab-color-instrument-bg`, `--ab-color-instrument-chrome`, `--ab-color-instrument-accent-warn`, `--ab-color-vspeed-vx`, `--ab-color-vspeed-vy`, etc.), wrap sim routes in `<ThemeProvider theme="tui">`, and replace every hex with a token. (b) If the sim is explicitly exempt (throwaway prototype per `apps/sim/src/routes/+page.svelte:45`), document the exemption in `docs/platform/MULTI_PRODUCT_ARCHITECTURE.md` and add a comment at the top of each sim `.svelte` file stating "tokens deferred until post-Phase-0.5." The current state is neither -- it looks like the convention, copy that, but the convention says the opposite.

### critical: `var(--ab-*, #hex)` fallback pattern in apps/sim

- **File**: `apps/sim/src/routes/+page.svelte:68,87,91,96,113,120,126,131,142`, `apps/sim/src/routes/[scenarioId]/+page.svelte:417,424,434,449,455,456,465,470,471,515,517`
- **Problem**: 30 occurrences of `var(--ab-color-*, #xxx)` with a hex fallback. The fallback is a second, undeclared palette. If the token ever resolves to `initial` (component rendered outside a `ThemeProvider`), users see a silently different color. This also signals to future authors that "hex fallbacks are how we handle theme-missing cases."
- **Rule**: `CLAUDE.md` -- "No magic strings. No magic numbers." `libs/themes/tokens.css:29`: "Primitives must not hardcode hex."
- **Fix**: Drop the fallback argument. `var(--ab-color-fg-muted)` with no fallback; if resolution fails, that is a bug to surface, not mask. `ThemeProvider` is documented to wrap the entire `(app)` layout; routes should rely on it.

### critical: rem spacing literals bypass `--ab-space-*` (117 font-size + 400+ padding/margin/gap)

- **File**: `apps/study/src/routes/(app)/memory/+page.svelte:130-294` (many), `apps/study/src/routes/(app)/memory/review/+page.svelte:374-695` (many), `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:352-475` (many), across ~30 `.svelte` files
- **Problem**: The design-token system exposes `--ab-space-2xs` (`0.25rem`) through `--ab-space-2xl` (`2rem`) and `--ab-font-size-xs` through `--ab-font-size-2xl`. `font-size` tokens are used 269 times, but raw `rem` values are used 117 times for font-size alone, and `padding/margin/gap` use raw rem almost everywhere. Every "1.5rem" should be `var(--ab-space-xl)`, every "0.75rem" should be `var(--ab-space-md)`, etc. The `tui` theme compresses its spacing scale; pages wired to raw rem will not compress with it.
- **Rule**: `CLAUDE.md` -- "All literal values in `libs/constants/`." (Design tokens are the CSS equivalent.)
- **Fix**: Sweep pass replacing rem literals with `var(--ab-space-*)`. Add a Biome/stylelint rule (or a `docs/agents/*.md` review checklist item) to flag new rem literals in `.svelte <style>` blocks. For font-size, replace `font-size: 0.875rem` -> `font-size: var(--ab-font-size-sm)`, `0.75rem` -> `xs`, `1rem` -> `base`, `1.125rem` -> `lg`, `1.375rem` -> `xl`, `1.75rem` -> `2xl`. Values that do not match a scale step (`0.625rem`, `0.3125rem`, `0.9375rem`, `0.85rem`, `0.82rem`, `0.72rem` in sim) indicate either the scale needs a new step or the value is wrong -- make a decision per occurrence.

### major: literal `border-radius: Npx` instead of `--ab-radius-*` (58 occurrences)

- **File**: `apps/study/src/routes/(app)/memory/+page.svelte:171,203,266,297`, `apps/study/src/routes/(app)/memory/review/+page.svelte:386,410,443,475,486,536,594,654,661,695`, `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:352,367,375,397,436,475`, `apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte:145`, `apps/study/src/routes/(app)/knowledge/+page.svelte:314-315`
- **Problem**: Tokens `--ab-radius-xs` (3px), `sm` (6px), `md` (8px), `lg` (12px), `pill` (999px) exist and are used 148 times, but 58 sites use literal px. `tui` locks radii to sharp/sm; literal px doesn't respect the theme.
- **Rule**: `libs/themes/tokens.css:162-167`.
- **Fix**: Map `999px` -> `--ab-radius-pill`, `12px` -> `--ab-radius-lg`, `8px` -> `--ab-radius-md`, `6px` -> `--ab-radius-sm`, `3px-4px` -> `--ab-radius-xs`. Off-scale values (`10px`, `16px`) need a decision: extend the scale or round to the nearest token.

### major: breakpoint magic numbers, no breakpoint tokens exist

- **File**: `apps/study/src/routes/(app)/dashboard/+page.svelte:123 (1023px),136 (639px)`, `apps/study/src/routes/(app)/+layout.svelte:275 (640px)`, `apps/study/src/routes/(app)/calibration/+page.svelte:970 (560px)`, `apps/study/src/routes/(app)/memory/review/+page.svelte:720 (480px)`, `apps/study/src/routes/(app)/memory/new/+page.svelte:372 (480px)`, `apps/study/src/routes/(app)/knowledge/+page.svelte:442 (640px)`, plus 7 more
- **Problem**: Six distinct breakpoint values (480/560/639/640/960/1023) used inconsistently. `640` and `639` appear in sibling files. No `--ab-breakpoint-*` token exists in `libs/themes/tokens.css`. Postel's-law drift: the next app picks its own numbers.
- **Rule**: `CLAUDE.md` Critical Rules -- no magic numbers. Design-token system owns layout thresholds.
- **Fix**: Add `--ab-breakpoint-sm` (`480px`), `--ab-breakpoint-md` (`640px`), `--ab-breakpoint-lg` (`1024px`) to `tokens.css`. Note: CSS `@media` does not accept `var()` in standards-track CSS, but custom media queries via PostCSS work, or export constants from `libs/constants/src/breakpoints.ts` for use in SvelteKit route guards and JS breakpoint checks, and document the chosen CSS numbers in `DESIGN_PRINCIPLES.md` so future authors reuse them.

### major: bare `font-family: ui-monospace, monospace` instead of `--ab-font-family-mono`

- **File**: `apps/sim/src/lib/panels/VSpeeds.svelte:63`, `apps/sim/src/lib/panels/ControlInputs.svelte:109,115,122,202`, `apps/sim/src/lib/panels/ScenarioStepBanner.svelte:61`, `apps/sim/src/lib/panels/WxPanel.svelte:75`, `apps/sim/src/lib/panels/KeybindingsHelp.svelte:109,148`, `apps/sim/src/lib/panels/ResetConfirm.svelte:71`, `apps/sim/src/routes/[scenarioId]/+page.svelte:533`, `apps/study/src/routes/(app)/memory/review/+page.svelte:655`, `apps/study/src/routes/(app)/dashboard/+page.svelte:88,95,152`, `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte:596`, `apps/study/src/routes/(app)/knowledge/[slug]/learn/ActivityHost.svelte:57`, `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:409`
- **Problem**: 18 call sites hand-roll the mono font stack. `--ab-font-family-mono` is defined in `tokens.css:127` and used correctly in `dashboard/_panels/*.svelte` (10 sites). The rest drift.
- **Rule**: `libs/themes/tokens.css` typography section.
- **Fix**: Replace with `font-family: var(--ab-font-family-mono)`.

### major: magic-string session `kind`/`phase` comparisons despite constants in `@ab/constants`

- **File**: `libs/bc/study/src/engine.ts:354,358,372,373,378,379`, `libs/bc/study/src/sessions.ts:504`, `apps/study/src/routes/(app)/session/start/+page.svelte:263,269,271`, plus 41 occurrences in `engine.test.ts` / `session/start` / `sessions/[id]` routes, and 13 `phase === 'front'|'answer'|'confidence'|'complete'|'submitting'` occurrences in `apps/study/src/routes/(app)/memory/review/+page.svelte:53,217,222,231,266,298,309,314,364`
- **Problem**: `SESSION_ITEM_KINDS` is exported from `libs/constants/src/study.ts:612` with `CARD`/`REP`/`NODE_START` members, but every comparison uses the raw string `'card'`/`'rep'`/`'node_start'`. The review phase enum has no constant at all -- five distinct strings float free across the UI.
- **Rule**: `CLAUDE.md` Critical Rules: "No magic strings. All literal values in `libs/constants/`."
- **Fix**: (a) Replace `=== 'card'` with `=== SESSION_ITEM_KINDS.CARD` etc. throughout engine.ts, sessions.ts, session/start page, sessions/[id] page. (b) Add `MEMORY_REVIEW_PHASES = { FRONT: 'front', ANSWER: 'answer', CONFIDENCE: 'confidence', COMPLETE: 'complete', SUBMITTING: 'submitting' } as const` to `libs/constants/src/study.ts`, export `MemoryReviewPhase` type, replace literals.

### major: `as Record<string, string>` pattern for label-map indexing (5+ files)

- **File**: `apps/study/src/routes/(app)/memory/+page.svelte:19`, `apps/study/src/routes/(app)/memory/review/+page.svelte:70`, `apps/study/src/routes/(app)/memory/new/+page.svelte:55`, `apps/study/src/routes/(app)/memory/browse/+page.svelte:78,82`, `apps/study/src/routes/(app)/memory/[id]/+page.svelte:109,113`, `apps/study/src/routes/(app)/dashboard/_panels/DueReviewsPanel.svelte:29`, `apps/study/src/routes/(app)/calibration/+page.svelte:30`, `apps/study/src/routes/(app)/plans/new/+page.svelte:62,66`
- **Problem**: Identical 3-line helper (`return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug)`) copy-pasted into ~8 files. The assertion bypasses the narrow `Record<Domain, string>` type. If a caller passes an unvalidated slug, the expression is `undefined` at runtime but `string` at type-checking time.
- **Rule**: `CLAUDE.md` -- "No `any`. No non-null assertions. Type assertions only with a justifying comment."
- **Fix**: Add a `labelForDomain(slug: string): string` helper in `libs/constants/src/study.ts` (or `libs/aviation`) that type-narrows via `DOMAIN_VALUES.includes` and returns the label or `humanize(slug)` fallback. Same for `CARD_TYPE_LABELS`, `PLAN_STATUS_LABELS`, `CERT_LABELS`, `DEPTH_PREFERENCE_LABELS`, `SESSION_MODE_LABELS`. Remove the `as Record<string, string>` cast from every call site.

### major: em-dash in user-facing prose (`—` in session UI)

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:91,136`, `apps/study/src/routes/(app)/session/start/+page.svelte:267`
- **Problem**: Unicode em-dash `—` used as a sentence/label separator in user-visible strings. `<title>Session — airboss</title>`, `<span class="reason-detail">— {current.reasonDetail}</span>`, `<span class="detail">— {item.reasonDetail}</span>`. `CLAUDE.md` bans em-dash/en-dash/`--` in all prose including UI strings.
- **Rule**: Global rules, Text Formatting: "Never use em-dash, en-dash, or double-dash as a sentence separator."
- **Fix**: Replace with `-` or rephrase. `<title>Session - airboss</title>`, `<span class="reason-detail">- {current.reasonDetail}</span>`.

### minor: Unicode arrow `←` in back-link prose

- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.svelte:147`
- **Problem**: `<a class="back" href={ROUTES.MEMORY_BROWSE}>← Browse</a>` uses `←` (U+2190). `apps/sim/src/routes/[scenarioId]/+page.svelte:279` already uses the entity `&larr;` for the same UI pattern. Pick one. The global rule specifically mentions arrow characters, though `←` is not `→`; the intent is "no unicode arrows."
- **Rule**: Global rules, Text Formatting: "Never use unicode arrow (`->`), always `->` (hyphen-greater-than)."
- **Fix**: `<a class="back" href={ROUTES.MEMORY_BROWSE}>&larr; Browse</a>` to match sim, or use the plain text `<- Browse`. Agree on a pattern and apply everywhere.

### minor: `as [EnumType]` after `includes()` guard -- idiomatic but uncommented

- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:32`, `apps/study/src/routes/(app)/memory/browse/+page.server.ts:22,27,32,37`, `apps/study/src/routes/(app)/plans/new/+page.server.ts:40,46,47,67,70`, `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:59,63,64,77,78,136,138,150,152`
- **Problem**: The `(VALUES as readonly string[]).includes(raw) ? (raw as Enum) : undefined` pattern is correct TypeScript (the cast is necessary because `includes` is not a type guard on a `readonly EnumValue[]`), but `CLAUDE.md` says "No `as` without a justifying comment." There are ~30 uncommented `as Enum` casts of this shape.
- **Rule**: `CLAUDE.md` -- "No `as` without a comment justifying why the cast is safe."
- **Fix**: Two options. (a) Factor a `coerceDomain(raw): Domain | undefined` / `coerceCert(raw): Cert | undefined` helper in `libs/constants/src/study.ts` (colocated with each enum) that does the includes + narrowing in one place with a proper type predicate -- call sites drop the cast. This is the preferred pattern; it mirrors the existing `coerceEnum` helper used in `plans/new/+page.server.ts:67`. (b) Add `// narrow after VALUES.includes() guard` comment to each cast.

### minor: `session.user as Record<string, unknown>` and double-cast chain

- **File**: `apps/study/src/hooks.server.ts:94,95,97`
- **Problem**: `((session.user as Record<string, unknown>).firstName as string)` double-casts through `Record<string, unknown>` to `string`. No justifying comment. If better-auth's types expose `firstName`/`lastName`/`role`, the cast should not be needed.
- **Rule**: `CLAUDE.md` -- no uncommented `as`.
- **Fix**: Extend the `AuthUser` type in `libs/auth/src` to include the custom fields, or parse with a zod schema at the auth boundary so the rest of the app gets a typed `User`.

### minor: scripts import from `../../schema/source` (intra-lib deep relative)

- **File**: `libs/aviation/src/sources/cfr/extract.ts:13`
- **Problem**: `import type { SourceExtractor } from '../../schema/source';` is a 2-level relative intra-lib import. Project rules allow intra-lib relative imports, so this is permitted, but the depth is brittle and the alternative `import type { SourceExtractor } from '@ab/aviation/schema/source'` is clearer. Minor; flagging because it's the only surviving `../../` in lib source.
- **Rule**: `CLAUDE.md` Import Rules: "Intra-lib relative imports are fine" (so technically compliant).
- **Fix**: Consider a barrel export in `libs/aviation/src/schema/index.ts` that re-exports `SourceExtractor`, then `import type { SourceExtractor } from '../../schema'`, or leave as-is.

### nit: inconsistent "throwaway prototype" disclaimer vs production path

- **File**: `apps/sim/src/routes/+page.svelte:45` -- "Throwaway prototype. Not an FAA-approved ATD. For UX validation only."
- **Problem**: This comment suggests sim is intentionally not held to token rules, which would explain the hex explosion. But `docs/products/sim/VISION.md` and `MULTI_PRODUCT_ARCHITECTURE.md` treat sim as a first-class surface. Which is it?
- **Rule**: `CLAUDE.md` Prime Directive: "Do the right thing. Always. Never propose stubs or MVP shortcuts."
- **Fix**: Decide. Either (a) sim is production-bound and owes a token pass now, before more panels land, or (b) sim is explicitly a throwaway and there is a deletion trigger documented in `MULTI_PRODUCT_ARCHITECTURE.md` (e.g., "sim is replaced by `apps/avionics/` by Phase 1.0"). Currently the code says "prototype," the repo layout says "first-class app." Ambiguity is the propagation vector.

### nit: sim `subtitle` prose uses `-- ` separator (CLAUDE.md-compliant but visually identical to en-dash)

- **File**: `apps/sim/src/routes/+page.svelte:17` ("Hand-rolled C172 FDM. Feel the controls, practice the stall recovery, learn by flying."), `apps/sim/src/routes/+page.svelte:45` ("Throwaway prototype. Not an FAA-approved ATD. For UX validation only.")
- **Problem**: None -- these don't use `--` as a separator; they're correct. Flagging because visually scanning for `--` turned them up and they pass. Ignore.
- **Rule**: Text Formatting: "Never use `--` as a sentence separator in prose."
- **Fix**: None needed. Noted for calibration.

## Positive findings

- Zero `: any` annotations in source.
- Zero non-null assertions (`!`) in source.
- Zero Svelte 4 patterns (`export let`, `$:`, `<slot>`, `$app/stores`, `writable/readable/derived` from `svelte/store`).
- Zero `nanoid()`/`ulid()` calls outside `libs/utils/src/ids.ts`.
- Zero raw SQL outside Drizzle's `sql` template tag (which is the sanctioned way to write SQL fragments).
- Zero relative cross-lib imports (`../../libs/foo`-style).
- `ROUTES` discipline is excellent -- all 20+ `redirect()` / `goto()` / `href` sites in study use `ROUTES.*`, as does sim. No inline route paths found.
- `@ab/*` alias usage is consistent across 322 import sites.
- `libs/ui/src/components/*.svelte` is the model: tokens, no hex, no px-spacing-literal drift.
- `libs/constants/src/` has rich enum coverage for the domain (26 enum groups).
