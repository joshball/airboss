---
title: 'Design: Navigating FAA Documentation'
product: study
feature: faa-documentation-navigation
type: design
status: unread
---

# Design: Navigating FAA Documentation

This is a content-authoring work package with no data model change. The design here is content architecture: where each file lives, how the four artifact types relate, the knowledge-node identifiers, the glossary entry keys, the reference-page structure, and the design of the AC-numbering discovery exercise.

## Key decision: four artifact types, one course

The course is the spine. It threads three other artifact types, each chosen because it is the right shape for a different slice of the material.

- A **course** (`course/courses/`) is the right shape for a guided arc: a returning pilot walks the six topics in order. Mirrors `weather-comprehensive`.
- **Knowledge nodes** (`course/knowledge/`) are the right shape for a discovery-walk skill that can be reviewed in isolation and pulled into spaced repetition. The AC numbering system, identifier anatomy, and cross-reference triangulation are skills, not just facts: a learner can practice and be assessed on them. They get nodes.
- **Glossary entries** (`libs/help/src/glossary/`) are the right shape for the acronyms. A pilot encounters "InFO" or "SAFO" anywhere in the app and wants a one-line answer without leaving the page. The document-family acronyms are glossary-shaped regardless of this course; the course is just the occasion to author them.
- A **reference artifact** (`course/regulations/references/`) is the right shape for the durable map: one browsable, citable page per family. It is the answer key the knowledge nodes point at, and the thing a pilot returns to months later.

The taxonomy is glossary-shaped AND reference-shaped: the glossary entry is the 160-character tooltip, the reference page is the full treatment. They are not redundant; they are two depths of the same content, exactly as `weather` does with its glossary terms and its `references/products/` pages.

## File layout

```text
course/
  courses/
    faa-documentation-navigation/
      manifest.yaml                          course definition, mirrors weather-comprehensive
      sections/
        s1-why-the-ecosystem.yaml             frame: why split binding rules from advisory guidance
        s2-the-document-families.yaml         the taxonomy: 12 families, regulatory vs advisory
        s3-the-ac-numbering-system.yaml       the discovery exercise
        s4-identifier-anatomy.yaml            AC / CFR / AIM citation anatomy
        s5-revisions-and-supersession.yaml    revision letters, changes, cancellation
        s6-finding-things-and-cross-reference.yaml  DRS, eCFR, and the triangulation skill
  knowledge/
    regulations/
      faa-document-ecosystem/node.md          conceptual: the binding/advisory split, family map
      ac-numbering-system/node.md             procedural: predict subject from AC number
      faa-citation-anatomy/node.md            procedural: parse any AC / CFR / AIM identifier
      faa-cross-reference-triangulation/node.md  judgment: triangulate a question across families
  regulations/
    references/
      document-families/
        _template.md                         the family-page shape (adapted from weather _template.md)
        README.md                             the family index: the browsable map
        14-cfr/page.md
        advisory-circulars/page.md
        aim/page.md
        pilot-controller-glossary/page.md
        airman-certification-standards/page.md
        faa-handbooks/page.md
        orders-and-notices/page.md
        technical-standard-orders/page.md
        airworthiness-directives/page.md
        safo-and-info/page.md
        notams/page.md
        chart-supplements/page.md

libs/help/src/glossary/
  entries.ts                                  add one GlossaryEntry per family acronym
  content/
    cfr.md, advisory-circular.md, aim.md, pcg.md, acs.md,
    faa-handbook.md, faa-order.md, tso.md, airworthiness-directive.md,
    safo.md, info.md, notam.md, chart-supplement.md
```

## Knowledge-node identifiers

Existing weather nodes use the `wx-` prefix; performance nodes use `perf-`. The regulations domain uses `reg-`. The four node IDs:

| Node directory                      | `id`                                    | `domain`    | Knowledge character    |
| ----------------------------------- | --------------------------------------- | ----------- | ---------------------- |
| `faa-document-ecosystem`            | `reg-faa-document-ecosystem`            | regulations | conceptual             |
| `ac-numbering-system`               | `reg-ac-numbering-system`               | regulations | procedural, conceptual |
| `faa-citation-anatomy`              | `reg-faa-citation-anatomy`              | regulations | procedural             |
| `faa-cross-reference-triangulation` | `reg-faa-cross-reference-triangulation` | regulations | judgment, procedural   |

