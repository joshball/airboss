---
title: 'Test Plan: Stage-5 citation deep-linking'
product: study
feature: stage5-citation-deeplink
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Stage-5 citation deep-linking

Prefix: `S5CD`.

## Setup

- Dev DB reset + reseeded so every corpus has rows (`bun run db reset && bun run db push && bun run db seed`).
- Logged in as Abby (the stable dev-seed user, `abby@airboss.test`).
- At least one card, one rep, and one knowledge node owned by Abby (covered by default seed).
- AIM resolver verified non-default (per pre-flight task in [tasks.md](tasks.md)).

---

## S5CD-1: airboss_ref backfill on every reference_section row

1. Run `bun -e "import {db} from '@ab/db/connection'; import {referenceSection} from '@ab/bc-study/schema'; import {sql} from 'drizzle-orm'; const r = await db.select({c: sql\`count(*)\`}).from(referenceSection).where(sql\`airboss_ref IS NULL OR airboss_ref = ''\`); console.log(r);"`.
2. **Expected:** `c = 0`. Every row has a non-empty `airboss_ref`.

## S5CD-2: airboss_ref shape passes the parser

1. Run `bun -e "import {db} from '@ab/db/connection'; import {referenceSection} from '@ab/bc-study/schema'; import {parseIdentifier, isParseError} from '@ab/sources'; const rows = await db.select({u: referenceSection.airbossRef}).from(referenceSection); const bad = rows.filter(r => isParseError(parseIdentifier(r.u))); console.log('bad:', bad.length);"`.
2. **Expected:** `bad: 0`. Every URI parses.

## S5CD-3: CHECK constraint rejects malformed URIs

1. Try inserting a row with `airboss_ref = 'not-a-uri'` directly (raw SQL via psql).
2. **Expected:** Postgres rejects with the CHECK constraint name `reference_section_airboss_ref_shape_check`.

## S5CD-4: Citation picker -- Section tab returns CFR rows

1. Open a card detail page (`/memory/<card-id>`).
2. Click "Add citation" -> picker opens.
3. Click the Section tab.
4. Type `91.103`.
5. **Expected:** At least one row appears with label "14 CFR §91.103 -- Preflight action" and a `[CFR]` corpus badge.

## S5CD-5: Citation picker -- Section tab returns handbook rows

1. In the picker's Section tab, type `wing loading`.
2. **Expected:** At least one row appears for PHAK Ch 12 §12.3 with a `[Handbook]` (or `[PHAK]`) corpus badge.

## S5CD-6: Citation picker -- Section tab returns AIM rows

1. In the picker's Section tab, type `5-2-1`.
2. **Expected:** Row "AIM 5-2-1 -- General" with `[AIM]` corpus badge.

## S5CD-7: Citation picker -- Section tab returns AC rows

1. In the picker's Section tab, type `61-65`.
2. **Expected:** Rows for AC 61-65J appear with `[AC]` corpus badge.

## S5CD-8: Citation picker -- Section tab returns ACS rows

1. In the picker's Section tab, type `private pilot`.
2. **Expected:** Rows for ACS publications + tasks appear with `[ACS]` corpus badge.

## S5CD-9: Citation picker -- only 3 tabs render (Section / Knowledge / External)

1. Open the picker on a card detail page.
2. **Expected:** Three tab buttons -- "Section", "Knowledge node", "External link". No "Regulation" or "AC" tabs.

## S5CD-10: Create a CFR-section citation, persists

1. From the Section tab pick "14 CFR §91.103 -- Preflight action".
2. Click Save.
3. **Expected:** Modal closes; a new chip "14 CFR §91.103" appears below the card body.
4. Reload the page.
5. **Expected:** The chip is still there.

## S5CD-11: Create a handbook citation, persists

1. From Section tab pick a PHAK section.
2. Save.
3. **Expected:** Chip appears + persists across reload.

## S5CD-12: Create an AIM citation, persists

1. From Section tab pick `AIM 5-2-1`.
2. Save.
3. **Expected:** Chip appears + persists.

## S5CD-13: Click a CFR chip -> navigates to flightbag CFR section

1. Click the chip "14 CFR §91.103" on the card detail page.
2. **Expected:** Browser navigates to `/cfr/14/91/103` on the flightbag origin (in dev, the same origin) and the flightbag reader renders the §91.103 section.

## S5CD-14: Click a handbook chip -> navigates to flightbag handbook section

1. Click the chip for the PHAK section.
2. **Expected:** Navigates to `/handbook/phak/<edition>/12/3` and the section content renders.

## S5CD-15: Click an AIM chip -> navigates to flightbag AIM paragraph

1. Click the chip for AIM 5-2-1.
2. **Expected:** Navigates to `/aim/5/2/1` and renders the paragraph content.

