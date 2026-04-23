---
title: 'Tasks: Session Legibility and Help Expansion'
product: study
feature: session-legibility-and-help-expansion
type: tasks
status: unread
---

# Tasks: Session Legibility and Help Expansion

Phases run in order. Each phase ends with `bun run check` clean + a commit.

## Pre-flight

- [x] Read [spec.md](spec.md) end-to-end.
- [x] Read [design.md](design.md), especially Key Decisions 1-8.
- [x] Read [libs/help/src/schema/help-page.ts](../../../libs/help/src/schema/help-page.ts), [help-section.ts](../../../libs/help/src/schema/help-section.ts), [help-tags.ts](../../../libs/help/src/schema/help-tags.ts).
- [x] Read [libs/help/src/validation.ts](../../../libs/help/src/validation.ts) — note the per-check structure; new checks follow the same pattern.
- [x] Read [libs/help/src/registry.ts](../../../libs/help/src/registry.ts) — note the idempotent per-appId registration contract.
- [x] Read [libs/help/src/ui/HelpSection.svelte](../../../libs/help/src/ui/HelpSection.svelte) and [HelpCard.svelte](../../../libs/help/src/ui/HelpCard.svelte) — understand current render path + callout-variant tokens.
- [x] Read [libs/utils/src/markdown.ts](../../../libs/utils/src/markdown.ts) — the in-house renderer. New renderer will be a sibling in `libs/help/`.
- [x] Read [libs/ui/src/components/ConfirmAction.svelte](../../../libs/ui/src/components/ConfirmAction.svelte) — focus-trap pattern to extract.
- [x] Read [apps/study/src/routes/(app)/session/start/+page.svelte](../../../apps/study/src/routes/(app)/session/start/+page.svelte) and [+page.server.ts](../../../apps/study/src/routes/(app)/session/start/+page.server.ts).
- [x] Read [libs/constants/src/study.ts](../../../libs/constants/src/study.ts) — where new `SESSION_REASON_CODE_DEFINITIONS` + `SESSION_REASON_CODE_SLICE` land.
- [x] Read [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts) — confirm `HELP_ID(id)` exists or needs adding.
- [x] Verify `bun run check` is currently clean. If not, stop and fix first.
- [x] Create feature branch: `git checkout -b feat/session-legibility-and-help-expansion`.

---

## Phase 1 — Foundations: schema, renderer, primitives

Goal: shared infrastructure lands so concept pages + `/session/start` have something to sit on.

### 1.1 Schema extensions

- [x] Create [libs/help/src/schema/external-ref.ts](../../../libs/help/src/schema/external-ref.ts): `ExternalRef` + `ExternalRefSource`.
- [x] Update [libs/help/src/schema/help-page.ts](../../../libs/help/src/schema/help-page.ts): add `concept?: boolean` + `externalRefs?: readonly ExternalRef[]`.
- [x] Update [libs/help/src/schema/help-tags.ts](../../../libs/help/src/schema/help-tags.ts): add `conceptGroup?: 'learning-science' | 'airboss-architecture' | 'aviation-doctrine'`.
- [x] Update `HELP_KIND_VALUES` to add `'concept'`.
- [x] Update [libs/help/src/index.ts](../../../libs/help/src/index.ts) to export `ExternalRef`, `ExternalRefSource`.

### 1.2 Focus trap extraction

- [x] Create [libs/ui/src/lib/focus-trap.ts](../../../libs/ui/src/lib/focus-trap.ts) exporting `createFocusTrap(container: HTMLElement): { handleKeyDown, release }`. Pure function; no DOM side effects until `handleKeyDown` runs.
- [x] Refactor [libs/ui/src/components/ConfirmAction.svelte](../../../libs/ui/src/components/ConfirmAction.svelte) to use it. Behaviour must not change — same tab cycling, escape dismiss, restore focus.
- [x] Run `bun run check`.

### 1.3 Markdown renderer — parser

