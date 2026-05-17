# Phase 3 directive-family audit

DateTime: 2026-05-15
Machine: darwin
Branch: feat/callout-directive-formalisation
Triggering prompt: Land Phase 3 of the markdown-directive cleanup (`:::callout` formalisation + family consistency), following Phase 1 (`:::cards`, PR #983) and Phase 2 (`:::phase`, PR #991).
Context: The markdown directive system lives in `libs/help/src/markdown/` (parser `block.ts`, AST `ast.ts`, validator `validation.ts`) and `libs/constants/src/markdown-directives.ts` (registry). This audit covers the three sub-items the dispatcher named.

## Summary

| Sub-item                         | Finding                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| (c) chart / scenario / xc-viewer | `:::chart` + `:::scenario` are clean attribute-only directives, no H2-eats-content smell. `:::xc-viewer` does not exist. |
| (b) `:::cards` family placement  | `:::cards` is correctly data-payload-body. Migrating it to nested-markdown-body would be wrong. Do NOT migrate.          |
| (a) `:::callout` registry gap    | Genuine inconsistency, but the fix is a product-shape decision. See "The `:::callout` decision" below -- BLOCKER.        |

## 1. The H2-eats-content smell (sub-item c)

Phases 1 and 2 closed a real smell: `:::cards` and `:::phase` previously carried meaning by *position* (a YAML blob after a heading; an `## Context` heading that the splitter consumed as a phase boundary). The audit question for Phase 3: do `:::chart`, `:::scenario`, `:::xc-viewer` have anything analogous?

### `:::chart` -- clean

- Parser case: `block.ts` lines 143-200, attribute-only branch (lines 180-199). `:::chart` is NOT in `MARKDOWN_DIRECTIVE_BODY_BEARING`, so the parser **rejects any body content** between `:::chart slug="..."` and the `:::` closer (lines 186-191, "must not contain a body"). It also rejects an unclosed directive.
- Validation: `validateDirective` (lines 517-525) requires `slug` and checks it against `WX_CHART_SLUG_REGEX`. A typo fails at parse time.
- AST: emits `{ kind: 'directive', name: 'chart', attrs }` with `body` and `children` both `undefined` (ast.ts lines 100-106).
- Authored uses: zero authored `:::chart` blocks exist in `course/` today (`grep -rn ':::chart' course/` returns nothing). The directive is exercised only by `libs/help/src/markdown/directives.test.ts`.
- Verdict: **clean.** No body, no positional semantics, no heading carries meaning. It is a pure component-mount directive. Nothing to fix.

### `:::scenario` -- clean

- Parser case: same attribute-only branch as `:::chart`. Body content rejected, unclosed rejected.
- Validation: `validateDirective` (lines 526-531) requires `slug` and checks it against `WX_SCENARIO_VALUES` (the registered scenario set).
- Authored uses: zero authored `:::scenario` blocks in `course/`. Exercised only by `directives.test.ts`.
- Verdict: **clean.** Identical shape to `:::chart`. Pure component-mount. Nothing to fix.

### `:::xc-viewer` -- does not exist

- `grep -rn 'xc-viewer'` across `*.ts` / `*.svelte` / `course/` finds the term ONLY in planning docs (`docs/vision/products/pre-flight/xc-viewer/VISION.md`, `docs/work-packages/xc-viewer-v1/*`, roadmap/board entries). There is no `:::xc-viewer` parser case, no registry entry, no authored content.
- Verdict: **not a directive.** It is a planned product surface (a work package), not a markdown directive. Nothing to audit, nothing to ship.

### Conclusion for sub-item (c)

All three are clean. `:::chart` and `:::scenario` are pure attribute-only directives with parse-time body rejection and slug validation: there is no hidden-semantics problem, no content silently dropped, no heading carrying meaning. `:::xc-viewer` does not exist as a directive. **There is no Phase 1/2-style smell to fix in this sub-item -- no code ships here.** This is the expected "audit found them clean" outcome.

## 2. `:::cards` family placement (sub-item b)

The question: should `:::cards` migrate from the data-payload-body family to the nested-markdown-body family that Phase 2 introduced?

### What `:::cards` body actually is

The body of a `:::cards` block is a YAML sequence of card objects:

```text
:::cards
- front: "What does VFR stand for?"
  back: "Visual Flight Rules."
  cardType: basic
:::
```

The parser captures the body verbatim into `node.body` and hands it to `parseCardsYaml` (re-exported from `@ab/bc-study`) for schema validation (`block.ts` lines 532-548). The body is **structured data** -- a typed YAML payload that feeds the spaced-repetition seeder at build time. It is parsed by a YAML parser, validated against a card schema, and never rendered as prose on the knowledge node (the rendered page is intentionally silent; cards surface via the review queue).

### Why migrating to nested-markdown-body would be wrong

The nested-markdown-body family (`:::phase`) exists because a phase body **is authored markdown** -- prose, lists, headings, tables. The parser recursively walks it through the block parser and stores an `MdNode[]` AST in `node.children` so renderers can mount a real tree.

A `:::cards` body is the opposite: it is a YAML data structure, not markdown. Feeding `- front: "..." back: "..."` through the markdown block parser would produce a `list` node whose items are paragraphs containing the literal text `front: "..."` -- garbage. There is no renderer that would consume that AST, and `parseCardsYaml` would still have to run to extract the actual card data. Converting `:::cards` to nested-markdown-body would add a meaningless `children` AST while keeping the YAML-payload code path: strictly worse, more code, zero gain.

### Conclusion for sub-item (b)

**`:::cards` stays in the data-payload-body family. It does NOT migrate.** This is a deliberate, defensible "do the right thing" outcome: the card body is genuinely a typed data payload, not authored markdown. The three families are correct as designed. The registry constants (`MARKDOWN_DIRECTIVE_BODY_BEARING` vs `MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY`) already make the distinction explicit, and the `markdown-directives.ts` doc comment documents all three families clearly. No code ships for this sub-item beyond confirming the registry comments are accurate (they are).

## 3. The `:::callout` decision (sub-item a)

### How callouts are parsed today

Callouts use the syntax `:::variant [optional title]` ... `:::`, where `variant` is one of `tip` / `warn` / `danger` / `howto` / `note` / `example` (`CALLOUT_VARIANTS` in `libs/help/src/validation.ts`).

- Parser: `block.ts` lines 117-234. The `:::ident` opener is shared with directives. The parser first checks `DIRECTIVE_NAME_SET` (the registry). If the name is NOT a registered directive, it falls through to the callout branch (lines 202-233), which validates the name against `CALLOUT_VARIANT_SET`, captures the body lines (with nested-callout depth matching), recursively parses the body as markdown, and emits `{ kind: 'callout', variant, title, children }`.
- AST: `CalloutNode` (ast.ts lines 61-66) -- a distinct node kind from `DirectiveNode`, with a `variant` field and a nested-markdown `children` AST.
- Validation: `extractCalloutVariants` + `CALLOUT_VARIANTS` in `validation.ts` (lines 47-57, 345-357) flags unknown variants in help-page section bodies at build time.
- Renderer: `MarkdownBody.svelte` line 148 handles `kind === 'callout'` -> `<HelpCard variant=... title=...>`.

### Authored callout inventory

69 authored callouts across 19 files, all in `apps/study/src/lib/help/content/bodies/` (help-page bodies). Breakdown: 26 `:::tip`, 19 `:::note`, 13 `:::example`, 11 `:::warn`, 0 `:::howto`, 0 `:::danger`. **Zero callouts are authored in `course/knowledge/`** -- they live entirely in TypeScript help-content body strings.

### What the inconsistency actually is

Callouts are NOT an ad-hoc system. They share the `:::name` opener, have a closed variant set, have nested-markdown bodies, and have parse-time validation. They are, in every functional respect, a directive family. The single inconsistency is that **the directive registry (`MARKDOWN_DIRECTIVE_NAMES`) does not list callouts at all**, and the parser keys callouts on a separate `CALLOUT_VARIANT_SET`. The variant is encoded as the directive *name* (`:::tip`) rather than as an attribute (`:::callout variant="tip"`).

### Two ways to "formalise"

Option A -- migrate the syntax. Add `MARKDOWN_DIRECTIVE_NAMES.CALLOUT = 'callout'`, put it in `MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY`, require a `variant` attribute. Authoring becomes `:::callout variant="tip"`. Migrate all 69 sites with a migration script (modelled on `2026-05-h2-phases-to-directive.ts`). Delete the separate callout parser branch + `CALLOUT_VARIANT_SET`. Result: one registry, one code path.

Option B -- formalise the family without changing syntax. Recognise callouts as a **fourth directive family: variant-named directives** (the variant IS the directive name, drawn from a closed enum; the body is nested markdown). Document this family in `markdown-directives.ts` alongside the existing three. Keep `:::tip` / `:::warn` / etc. as the authored syntax. The `CALLOUT_VARIANTS` list becomes the registry surface for that family. No content migration. The registry doc comment stops reading as "directives are formal, callouts are something else" and instead reads as "four families, callouts are the fourth."

### Why this needs the dispatcher's decision

The dispatch brief for sub-item (a) explicitly says "`:::callout` joins the `MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY` family alongside `:::phase`" -- that presupposes Option A (a single `callout` name with a `variant` attribute), because the registry keys on one fixed `name`.

But Option A makes authoring strictly worse:

- 69 sites become more verbose (`:::callout variant="tip"` vs `:::tip`).
- The readable opener (`:::warn` telegraphs the callout kind at a glance) is lost.
- The sole gain is "one list instead of two" -- an internal-consistency win with zero functional or authoring benefit.

CLAUDE.md PRIME DIRECTIVE: "do the right thing... longer scope to do it right is always acceptable, quality shortcuts are not." The dispatch brief itself, for sub-item (b), explicitly says a migration that "makes the code worse" is the wrong call and a deliberate non-migration is a valid outcome. The same logic applies here: Option A is a syntax downgrade for 69 authored sites.

The CLAUDE.md "No legacy -- retire on sight" rule is about *dead* code paths, not about *equivalent* syntax. `:::tip` is not legacy: it is the live, ergonomic, widely-used authoring form. Option B does not leave a "legacy alias" -- it formalises the existing syntax as a first-class family.

My recommendation is **Option B**: formalise callouts as the fourth directive family (variant-named, nested-markdown body), document it in the registry, keep `:::tip` syntax. This closes the registry gap (the system becomes coherent and fully documented) without a 69-site syntax downgrade.

But Option B conflicts with the brief's explicit instruction that `:::callout` joins `MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY` as a single name. That conflict is a genuine product-shape decision the dispatcher must make. Per the brief: "stop and ask if you genuinely don't know the right thing" -- here I *do* have a recommendation, but it contradicts the literal instruction, so the dispatcher needs to confirm which option to ship.

## Recommendation

- Sub-item (c): no code. Audit confirms `:::chart` / `:::scenario` clean, `:::xc-viewer` non-existent.
- Sub-item (b): no migration. `:::cards` stays data-payload-body. Confirmed correct by design.
- Sub-item (a): BLOCKER. Option A (migrate 69 sites to `:::callout variant="tip"`, delete callout branch) vs Option B (formalise callouts as the fourth family, keep `:::tip` syntax). Recommended: Option B. Dispatcher decides.

## Resolution (2026-05-16)

The dispatcher resolved sub-item (a) as **Option B** -- formalise callouts as the fourth directive family (variant-named directives), keep `:::tip` / `:::warn` / `:::note` / `:::example` as the authored syntax, no content migration. Shipped in the PR titled `feat(course): :::callout directive family + inline-closed directive form (Phase 3)`:

- Callout family added to the `@ab/constants` registry (`MARKDOWN_CALLOUT_VARIANT_NAMES`); the registry doc comment now documents all four families and each callout variant's semantic purpose.
- `danger` and `howto` retired (zero authored uses, dead code).
- The parser recognises callouts through the unified registry opener set; the ad-hoc `CALLOUT_VARIANT_SET` is now sourced from the registry. The callout path still emits `CalloutNode`, so the `<HelpCard>` renderer is unchanged.
- A general inline-closed directive form was added (`:::name ...:::`), separate from the callout decision.
- `:::cards` stays data-payload-body, as this audit concluded.
