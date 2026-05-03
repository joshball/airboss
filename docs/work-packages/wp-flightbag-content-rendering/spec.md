---
title: 'Spec: WP-FLIGHTBAG-CONTENT -- wire flightbag load functions to real @ab/sources resolvers'
product: flightbag
feature: wp-flightbag-content-rendering
type: spec
status: draft
review_status: pending
---

# WP-FLIGHTBAG-CONTENT: wire flightbag load functions to real content

The flightbag scaffold (#524) shipped with placeholder load functions that parse the `airboss-ref:` URI and hand it to a stub `<RenderedSection>` component. This WP wires real content rendering: each route load function calls `@ab/sources` resolvers to fetch the actual `reference_section` data, and `<RenderedSection>` renders the markdown body via the existing markdown pipeline.

## Pre-conditions

- ✅ Flightbag scaffold lands (#524)
- ✅ All section-tree promotions land (Wave 2 — WP-MTN, WP-RMH, WP-AIH, WP-IPH, WP-IFH all complete)
- ✅ handbooks-extras retired (Wave 4 — every reference is section-tree)

## Scope

### Per-route load function wiring

Each placeholder route in `apps/flightbag/src/routes/` gets a real `+page.server.ts` `load()` that:

1. Validates URL params via existing locator parsers (`parseHandbooksLocator`, etc.)
2. Resolves to a `SourceId` via `@ab/sources`
3. Loads the `study.reference` row + matching `study.reference_section` rows from the DB
4. Constructs a render context: section title, breadcrumbs (parent chapter + grandparent doc), prev/next siblings, body markdown
5. Hands to the page component for rendering

### `<RenderedSection>` real implementation

Today: stub component renders the markdown string directly.

After this WP:
- Renders markdown via the existing pipeline (`@ab/ui/MarkdownRenderer` or whatever study uses)
- Renders inline `<CitationChip>` components when content references other `airboss-ref:` URIs
- Renders inline figures (looks up `figures/<id>.png` paths from manifest)
- Renders inline tables (looks up `tables/<id>.html` paths from manifest)
- Frontmatter metadata visible (FAA pages, source URL link)

### Breadcrumbs + navigation

- Doc landing → Chapter list
- Chapter page → prev/next chapter, link to parent doc, child sections list
- Section page → prev/next section in chapter, link to parent chapter

All navigation URLs use `ROUTES.FLIGHTBAG_*` (no inline strings).

### Per-corpus rendering tweaks

- **Handbook section page**: standard chapter→section→content shape
- **AIM paragraph page**: shorter chunks; render the paragraph plus its parent section's table-of-contents
- **CFR section page**: bold §, italicize subsection lettering, render the regulatory text in monospace if helpful
- **AC page**: it's a single AC document; chapter index + section render
- **ACS task page**: 4-level depth (publication → area → task → element); element checkboxes if applicable

These are CSS/template differences. Each corpus gets its own page template.

## Phases

### Phase 1: Real `<RenderedSection>` + markdown pipeline

Before any route wiring: get one section rendering correctly. Pick PHAK §2.3 as the test target.

### Phase 2: Handbook routes (3 depths)

`/handbook/[slug]/[edition]`, `/handbook/[slug]/[edition]/[chapter]`, `/handbook/[slug]/[edition]/[chapter]/[section]`. Three load functions, three page templates.

### Phase 3: AIM routes

`/aim/[chapter]/[section]/[paragraph]`. Plus parent chapter/section overview pages.

### Phase 4: CFR routes

`/cfr/[title]/[part]/[section]`.

### Phase 5: AC routes

`/ac/[doc]/[rev]`. Single page (whole-doc view) with section anchors if section-tree promoted.

### Phase 6: ACS routes

`/acs/[doc]/area/[area]/task/[task]`. Plus element list rendering.

### Phase 7: Citation chips

`<CitationChip>` real implementation:
- Resolves `airboss-ref:` URI to display label (e.g. "PHAK §2.3")
- Links to the matching flightbag URL via `urlForReference()`
- Hover preview (tooltip with first paragraph of target section)

### Phase 8: Tests

- Each route has a unit test that mocks the resolver and verifies render output
- E2E test: navigate from study citation chip → flightbag → drill down → return

### Phase 9: Doc updates

- Update REFERENCES.md to remove "scaffold only" caveat
- Update flightbag VISION.md to reflect "in production"

## Out of scope

- Search inside flightbag (separate WP — index from manifests; ranking; query UI)
- Auth on flightbag (still public)
- Public web deployment (separate concern)
- Migrating study's `/library/...` routes (separate WP per `wp-citation-chips-to-flightbag/`)

## Risks

- **Existing markdown pipeline assumes study context.** May need extracting into `libs/library/` for shared use across study and flightbag without coupling.
- **CitationChip recursion**: a chip on a section might link to another section that has its own chips. Don't over-render; chips are flat (no hover-of-hover).
- **Heavy chunks**: PHAK chapter 2 has 60+ sections. Don't load them all at once on the chapter page; show chapter overview + nav-only.

## Anchors

- [PR #524 Flightbag scaffold](https://github.com/joshball/airboss/pull/524)
- [docs/products/flightbag/VISION.md](../../products/flightbag/VISION.md)
- [WP-CITATION-CHIPS-TO-FLIGHTBAG](../wp-citation-chips-to-flightbag/spec.md) — runs after this
- [WP-HANGAR-REFS](../wp-hangar-references-dashboard/spec.md) — admin counterpart
