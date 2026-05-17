---
title: 'Tasks: Navigating FAA Documentation'
product: study
feature: faa-documentation-navigation
type: tasks
status: unread
---

# Tasks: Navigating FAA Documentation

Ordered by dependency. The reference pages and glossary entries are the foundation the course steps and knowledge nodes cite, so they come first.

## Pre-flight

- [ ] Read `docs/decisions/011-knowledge-graph-learning-system/decision.md` -- the discovery-first pedagogy and the seven-phase walk.
- [ ] Read `course/courses/weather-comprehensive/manifest.yaml` and one `sections/*.yaml` -- the course-definition shape to mirror.
- [ ] Read `course/knowledge/performance/crosswind-component/node.md` -- the ADR-011 knowledge-node frontmatter contract.
- [ ] Read `course/weather/references/products/_template.md` and `course/weather/references/products/metar/page.md` -- the reference-page shape.
- [ ] Read `libs/help/src/glossary/entries.ts`, `index.ts`, and `index.test.ts` -- the `GlossaryEntry` contract and the loader test.
- [ ] Grep `GLOSSARY_ENTRIES` for each proposed key (`cfr`, `aim`, `acs`, etc.) -- confirm no collision; if `aim` or `acs` is taken, switch to `faa-aim` / `faa-acs` and note it in design.md.
- [ ] Confirm the AC numbering scheme against AC 00-2 Appendix 2 and the current revision letters of the cited ACs (AC 00-45, AC 00-6) via `drs.faa.gov`.

## Implementation

### 1. The reference artifact (the durable map)

- [ ] Create `course/regulations/references/document-families/` and adapt `_template.md` from the weather products template, retargeted to document families per design.md.
- [ ] Author `page.md` for all twelve families: `14-cfr`, `advisory-circulars`, `aim`, `pilot-controller-glossary`, `airman-certification-standards`, `faa-handbooks`, `orders-and-notices`, `technical-standard-orders`, `airworthiness-directives`, `safo-and-info`, `notams`, `chart-supplements`.
- [ ] Each page: binding-or-advisory stated plainly, identifier anatomy, revisions/currency, where-to-find, cross-reference, gotchas, verified `authoritative_sources`.
- [ ] Author `document-families/README.md` -- the family index table (the browsable map): all twelve families, binding-status, issuer, page link.
- [ ] Run `bun run track format` on the new reference files; run `bun run check dirty` -- 0 errors.

### 2. Glossary entries

- [ ] Add one `GlossaryEntry` per family to `GLOSSARY_ENTRIES` in `libs/help/src/glossary/entries.ts`, using the keys and short strings from design.md.
- [ ] Set `related` edges between sibling entries (for example `cfr` related to `advisory-circular` and `airworthiness-directive`).
- [ ] Create a matching `content/<key>.md` long-form body for every new entry.
- [ ] Run `bun test` on `libs/help/src/glossary/index.test.ts` -- the loader test walks every `longRef` and must pass.
- [ ] Run `bun run check dirty` -- 0 errors, commit.

### 3. Knowledge-graph nodes

- [ ] Create `course/knowledge/regulations/faa-document-ecosystem/node.md` -- conceptual root node, the binding/advisory split, the family map. ADR-011 frontmatter, `id: reg-faa-document-ecosystem`, `requires: []`.
- [ ] Create `course/knowledge/regulations/ac-numbering-system/node.md` -- procedural, the predict-subject-from-number skill. Author the five-number discovery exercise per design.md.
- [ ] Create `course/knowledge/regulations/faa-citation-anatomy/node.md` -- procedural, parsing any AC / CFR / AIM identifier.
- [ ] Create `course/knowledge/regulations/faa-cross-reference-triangulation/node.md` -- judgment, the capstone triangulation skill with the 14 CFR 91.103 worked example.
- [ ] Set all graph edges (`requires`, `deepens`, `applied_by`, `related`) per design.md; point `related_knowledge_nodes` on the reference pages at these node IDs.
- [ ] Run the knowledge dry-run validator (`bun run db build` dry-run path) -- all four nodes parse, every edge resolves.
- [ ] Run `bun run check dirty` -- 0 errors, commit.

### 4. The course definition

- [ ] Create `course/courses/faa-documentation-navigation/manifest.yaml` -- `slug: faa-documentation-navigation`, `title: Navigating FAA Documentation`, description framing it as the "take this first" orientation course.
- [ ] Author the six section files in `sections/`: `s1-why-the-ecosystem`, `s2-the-document-families`, `s3-the-ac-numbering-system`, `s4-identifier-anatomy`, `s5-revisions-and-supersession`, `s6-finding-things-and-cross-reference`.
- [ ] Each step: discovery-first framing prose, then hand-off to its knowledge node, mirroring the `weather-comprehensive` step-then-node pattern.
- [ ] Step 3 carries the AC-numbering discovery exercise; step 6 carries the cross-reference worked example.
- [ ] Run the course seed validator (`bun run db build` dry-run) -- the manifest and sections parse.
- [ ] Run `bun run check dirty` -- 0 errors, commit.

### 5. Wire the orientation framing

- [ ] In the first step of `weather-comprehensive` (and any other content course), add a one-line link recommending this course as orientation. Do NOT make it a hard prerequisite.
- [ ] Run `bun run check dirty` -- 0 errors, commit.

## Post-implementation

- [ ] Full manual walk per test-plan.md: take the course, read every reference page, hover every new glossary term.
- [ ] Re-run the course seed validator, knowledge dry-run, and glossary loader test -- all green.
- [ ] Run `bun run check all` -- 0 errors, 0 warnings.
- [ ] Request implementation review (`/ball-review-full` or `/ball-review-cfi` for the pedagogy pass).
- [ ] Update `course/regulations/README.md` and any course index to list the new course.
