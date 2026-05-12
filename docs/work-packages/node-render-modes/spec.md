---
id: node-render-modes
title: "Spec: Node render modes"
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-04
owner: agent
depends_on: []
unblocks: []
tags:
  - knowledge-graph
  - rendering
legacy_fields:
  feature: node-render-modes
  type: spec
  review_status: pending
---

Add a render-mode toggle to knowledge node detail pages and (optionally, in v1.1) to flightbag handbook sections. The toggle has three modes -- **Learn** (discovery-first, default), **Review** (synthesis-first), **Memorize** (regulation-first) -- which re-order the same body content for different reading purposes. Knowledge node bodies are restructured as a small set of named sections so the renderer can re-order them rather than the author writing three versions of the same text.

This is WP 3 of a three-WP arc. WP 1 is [study-home](../study-home/spec.md). WP 2 is [flight-evidence-and-cfi-feedback](../flight-evidence-and-cfi-feedback/spec.md).

## Why this WP exists

ADR 011 says "discovery-first -- lead with WHY, reveal regs as confirmation of reasoning, not as arbitrary rules." That's the right default for *understanding* a topic. But:

- For **review** -- the user already understands and wants the synthesis, then the reg.
- For **memorize** -- the user wants the reg verbatim first, then a quick synthesis as a memory aid.

Today knowledge node bodies are free-form markdown. Re-rendering them for different modes would mean re-authoring. Instead: structure each body as a small set of *named sections* (hook, explanation, synthesis, regulation_text, practice_prompts, citations) and let the renderer pick an order per mode.

Same content, three reading orders. One toggle on the node page.

WP 1 already shipped a v1 of this idea: the leaf citation panel has a `[hb][reg]` toggle that flips citation order. WP 3 generalizes the pattern to the full knowledge node body and (optionally) to handbook sections.

## Anchors