## S5CD-16: Click an AC chip -> navigates to flightbag AC chapter

1. Click an AC chip.
2. **Expected:** Navigates to `/ac/61-65/j/section-3` (or matching) and renders.

## S5CD-17: Click an ACS chip -> navigates to flightbag ACS task

1. Click an ACS chip.
2. **Expected:** Navigates to `/acs/<slug>/area/<area>/task/<task>` and renders.

## S5CD-18: External chip opens in new tab

1. Add an external citation (URL + title).
2. Click the chip.
3. **Expected:** Opens in a new tab/window. Original study tab remains.

## S5CD-19: Knowledge-node chip navigates in same tab

1. Add a knowledge-node citation.
2. Click the chip.
3. **Expected:** Same-tab navigation to `/knowledge/<id>`. The study tab is replaced; back button returns to the card.

## S5CD-20: CitationChips on card public page renders deep links

1. Sign out. Navigate to `/cards/<card-id>` (public page) of a card with internal + external citations.
2. **Expected:** All chips render as clickable anchors. Internal chips navigate same-tab to flightbag/knowledge URLs; external chips open in a new tab.

## S5CD-21: Editable mode (memory + reps pages) shows clickable chips with remove

1. On `/memory/<card-id>`, view a card with a citation.
2. **Expected:** Chip is clickable AND has a remove (×) affordance.

## S5CD-22: Remove citation works

1. Click the × on a citation chip.
2. Confirm the dialog.
3. **Expected:** Chip removes from the list. Reload -- still gone.

## S5CD-23: Picker Section tab -- empty query returns first N rows

1. Open the Section tab. Don't type anything.
2. **Expected:** A list of rows appears (the BC's empty-query path returns first N), capped at MAX_SEARCH_LIMIT.

## S5CD-24: Picker Section tab -- query with no matches

1. Type something nonsensical like `qzqzqzqz`.
2. **Expected:** "No results" affordance.

## S5CD-25: Picker Section tab -- limit clamping

1. Open the picker via DevTools, dispatch a search with `limit=999999`.
2. **Expected:** Returns at most `MAX_SEARCH_LIMIT` rows.

## S5CD-26: Audit clean after WP merges

1. Run `bun run sources audit-citations`.
2. **Expected:** `clean -- every citation resolves and every target is live.`

## S5CD-27: Audit JSON output structure

1. Run `bun run sources audit-citations --json`.
2. **Expected:** Valid JSON with `totalCitations >= 5` (the test citations created above), `findings: []`, `corpusCoverage` containing entries for the corpora used in tests.

## S5CD-28: Citation_audit scheduled job is enabled

1. Run `bun run schedule` (or `bash scripts/scheduler/list.sh`).
2. **Expected:** `citation-audit` job listed with `enabled: true` (or whatever the manager's affirmative state is).

## S5CD-29: Dead-target detection still works

1. Pick a citation pointing at a `reference_section`. Delete that section row directly via SQL: `DELETE FROM study.reference_section WHERE id = '<id>'`.
2. Run `bun run sources audit-citations`.
3. **Expected:** One `dead_target` finding with the citation id.

## S5CD-30: Migration retires legacy target types

1. Run `bun -e "import {db} from '@ab/db/connection'; import {sql} from 'drizzle-orm'; const r = await db.execute(sql\`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'content_citation_target_type_check'\`); console.log(r);"`.
2. **Expected:** The CHECK definition lists `'reference_section'`, `'knowledge_node'`, `'external_ref'` and does NOT contain `'regulation_node'` or `'ac_reference'`.

## S5CD-31: bun run check clean

1. `bun run check`.
2. **Expected:** "All checks passed."

## S5CD-32: Composer policy update applied to public page

1. View `/cards/<card-id>` of a card that has reference_section + knowledge_node + external_ref citations.
2. **Expected:** All three render as clickable anchors (was: only external_ref before this WP).

## S5CD-33: Vitest coverage

1. `bunx vitest run libs/bc/study/src/citations`.
2. **Expected:** All tests pass. New tests for `searchReferenceSections` and the updated `resolveCitationTargets` and `corpusForCitationTarget` are present.

## Coverage matrix

| Concern               | Test IDs                        |
| --------------------- | ------------------------------- |
| Schema integrity      | S5CD-1, S5CD-2, S5CD-3, S5CD-30 |
| Picker UX             | S5CD-4..9, S5CD-23..25          |
| Citation persistence  | S5CD-10..12, S5CD-22            |
| Deep-link navigation  | S5CD-13..21                     |
| Public-page policy    | S5CD-20, S5CD-32                |
| Audit + scheduled job | S5CD-26..29                     |
| Build + tests         | S5CD-31, S5CD-33                |
