---
feature: full-codebase
category: patterns
date: 2026-04-22
branch: main
issues_found: 15
critical: 3
major: 6
minor: 5
nit: 1
---

## Summary

The repo is in solid shape on the hard critical-rules front: no `any` in production code (only test-only `as any` casts and one `Any device` English-prose false-positive), no Svelte 4 patterns, no inline route strings, no inline port numbers, no raw SQL outside Drizzle's `sql` helper, no direct `ulid()`/`nanoid()` calls outside the sanctioned wrapper, no AI attribution, and ADR 012 cleanup is complete (only the documenting comment for `REPS_SESSION` remains, as expected). The dominant issue is design-token debt: 835+ hardcoded hex values and 11 hardcoded `rgba()` shadow/focus rings across `apps/study/src/routes/(app)/**/*.svelte`, plus ~260 non-tokenized `font-size` declarations (all rem-based, but hardcoded numbers instead of `var(--font-size-*)` tokens). This bypasses `libs/themes/tokens.css` as the design-tokens source and is the single largest consistency risk in the codebase. The `libs/ui/` primitives are clean, so the debt is scoped to route-level page styles authored before the token system stabilized.

## Issues

### critical: Hardcoded hex colors across route-level page styles

- **File**: `apps/study/src/routes/(app)/memory/+page.svelte:136,141,159,168,169,175,181,187,192,197,202,213,233,234,239,244,271,277,287,291,296,305,311,315,321,340,345,349,350,351,355,360,364` (34 hardcoded hex values in one file), and 30 other files totaling 835 occurrences
- **Problem**: Direct hex values (`#0f172a`, `#64748b`, `#e2e8f0`, `#1d4ed8`, `#2563eb`, `#bfdbfe`, `#eff6ff`, etc.) in `<style>` blocks across every `apps/study/src/routes/(app)/` page. This bypasses `libs/themes/tokens.css` as the design-tokens source of truth. Bad files by count: `calibration/+page.svelte` (84), `reps/browse/+page.svelte` (75), `knowledge/[slug]/+page.svelte` (71), `memory/[id]/+page.svelte` (63), `memory/browse/+page.svelte` (61), `knowledge/+page.svelte` (60), `sessions/[id]/+page.svelte` (43), `plans/[id]/+page.svelte` (42), `memory/review/+page.svelte` (38), `reps/new/+page.svelte` (38), `memory/+page.svelte` (34), `reps/+page.svelte` (33), `sessions/[id]/summary/+page.svelte` (31), `memory/new/+page.svelte` (30), `plans/+page.svelte` (25), `plans/new/+page.svelte` (24), `glossary/[id]/+page.svelte` (20).
- **Rule**: `CLAUDE.md` Critical Rules -> "All literal values in `libs/constants/`. Enums, routes, ports, config." The design-token equivalent from `ball-review-patterns` SKILL.md -> "No raw color values in `.svelte` files -- all colors come from tokens." Also `CLAUDE.md` project pattern -> `libs/themes/tokens.css` is THE source; hardcoded hex after PRs #22/#27/#28 is a violation.
- **Fix**: Replace every hex value with `var(--t-*)` or `var(--color-*)` tokens from `libs/themes/tokens.css`. If a needed shade doesn't exist, add it to the theme -- do not inline. This is a sweep-level refactor: audit each page's palette, map to the token set, update in batches (one page per commit for reviewability).

### critical: Hardcoded rgba() focus rings and shadows

- **File**: `apps/study/src/routes/(app)/memory/new/+page.svelte:292`, `memory/browse/+page.svelte:327,443,477`, `memory/[id]/+page.svelte:565`, `knowledge/+page.svelte:210,270`, `reps/new/+page.svelte:429`, `reps/browse/+page.svelte:322,427,465`
- **Problem**: Recurring `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15)` and `rgba(134, 239, 172, 0.35)` literals. These are the focus-ring and newly-created-highlight patterns, duplicated across pages. Should be a `--shadow-focus-ring` / `--shadow-success-glow` token.
- **Rule**: Same as above -- shadows and colors must come from tokens.
- **Fix**: Add `--shadow-focus-ring: 0 0 0 3px var(--color-focus-ring-alpha)` (and a success-glow variant) to `libs/themes/tokens.css`, then replace inline usages. The blue `rgba(37, 99, 235, ...)` matches existing primary-blue token families; derive the alpha variant there.