Frontmatter follows the ADR-011 contract exactly (the shape of `course/knowledge/performance/crosswind-component/node.md`): identity block, knowledge-character block, cert and study-priority block, `requires` / `deepens` / `applied_by` / `related` graph edges, content-and-delivery block, `references` block, and assessment block.

Graph edges:

- `reg-faa-document-ecosystem` is the root. `requires: []`. It is required-by the other three.
- `reg-ac-numbering-system` `requires: [reg-faa-document-ecosystem]`.
- `reg-faa-citation-anatomy` `requires: [reg-faa-document-ecosystem]`.
- `reg-faa-cross-reference-triangulation` `requires: [reg-faa-document-ecosystem, reg-faa-citation-anatomy]`; it is the capstone skill.
- All four carry `minimum_cert: private` and `study_priority: standard`. None is checkride-hot, so none is `critical`.
- `related` edges link out to existing nodes where natural (for example the cross-reference node `related`s a weather go/no-go node, since the worked example is a weather decision).

## Glossary entry keys

`GlossaryEntry.key` is lower-kebab-case and never repurposed. One entry per family. Where the acronym is the term, the term field is the upper-cased acronym (matching the existing `cta`, `ia`, `bc` entries).

| `key`                     | `term`             | `short` (<= 160 chars, plain English)                                                                      |
| ------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `cfr`                     | `14 CFR`           | Title 14 of the Code of Federal Regulations: the binding aviation rules. "FAR" is the colloquial name.     |
| `advisory-circular`       | `AC`               | Advisory Circular. FAA guidance showing one acceptable means of complying with a rule. Not itself binding. |
| `aim`                     | `AIM`              | Aeronautical Information Manual. The FAA's operational how-to: procedures, phraseology, hazards. Advisory. |
| `pcg`                     | `P/CG`             | Pilot/Controller Glossary. The shared vocabulary that backs the AIM and ATC phraseology.                   |
| `acs`                     | `ACS`              | Airman Certification Standards. What a checkride tests, task by task. Replaced the older PTS.              |
| `faa-handbook`            | `FAA Handbook`     | The training-depth references: PHAK, AFH, IFH, the Aviation Weather Handbook, and others. Advisory.        |
| `faa-order`               | `FAA Order`        | Internal FAA direction (8900.1, JO 7110.65). Binds the agency and its inspectors, not pilots directly.     |
| `tso`                     | `TSO`              | Technical Standard Order. Minimum performance standards an article (avionics, equipment) must meet.        |
| `airworthiness-directive` | `AD`               | Airworthiness Directive. A binding, mandatory corrective action on a specific aircraft or article.         |
| `safo`                    | `SAFO`             | Safety Alert for Operators. A time-sensitive FAA safety message. Advisory but high-priority.               |
| `info`                    | `InFO`             | Information for Operators. An FAA notice sharing non-urgent operational information. Advisory.             |
| `notam`                   | `NOTAM`            | Notice to Air Missions. A binding, time-critical notice of a change to the National Airspace System.       |
| `chart-supplement`        | `Chart Supplement` | Airport and facility data, formerly the Airport/Facility Directory. Issued on a 56-day cycle.              |

Before authoring, the implementer greps `GLOSSARY_ENTRIES` for each `key` to confirm no collision. `aim` and `acs` are the collision-risk keys; if either is taken by an unrelated meaning, the aviation entry takes `faa-aim` / `faa-acs` and the design doc records the rename. Each entry adds a matching `content/<key>.md`; the `index.test.ts` loader test walks every `longRef` and asserts the file exists, so a missing body fails the check pipeline.

## Reference-page structure

The family-page `_template.md` is adapted from `course/weather/references/products/_template.md`, retargeted from weather products to document families. Per-page sections:

- Frontmatter: `id` (kebab, prefixed `faa-doc-`), `title`, `family_code`, `binding` (`regulatory` | `advisory`), `issuer`, `update_cadence`, `status`, `authoritative_sources`, `related_knowledge_nodes`, `related_families`.
- `## What it is` -- who issues it, what authority it carries, what it covers.
- `## Binding or advisory` -- the single load-bearing distinction, stated plainly for this family.
- `## How it is identified` -- the citation anatomy for this family (an AC number, a CFR section, an AIM paragraph).
- `## Revisions and currency` -- how this family supersedes itself; how to confirm you have the current edition.
- `## Where to find it` -- the canonical online home and the direct URL pattern.
- `## How it relates to the others` -- the cross-reference: which families this one points to and is pointed at by.
- `## Common gotchas` -- the misread that bites people for this family.
- `## Related families` and `## Related knowledge nodes` -- the graph links.

