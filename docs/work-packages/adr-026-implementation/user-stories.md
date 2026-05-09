---
title: 'User stories: ADR 026 implementation -- registry-canonical edition coherence'
product: platform
feature: adr-026-implementation
type: user-stories
status: unread
review_status: done
---

# User stories: ADR 026 implementation

This is mostly an internal refactor; user-visible surface is thin. Two stories matter.

## US-1: Learner sees correct "newer edition available" affordance after a handbook promotion

**Persona:** a learner studying from an older AFH edition (8083-3B) when the FAA publishes 3C.

**Today's behavior (broken):** the FAA publishes AFH 3C. The hangar admin promotes the new edition through `sources_registry.editions` (writes the new row, retires the old). The learner opens `/library/handbook/afh/3` and the page either:

- Shows no affordance (the registry knows but `study.reference.supersededById` doesn't), OR
- Shows the affordance with the wrong edition title (the chain walks the column, not the registry).

The promotion landed in one table but the reader reads a different one.

**Post-WP behavior (correct):** the same promotion writes the registry row and retires the prior. The learner opens the page; the "newer edition available" affordance reads `getCurrentEdition('airboss-ref:handbooks/afh')` from the registry, gets the 3C row, surfaces "Newer edition available: AFH 8083-3C" with a link. The affordance updates as soon as the registry sees the new edition -- no separate seed step, no sync window, no two-stores-of-truth race.

**Acceptance:** [test-plan.md §"Manual walkthrough"](./test-plan.md#manual-walkthrough) walks 1, 2, 3 verify this behavior across the top library page, chapter page, and section page.

## US-2: Author cites a regulation that's been re-paragraphed across CFR years

**Persona:** a content author who pinned a knowledge-node citation to `airboss-ref:regs/cfr-14/91/103/b/2?at=2024` last year and is now re-reading the lesson against the 2026 CFR.

**Today's behavior (working but fragile):** the citation resolves via a `study.reference.supersededById` walk against an older 14 CFR row. The chain is wired by the seed; the registry doesn't participate. If anything in the registry-versus-`study.reference` sync ever drifts, the citation lands on the wrong year's text.

**Post-WP behavior (consolidated):** the same citation resolves via `getCurrentEdition('airboss-ref:regs/cfr-14')` to find the current 2026 edition, and via `getEditionByLabel('airboss-ref:regs/cfr-14', '2024')` to confirm the pinned 2024 edition exists. Both reads hit the registry directly. The amendment 2026-05 drift sentinels (when they ship on the amendment branch) consult the registry through the same resolver, not through the dropped column. One walker; one source of truth.

**Acceptance:** [test-plan.md §"regulations.test.ts -- 'CFR Part picks the latest edition's representative row'"](./test-plan.md#regulationstestts----cfr-part-picks-the-latest-editions-representative-row) verifies this for the regulations detail surface.

## What's NOT a story here

- Hangar admin authoring or promoting an edition. The hangar UI is unchanged by this WP -- the promotion flow already writes the registry today; this WP just makes every reader trust that as the source of truth.
- Personal-syllabus authoring. ADR 026 §4 keeps `study.syllabus.edition` free-form for personal/school syllabi; the user authoring a personal syllabus sees no behavior change.
- Knowledge-node citation authoring. The amendment 2026-05 ships the optional-edition relaxation + drift sentinels on its own branch; this WP's resolver API is what those sentinels will call after both ship, but no authoring surface changes here.
