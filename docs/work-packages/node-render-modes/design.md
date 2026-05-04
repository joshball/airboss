---
title: 'Design: Node render modes'
product: study
feature: node-render-modes
type: design
status: draft
review_status: pending
created: 2026-05-04
---

## Key technical decisions

### Decision 1: Section delimiters live inline as HTML comments

Two ways to declare section structure in a markdown file:

- **(a) Frontmatter array:**

  ```yaml
  ---
  body_sections:
    - type: hook
      body: |
        ...
    - type: explanation
      body: |
        ...
  ---
  ```

  Pros: machine-parseable, every section has a clean type. Cons: bodies live inside YAML strings, which kills markdown ergonomics (no syntax highlighting, awkward escapes).

- **(b) Inline HTML-comment delimiters:**

  ```markdown
  ---
  title: Density altitude
  ---

  <!-- @section: hook -->

  Picture this: ...

  <!-- @section: explanation -->

  Density altitude is the altitude that...

  <!-- @section: synthesis -->

  In short: ...
  ```

  Pros: markdown stays markdown, authors get full editor support, comments are native HTML so they don't render. Cons: requires a tiny parser; out-of-order or duplicated section markers need validation.

**Decision: (b).** The author experience is decisive: knowledge nodes are content, and the content lives in markdown. The parser is ~50 lines.

### Decision 2: Mode is purely a render-time concern

The DB does not store per-mode versions of the body. The body is one structured artifact (a `KnowledgeNodeBody = { sections: BodySection[] }`); the renderer projects it per mode. This keeps:

- One source of truth.
- Edits propagate to all modes by default.
- No risk of mode-specific drift.

The renderer is a Svelte component that takes `KnowledgeNodeBody + mode` and returns the right tree. Sections that fall after the "primary content" in a given mode (e.g., `hook` + `explanation` in Memorize mode) render inside a `<details>` element labeled "Full explanation."

### Decision 3: Mode persistence -- server-side `study.user_pref`, URL param for sharing

