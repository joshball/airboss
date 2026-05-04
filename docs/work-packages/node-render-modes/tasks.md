---
title: 'Tasks: Node render modes'
product: study
feature: node-render-modes
type: tasks
status: draft
review_status: pending
created: 2026-05-04
---

## Pre-flight

- [ ] Read `spec.md` and `design.md` end-to-end.
- [ ] Read `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte` -- the current node detail page.
- [ ] Read `libs/bc/study/src/knowledge.ts` -- existing knowledge-node BC functions.
- [ ] Sample 3-5 existing knowledge node markdown files from `course/knowledge/` -- understand the current free-form shape.
- [ ] Confirm WP 1 + WP 2 are merged (this WP composes on the citation pattern from WP 1).
- [ ] Confirm open questions answered (especially decision 1, frontmatter vs inline).
- [ ] Run `bun run check` -- 0 errors baseline.

## Implementation

### 1. Constants + types

- [ ] Add `RENDER_MODES = { LEARN: 'learn', REVIEW: 'review', MEMORIZE: 'memorize' } as const` in `libs/constants/src/study.ts`.
- [ ] Add `BODY_SECTION_TYPES = { HOOK: 'hook', EXPLANATION: 'explanation', SYNTHESIS: 'synthesis', REGULATION_TEXT: 'regulation_text', PRACTICE_PROMPTS: 'practice_prompts' } as const`.
- [ ] Add `MODE_ORDERS: Record<RenderMode, string[]>` -- the per-mode ordering arrays from design.md decision 6.
- [ ] Add `STUDY_KNOWLEDGE_LOCALSTORAGE_KEY = 'study.knowledge.renderMode'`.
- [ ] Add `KnowledgeNodeBody`, `BodySection`, `RenderMode`, `BodySectionType` types (probably in `libs/types/`).
- [ ] `bun run check` -- 0 errors.

### 2. Parser

- [ ] Create `libs/bc/study/src/knowledge-body/parser.ts` per design.md.
  - Export `parseKnowledgeBody(markdown: string): KnowledgeNodeBody`.
  - Regex split on `<!-- @section: <type> -->` markers.
  - Validate types against the enum.
  - Validate at least `explanation` + `synthesis` present; if missing, return `free-form` + warn.
- [ ] Create `libs/bc/study/src/knowledge-body/parser.test.ts` -- vitest cases:
  - Free-form (no markers).
  - Structured with all sections in order.
  - Structured out of order (renderer reorders; parser preserves source order).
  - Missing required (synthesis) -> falls back to free-form.
  - Duplicate marker -> use first, warn.
  - Invalid type -> warn, treat as free-form.
- [ ] `bun run check` -- 0 errors. Run tests.

### 3. Renderer component

- [ ] Create `apps/study/src/routes/(app)/knowledge/[slug]/_components/BodyRenderer.svelte`.
  - Props: `body: KnowledgeNodeBody`, `citations: { handbook, regulation }`, `mode: RenderMode`.
  - If `body.kind === 'free-form'`: render `<Markdown>{body.markdown}</Markdown>`.
  - If `body.kind === 'structured'`: walk `MODE_ORDERS[mode]`, render each section in turn.
    - `@citations` -> `<CitationStacks ...>` (lift from WP 1).
    - `@collapsed_full` -> `<CollapsedFull ...>` containing `hook` + `explanation`.
  - Missing-reg fallback: if mode is `memorize` and no `regulation_text` section exists, render in `learn` order with a `<NoRegBanner>`.
- [ ] Create `apps/study/src/routes/(app)/knowledge/[slug]/_components/CollapsedFull.svelte` -- `<details><summary>Full explanation</summary>...</details>`.
- [ ] Create `apps/study/src/routes/(app)/knowledge/[slug]/_components/ModeToggle.svelte`:
  - Segmented control: 3 buttons.
  - Bound `mode` prop; reads / writes `localStorage[STUDY_KNOWLEDGE_LOCALSTORAGE_KEY]`.
  - Disabled state for free-form bodies (with tooltip).
  - `[?]` popover with the explainer text from design.md decision 7.