### critical: Hardcoded border-radius and em-based font-sizes

- **File**: `apps/study/src/routes/(app)/memory/+page.svelte:160,203,235,298,329`, `memory/review/+page.svelte:279,290,340,390,443,450,484`, `memory/new/+page.svelte:213,225,239,249,276,323`, `memory/browse/+page.svelte:295,318` (sampled -- every route-level page uses raw `px` radii), and two em-based font-sizes at `knowledge/[slug]/+page.svelte:597` and `knowledge/[slug]/learn/+page.svelte:306` (`font-size: 0.875em`)
- **Problem**: Raw `border-radius: 8px|12px|16px|999px` and `font-size: 0.875em` bypass `--radius-*` and `--font-size-*` tokens. Em-based sizing breaks the "everything derives from `--font-size-base`" rule from the patterns skill (spacing and font sizes must all cascade from one base).
- **Rule**: SKILL.md -> "ALL visual values (colors, spacing, font sizes, radii, shadows) must use design tokens... No `px` for font sizes or spacing -- only `rem`" and "Font sizes and spacing MUST be `rem`-based, derived from `--font-size-base`."
- **Fix**: Swap every inline `border-radius` for `var(--radius-sm|md|lg|pill)`. Convert the two `em` font-sizes to `rem`. Add radius tokens if missing.

### major: Non-tokenized rem font-sizes (260 occurrences)

- **File**: 32 files across `apps/study/src/routes/(app)/**/*.svelte`. Example: `memory/+page.svelte` has 11 non-tokenized vs 11 tokenized; `memory/review/+page.svelte` has 14 non-tokenized vs 14 tokenized; `calibration/+page.svelte` has the worst ratio. Grep: `grep -rn "font-size" apps/study/src --include='*.svelte' | grep -v "var(--" | grep -v "// "` returns 260 hits.
- **Problem**: Sizes like `font-size: 0.8125rem`, `0.9375rem`, `1.0625rem`, `1.75rem`, `1.25rem` are all bespoke rem values instead of referencing `--font-size-xs|sm|base|lg|xl`. The values themselves are rem-based (so the global scale rule holds), but the tokens are bypassed. One file (`CalibrationPanel.svelte`) shows the correct pattern with 5 tokenized uses.
- **Rule**: SKILL.md -> "All font size tokens (`--font-size-xs` through `--font-size-xl`) must be expressed in `rem` relative to the base" and "No raw color values in `.svelte` files -- all colors come from tokens." Same principle for size scales.
- **Fix**: Map the bespoke values to the token scale. If the scale is missing intermediate steps (0.8125rem, 0.9375rem, 1.0625rem), add them to `libs/themes/tokens.css` as `--font-size-sm`, `--font-size-md`, `--font-size-lg` variants (or round to existing steps). One consolidation pass clears the debt.

### major: Test-file `as any` casts

- **File**: `libs/bc/study/src/scenarios.test.ts:174`, `libs/aviation/src/validation.test.ts:42,74`
- **Problem**: `domain: 'not-a-domain' as any`, `aviationTopic: [] as any`, `flightRules: 'made-up' as any`. These intentionally violate the schema to assert validation failures.
- **Rule**: `CLAUDE.md` Critical Rules -> "No `any`."
- **Fix**: Use `as unknown as DomainValue` (or the equivalent typed cast) so the escape hatch is explicit and one level narrower. Or define a `TestInvalidInput` type that widens the field being tested. The goal is to keep the schema-violation intent while avoiding a bare `any`.

### major: `TODO(wp-reference-extraction-pipeline)` debt in aviation validation

- **File**: `libs/aviation/src/validation.ts:286`, `libs/aviation/src/validation.ts:24` (comment), `libs/aviation/src/schema/source.ts:11` (comment)
- **Problem**: A validation gate ("unregistered `sourceId`") is deferred with a TODO. Per CLAUDE.md -> "Zero tolerance for known issues. A stub is a known issue. Fix it before moving on."
- **Rule**: `CLAUDE.md` Prime Directive.
- **Fix**: Either wire the source-registry check now (the registry ships in `@ab/aviation`) or document the gap in `docs/work-packages/reference-extraction-pipeline/tasks.md` with a named phase and an explicit acceptance-criterion. TODOs in code should point at a tracked task, not float.