- [decision-011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy. Learn mode is the canonical implementation.
- [study-home](../study-home/spec.md) -- WP 1's leaf citation toggle is the v1 of this pattern.
- `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte` -- the existing knowledge node detail page; this WP redesigns it.
- `course/knowledge/**/*.md` -- existing knowledge node markdown content; ~16+ nodes today, all free-form.
- `libs/bc/study/src/knowledge.ts` -- the BC that resolves a knowledge node + its citations.

## In scope

### The render modes

| Mode     | Order                                                                                                 | When to use                                                               |
| -------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Learn    | hook -> explanation -> synthesis -> regulation_text -> practice_prompts -> citations                  | First exposure or coming back to a topic. ADR 011 default.                |
| Review   | synthesis -> regulation_text -> citations -> practice_prompts (-> hook + explanation collapsed below) | I already understand; show me the meat.                                   |
| Memorize | regulation_text -> synthesis -> practice_prompts (-> hook + explanation collapsed below)              | I'm trying to commit the rule to memory; lead with the verbatim language. |

Learn is the default. The user toggles per-node; preference persists per user (localStorage v1, server-side prefs post-MVP).

### Body section types

A knowledge node body is structured as a YAML frontmatter `body_sections:` array (or an inline `<!-- @section: name -->` delimiter -- see design.md decision 1) defining named sections. Each section has a `type`:

| Type               | Content                                                                                        | Required?                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `hook`             | A scenario or question that motivates the topic. 1-3 paragraphs.                               | Optional. Falls back to the title if missing.                        |
| `explanation`      | The discovery-first walkthrough. The longest, narrative-driven section.                        | Required.                                                            |
| `synthesis`        | The 1-3 paragraph "if you only read one section, read this." Plain language.                   | Required.                                                            |
| `regulation_text`  | Verbatim regulation excerpts. Quoted, formatted, with `airboss-ref:` citation.                 | Optional. Skipped for nodes that don't tie to a specific reg.        |
| `practice_prompts` | Questions / scenarios the reader can use to self-test. Optionally linked to scenarios / cards. | Optional.                                                            |
| `citations`        | The structured citation block (handbook + reg stacks).                                         | Generated by the renderer from existing citation data; not authored. |

Authors write only `hook`, `explanation`, `synthesis`, `regulation_text`, `practice_prompts`. The renderer composes them per mode.

### Migration path for existing nodes

~16+ existing knowledge nodes are free-form markdown today. They migrate to the structured shape via:

1. **Automated split** for nodes whose markdown already has `## Hook` / `## Explanation` / `## Synthesis` headings: parse and convert.
2. **Manual annotation** for nodes that don't: add `body_sections:` frontmatter delimiters or split into named sections by hand.

This WP includes the migration of all existing content. Approach: phase 1 ships the renderer + falls back to free-form rendering for un-migrated nodes. Phase 2 migrates nodes incrementally; un-migrated nodes render in Learn mode only (toggle disabled with a tooltip).

### Surfaces

#### Knowledge node detail page (`/knowledge/[slug]`)

- New mode toggle at the top of the body, after the title + breadcrumb. Three buttons: `Learn` / `Review` / `Memorize`. Active mode visually distinct.
- Body re-renders per the mode order. Sections that fall after the "primary content" in a given mode are rendered in a `<details>` collapsible.
- Citations panel (existing) honors the same handbook-vs-reg toggle as WP 1.
- "Why these orders?" link in the toggle area opens an info popover explaining the three modes.

#### Flightbag handbook sections (`/library/handbook/[id]/[chapter]/[section]`) -- v1.1 / out of v1 scope

Future enhancement: handbook sections grow a similar toggle. "Learn" mode shows the full prose; "Memorize" mode shows boxed regulation excerpts only; "Review" mode shows section headers + key-figures + summary boxes. **Out of scope for v1**; called out as foreshadowed.

### Author tooling

- A new `bun run check knowledge-bodies` audit that verifies every knowledge node has at minimum `explanation` + `synthesis` sections. Soft-fail (warning) for missing optional sections.
- A markdownlint or biome rule (or custom) that flags free-form bodies after the migration ships. Once all nodes are migrated, free-form is rejected for new content.

## Behavior

### Mode toggle

1. User lands on `/knowledge/density-altitude`.
2. Default mode is the user's last-used mode (localStorage), falling back to `Learn`.
3. Body renders per the active mode's order.
4. User clicks `Memorize`. Body re-renders client-side (no navigation). Mode persisted.
5. User navigates to a different node; mode persists.

### Section ordering per mode

- **Learn:** hook, explanation, synthesis, regulation_text, practice_prompts, citations.
- **Review:** synthesis, regulation_text, citations, practice_prompts. Then a `<details>` collapsible "Full explanation" containing hook + explanation.
- **Memorize:** regulation_text, synthesis, practice_prompts, citations. Then a `<details>` collapsible "Full explanation" containing hook + explanation.

For Memorize mode on a node *without* a `regulation_text` section: fall back to Learn order with a notice "no regulation excerpt for this topic; showing the standard view."

### Migration of free-form nodes

- A free-form node (no `body_sections` frontmatter) renders as today's free-form body.
- The mode toggle is visible but disabled, with a tooltip: "This node is not yet structured for mode switching."
- Once an author adds `body_sections:` frontmatter, the toggle activates.

## Validation

| Field                             | Rule                                                                                                                                                               |            |                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------ |
| `body_sections` (frontmatter)     | If present: must contain at least `explanation` and `synthesis`. Each entry must have `type` in the closed enum + a non-empty body.                                |            |                                                                                                  |
| `body_sections.[].type`           | Closed enum: `hook`, `explanation`, `synthesis`, `regulation_text`, `practice_prompts`. (`citations` is generated, not authored.)                                  |            |                                                                                                  |
| Mode toggle URL param (`?mode=`)  | If present, must be `'learn' \                                                                                                                                     | 'review' \ | 'memorize'`. Invalid -> redirect without param.                                                  |
| `study.user_pref` mode preference | Key `study.knowledge.render_mode`, value `'learn' \                                                                                                                | 'review' \ | 'memorize'`. Validated by Zod via the `USER_PREF_SCHEMAS` registry from WP 1. Invalid -> reject. |
| `practice_prompts` markers        | `airboss-ref:card:<id>` or `airboss-ref:scenario:<id>` -- target id must resolve in the registry; unresolvable links render as plain text with a dev-mode warning. |            |                                                                                                  |

One form action: `?/setPref` (POST). Reuses WP 1's user-pref form action shape; key fixed to `study.knowledge.render_mode`.

## Edge cases

| Trigger                                                                 | What happens                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node has only `explanation` + `synthesis` (no hook, no reg, no prompts) | All three modes render the same content; toggle still visible but the difference between modes is minimal. No error.                              |
| Node has free-form body (not migrated)                                  | Toggle disabled with tooltip. Body renders as free-form.                                                                                          |
| User picks Memorize on a node with no `regulation_text`                 | Falls back to Learn order; banner notice "no regulation excerpt for this topic."                                                                  |
| User has `?mode=memorize` in URL but the node isn't migrated            | URL param ignored; renders in free-form. Toggle disabled.                                                                                         |
| Author adds `body_sections` frontmatter but forgets `synthesis`         | `bun run check knowledge-bodies` warns. Renderer falls back to free-form; toggle disabled.                                                        |
| Same node opened in two tabs                                            | Both honor the server-side `study.user_pref`. A mode change in tab A persists; tab B sees it on next load (no cross-tab live update). Acceptable. |
| `airboss-ref:card:<id>` link with unresolvable id                       | Link renders as plain text. Dev-mode console warning. Authoring lint flags broken links.                                                          |

## Decisions (formerly open questions, ratified 2026-05-04)

| #   | Question                          | Decision                                                                                                                               |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Section delimiter shape           | Inline HTML-comment delimiters (`<!-- @section: name -->`). Markdown stays native; tiny parser splits on delimiters. See design.md §1. |
| 2   | Migration auto-detection          | Auto-detect `## Hook` / `## Explanation` / `## Synthesis` / `## Regulation` / `## Practice` headings; manual fallback for the rest.    |
| 3   | Mode persistence                  | Server-side `study.user_pref` table -- the same table WP 1 ships. Key: `study.knowledge.render_mode`.                                  |
| 4   | Flightbag handbook section toggle | Out of v1 scope. Captured as `flightbag-render-modes` in `docs/platform/IDEAS.md`. Trigger: real demand for "show only boxed regs."    |
| 5   | Practice prompts shape            | Markdown body with `airboss-ref:card:<id>` / `airboss-ref:scenario:<id>` markers for clickable links to authored cards / scenarios.    |
| 6   | Post-migration lint posture       | `bun run check:knowledge-bodies` warns until full migration completes; one-line flip to error after the last node migrates.            |

These are no longer open. The text in design.md and tasks.md reflects each decision.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## What "done" looks like

- A user opens `/knowledge/density-altitude`.
- The page shows a `Learn / Review / Memorize` toggle below the title.
- `Learn` is selected by default (or the user's last choice).
- Body renders in Learn order: hook, explanation, synthesis, regulation_text, practice_prompts, citations.
- User clicks `Memorize`. Body re-orders without page reload: regulation_text, synthesis, practice_prompts, citations, with hook + explanation collapsed below.
- User navigates to `/knowledge/four-forces`. Mode preference persists; Memorize is selected.
- All ~16+ existing knowledge nodes are migrated to the structured shape.
- `bun run check` clean. Vitest + Playwright green.
