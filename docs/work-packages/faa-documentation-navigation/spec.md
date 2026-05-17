---
id: faa-documentation-navigation
title: 'Spec: Navigating FAA Documentation'
product: course
category: content
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-17
owner: agent
depends_on: []
unblocks: []
tags:
  - course
  - regulations
  - knowledge-graph
  - glossary
legacy_fields:
  feature: faa-documentation-navigation
  type: spec
---

# Spec: Navigating FAA Documentation

A short orientation course that teaches a pilot how to navigate the FAA's documentation ecosystem: not the content of any single document, but the map of how the document families fit together, how they are numbered, how they cross-reference, how they supersede each other, and where to find them.

## Why this course exists

Pilots are handed a pile of acronyms (CFR, FAR, AC, AIM, PCG, ACS, PTS, PHAK, AFH, IFH, SAFO, InFO, NOTAM, TSO, AD) with no orientation to how the system fits together. The FAA itself publishes no single browsable index. The old master checklist of advisory circulars, AC 00-2, was cancelled; its replacement, the Dynamic Regulatory System at `drs.faa.gov`, is a search tool, not a map. You cannot browse the documentation ecosystem from any one FAA page.

That absence is the course's reason to exist. This course is the map the FAA does not publish. It exists to get a returning pilot pointed in the right direction: when they ask "wait, what even IS an AC, and how is it different from the AIM, and why does AC 00-45 have an H on it," this course is the answer.

The audience is airboss's user zero: the returning private, instrument, or CFI pilot rebuilding knowledge who keeps hitting the documentation ecosystem as an undifferentiated wall of acronyms.

## Scope of the deliverable

This is a content-authoring work package. It produces course material, knowledge-graph nodes, glossary entries, and a reference artifact. It is not an application feature: there is no new route, no new component, no API surface.

The deliverable, in four parts:

1. A course definition under `course/courses/faa-documentation-navigation/`, mirroring `course/courses/weather-comprehensive/` (a `manifest.yaml` plus per-section step files).
2. Knowledge-graph nodes under `course/knowledge/regulations/` for the discovery-shaped skills (the AC numbering system, identifier anatomy, cross-reference triangulation).
3. Glossary entries under `libs/help/src/glossary/` for the document-family acronyms (one entry per family).
4. A reference artifact under `course/regulations/references/document-families/`: one browsable, citable page per FAA document family, mirroring `course/weather/references/products/`.

## Data model

No data model changes. This work package authors course content, knowledge nodes, glossary entries, and reference markdown. It does not add tables, columns, or schema namespaces. The course definition, knowledge nodes, and reference pages are file-backed content seeded through the existing course and knowledge pipelines; the glossary entries extend the existing `GLOSSARY_ENTRIES` array and its `content/<key>.md` corpus.

## Course content

The course covers six topics. Each is authored discovery-first per ADR 011: lead with WHY, let the learner reason toward the answer, reveal the FAA structure as confirmation of that reasoning.

### 1. The document-family taxonomy

For each family: what it is, regulatory vs advisory (binding vs guidance), who issues it, how often it changes, where it lives online. Families covered:

| Family                    | Binding? | What it is                                                                |
| ------------------------- | -------- | ------------------------------------------------------------------------- |
| 14 CFR                    | Binding  | The regulations. "FAR" is the colloquial name for the same thing.         |
| Advisory Circulars        | Advisory | One acceptable means of compliance with a regulation.                     |
| AIM                       | Advisory | Aeronautical Information Manual: operational how-to and procedures.       |
| Pilot/Controller Glossary | Advisory | The shared vocabulary for AIM and ATC phraseology.                        |
| ACS                       | Advisory | Airman Certification Standards. Replaced the older PTS.                   |
| FAA handbooks             | Advisory | PHAK, AFH, IFH, Aviation Weather Handbook, and others.                    |
| Orders & Notices          | Advisory | Internal FAA direction (8900.1, JO 7110.65, and similar).                 |
| TSOs                      | Advisory | Technical Standard Orders: minimum performance standards for articles.    |
| Airworthiness Directives  | Binding  | ADs: mandatory corrective action on a specific aircraft or article.       |
| SAFOs and InFOs           | Advisory | Safety Alerts for Operators; Information for Operators.                   |
| NOTAMs                    | Binding  | Notices to Air Missions: time-critical changes to the NAS.                |
| Chart Supplements         | Advisory | Airport and facility data formerly called the Airport/Facility Directory. |

The single most important distinction, taught explicitly, is regulatory vs advisory. An AC shows ONE acceptable means of compliance; it is not itself binding. A 14 CFR section IS binding. A pilot who confuses the two either over-constrains (treating advisory guidance as law) or under-constrains (treating a binding rule as optional).

### 2. The AC numbering system, taught as a discovery

