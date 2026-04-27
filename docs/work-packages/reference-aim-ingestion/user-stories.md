---
title: 'User stories: Reference AIM ingestion'
product: cross-cutting
feature: reference-aim-ingestion
type: user-stories
status: unread
review_status: pending
---

# User stories: Reference AIM ingestion

## Lesson author -- IFR clearance procedure

**As a lesson author writing an instrument-rating lesson on clearance readback, I want to cite the AIM paragraph that defines pilot responsibility upon clearance, so the validator confirms the reference resolves and the renderer substitutes the right citation.**

```markdown
The pilot is responsible for reading back the clearance verbatim
([@cite](airboss-ref:aim/5-1-7?at=2026-09)).
```

After Phase 7 ships, `bun run check` exits 0 for that line. The renderer (Phase 4) substitutes "AIM 5-1-7" at web render time, the formal citation in print mode, and the entry title in tooltip mode.

## Lesson author -- chapter-wide reference

**As a lesson author building a curriculum on ATC procedures, I want to reference an entire chapter of the AIM without picking a section, so I can hand the reader a "go read the whole thing" link.**

```markdown
ATC procedures are described in detail
([@title](airboss-ref:aim/5?at=2026-09)).
```

The chapter-level locator (`5`) resolves to the chapter's manifest entry; the renderer substitutes the chapter's `canonical_title`.

## Lesson author -- glossary entry

**As a lesson author defining a term used elsewhere in the lesson, I want to cite the AIM Pilot/Controller Glossary entry, so the term's authoritative definition is one click away.**

```markdown
The "pilot in command" is defined in the AIM Glossary
([@cite](airboss-ref:aim/glossary/pilot-in-command?at=2026-09)).
```

The glossary locator (`glossary/pilot-in-command`) resolves to the entry's manifest record. The renderer substitutes "AIM Glossary - Pilot In Command" or the entry title depending on the bound token.

## Lesson author -- appendix

**As a lesson author teaching radiotelephony procedures, I want to reference an AIM appendix that lists the FAA phraseology table.**

```markdown
Standard phraseology is summarized in
([@cite](airboss-ref:aim/appendix-1?at=2026-09)).
```

The appendix locator (`appendix-1`) resolves to the appendix's manifest entry; the renderer substitutes "AIM Appendix 1" or the appendix title.

## Operator -- run the corpus ingest

**As an operator who has already extracted a new AIM edition into derivatives, I want a separate command to register the extracted manifest into the @ab/sources corpus, so the registration step is an explicit, idempotent action separate from extraction.**

```bash
# Step 1 (future, follow-up): fetch + extract
bun run aim-ingest --edition=2026-09

# Step 2 (Phase 7, this WP): register into the corpus
bun run ingest aim --edition=2026-09
```

After step 2, the registry has chapter / section / paragraph / glossary / appendix entries for AIM 2026-09. Re-running step 2 is a no-op.

## Maintainer -- handle a new AIM edition

**As a maintainer when the FAA publishes a new AIM revision (e.g. 2027-04), I want to run the operator's source pipeline (out of scope for this WP) followed by `aim-corpus-ingest --edition=2027-04` and have both editions co-exist in the registry.**

ADR 019 §1.3 specifies AIM uses `YYYY-MM` pinning. From the locator's perspective `2027-04` is a new edition slug parallel to `2026-09`. Lessons pinned to `2026-09` continue to resolve; new lessons can target `2027-04`. Phase 5's diff job compares editions and surfaces paragraphs whose content changed silently between revisions.
