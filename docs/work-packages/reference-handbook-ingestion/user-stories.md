---
title: 'User stories: Reference handbook ingestion'
product: cross-cutting
feature: reference-handbook-ingestion
type: user-stories
status: unread
review_status: pending
---

# User stories: Reference handbook ingestion

## Lesson author

**As a lesson author writing a private-pilot weather lesson, I want to cite the PHAK chapter on Coriolis force using the canonical scheme, so the validator confirms the reference resolves and the renderer substitutes the right citation.**

```markdown
The Coriolis force deflects moving air to the right in the Northern Hemisphere
([@cite](airboss-ref:handbooks/phak/8083-25C/12/3)).
```

After Phase 6 ships, `bun run check` exits 0 for that line. The renderer (Phase 4) substitutes "PHAK Ch.12.3" at web render time, the formal citation in print mode, and the section title in tooltip mode.

## Lesson author -- chapter-wide reference

**As a lesson author building a curriculum on aerodynamics, I want to reference an entire chapter of the AFH without picking a section, so I can hand the reader a "go read the whole thing" link.**

```markdown
Slow-flight technique is covered in the AFH ([@title](airboss-ref:handbooks/afh/8083-3C/4)).
```

The chapter-level locator (`8083-3C/4`) resolves to the chapter's manifest entry; the renderer substitutes "Maintaining Aircraft Control: Upset Prevention and Recovery Training" or whatever the chapter's `canonical_title` is.

## Lesson author -- subsection

**As a lesson author drilling into a specific subsection of the PHAK, I want to cite the subsection level without pulling in the whole section.**

```markdown
Federal certification of pilots and mechanics began in 1926
([@cite](airboss-ref:handbooks/phak/8083-25C/1/2/2)).
```

The subsection locator (`1/2/2`) resolves to manifest code `1.2.2`. The renderer substitutes `PHAK Ch.1.2.2`.

## Operator -- run the corpus ingest

**As an operator who has already run PR #242's `handbook-ingest` to fetch + extract a new handbook edition, I want a separate command to register the extracted manifest into the @ab/sources corpus, so the registration step is an explicit, idempotent action separate from extraction.**

```bash
# Step 1 (PR #242, unchanged): fetch + extract
bun run sources extract handbooks --doc=phak

# Step 2 (Phase 6, new): register into the corpus
bun run sources register handbooks --doc=phak --edition=8083-25C
```

After step 2, the registry has chapter / section / subsection entries for PHAK 8083-25C. Re-running step 2 is a no-op.

## Maintainer -- add a new handbook

**As a maintainer adding the Instrument Flying Handbook (IFH) to the corpus, I want to update one constant (`DOC_EDITIONS`) plus run the two CLIs, with no other Phase 6 code changes.**

```typescript
// libs/sources/src/handbooks/resolver.ts
const DOC_EDITIONS: Record<string, string> = {
  phak: 'FAA-H-8083-25C',
  afh: 'FAA-H-8083-3C',
  avwx: 'FAA-H-8083-28B',
  ifh: 'FAA-H-8083-15B', // <-- new
};
```

Plus add `'ifh'` to the locator parser's accepted-doc list. Then run the two CLIs. The new corpus is live.

## Maintainer -- handle a new handbook edition (e.g. 8083-25D)

**As a maintainer when the FAA publishes 8083-25D, I want to add the new edition slug as a new doc entry (or extend `DOC_EDITIONS` to map `phak` -> [25C, 25D]), run the ingest, and have both editions co-exist in the registry.**

ADR 019 §1.2 specifies handbook editions are baked into the doc slug; from the locator's perspective `8083-25D` is a new slug entirely. The ingest CLI takes `--edition=` so the operator can register multiple editions of the same doc independently. Lessons pinned to `8083-25C` continue to resolve; new lessons can target `8083-25D`. Phase 5's annual diff job does not apply (handbooks don't have calendar editions); the supersession is recorded explicitly via a follow-up phase if/when the user wants to deprecate the old edition.
