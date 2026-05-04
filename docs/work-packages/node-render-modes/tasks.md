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
- [ ] Confirm WP 1 is merged. WP 3 reuses WP 1's `study.user_pref` table + `?/setPref` form action; building before WP 1 ships means duplicating that work.
- [ ] Re-read spec.md "Decisions" table -- all 6 questions are decided. Cross-check that nothing in tasks contradicts a decision.
- [ ] Run `bun run check` -- 0 errors baseline.

## Implementation

### 1. Constants + types

- [ ] Add `RENDER_MODES = { LEARN: 'learn', REVIEW: 'review', MEMORIZE: 'memorize' } as const` in `libs/constants/src/study.ts`.
- [ ] Add `BODY_SECTION_TYPES = { HOOK: 'hook', EXPLANATION: 'explanation', SYNTHESIS: 'synthesis', REGULATION_TEXT: 'regulation_text', PRACTICE_PROMPTS: 'practice_prompts' } as const`.
- [ ] Add `MODE_ORDERS: Record<RenderMode, string[]>` -- the per-mode ordering arrays from design.md decision 6.
- [ ] Extend `USER_PREF_KEYS` (from WP 1) with `KNOWLEDGE_RENDER_MODE: 'study.knowledge.render_mode'`.
- [ ] Extend `USER_PREF_SCHEMAS` registry in `libs/bc/study/src/user-prefs.ts` to include the new key with `z.enum(['learn', 'review', 'memorize'])`.
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
  - Reads `mode` from loader output (`data.userPrefs[USER_PREF_KEYS.KNOWLEDGE_RENDER_MODE] ?? 'learn'`).
  - Click fires the WP-1 `?/setPref` form action with `key=study.knowledge.render_mode`. Optimistic UI; rollback on error.
  - Disabled state for free-form bodies (with tooltip).
  - `[?]` popover with the explainer text from design.md decision 7.
- [ ] `bun run check` -- 0 errors.

### 4. Wire into the knowledge node page

- [ ] Update `+page.server.ts`:
  - Read the markdown file as today.
  - Run `parseKnowledgeBody(markdown)`; return `body` + existing citation data.
  - Call `getUserPrefs(userId, [USER_PREF_KEYS.KNOWLEDGE_RENDER_MODE])` -> resolve mode default.
  - Read `?mode=` from URL; if present and valid, override (and fire `setUserPref` so the URL-shared mode persists). If invalid: redirect without param.
  - Return `{ body, citations, mode, userPrefs }`.
- [ ] Wire the `?/setPref` form action (already exists from WP 1; just reuse).
- [ ] Update `+page.svelte`:
  - Replace direct markdown render with `<ModeToggle mode={data.mode} />` + `<BodyRenderer body={data.body} citations={data.citations} mode={data.mode} />`.
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

### 7. Practice prompts -- airboss-ref marker resolution

- [ ] In `parseKnowledgeBody`, when assembling the `practice_prompts` section's body, scan for `airboss-ref:card:<id>` and `airboss-ref:scenario:<id>` markers.
- [ ] Render markers as clickable `<a>` elements that route to `ROUTES.MEMORY_CARD(id)` or the scenario detail route, opening the linked artifact in the same tab.
- [ ] Unresolvable markers (id doesn't exist in registry) render as plain text + dev-mode console warning.
- [ ] Add a vitest case asserting marker resolution: `airboss-ref:card:abc123` -> `<a href="/memory/abc123">...</a>`; `airboss-ref:card:nonexistent` -> plain text + warning.
- [ ] Authoring lint extension: `tools/check-knowledge-bodies.ts` walks each `practice_prompts` body, asserts every marker resolves; broken links are an error.
- [ ] `bun run check` -- 0 errors.

### 8. Validation tooling

- [ ] Create `tools/check-knowledge-bodies.ts`:
  - Walk `course/knowledge/**/*.md`.
  - Parse each via `parseKnowledgeBody`.
  - If any free-form: warn (v1) / error (post-migration).
  - If structured but missing `synthesis` or `explanation`: error.
  - Walk `practice_prompts` markers; assert each `airboss-ref:card:<id>` / `airboss-ref:scenario:<id>` resolves.
- [ ] Add `check:knowledge-bodies` script to root `package.json`.
- [ ] Wire into `bun run check`.
- [ ] After step 6 completes, flip the free-form behavior from warn to error.

### 9. Tests

- [ ] Vitest: `BodyRenderer` snapshot tests for each mode against a sample structured body.
- [ ] Vitest: parser tests already covered in step 2.
- [ ] Vitest: marker resolution covered in step 7.
- [ ] Playwright e2e (`tests/e2e/knowledge-render-modes.spec.ts`):
  - Navigate to `/knowledge/density-altitude`.
  - Assert toggle visible, "Learn" selected.
  - Assert section order in DOM (hook -> explanation -> synthesis -> reg -> prompts).
  - Click "Memorize". Assert reorder. Assert `<details>` for "Full explanation" present.
  - Reload page; assert "Memorize" still selected (server-persisted via WP 1's user_pref).
  - Navigate to a free-form node (or a test fixture); assert toggle disabled with tooltip.
  - Navigate with `?mode=review`; assert mode is review AND that the user_pref was updated.
  - Click an `airboss-ref:card:` link in a `practice_prompts` section; assert navigation to the card.
- [ ] `bun run check` -- 0 errors. `bun test`. `bunx playwright test`.

### 10. Polish

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
