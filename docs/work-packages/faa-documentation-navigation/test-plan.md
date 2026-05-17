---
title: 'Test Plan: Navigating FAA Documentation'
product: study
feature: faa-documentation-navigation
type: test-plan
status: unread
---

# Test Plan: Navigating FAA Documentation

This is content authoring, so "done" is content-correctness and a clean learner walk-through, not form validation. Scenarios use the prefix `FDN`.

## Setup

- Seed the database (`bun run db build` then seed) so the new course, knowledge nodes, and glossary entries are loaded.
- Sign in as the dev-seed user (`abby@airboss.test`).
- Have `drs.faa.gov` and the eCFR open in a second window to spot-check citations.

---

## FDN-1: The course appears and is framed as orientation

1. Sign in and navigate to the course list.
2. Locate "Navigating FAA Documentation."
3. Open it and read the manifest description and the first step.
4. **Expected:** The course is listed, opens cleanly, and both the description and step 1 explicitly position it as the orientation course to take first. It is not marked as a hard prerequisite of any other course.

## FDN-2: Walk the full course

1. Open "Navigating FAA Documentation" and complete all six steps in order.
2. At each step, confirm the framing prose hands off to a knowledge node.
3. **Expected:** All six steps render with no broken links and no missing-node errors. Each step's hand-off resolves to a real knowledge node. The course can be completed end to end.

## FDN-3: The taxonomy step teaches binding vs advisory

1. Open step 2, "The document families."
2. Read the regulatory-vs-advisory treatment.
3. **Expected:** Every one of the twelve families is named and classified binding or advisory. The step states explicitly that an AC shows ONE acceptable means of compliance and is not itself binding, while a 14 CFR section IS binding.

## FDN-4: The AC-numbering discovery exercise

1. Open step 3, "The AC numbering system."
2. Work through the exercise: five AC numbers are shown with subjects hidden.
3. Attempt to predict each subject before revealing the scheme.
4. **Expected:** The exercise presents `AC 61-65`, `AC 91-73`, `AC 20-138`, `AC 150-5300-13`, `AC 00-6` (or the documented stable set), withholds the answers until the learner has guessed, then reveals the subject-series table. The same five numbers appear in the matching knowledge node and its recall cards.

## FDN-5: Identifier anatomy is taught for all three families

1. Open step 4, "Identifier anatomy."
2. Confirm the breakdown of an AC identifier, a CFR cite, and an AIM cite.
3. **Expected:** "AC 00-45H" is decomposed into prefix / number / revision letter, and contrasted with its title. "14 CFR 91.137(a)(2)" is decomposed into title / part / section / paragraph. "AIM 7-1-6" is decomposed into chapter / section / paragraph.

## FDN-6: Revisions and supersession use the worked contrasts

1. Open step 5, "Revisions and supersession."
2. Read the cancellation treatment.
3. **Expected:** The step explains the revision letter, the difference between a Change and a full revision, and "Cancelled." It uses AC 00-6A (cancelled, successor AC 00-6B exists) and AC 00-2 (cancelled, no successor, DRS replaced it) as the two worked contrasts.

## FDN-7: The cross-reference worked example triangulates

1. Open step 6, "Finding things and cross-reference."
2. Follow the weather go/no-go worked example.
3. **Expected:** The example walks one question across 14 CFR 91.103, AC 00-45H, AIM Chapter 7, the Aviation Weather Handbook, and the relevant ACS weather task, showing what each family contributes.

## FDN-8: The reference family index is the browsable map

1. Navigate to the document-families reference index (`README.md`).
2. Scan the table.
3. **Expected:** A single table lists all twelve families with binding-status, issuer, and a working link to each family's page. Every link resolves to a populated page.

## FDN-9: Each family reference page is complete and citable

1. Open three family pages: `14-cfr`, `advisory-circulars`, `notams`.
2. Confirm each has all template sections populated.
3. **Expected:** Each page has frontmatter with a unique `id`, a binding-or-advisory section, identifier anatomy, revisions/currency, where-to-find, cross-reference, and gotchas. No section is a placeholder. `authoritative_sources` are real and verifiable.

## FDN-10: Glossary entries resolve in the explain-everything surfaces

1. On any page that renders glossary-linked terms, hover over `AC`, `NOTAM`, `ACS`, and `InFO`.
2. Open the `/reference/glossary` page and locate the same terms.
3. **Expected:** Each acronym shows its one-line definition in the tooltip. Each has a long-form body on the glossary page. The `index.test.ts` loader test passes (every `longRef` resolves to a file).

## FDN-11: A cancelled-with-no-successor family is handled cleanly

1. Open the family pages and the taxonomy step for any document that the course names but does not give a full page (if any).
2. Check how a cancelled-no-successor document is presented.
3. **Expected:** Covered-by-name-only families are marked as such in the index, not silently missing. The AC 00-2 cancellation is recorded explicitly with a pointer to DRS, not left as a dangling reference.

## FDN-12: Graph edges and citations are valid

1. Run the knowledge dry-run validator and the course seed validator.
2. Run `bun run check all`.
3. **Expected:** All four knowledge nodes parse, every `requires` / `related` / `related_knowledge_nodes` edge resolves to an existing node, the course manifest and sections parse, and `bun run check all` reports 0 errors and 0 warnings.

## FDN-13: A learner who skips the course is still pointed back

1. Without taking this course, open `weather-comprehensive` and read its first step.
2. **Expected:** The first step of the content course carries a one-line link recommending "Navigating FAA Documentation" as orientation. The link is a recommendation, not a gate: the content course is fully accessible without taking this one first.
