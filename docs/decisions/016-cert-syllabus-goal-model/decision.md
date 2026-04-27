---
title: 'ADR 016: Cert, Syllabus, Goal, and the Multi-Lens Learning Model'
date: 2026-04-26
status: proposed
participants: Joshua Ball, Claude
context: ./context.md
supersedes: null
---

# ADR 016: Cert, Syllabus, Goal, and the Multi-Lens Learning Model

## Decision

Airboss adopts a five-object learning model:

1. **Knowledge graph** -- nodes and typed edges; the truth about aviation concepts. Unchanged from ADR 011.
2. **References** -- first-class citation objects (CFR, AC, handbook, AIM, ACS, NTSB), versioned by edition.
3. **Syllabi** -- authored projections onto the graph. The ACS, PTS, 61.31 endorsement requirements, and custom curricula all share this shape: a tree of Areas -> Tasks -> Elements where each leaf points at one or more graph nodes with `{required_depth, required_bloom, references}`.
4. **Certs / Ratings / Endorsements** -- regulatory artifacts composed as a DAG (not a line). Each carries one or more syllabi (typically the FAA's ACS or PTS plus optional company/school syllabi).
5. **Goals** -- learner-owned. A goal references zero or more syllabi (with weights and optional sequencing) plus ad-hoc graph nodes plus user-authored cards/scenarios. Goals can be cert-agnostic.

The graph is the truth. Syllabi project onto it. Certs are constraint sets. Goals are the learner's union. Mastery is computed at the node and rolls up to whatever structure asks.

This supersedes the implicit "cert lives on the node as a relevance array" model, which conflated assertion with storage. The relevance array becomes a derived cache; the source of "this concept is on the PPL ACS at apply level" lives in the PPL ACS syllabus.

Companion: [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md) is the durable principles document. This ADR records the model and the migration; the philosophy explains the why.

## Why now

User zero is a returning CFI rebuilding PPL/IR/CPL/CFI/CFII/MEI/MEII knowledge from a 30-year hiatus. The current model -- `cert_goals` array on a study plan, relevance entries authored on each node -- handles "study toward a cert" but does not handle:

- **Multi-cert progress at a glance.** "How am I doing on each of seven certs?" requires per-cert rollup the current data shape can compute but no surface exposes.
- **The FAA's actual structure.** ACS Areas of Operation -> Tasks -> Elements is how the regulation is written, how examiners test, and how pilots think when prepping. The graph has no notion of it.
- **Instructor and rating composition.** CFII isn't "after CFI"; it's CFI + IR add-on with its own PTS. MEI requires CFI + multi-engine class rating. The current `CERT_PREREQUISITES` collapses this DAG to a line.
- **Personal study plans that aren't certs.** "I want to be ready to instruct again" isn't PPL or CFI alone; it's a curated union.
- **Lens-based browsing.** ACS view, handbook view, phase-of-flight view, weakness view -- all peer to "domain view," all over the same content.

## Architecture

```text
┌────────────────────────────────────────────────────────────────┐
│  Goal (learner-owned)                                          │
│  multi-syllabus, optionally cert-agnostic, weights + sequence  │
├────────────────────────────────────────────────────────────────┤
│  Cert / Rating / Endorsement (regulatory artifact, DAG)        │
│  carries one or more Syllabi (ACS/PTS/61.31/...)               │
├────────────────────────────────────────────────────────────────┤
│  Syllabus (authored projection)                                │
│  Area -> Task -> Element; leaves point at graph nodes with     │
│  required depth, required bloom, references                    │
├────────────────────────────────────────────────────────────────┤
│  Knowledge Graph (ADR 011)                                     │
│  nodes + typed edges + 7-phase content + assessment methods    │
├────────────────────────────────────────────────────────────────┤
│  References                                                    │
│  CFR / AC / Handbook / AIM / ACS / NTSB; edition-versioned     │
└────────────────────────────────────────────────────────────────┘
```

Mastery flows upward from the node. Lenses are projections downward.

## The objects

### Reference

Already partially exists; this ADR formalizes it as a peer object, not metadata on a node.

```text
Reference
  id           ref_<ULID>
  kind         cfr | ac | handbook | acs | pts | aim | ntsb | poh | other
  document     short canonical id (e.g. "phak", "afh", "avwx", "14cfr61")
  edition      FAA-H-8083-25C | 2024-09 | rev-date
  title        "Pilot's Handbook of Aeronautical Knowledge"
  publisher    FAA | manufacturer | other
  url          official link
  superseded_by id?  (for edition tracking)
```

A **citation** is a (Reference, locator) pair:

```text
Citation
  reference_id ref_...
  locator      "Ch 12 §3 p. 12-7" | "Area V Task B" | "§61.57(c)" | "AIM 5-1-7"
  framing      survey | operational | procedural | regulatory | examiner
  note         optional learner-facing context
```

Nodes, syllabus leaves, cards, and scenarios all carry citation arrays. The same Reference is cited many times; the citation row stores the locator.

### Syllabus

```text
Syllabus
  id              syl_<ULID>
  slug            "ppl-acs-2024" | "ir-acs-2024" | "cfi-pts-2024" | "complex-endorsement"
  kind            acs | pts | endorsement | school | personal
  title           "Private Pilot Airplane ACS"
  edition         FAA-S-ACS-6B | 2024-09 | revision-date
  cert_id         cert_... (the cert this syllabus belongs to; null for endorsement-only)
  source_url      official FAA URL if applicable
  status          draft | active | archived

SyllabusNode (the tree -- internal nodes and leaves)
  id              sln_<ULID>
  syllabus_id     syl_...
  parent_id       sln_... | null (root)
  ordinal         integer for stable ordering
  level           area | task | element | section (kind-dependent)
  code            "I" | "I.A" | "I.A.K1" | free-form for non-ACS
  title           "Preflight Preparation" | "Pilot Qualifications" | ...
  description     optional prose
  required_depth  knowledge | risk_management | skill   (ACS triad)
  required_bloom  bloom level expected at this leaf
  citations       [Citation]   // references this leaf calls out
  is_leaf         boolean

SyllabusNodeLink (leaf -> graph node)
  syllabus_node_id  sln_...
  knowledge_node_id node_...
  weight            optional; for partial coverage
```

A leaf can map to multiple knowledge nodes (one task often spans several concepts). A knowledge node can be mapped from many syllabi at different depths. The relationship is many-to-many, recorded once on the syllabus side.

### Cert / Rating / Endorsement

```text
Credential   (umbrella table; certs, ratings, endorsements are kinds)
  id              cred_<ULID>
  kind            pilot_cert | instructor_cert | rating | endorsement
  slug            "private" | "commercial" | "atp" | "instrument" | "multi-engine"
                  "cfi" | "cfii" | "mei" | "complex" | "high-performance" | "tailwheel"
  title           "Private Pilot Certificate"
  category        airplane | rotorcraft | glider | balloon | powered-lift | none
  class           single-engine-land | multi-engine-land | ...   (where applicable)

CredentialPrereq
  credential_id   cred_...
  prereq_id       cred_...
  kind            required | recommended

CredentialSyllabus
  credential_id   cred_...
  syllabus_id     syl_...
  primacy         primary | alternate     // ACS is primary; school syllabus alternate
```

Prereqs form a DAG (CFII -> {CFI, IR}; MEI -> {CFI, multi-engine}). The current `CERT_PREREQUISITES` line gets retired; that constant becomes a derived view of this DAG (or is removed entirely).

### Goal

```text
Goal
  id              goal_<ULID>
  user_id         u_...
  title           "Return to instructing + finish IR + add CPL/Multi/CFII/MEI"
  status          active | paused | archived
  created_at      ts

GoalSyllabus      (which syllabi this goal includes, with weight + order)
  goal_id         goal_...
  syllabus_id     syl_...
  weight          0..1 (relative emphasis)
  sequence_hint   integer | null
  focus_filter    optional area/task subset

GoalNode          (ad-hoc graph nodes added directly, not via a syllabus)
  goal_id         goal_...
  knowledge_node_id node_...
  reason          "weak area" | "personal interest" | ...
```

The session engine targets a Goal. The goal resolves to a union of (knowledge nodes, required depths, references). Today's `study_plan.cert_goals` becomes a goal whose `GoalSyllabus` rows are the canonical syllabi for those certs.

### The relevance-array cache

Knowledge nodes keep a `relevance` array column for fast reads, but it is **derived from syllabi**, not authored. Build pipeline:

1. Author a syllabus (or transcribe an ACS).
2. Build script walks every syllabus, every leaf with a `SyllabusNodeLink`, and accumulates `(cert, bloom, priority)` triples per linked node.
3. Triples are deduplicated and written to `node.relevance` as a cache.
4. If a node's authored relevance disagrees with the cache during migration, the cache wins on rebuild; the node's authored field is dropped.

This decouples assertion (lives in the syllabus) from storage (cached on the node for query speed).

## Lenses

A lens is a function `(Goal, optional filters) -> ordered tree-or-list of nodes with rollup metrics`.

Initial lenses:

| Lens | Tree shape | Source |
| ----------------- | ----------------------------- | ------------------------------ |
| ACS | Area -> Task -> Element -> nodes | Syllabus tree |
| PTS | Area -> Task -> Element -> nodes | Syllabus tree |
| Endorsement | Element -> nodes | Endorsement syllabus |
| Domain | Domain -> nodes | Graph metadata |
| Phase of flight | Phase -> nodes | Graph metadata |
| Handbook | Handbook -> Chapter -> nodes | Reference + Citation |
| Weakness | Severity bucket -> nodes | Mastery snapshot |
| Bloom | Level -> nodes | Required-bloom across syllabi |
| Custom | User-defined | Goal + ad-hoc collections |

All share the same UI primitives: tree, rollup, drill-in, jump-to-learn. Mastery rolls up at every internal node of every lens.

## Authoring

Two authoring surfaces:

1. **YAML-in-repo for system content.** Knowledge nodes (existing), references, syllabi. Reviewable, diffable, versioned by git. Rebuilds the DB cache on `bun run build`.
2. **In-app for personal content.** Goals, ad-hoc collections, personal cards/scenarios. Lives in the database, owned by the user.

The FAA publishes ACS PDFs that are scrapable but not stable. Initial syllabi (PPL ACS, IR ACS, CPL ACS, CFI PTS) are transcribed once from the published edition into YAML, with the FAA URL and edition recorded on the syllabus. When the FAA publishes a new edition, a new syllabus row is added (not edited in place); existing goals can opt to migrate.

## Mastery rollup

Per-node mastery already exists (dual-gate: card stability AND rep accuracy). Rollup math:

- **Internal node of any lens** = aggregate of its children. Default aggregator: weighted average where weights are leaf priority. Critical leaves count more.
- **Coverage** = (mastered leaves / total leaves). Reported alongside mastery so a 90%-of-30%-covered cert reads differently from 90%-of-100%.
- **Required evidence** = the assessment methods declared on each linked node. A leaf is mastered when *all required evidence kinds* clear their thresholds. CFI leaves typically require teaching-exercise evidence; PPL leaves typically don't.
- **Goal progress** = weighted union across the goal's syllabi + ad-hoc nodes.

## Handbook ingestion and reader

The cert/syllabus/goal model is incomplete without a handbook reader. Handbooks are the spine of legitimacy referenced by the philosophy: every claim a node or syllabus leaf makes resolves to FAA wording one click away. Citing PDFs that learners cannot read in-app would be a half-feature.

Scope and legal posture:

- **Public domain only.** FAA-published handbooks (PHAK FAA-H-8083-25, AFH FAA-H-8083-3, AvWX FAA-H-8083-28, IFH FAA-H-8083-15, IPH FAA-H-8083-16, Helicopter Flying Handbook, Glider Flying Handbook, Balloon Flying Handbook, AC 00-6 Aviation Weather, AC 00-45 Aviation Weather Services, AIM, Pilot/Controller Glossary), the CFRs via eCFR, and FAA Advisory Circulars. Per 17 USC § 105 these are U.S. Government works and not subject to copyright. We ingest, parse, render, and link freely.
- **Out of scope.** Any commercial publisher (Jeppesen, ASA, Sporty's, King Schools, Gleim). Out by license, not by interest.

The ingestion pipeline:

```text
1. Fetch     official FAA PDF + checksum, store under handbooks/<doc>/<edition>/source.pdf
2. Outline   extract embedded PDF outline -> chapter / section / sub-section tree
3. Text      per-section text via PyMuPDF (fitz); preserves layout reliably
4. Figures   per-page image extraction; figure caption pattern ("Figure 12-7.")
              binds caption to image; cropped and stored alongside section markdown
5. Tables    detection + conversion to HTML tables; tables that span pages are merged
6. Normalize per-section markdown with frontmatter:
                handbook, edition, chapter_number, section_number,
                section_title, faa_pages (range), source_url
7. Build     rebuild Reference rows; one Reference per (document, edition);
              one citable locator per section
8. Render    same Markdown pipeline as knowledge nodes (Shiki, KaTeX, references resolver)
```

Re-running the pipeline on a new edition produces a new tree under `handbooks/phak/2024-09/` etc. Old edition stays. Citations bind to `(document, edition, locator)` and survive the change.

URL shape (lives inside `apps/study/` for now; extracted later if it grows):

```text
/handbooks                              all handbooks index
/handbooks/phak                         chapter index for one handbook
/handbooks/phak/12                      chapter overview + section list
/handbooks/phak/12/3                    readable section (the page learners use)
/handbooks/phak/12/3?edition=2024-09    explicit edition; default = latest
```

Section pages render the markdown with figures inline, a sticky table of contents, citations bidirectionally linked to nodes, and a read-progress control at the foot of the section.

Read-progress model:

- **State** is per-(user, handbook section, edition): `unread | reading | read`. The user controls transitions; the system suggests but never auto-marks.
- **Suggestion heuristic** ("Mark read?") fires after the section has been on screen for a plausible duration AND scrolled to the bottom AND total time-on-section exceeds a low threshold. Surfaces a non-blocking prompt at the bottom. Never auto-flips state.
- **Comprehension flag** is a separate dimension. A learner can mark a section "read but didn't get it" -- counts as read for coverage but keeps the section in a "to revisit" surface.
- **Per-section notes** in the user's own markdown. Optional.
- **Re-read** is a first-class action. Resets state on the section. Notes survive.
- **Chapter-level rollup** = (sections marked read / total sections in chapter). Surfaced on chapter overviews.

Citations from knowledge nodes upgrade from freeform strings to structured locators: `{reference_id: ref_phak_2024_09, locator: {chapter: 12, section: 3, page: "12-7"}}`. The locator resolves to a real handbook URL. Bidirectional navigation: from a node, jump to the cited section; from a section, see the knowledge nodes that cite it with mastery indicators.

Initial ingestion target (Pareto win for PPL/IR/CPL): PHAK + AFH + AvWX. IFH + IPH come with the IR push. AIM is ongoing because it's revised continuously; we ingest it on a schedule.

A separate work package -- `handbook-ingestion-and-reader` -- carries the engineering. This ADR records the model; the WP carries the implementation plan, schema, and UI.

## Migration plan

Phased; each phase is independently shippable.

| Phase | Scope | Status |
| ----- | ----------------------------------------------------------------------------- | ------ |
| 0 | Handbook ingestion pipeline + reader UI + read-progress (PHAK first); Reference table seeded from ingested handbooks | Shipped (in flight; PR pending) -- PHAK + AFH + AvWX ingested at section-granularity; reader live; storage + edition policies in [ADR 018](../018-source-artifact-storage-policy/decision.md) + [ADR 020](../020-handbook-edition-and-amendment-policy.md) |
| 1 | Citation table; existing node references migrated to structured citations | TBD |
| 2 | Credential DAG; current `CERTS` + `CERT_PREREQUISITES` retired into derived views | TBD |
| 3 | Syllabus + SyllabusNode + SyllabusNodeLink tables; YAML authoring pipeline | TBD |
| 4 | PPL ACS transcribed (K/R/S as separate leaves); existing 30 nodes wired in via SyllabusNodeLink; AFH + AvWX ingested | TBD |
| 5 | Relevance cache rebuild; authored relevance arrays dropped from YAML | TBD |
| 6 | Goal table; existing study plans converted (cert_goals -> GoalSyllabus rows) | TBD |
| 7 | Cert dashboard surface (ACS lens) | TBD |
| 8 | Lens framework + handbook lens + weakness lens | TBD |
| 9 | Personal goal composer | TBD |
| 10 | Remaining syllabi: IR ACS, CPL ACS, CFI PTS, CFII PTS, MEI, endorsements; IFH + IPH ingested | Ongoing |

Phase 0 lands first because Phase 1 needs the handbook structure to point at and the reader has standalone learner value (the user can read PHAK in-app immediately, even before any cert dashboard exists). Phase 10 is bounded transcription + ingestion work, not a research project. PPL ACS is ~200 task leaves which expand to ~600 K/R/S element leaves; the full set across the certs and ratings user zero is pursuing is on the order of 4000 element leaves.

## Constants and naming

`libs/constants/src/study.ts` retains `CERTS` and `CERT_PREREQUISITES` only as derived helpers. New constants:

- `CREDENTIAL_KINDS` -- pilot_cert, instructor_cert, rating, endorsement
- `SYLLABUS_KINDS` -- acs, pts, endorsement, school, personal
- `SYLLABUS_NODE_LEVELS` -- area, task, element, section
- `REQUIRED_DEPTHS` -- knowledge, risk_management, skill (ACS triad)
- `REFERENCE_KINDS` -- cfr, ac, handbook, acs, pts, aim, ntsb, poh, other
- `CITATION_FRAMINGS` -- survey, operational, procedural, regulatory, examiner
- `LENS_KINDS` -- acs, pts, endorsement, domain, phase, handbook, weakness, bloom, custom

`libs/constants/src/reference-tags.ts` already enumerates `CERT_APPLICABILITIES` (student, sport, recreational, private, instrument, commercial, cfi, cfii, atp, all). The Credential table replaces the cert-applicability tag for source-of-truth purposes; the tag remains as an authoring shortcut.

## Resolved (2026-04-26)

The four questions originally listed as open are decided. Recorded here so the rationale doesn't get lost.

1. **Credentials compose; ratings and endorsements are separate credentials.** A Private Pilot Certificate is one credential. Single-engine-land is a separate credential of `kind=rating`. Multi-engine-land another. Complex, high-performance, tailwheel, high-altitude, spin -- each a credential of `kind=endorsement`. Composition flows through `CredentialPrereq`. This matches how 14 CFR 61.5, 61.31, and the ACS structure treat them.
2. **ACS triad becomes three separate leaves.** Each `K`, `R`, `S` element from the ACS is its own leaf in the syllabus tree, parented to its task. Each carries its own text, references, evidence requirements, and mastery state. A learner can be solid on K elements (book) and weak on S elements (flying); the system reports the difference. `required_depth` on a leaf becomes informational rather than structural; `level=element` plus a `triad ∈ {K, R, S}` field captures the triad.
3. **Scenarios and cards stay node-mapped.** Cards and scenarios already carry `node_id`. Syllabus leaves carry `SyllabusNodeLink -> node`. "Cards on Area V Task B" is a transitive lookup through the linked nodes. No direct leaf-to-card mapping. The graph remains the only place that knows what a concept is. Filtering to evidence kind uses the existing `assessment_methods` array on cards/scenarios; an `S`-triad leaf surfaces scenarios and demonstrations, a `K`-triad leaf surfaces cards.
4. **New syllabus row per FAA edition; goals pin to an edition; migration is opt-in.** A new ACS publication is a new syllabus, not an edit. Goals reference a specific syllabus version. A diff surface shows what changed (added, removed, renamed leaves) so a learner mid-prep can decide whether to migrate or finish on the old edition. Same versioning model as Reference editions.

## Non-goals

- A general-purpose LMS (no enrollment, no instructor-grading workflow, no class management).
- A regulation interpreter (we cite CFRs and surface them; we don't substitute for legal advice or POH-specific guidance).
- An ACS transcription tool (we transcribe by hand once per edition; tooling can come later if it earns its keep).
- Commercial handbook ingestion (Jeppesen, ASA, Sporty's, King are out -- copyright. Only FAA-published works.).

## Consequences

**Positive:**

- The model matches the world. Pilots, examiners, and the FAA all think in this shape.
- Lenses become trivial. Once the graph + syllabi + references exist, "browse by handbook" is a query, not a feature.
- Multi-cert progress is a first-class view, not an inferred report.
- Personal goals are cleanly separable from regulatory structure.
- Authoring is structured and reviewable.

**Costs:**

- Transcription work for ACS/PTS material. PPL alone is ~200 leaves.
- Migration of the existing relevance arrays. Bounded; one-time.
- More objects to author and maintain. Mitigated by YAML-in-repo for system content and a goal composer for personal content.
- Mastery rollup math gets more complex (multiple lenses, weighted aggregation, evidence-kind gating). Worth it.

**Reversible if wrong:** Every layer is additive. If syllabi turn out to be the wrong shape, we keep the graph + references and rebuild the layer above. Nothing in this ADR damages prior work.

## Companion

The durable principles behind this model live in [docs/platform/LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md). When this ADR ships, that doc moves from "proposed" to load-bearing; product reviews use it as the touchstone for "are we building what we said we'd build."