The `README.md` in `document-families/` is the family index: a single table of all twelve families with binding-status, issuer, and a link to each page. This table IS the map the course exists to provide; it is the most-linked-to artifact in the work package.

## The AC-numbering discovery exercise

The exercise lives in two places: the course step `s3-the-ac-numbering-system.yaml` and the knowledge node `reg-ac-numbering-system`. It is authored, not coded: it uses the existing card and recall modalities.

The discovery arc, per ADR 011:

1. **Hook with a problem.** Show five real AC numbers with their subjects hidden: `AC 61-65`, `AC 91-73`, `AC 20-138`, `AC 150-5300-13`, `AC 00-6`. Ask the learner to guess what each is about.
2. **Let them struggle, then give one anchor.** Reveal that `AC 61-65` is "Certification: Pilots and Flight and Ground Instructors" and that 14 CFR Part 61 is the pilot-certification regulation. The learner is invited to notice the 61 matches.
3. **Let them generalize.** Ask: if 61 is the Part-61 series, what would you expect 91 to be? 150? The learner reasons toward "the AC number mirrors the CFR part."
4. **Reveal the scheme.** Present the subject-series table (00 general, 20 aircraft, 60 airmen, 61 certification, 90 air traffic and general operating rules, 150 airports). Confirm against AC 00-2 Appendix 2.
5. **Confirm with the regulation.** Show that the AC series prefix and the CFR subchapter structure are the same skeleton. The numbering is not arbitrary; it is a deliberate mirror.
6. **Practice.** Recall cards: given an AC number, name the subject area; given a subject, name the series prefix.

The five-number set is a stable contract: the same numbers appear in the step body, the node body, and the recall cards so a learner sees one consistent worked set.

## Key decisions

### Standalone course, framed "take this first," not a hard prerequisite

The question: should this course gate the content courses (a learner must finish it before `weather-comprehensive`)? The decision: no. It is a standalone course, framed in its manifest and first step as the orientation to take first, and linked from the first step of content courses as recommended. A hard prerequisite would block a learner who already knows the ecosystem and wants to start on weather. Soft framing gets the new pilot oriented without caging the experienced one. Making it a hard prerequisite is deferred (see OUT-OF-SCOPE.md) with a concrete revisit trigger.

### Both knowledge nodes and glossary entries, not one or the other

The question: nodes, glossary, or both? The decision: both, because they serve different jobs. The glossary answers "what does this acronym mean" in a tooltip anywhere in the app; the nodes deliver a discovery-walk skill that enters spaced repetition. Authoring only the glossary would leave the numbering and triangulation skills with no home in the study engine. Authoring only nodes would leave every acronym un-explained outside this one course. The taxonomy genuinely needs both depths.

### Reference artifact included, not deferred

The question: is the per-family reference page worth authoring now? The decision: yes, include it. The reference pages are the durable map and the answer key the knowledge nodes cite. Without them the course teaches the skill of navigation but leaves no artifact to navigate. `weather` proved the pattern: the `references/products/` pages are the most-returned-to weather content. The `document-families/README.md` index is the single most valuable file in the package: the browsable map the FAA does not publish.

### Reference pages live under `course/regulations/`, not `course/weather/`

The weather reference pages live under `course/weather/references/products/`. By symmetry, the document-family pages live under `course/regulations/references/document-families/`: `course/regulations/` already exists as the home of the FAR-navigation course content. This keeps the reference artifact co-located with the regulatory-domain content it serves, exactly as the weather references sit under `course/weather/`.

### No data model change

The course manifest, knowledge nodes, and reference pages are file-backed content consumed by the existing course and knowledge seed pipelines. The glossary entries extend an existing typed array and its markdown corpus. Nothing in this package adds a table, a column, or a schema namespace. The validators that gate it (course seed validator, knowledge dry-run, glossary loader test) all already exist.