- Server-side row in `study.user_pref` (table from WP 1). Key `study.knowledge.render_mode`, value `'learn' | 'review' | 'memorize'`. Default `'learn'`.
- WP 3 adds the key to the `USER_PREF_SCHEMAS` registry in `libs/bc/study/src/user-prefs.ts` with `z.enum(['learn', 'review', 'memorize'])`. No new table; no new migration; the WP-1 form action `?/setPref` handles writes.
- URL param `?mode=...` overrides for one navigation. If present and valid, fires the `?/setPref` form action to update the stored preference (so visiting a shared link updates the user's default).
- Invalid URL param: redirect to `/knowledge/[slug]` with no param.

Cross-device sync works correctly without extra work.

### Decision 4: Migration is two-phase

**Phase 1 (this WP):** ship the renderer + parser. Free-form nodes (no section delimiters) render exactly as today (toggle disabled). Migrated nodes render with toggle enabled.

**Phase 2 (this WP, after Phase 1 stabilizes):** migrate every existing node. ~16+ nodes, ~half can be auto-converted (their markdown already uses `## Hook` / `## Explanation` / `## Synthesis` headings). The other half need a hand-pass.

Auto-conversion script: walks `course/knowledge/**/*.md`, looks for `## (Hook|Explanation|Synthesis|Regulation|Practice)` headings, replaces them with `<!-- @section: ... -->` delimiters. One-shot; deletable after.

### Decision 5: A node without `regulation_text` can still toggle modes

For Memorize mode on a node without a regulation excerpt: fall back to Learn order with a banner. The toggle remains visible -- the user might be on a node-with-no-reg today and a node-with-reg next click, and we don't want the toggle to flicker in/out.

### Decision 6: Citations are generated, not authored as a section

The `citations` section is computed by the renderer from existing citation data on the node (handbook citations + reg citations). Authors don't write a `<!-- @section: citations -->` block -- it's added at render time at the appropriate point in the order.

This means the per-mode order definition only needs to interleave the *authored* sections with the generated citation block:

```typescript
const MODE_ORDERS: Record<RenderMode, BodySectionType[]> = {
  learn:    ['hook', 'explanation', 'synthesis', 'regulation_text', 'practice_prompts', '@citations'],
  review:   ['synthesis', 'regulation_text', '@citations', 'practice_prompts', '@collapsed_full'],
  memorize: ['regulation_text', 'synthesis', 'practice_prompts', '@citations', '@collapsed_full'],
};
```

`@citations` is the rendered citation block. `@collapsed_full` is a sentinel that wraps `hook` + `explanation` in a `<details>` for review and memorize modes.

### Decision 7: The toggle UI

A segmented control of three buttons. Active button gets the primary visual state. Layout:

```text
┌─────────┬──────────┬──────────┐
│  Learn  │  Review  │ Memorize │
└─────────┴──────────┴──────────┘
                 [?]
```

The `[?]` opens a popover explaining the modes:

> **Learn** -- Start with the why: a scenario, an explanation, then a summary, then the rule.
> **Review** -- You already know it: summary first, then the rule, then a quick refresher.
> **Memorize** -- Drill the rule: regulation text first, then a quick paraphrase to anchor it.

### Decision 8: Render-mode toggle on flightbag is foreshadowed, not built

The flightbag handbook reader's toggle is its own animal: handbook prose isn't (and shouldn't be) decomposed into hook/synthesis/etc. -- it's authored prose by the FAA, often boxed regulation excerpts inline. A "Memorize" mode there means "show the boxed regs; hide the surrounding prose." That's a different rendering model, not a re-order. **v1.1 WP** when there's a real ask. Calling it out so the vocabulary stays consistent.

## Schema

No schema changes. Knowledge node bodies are markdown files in `course/knowledge/`; the structure lives in the markdown.

## Parser

```typescript
// libs/bc/study/src/knowledge-body/parser.ts

export type BodySectionType = 'hook' | 'explanation' | 'synthesis' | 'regulation_text' | 'practice_prompts';
export type BodySection = { type: BodySectionType; body: string };
export type KnowledgeNodeBody =
  | { kind: 'free-form'; markdown: string }
  | { kind: 'structured'; sections: BodySection[] };

export function parseKnowledgeBody(markdown: string): KnowledgeNodeBody;
```

Logic:

1. Split the markdown on `<!-- @section: <type> -->` delimiters using a regex.
2. If no delimiters: return `{ kind: 'free-form', markdown }`.
3. If delimiters found: validate each `<type>` is in the enum. Strip leading/trailing whitespace per section. Return `{ kind: 'structured', sections }`.
4. Validate: at least one `explanation` + one `synthesis`. If not: return `{ kind: 'free-form', markdown }` with a console warning. (Don't crash; the renderer can still display free-form.)

Vitest unit tests cover: free-form, structured-valid, structured-missing-required, structured-out-of-order (allowed; renderer reorders), structured-with-duplicate (use the first; warn).

## Renderer

```typescript
// apps/study/src/routes/(app)/knowledge/[slug]/_components/BodyRenderer.svelte

type Props = {
  body: KnowledgeNodeBody;
  citations: { handbook: CitationChip[]; regulation: CitationChip[] };
  mode: RenderMode;
};
```

Logic:

- If `body.kind === 'free-form'`: render the markdown verbatim. Mode toggle disabled.
- If `body.kind === 'structured'`: pick the order from `MODE_ORDERS[mode]`, iterate, render each section.
  - For `'@citations'`: render `CitationStacks` (the same component WP 1 uses).
  - For `'@collapsed_full'`: wrap `hook` + `explanation` in `<details><summary>Full explanation</summary>...</details>`.
  - For a missing `regulation_text` in memorize mode: render the `learn` order with a banner.

Markdown rendering uses the existing markdown component (`@ab/ui/Markdown` or whatever the project uses).

## Component structure

```text
apps/study/src/routes/(app)/knowledge/[slug]/
  +page.server.ts                              # existing; gains body parsing
  +page.svelte                                 # existing; adds <ModeToggle> + <BodyRenderer>
  _components/
    ModeToggle.svelte                          # the segmented control + popover
    BodyRenderer.svelte                        # mode-aware composition
    CollapsedFull.svelte                       # <details> for hook + explanation
```

`+page.server.ts` reads the markdown file, runs `parseKnowledgeBody`, returns the `KnowledgeNodeBody`. Citations come from existing BC.

`+page.svelte` adds:

- A `<ModeToggle bind:mode />` component that reads / writes localStorage.
- A `<BodyRenderer body={data.body} citations={data.citations} {mode} />`.

## Migration script

```text
tools/migrate-knowledge-bodies/migrate.ts
```

Walk `course/knowledge/**/*.md`. For each:

1. If already has `<!-- @section: -->` delimiters: skip.
2. If has `## Hook` / `## Explanation` / `## Synthesis` / `## Regulation` / `## Practice` headings: replace each with the corresponding delimiter, preserving the body below.
3. Else: emit a TODO list -- the file needs manual annotation.

Run once. Hand-pass the TODOs.

## Validation tooling

```text
tools/check-knowledge-bodies.ts
```

Walk `course/knowledge/**/*.md`. For each:

1. Run `parseKnowledgeBody`.
2. If `kind === 'free-form'`: warn (until full migration; then this becomes a fail).
3. If `kind === 'structured'`: assert at least `explanation` + `synthesis` present. Warn on missing `hook`, `regulation_text`, `practice_prompts` (optional but recommended).

Wired into `bun run check` via a new `check:knowledge-bodies` script. v1: warning only. v1.1 (post-migration): error on free-form.

## Tests

- Vitest: `parseKnowledgeBody` unit tests (free-form / structured / invalid).
- Vitest: `BodyRenderer` snapshot tests per mode.
- Playwright: knowledge node detail page renders correct order per mode; toggle persists; URL param `?mode=memorize` works.

## Performance

- Parsing is fast (regex split + per-section trim). Single-digit ms per node.
- Mode toggle is client-side only; no re-fetch.
- LocalStorage read on initial page render; SSR uses the URL `?mode=` param if present, otherwise falls back to `Learn` server-side and the client may flash to the user's preferred mode on hydration. Acceptable.

## Accessibility

- Mode toggle is a `<div role="tablist">` with `<button role="tab" aria-selected="...">`.
- Active mode announced ("Learn mode selected").
- The `<details>` collapsibles have native keyboard support.
- Mode change fires an `aria-live="polite"` announcement: "Switched to Memorize mode."

## Forward compatibility

- WP 1's leaf citation panel is the v1 of this pattern (handbook-vs-reg toggle). The `[hb][reg]` toggle becomes `[learn][review][memorize]` when applied to a full knowledge node. Same vocabulary.
- Future: handbook section toggle (v1.1 WP).
- Future: per-mode user preference stored server-side (post-MVP user_pref table).