- [ ] `bun run check` -- 0 errors.

### 4. Wire into the knowledge node page

- [ ] Update `+page.server.ts`:
  - Read the markdown file as today.
  - Run `parseKnowledgeBody(markdown)`; return `body` + existing citation data.
  - Read `?mode=` from URL; validate against `RENDER_MODES`. If invalid: redirect without param. If valid: include in the loader return.
- [ ] Update `+page.svelte`:
  - Replace direct markdown render with `<ModeToggle bind:mode />` + `<BodyRenderer ... {mode} />`.
  - On mount: if URL has `?mode=`, use that and write to localStorage. Else: read localStorage, fall back to `learn`.
- [ ] `bun run check` -- 0 errors.

### 5. Migration -- automated phase

- [ ] Create `tools/migrate-knowledge-bodies/migrate.ts`:
  - Walk `course/knowledge/**/*.md`.
  - For each file: detect `## Hook` / `## Explanation` / `## Synthesis` / `## Regulation` / `## Practice` headings (case-insensitive).
  - Replace each with `<!-- @section: ... -->` delimiter (preserving the body below).
  - Skip files that already have `<!-- @section: -->` markers.
  - Print a "needs manual annotation" list for files that have neither.
- [ ] Dry-run: print proposed changes, don't write.
- [ ] Apply: write changes, run `parseKnowledgeBody` over each modified file to sanity-check.
- [ ] Stage modified files. `bun run check` -- 0 errors.

### 6. Migration -- manual phase

- [ ] For each file flagged "needs manual annotation": read it, decide where the section boundaries go, insert delimiters by hand.
- [ ] Re-run `parseKnowledgeBody` validation: `bun run check:knowledge-bodies`.
- [ ] All knowledge nodes should now parse as `kind: 'structured'`. Free-form is migration debt; once empty, the lint rule (step 7) flips to error.

### 7. Validation tooling

- [ ] Create `tools/check-knowledge-bodies.ts`:
  - Walk `course/knowledge/**/*.md`.
  - Parse each via `parseKnowledgeBody`.
  - If any free-form: warn (v1) / error (post-migration).
  - If structured but missing `synthesis` or `explanation`: error.
- [ ] Add `check:knowledge-bodies` script to root `package.json`.
- [ ] Wire into `bun run check`.
- [ ] After step 6 completes, flip the free-form behavior from warn to error.

### 8. Tests

- [ ] Vitest: `BodyRenderer` snapshot tests for each mode against a sample structured body.
- [ ] Vitest: parser tests already covered in step 2.
- [ ] Playwright e2e (`tests/e2e/knowledge-render-modes.spec.ts`):
  - Navigate to `/knowledge/density-altitude`.
  - Assert toggle visible, "Learn" selected.
  - Assert section order in DOM (hook -> explanation -> synthesis -> reg -> prompts).
  - Click "Memorize". Assert reorder. Assert `<details>` for "Full explanation" present.
  - Reload page; assert "Memorize" still selected.
  - Navigate to a free-form node (or a test fixture); assert toggle disabled with tooltip.
  - Navigate with `?mode=review`; assert mode is review.
- [ ] `bun run check` -- 0 errors. `bun test`. `bunx playwright test`.

### 9. Polish

- [ ] `bunx biome format --write` over all touched files.
- [ ] Manual smoke pass per `test-plan.md`.
- [ ] Update `docs/decisions/011-knowledge-graph-learning-system/decision.md` with a note: "WP 3 implements three render modes; Learn is the default and matches the discovery-first principle of this ADR."

## Post-implementation

- [ ] Full manual test per `test-plan.md`.
- [ ] Request review.
- [ ] Apply review fixes.
- [ ] Re-run `bun run check`, all tests.
- [ ] Update `docs/work/NOW.md`.
- [ ] PR per project workflow.