The AC number mirrors the subchapter structure of 14 CFR. Subject-series prefixes: 00 = general, 20 = aircraft, 60 = airmen, 61 = certification and ratings, 90 = air traffic and general operating rules, 150 = airports, and so on. AC 61-65 is guidance ABOUT 14 CFR Part 61.

The learner is shown five AC numbers, asked to predict each subject, and only then shown the scheme. The skill is predicting an AC's subject from its number. Source for the numbering scheme: AC 00-2, Appendix 2.

### 3. Document identifier anatomy

Pull apart "AC 00-45H": document-type prefix (AC), AC number (00-45), revision letter (H). Contrast the IDENTIFIER with the TITLE ("Aviation Weather Services"): the identifier locates the document, the title describes it. The same anatomy applies to a CFR cite (14 CFR 91.137(a)(2): title / part / section / paragraph) and an AIM cite (7-1-6: chapter / section / paragraph). The vocabulary is taught precisely so the learner can read any citation they encounter.

### 4. Revisions, changes, cancellation, supersession

What the revision letter means, what a "Change 1 / CHG 2" is versus a full revision, what "Cancelled" means, and how a cancelled document still matters. Worked contrasts: AC 00-6A is cancelled but the successor AC 00-6B exists; AC 00-2 is cancelled with no successor (DRS replaced it). The takeaway habit: always check for the current edition before relying on a document.

### 5. How to actually find things

`drs.faa.gov` (the modern master search), the `faa.gov/regulations_policies` areas, eCFR for the regulations, and the per-office AC subsets (the Airports office owns the 150-series; Flight Standards owns others; no single office owns "all ACs"). The flat `documentLibrary` PDF URL pattern is shown so the learner recognizes a direct-to-PDF link when they see one.

### 6. Cross-reference and interrelatedness

The real skill: a CFR section is binding but terse; its matching AC explains an acceptable means of compliance; the AIM gives operational how-to; a handbook gives training-depth treatment; the ACS says what a checkride tests. The learner practices triangulating across families. Worked example: a weather go/no-go question walked from 14 CFR 91.103 to AC 00-45H to AIM Chapter 7 to the Aviation Weather Handbook to the relevant ACS weather task.

## Behavior

### Taking the course

A learner opens the course like any other course in the study app. It runs as a sequence of steps: each step frames its topic in discovery prose and then hands off to a knowledge node for the seven-phase discovery walk, mirroring the `weather-comprehensive` step-then-node pattern. The course is standalone and explicitly framed as "take this first": the manifest description and step 1 both position it as the orientation a returning pilot should complete before diving into a content course.

### The AC-numbering discovery exercise

The numbering-system step presents five AC numbers and asks the learner to predict the subject of each before the scheme is revealed. The exercise is authored in the step body and its knowledge node; it uses the existing card and recall modalities, not a new interaction type.

### Reading a reference page

Each document-family reference page is a standalone, citable markdown page under `course/regulations/references/document-families/<family>/page.md`. A learner reaches it from a course step, from a knowledge node's references, or by browsing the family index. The pages are the durable map: a reader can scan the whole ecosystem one page at a time.

### Glossary lookup

Each document-family acronym resolves in the existing "explain everything" glossary surfaces (hover tooltips, the glossary drawer, the `/reference/glossary` page). A learner who encounters "InFO" anywhere in the app gets the one-line definition without leaving the page.

## Validation

This work package authors content, not user-input forms. Validation is content-correctness, enforced by the existing seed and graph validators.

| Artifact         | Rule                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Course manifest  | Valid `manifest.yaml` shape; passes the course seed validator (`bun run db build` dry-run).   |
| Knowledge nodes  | ADR-011 frontmatter contract; `id` prefixed `reg-`; passes the knowledge dry-run validator.   |
| Glossary entries | Each entry has a matching `content/<key>.md`; the `index.test.ts` loader test stays green.    |
| Reference pages  | Each page follows the `_template.md` shape; frontmatter `id` is unique and kebab-case.        |
| Citations        | Every source citation (AC number, CFR section, AIM paragraph) is verified against the source. |
| Cross-links      | Every `requires` / `related` / `related_knowledge_nodes` link resolves to an existing node.   |

## Edge cases

- A document family the course names but does not give a full reference page (for example a niche Order). The taxonomy step still names it; the family index marks it as covered-by-name only, so a reader is not left wondering whether the page is missing or intentionally brief.
- A cancelled document with no successor (AC 00-2). The revisions step uses it as the worked example for "cancelled, gone, replaced by a system not a document." The reference page for that family explicitly records the cancellation and points at DRS.
- An acronym that already exists in the glossary under a non-aviation meaning (for example a generic three-letter key collision). The new entry uses an aviation-specific key; the design doc resolves any collision before authoring.
- A learner who skips this course and starts a content course cold. The content course's first step links back here as recommended orientation; this course never becomes a hard prerequisite (see OUT-OF-SCOPE.md).

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