### major: "honest" token in two shipped code paths

- **File**: `libs/bc/study/src/dashboard.ts:261`, `libs/bc/sim/src/scenarios/departure-stall.ts:24`
- **Problem**: Both CLAUDE.md (project) and the global rule ban "honest" in any line of text: replies, code comments, commit messages, docs. `dashboard.ts:261` has "a full 1-year lookup so the number is honest" in a comment. `departure-stall.ts:24` has "keep the elevator honest" in user-facing scenario narration prose.
- **Rule**: `CLAUDE.md` (project) -> "Never use the word `honest` or any variant... in every line of text: chat replies, code comments, commit messages, docs, PR descriptions." Global rule is identical.
- **Fix**: Rewrite `dashboard.ts:261` as "a full 1-year lookup so the number is accurate" or "reflects the true 365-day window." Rewrite `departure-stall.ts:24` as "keep the elevator disciplined" or "don't let the nose creep up." The scenario prose is user-facing so take extra care on voice.

### major: "honest" variants in planning docs, vision docs, PRDs, and work packages

- **File**: `docs/products/sim/VISION.md:7`, `docs/platform/DESIGN_PRINCIPLES.md:91,94`, `docs/vision/products/experimental/augmented-checklist/PRD.md:29`, `docs/platform/PRODUCT_BRAINSTORM.md:31`, `docs/platform/VISION.md:67,156`, `docs/platform/SCENARIO_ENGINE_SPEC.md:407`, `docs/vision/products/pre-flight/pre-flight-imsafe/PRD.md:4,31,38,43`, `docs/vision/products/reflection/currency-proficiency-tracker/PRD.md:42`, `docs/vision/products/proficiency/calibration-tracker/PRD.md:77`, `docs/platform/IDEAS.md:85`, `docs/work-packages/calibration-tracker/PRD.md:36,221,258`, `docs/work-packages/knowledge-graph/test-plan.md:219`, `docs/work-packages/learning-dashboard/PRD.md:21,41,45,189`, `docs/work-packages/learning-dashboard/design.md:40,52,63,155,237`, `docs/work-packages/reference-system-core/design.md:21`, `docs/walkthroughs/_template.md:72`, `course/L05-Implementation/features/discovery/user-stories.md:20`, plus 3 matches in `course/L05-Implementation/question-bank/**/*.md` (question-bank prose describes CFI ethics of "honest documentation" -- this is the FAA-content exception and may be intentional).
- **Problem**: The platform/vision/product docs repeatedly use "honest," "honestly," "the honest read," "honest picture," etc. as a design-principle phrase. Two specific review-doc self-references (`docs/work/reviews/2026-04-19-spaced-memory-items-phase-0-patterns.md:33,283`) are OK because they are reviews flagging the rule. The CFI question-bank prose at `course/L05-Implementation/question-bank/**` is FAA-facing teaching content about documentation ethics and is arguably the intended-term exception, but still worth a sweep.
- **Rule**: `CLAUDE.md` (project + global) -> no "honest" in docs.
- **Fix**: Sweep and replace. Substitutions that preserve meaning: "honest picture" -> "accurate picture" / "unvarnished picture"; "honest read" -> "accurate read" / "unsparing read"; "honestly" -> "directly" / "without cheerleading"; "honest self-assessment" -> "candid self-assessment." For the CFI question-bank content, assess whether the aviation teaching concept ("honest documentation" as a professional ethics term) counts as FAA-facing vocabulary that should stay -- either way, use it deliberately and consistently, or pick a synonym like "candid" / "truthful" / "faithful."

### major: "honest" in top-level `CLAUDE.md` self-reference

- **File**: `/Users/joshua/src/_me/aviation/airboss/CLAUDE.md` (Prime Directive section), and `.claude/CLAUDE.md` global
- **Problem**: Both CLAUDE.md files contain the word "honest" when explaining the rule banning it ("Never use the word `honest`..."). This is unavoidable and correct -- the rule has to name the forbidden word. Noting here only to confirm these are not violations.
- **Rule**: Self-referential rule declaration, not a violation.
- **Fix**: No change needed.

### minor: `em`-based sub-sizing in two markdown render spots

