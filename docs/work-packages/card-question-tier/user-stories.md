---
id: card-question-tier
title: 'User Stories: Card Question-Tier + Provenance'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks: []
tags:
  - cards
  - schema
  - user-stories
legacy_fields:
  feature: card-question-tier
  type: user-stories
---

# User Stories: Card Question-Tier + Provenance

User-perspective narratives covering the three roles this schema serves: card authors (writing yaml-cards in node.md), learners (filtering and reading cards), and CFIs (curating what's essential vs what's a written-test artifact). The schema is what ships in Phase 1; the surfaces that use it ship in Phase 3 follow-on WPs. The stories below cover both layers so the schema decisions are anchored to the user-facing reasons.

## As a card author writing yaml-cards in a node.md file

- I want optional `question_tier:`, `source_authority:`, and `acs_codes:` fields on each yaml-cards entry so I can mark provenance as I write the card, not as a follow-up backfill task.
- I want the seeder to fail loud at parse time (with a per-card path) when I misspell `question_tier` or use a `source_authority.kind` that isn't in the registry. A typo should not silently land as a NULL or a free-form string.
- I want `source_authority` to accept multiple entries per card so a card answering "VFR cloud clearance in Class B" can cite both 14 CFR 91.155 and AIM 4-3-1 without picking one as the canonical source.
- I want `acs_codes` to accept multiple codes so a card covering "decode a METAR" can map to PA.I.C.K2a (private) AND IR.II.A.K2 (instrument) without authoring two separate cards.
- I want the existing `tags[]` field to keep working as the free-form augmentation channel so my cards keep their topical labels, my workflow tags, and my cross-cutting attributes -- the new typed fields only displace what they make redundant.

## As a learner studying for the FAA written test

- I want to filter the review queue to "FAA-written tier only" on the days I'm drilling for the test so I don't waste reps on CFI-essential cards that aren't on the exam.
- I want each card to clearly indicate "this exists because the FAA tests it" so I trust that drilling it is a good use of my time before the test.
- I want to see the FAA-written framing of a fact paired with the CFI-essential framing of the same fact when both exist, so I learn the test answer AND the operational truth in one session, with the difference visible.
- I want the source-authority badge on a card ("CFR" / "AIM" / "PHAK") to deep-link into the flightbag reference so I can confirm the answer at the source when I'm not sure -- the badge is not just decoration, it's the trust signal AND the on-ramp to the source document.

## As a learner studying with my CFI

- I want my CFI to flag "these cards are what I think matters; ignore the FAA-written-only ones for now" so my drill sessions match what we're working on in the airplane.
- I want the cards my CFI flagged to surface together when I open the review queue, separately from the bulk of my deck, so the CFI's curation doesn't get lost in the volume.
- I want to see, on each card my CFI flagged, the structured citation for where the answer comes from so I can check the source if my CFI's framing differs from what the textbook says.

## As a CFI curating a student's deck

- I want to filter my student's deck by `question_tier` so I can quickly see which cards are real CFI essentials (`cfi-essential` or `both`) vs which are FAA-written-only artifacts.
- I want to add a "this card is what really matters operationally" tier flag without authoring a new card -- the existing card text is fine, I just want to mark it as essential to my student's growth.
- I want ACS coverage visibility per student: "for PA.I.C.K2a (acceptable weather products), here are the cards my student has. Are any tasks uncovered?"

## As a course author authoring a new node.md

- I want a frontmatter or per-card pattern that makes the new fields easy to add without re-reading the spec each time. The yaml-cards entries should look obvious to copy from a recent example.
- I want the pilot cards in the weather nodes to be the canonical examples I copy from -- they should demonstrate every field shape (single source, multi-source, multi-ACS-code, with tier, without tier).

## As a future agent doing the backfill (Phase 2)

- I want a single backfill script (`scripts/db/backfill-card-provenance.ts`) that walks every node.md, infers `acs_codes` and `source_authority` from existing tag patterns, and reports a per-card diff before I apply the change.
- I want the script to refuse to set `question_tier` automatically -- the FAA-vs-CFI distinction has to be hand-classified, and a wrong inference would be worse than a NULL.
- I want the script to be re-runnable (idempotent) so I can apply it node-by-node, review the diff per node, and not lose progress if I re-run.