- [x] Create [libs/help/src/markdown/ast.ts](../../../libs/help/src/markdown/ast.ts): `MdNode` + `InlineNode` union types per design doc.
- [x] Create [libs/help/src/markdown/parser.ts](../../../libs/help/src/markdown/parser.ts) with `parseBlocks(src: string): MdNode[]`. Block-level pass: headings (h2-h4), paragraphs, lists (ordered + unordered, 2-level nesting), fenced code, blockquote, callouts, pipe tables, figures, hr.
- [x] Create [libs/help/src/markdown/inline.ts](../../../libs/help/src/markdown/inline.ts) with `parseInline(src: string): InlineNode[]`. Inline pass: text, bold, italic, inline code, links, wikilinks.
- [x] Unit tests: one test per block type + one per inline type. Tests live at [libs/help/src/markdown/parser.test.ts](../../../libs/help/src/markdown/parser.test.ts) and `inline.test.ts`.
- [x] Run `bun run check`.

### 1.4 Markdown renderer — Shiki + public entry

- [x] Add dep: `bun add shiki` in the repo root (or `libs/help` if that's the convention — check existing deps first).
- [x] Create [libs/help/src/markdown/shiki.ts](../../../libs/help/src/markdown/shiki.ts): lazy highlighter per design.
- [x] Supported langs: `typescript`, `svelte`, `sql`, `bash`, `json`. `text` passes through escaped. Unknown langs → warning + escaped pass-through.
- [x] Create [libs/help/src/markdown/index.ts](../../../libs/help/src/markdown/index.ts) exporting `parseMarkdown(body, opts): Promise<MdNode[]>`. Internally: block parse → inline parse → highlight every `code` node → resolve wikilinks against `helpIds` + `hasAviationReference`.
- [x] Unit test: end-to-end — parse a body with every feature, assert AST shape.
- [x] Run `bun run check`.

### 1.5 `<MarkdownBody>` component

- [x] Create [libs/help/src/ui/MarkdownBody.svelte](../../../libs/help/src/ui/MarkdownBody.svelte): walks AST, renders per kind. Callouts mount `<HelpCard variant={...}>`. Wikilinks resolved = `<a>` to `/help/<id>` or `/glossary/<id>`; unresolved = styled plain text (dev-only). Tables responsive. Figures with figcaption.
- [x] Create [libs/help/src/ui/ExternalRefsFooter.svelte](../../../libs/help/src/ui/ExternalRefsFooter.svelte): renders `externalRefs` as a styled references block (cards or list), with source badges.
- [x] Update [libs/help/src/ui/HelpSection.svelte](../../../libs/help/src/ui/HelpSection.svelte) to use `<MarkdownBody>` instead of `<ReferenceText>` for the body. Keep `ReferenceText` export for aviation glossary callers.
- [x] Update [libs/help/src/ui/HelpLayout.svelte](../../../libs/help/src/ui/HelpLayout.svelte) to render `<ExternalRefsFooter>` when `page.externalRefs` is set.
- [x] Visual smoke-test on `/help/memory-review` — existing page should still render.
- [x] Run `bun run check`.

### 1.6 `<InfoTip>` primitive

- [x] Create [libs/ui/src/components/InfoTip.svelte](../../../libs/ui/src/components/InfoTip.svelte): props per spec. Inline-flex; uses `createFocusTrap`; `role="dialog"` + `aria-modal="false"`; viewport-edge flip; hover+focus+tap triggers.
- [x] Styles: token-only (`--ab-color-surface-raised`, `--ab-color-border`, `--ab-shadow-lg`, `--ab-focus-ring`, spacing tokens). No hex.
- [x] Reduced-motion: use `--ab-transition-normal`.
- [x] Export from [libs/ui/src/index.ts](../../../libs/ui/src/index.ts).
- [x] Unit test: prop rendering; dev-build-only snapshot is acceptable here.
- [x] Manual smoke: create a throwaway `/dev/infotip` route or drop one temporarily in dashboard to verify keyboard, hover, touch, and edge flip.
- [x] Run `bun run check`.

### 1.7 `<PageHelp>` component

- [x] Verify or add `ROUTES.HELP_ID(id)` in [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts).
- [x] Create [libs/help/src/ui/PageHelp.svelte](../../../libs/help/src/ui/PageHelp.svelte). Renders nothing if page id unknown; dev-only `console.warn`.
- [x] Export from [libs/help/src/index.ts](../../../libs/help/src/index.ts).
- [x] Run `bun run check`.

### 1.8 Validation additions

- [x] Extend [libs/help/src/validation.ts](../../../libs/help/src/validation.ts):
  - External-refs URL/field checks (error).
  - `concept` ↔ `helpKind === 'concept'` consistency (error).
  - `concept === true` implies `externalRefs.length >= 1` (warning).
  - Unknown callout directive variant (error) — requires pre-parse or the renderer-validator to be invoked during validation.
- [x] Unit tests for each new check. Pattern: pass a page with the violation, assert the expected error/warning.
- [x] Run `bun run check` — fix any surfacing errors in existing help pages.
- [x] Commit Phase 1: `feat(help): markdown renderer, InfoTip, PageHelp, schema + validation foundations`.

---

## Phase 2 — Concept library

Goal: ten concept pages shipped, registered, and reachable via `/help/concepts`.

### 2.1 Concept page authoring

One task per page. Each page:

- Uses `concept: true`, `helpKind: 'concept'`, `tags.appSurface: ['study']`, `tags.conceptGroup: '...'`, `tags.keywords: [...]`.
- 2-5 sections using callouts + tables + cross-links.
- `externalRefs` block with 2-6 entries.
- `related` array cross-linking ≥2 other concept pages.
- `reviewedAt: '2026-04-23'` (today).

- [x] [apps/study/src/lib/help/content/concepts/fsrs.ts](../../../apps/study/src/lib/help/content/concepts/fsrs.ts) — id `concept-fsrs`, group `learning-science`.
- [x] [apps/study/src/lib/help/content/concepts/spaced-rep.ts](../../../apps/study/src/lib/help/content/concepts/spaced-rep.ts) — id `concept-spaced-rep`, group `learning-science`.
- [x] [apps/study/src/lib/help/content/concepts/active-recall.ts](../../../apps/study/src/lib/help/content/concepts/active-recall.ts) — id `concept-active-recall`, group `learning-science`.
- [x] [apps/study/src/lib/help/content/concepts/calibration.ts](../../../apps/study/src/lib/help/content/concepts/calibration.ts) — id `concept-calibration`, group `learning-science`.
- [x] [apps/study/src/lib/help/content/concepts/interleaving.ts](../../../apps/study/src/lib/help/content/concepts/interleaving.ts) — id `concept-interleaving`, group `learning-science`.
- [x] [apps/study/src/lib/help/content/concepts/desirable-difficulty.ts](../../../apps/study/src/lib/help/content/concepts/desirable-difficulty.ts) — id `concept-desirable-diff`, group `learning-science`.
- [x] [apps/study/src/lib/help/content/concepts/knowledge-graph.ts](../../../apps/study/src/lib/help/content/concepts/knowledge-graph.ts) — id `concept-knowledge-graph`, group `airboss-architecture`.
- [x] [apps/study/src/lib/help/content/concepts/session-slices.ts](../../../apps/study/src/lib/help/content/concepts/session-slices.ts) — id `concept-session-slices`, group `airboss-architecture`. Sections: `continue`, `strengthen`, `expand`, `diversify` (ids match `/session/start` InfoTip anchors).
- [x] [apps/study/src/lib/help/content/concepts/adm-srm.ts](../../../apps/study/src/lib/help/content/concepts/adm-srm.ts) — id `concept-adm-srm`, group `aviation-doctrine`.
- [x] [apps/study/src/lib/help/content/concepts/proficiency-currency.ts](../../../apps/study/src/lib/help/content/concepts/proficiency-currency.ts) — id `concept-prof-currency`, group `aviation-doctrine`.

### 2.2 Registration

- [x] Update [apps/study/src/lib/help/pages.ts](../../../apps/study/src/lib/help/pages.ts) to import + register all ten concept pages.
- [x] Run `bun run check` — all validation checks pass, no wikilink errors.

### 2.3 Concepts index route

- [x] Create [apps/study/src/routes/(app)/help/concepts/+page.ts](../../../apps/study/src/routes/(app)/help/concepts/+page.ts): loader returns grouped concept pages.
- [x] Create [apps/study/src/routes/(app)/help/concepts/+page.svelte](../../../apps/study/src/routes/(app)/help/concepts/+page.svelte): grouped card grid matching `/help` style.
- [x] Convert the existing "Help" nav entry into a dropdown with two items: "Help index" → `/help`, "Concepts" → `/help/concepts`. Check [apps/study/src/lib/nav/](../../../apps/study/src/lib/nav/) for existing primitives; if no dropdown exists, build a minimal one (hover + focus + click open, Escape/blur close, keyboard-navigable, uses tokens). Keep the dropdown behaviour consistent with `InfoTip`'s a11y rules.
- [x] Run `bun run check`.
- [x] Commit Phase 2: `feat(help): ten concept pages + /help/concepts index`.

---

## Phase 3 — `memory-review` page rebuild

### 3.1 Rewrite page content

- [x] Rewrite [apps/study/src/lib/help/content/memory-review.ts](../../../apps/study/src/lib/help/content/memory-review.ts) using:
  - Callouts (`:::tip`, `:::note`, `:::warn`, `:::example`) liberally.
  - Tables for the rating semantics (Again/Hard/Good/Easy → FSRS outcomes).
  - Cross-links to `concept-fsrs`, `concept-active-recall`, `concept-calibration`, `concept-spaced-rep`.
  - `externalRefs`: Wikipedia FSRS, Open Spaced Repetition, FAA-H-8083-9 (if relevant).
  - `reviewedAt: '2026-04-23'`.
- [x] Run `bun run check`.

### 3.2 Wire `<PageHelp>`

- [x] Add `<PageHelp pageId="memory-review" />` to [apps/study/src/routes/(app)/memory/review/+page.svelte](../../../apps/study/src/routes/(app)/memory/review/+page.svelte) header.
- [x] Run `bun run check`.
- [x] Manual smoke: open `/memory/review`, click `?`, land on `/help/memory-review`, see rich rendering with callouts + external refs footer.
- [x] Commit Phase 3: `feat(help): rebuild memory-review with rich markdown + externalRefs`.

---

## Phase 4 — `/session/start` legibility

### 4.1 Reason-code definitions

- [x] In [libs/constants/src/study.ts](../../../libs/constants/src/study.ts) add `SESSION_REASON_CODE_DEFINITIONS: Record<SessionReasonCode, string>` with 1-2 sentence plain-English explanations for all 13 codes.
- [x] In same file add `SESSION_REASON_CODE_SLICE: Record<SessionReasonCode, SessionSlice>` mapping each code to its slice.
- [x] Export both from [libs/constants/src/index.ts](../../../libs/constants/src/index.ts) if not already barrel-exported.
- [x] Run `bun run check`.

### 4.2 Author `session-start` help page

- [x] Create [apps/study/src/lib/help/content/session-start.ts](../../../apps/study/src/lib/help/content/session-start.ts) with sections:
  - `what-you-see` (lede).
  - `slices` — cross-link `concept-session-slices`.
  - `kinds` — Node/Card/Rep table.
  - `reason-codes` — table auto-built from `SESSION_REASON_CODE_DEFINITIONS` + `SESSION_REASON_CODE_SLICE` + `SESSION_REASON_CODE_LABELS` (author the TS that emits the body).
  - `priorities` — core/supporting/elective.
  - `domains` — 14 domains.
  - `modes-and-weights` — table of `MODE_WEIGHTS`.
- [x] Register in [apps/study/src/lib/help/pages.ts](../../../apps/study/src/lib/help/pages.ts).
- [x] Run `bun run check`.

### 4.3 Wire InfoTips in `/session/start`

- [x] Per spec's "InfoTip wiring" table: wrap slice headings, kind badges, reason chips, priority labels, domain labels, and the "Core topic, unstarted" / "Unused domain" phrases in `<InfoTip>`.
- [x] Pull definitions from `SESSION_REASON_CODE_DEFINITIONS` + concept-page summaries where appropriate.
- [x] Ensure no layout thrash — InfoTip is inline-flex so `<h2>` + icon stays on one line.
- [x] Run `bun run check`.

### 4.4 Make preview-row IDs clickable

- [x] Add `ROUTES.REP_DETAIL(id)` to [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts) returning `/reps/${id}`.
- [x] Create new route [apps/study/src/routes/(app)/reps/[id]/+page.server.ts](../../../apps/study/src/routes/(app)/reps/[id]/+page.server.ts): loads the scenario (BC call or DB read — check [libs/bc/study/src/](../../../libs/bc/study/src/) for an existing `getScenarioById`). 404 on not found.
- [x] Create [apps/study/src/routes/(app)/reps/[id]/+page.svelte](../../../apps/study/src/routes/(app)/reps/[id]/+page.svelte): renders scenario detail — title, domain, prompt, last-5 accuracy, last-attempt summary, "Start attempt" button linking to `/reps/new?scenarioId=<id>`, "Back to session" link.
- [x] Minimal-viable detail: title + prompt + last-attempt summary + Start button. Layout follows existing knowledge/memory detail page patterns (see [apps/study/src/routes/(app)/memory/[id]/+page.svelte](../../../apps/study/src/routes/(app)/memory/[id]/+page.svelte)).
- [x] Update the preview-row renderer in [+page.svelte](../../../apps/study/src/routes/(app)/session/start/+page.svelte):
  - `card` → `<a href={ROUTES.MEMORY_CARD(item.cardId)}>{item.cardId}</a>`.
  - `node_start` → `<a href={ROUTES.KNOWLEDGE_SLUG(item.nodeId)}>{item.nodeId}</a>`.
  - `rep` → `<a href={ROUTES.REP_DETAIL(item.scenarioId)}>{item.scenarioId}</a>`.
- [x] Run `bun run check`.

### 4.5 Collapsible legend

- [x] Create [apps/study/src/routes/(app)/session/start/SessionLegend.svelte](../../../apps/study/src/routes/(app)/session/start/SessionLegend.svelte): `<details>` root, labelled diagram using tokens (no hex), "Read the full guide" link to `/help/session-start`, localStorage-backed open/closed state (key `airboss:session-start-legend-open`).
- [x] Mount at top of preview area in `+page.svelte`.
- [x] Run `bun run check`.

### 4.6 Wire `<PageHelp>`

- [x] Add `<PageHelp pageId="session-start" />` to `/session/start` header.
- [x] Run `bun run check`.
- [x] Manual smoke: open `/session/start`. Hover every InfoTip. Tab through; confirm keyboard a11y. Click every ID; confirm routing. Toggle legend; reload to confirm state persists.
- [x] Commit Phase 4: `feat(session): /session/start legibility — InfoTips, clickable IDs, legend, help page`.

---

## Phase 5 — Polish + validation hardening

### 5.1 Validator hardening

- [x] Extend [libs/help/src/validation.ts](../../../libs/help/src/validation.ts) with: private-IP hostnames rejection, http-not-https warning, callout-directive unknown-variant error.
- [x] Add regression tests for each new check.
- [x] Run `bun run check`.

### 5.2 InfoTip helpId static check (optional, else parking lot)

- [x] Decide inline vs parking-lot: parked. Captured in [docs/work/NOW.md](../../work/NOW.md) "Follow-on candidates" — every existing `helpId` literal already resolves (Phase 4 wired them against registered pages), so the runtime scan is speculative until a broader author base exists. Re-open when a second author starts writing InfoTips.
- [ ] If kept: wire into `bun run check`.

### 5.3 Nav + visibility

- [x] Confirm `/help/concepts` appears in the nav and from `/help` index.
- [x] Confirm `<PageHelp>` renders identically on desktop + mobile for `/memory/review` + `/session/start`.

### 5.4 Docs

- [x] Update [docs/work/NOW.md](../../work/NOW.md) — mark this work package done, move to archive list.
- [ ] Update [docs/platform/DESIGN_PRINCIPLES.md](../../platform/DESIGN_PRINCIPLES.md) — dropped. No principle surfaced here that wasn't already covered; the "cross-link to ≥1 concept page" intent lives in the validator (concept pages warn without `externalRefs`) rather than as a prose principle. Re-open if a third round of help pages surfaces a durable pattern.
- [ ] Add a "Help authoring" short doc [docs/agents/help-authoring.md](../../agents/help-authoring.md) — dropped. Spec + tasks already document callout syntax, externalRefs, and MarkdownBody; duplicating into an agent doc before a second author exists is speculative. Re-open when another contributor starts authoring help pages.
- [x] Run `bun run check`.
- [x] Commit Phase 5: `chore(help): validator hardening, docs, polish`.

---

## Post-implementation

- [ ] Full manual test per [test-plan.md](test-plan.md).
- [ ] Run `/ball-review-full` — 10 parallel spec-aware reviewers.
- [ ] Fix every finding (critical + major + minor + nit per CLAUDE.md).
- [ ] Re-run `bun run check`, re-grep for any lingering symptoms.
- [ ] Push branch, open PR, merge, clean up worktree + branch per CLAUDE.md.