- **File**: `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte:597`, `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:306`
- **Problem**: `font-size: 0.875em` uses `em` (parent-relative) instead of `rem` (root-relative). Breaks the "one root scale" guarantee.
- **Rule**: SKILL.md -> "No `px` for font sizes or spacing -- only `rem`." The same logic applies to `em`, which is parent-relative, not root-relative.
- **Fix**: Change to `var(--font-size-sm)` or the equivalent `rem` token.

### minor: Inline union type for `Phase` in two route files

- **File**: `apps/study/src/routes/(app)/memory/review/+page.svelte:10`, `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:31`
- **Problem**: `type Phase = 'front' | 'confidence' | 'answer' | 'submitting' | 'complete'` defined locally. Truly local state-machine alphabets for a single page are OK per CLAUDE.md ("unless truly local"), but the second file defines an overlapping but different `Phase = 'read' | 'confidence' | 'answer'`. That naming collision suggests these are related concepts that deserve either separate names (e.g. `ReviewPhase`, `SessionItemPhase`) or a shared constant in `libs/constants/src/study.ts`.
- **Rule**: `CLAUDE.md` Critical Rules -> "No magic strings... Enums defined in constants, not inline."
- **Fix**: Rename to `ReviewPhase` / `SessionItemPhase` locally, or promote to `libs/constants/src/study.ts` as `REVIEW_PHASES` / `SESSION_ITEM_PHASES`. Adjust the type to `(typeof REVIEW_PHASES)[number]`. Decide based on whether another file will need to reference these names.

### minor: Inline union type `ListKind` in markdown util

- **File**: `libs/utils/src/markdown.ts:63`
- **Problem**: `type ListKind = 'ul' | 'ol'` is genuinely local to the parser and not referenced elsewhere.
- **Rule**: `CLAUDE.md` allows "unless truly local." This is the textbook local case.
- **Fix**: None. Noted only to confirm it's not a violation.

### minor: Inline union types on UI component props

- **File**: `libs/ui/src/components/Banner.svelte:2`, `libs/ui/src/components/TextField.svelte:2`, `libs/ui/src/components/StatTile.svelte:2`, `libs/ui/src/components/Card.svelte:13`, `libs/ui/src/components/Button.svelte:2,3,4`, `libs/ui/src/components/PanelShell.svelte:2`, `libs/ui/src/components/Badge.svelte:2,3`
- **Problem**: Each component exports a local string-union type for its variants. These are part of the component's public API and function like controlled vocabularies. Promoting them to `libs/constants/` would decouple the vocabulary from the component and let other packages reference the set. For v1 where only `apps/study` consumes `@ab/ui`, inline is defensible.
- **Rule**: `CLAUDE.md` Critical Rules allows local types; this is a judgement call.
- **Fix**: Decide on consistency. Option A: leave as-is (keep variants next to their component). Option B: promote to `libs/ui/src/variants.ts` (or `libs/constants/src/ui.ts`) as `BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const` and derive types. Option B is the documented house style; Option A is current reality. Pick one and make it consistent.

### minor: `NodeMasteryGate` local union in BC layer

- **File**: `libs/bc/study/src/knowledge.ts:462`
- **Problem**: `export type NodeMasteryGate = 'pass' | 'fail' | 'insufficient_data' | 'not_applicable'` is a domain concept exposed from a BC -- should live in `libs/constants/` (or `libs/types/`) so the values are a single source of truth.
- **Rule**: `CLAUDE.md` -> "No magic strings. Enums defined in constants, not inline."
- **Fix**: Move to `libs/constants/src/study.ts` as `NODE_MASTERY_GATES = ['pass', 'fail', 'insufficient_data', 'not_applicable'] as const` with the derived type. Export from `@ab/constants`. Import into `@ab/bc-study` and consumers.

### nit: Prose in `libs/aviation/src/references/aviation.ts:46` triggers the `: any` grep

- **File**: `libs/aviation/src/references/aviation.ts:46`
- **Problem**: The string literal "Any device used or intended to be used for flight in the air..." contains the token `: any` inside a quoted English sentence (the FAA definition of "aircraft"). Not a code violation; the greps will hit it forever.
- **Rule**: None.
- **Fix**: None. Noted so future reviewers know this false-positive is expected.
