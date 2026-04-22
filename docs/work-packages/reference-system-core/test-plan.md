---
title: 'Test Plan: Reference System Core'
product: study
feature: reference-system-core
type: test-plan
status: unread
---

# Test Plan: Reference System Core

## Setup

- Study app running at `https://study.airboss.test`.
- Logged in as test user.
- `libs/aviation/src/references/aviation.ts` populated with the ported 175 entries.
- `bun run check` passes cleanly.
- No `data/sources/` content required (extraction pipeline is a different package).

---

## RSC-1: Glossary index renders all 175 references

1. Navigate to `/glossary`.
2. **Expected:** Page renders. Card grid shows references. Total count matches the ported set (175, barring intentional pruning). Each card shows `displayName`, a truncated paraphrase, and tag chips.

## RSC-2: Detail page renders paraphrase-only reference

1. From the index, open any entry that has paraphrase but no verbatim (expected for all 175 in this package).
2. **Expected:** Detail page shows `displayName`, tag chips per axis, full paraphrase, a "verbatim pending extraction" badge, `sources[]` entries with deep-link URLs, and `related[]` siblings as links.

## RSC-3: Source-type facet filters

1. Navigate to `/glossary`.
2. Click the `cfr` facet in the source-type sidebar.
3. **Expected:** Grid narrows to CFR-sourced entries only. URL reflects `?source=cfr` (or equivalent). Facet counts on other axes update to reflect the filtered set.

## RSC-4: Aviation-topic multi-select

1. On the glossary index, select `weather` AND `regulations` under aviation-topic.
2. **Expected:** Grid shows only entries whose `aviationTopic[]` contains both values. Count displayed.

## RSC-5: Flight-rules filter

1. Select `flight-rules: ifr`.
2. **Expected:** Grid shows only entries with `flightRules = 'ifr'`. `both` and `vfr` entries filtered out.

## RSC-6: Knowledge-kind filter

1. Select `knowledge-kind: limit`.
2. **Expected:** Grid shows only `limit` entries. V-speed entries present; definition-kind and concept-kind entries filtered out.

## RSC-7: Phase-of-flight filter

1. Select `phase-of-flight: approach`.
2. **Expected:** Grid shows only entries whose `phaseOfFlight[]` contains `approach`.

## RSC-8: Cert-applicability filter

1. Select `cert-applicability: ir`.
2. **Expected:** Grid shows only IR-relevant entries. PPL-only entries filtered out.

## RSC-9: Power-user query syntax

1. Type `tag:weather rules:ifr` into the search box.
2. **Expected:** AND-filter applied. Grid shows entries with `aviationTopic` including `weather` AND `flightRules == 'ifr'`. Visible filter chips reflect the parsed query.

## RSC-10: Plain-text search matches aliases

1. Search for an alias on a known entry (e.g. `wx` for METAR-adjacent entries, or `PA.I.F.K1`).
2. **Expected:** Entries with that alias or keyword appear.

## RSC-11: Wiki-link canonical form resolves

1. Find (or author) a content file with `[[VFR minimums::cfr-14-91-155]]`.
2. Render the containing page through `ReferenceText`.
3. **Expected:** "VFR minimums" renders as a link. Hover (desktop) opens a popover with displayName, truncated paraphrase, tag chips, and a link to `/glossary/cfr-14-91-155`.

## RSC-12: Wiki-link display-only form uses reference displayName

1. Render prose containing `[[::cfr-14-91-155]]`.
2. **Expected:** Rendered text is the reference's `displayName` (e.g. "14 CFR 91.155"), not a literal `::`.

## RSC-13: TBD-id wiki-link surfaces warning

1. Add `[[some future term::]]` to a content file.
2. Run `bun run check`.
3. **Expected:** Check passes. Output includes a warning line: count of TBD wiki-links + first-seen path.
4. Render the containing page in dev.
5. **Expected:** "some future term" rendered with the dev-mode yellow underline.

## RSC-14: Scanner fails fast on broken wiki-link

1. Add `[[X::cfr-14-99-999]]` (id not in registry) to a content file.
2. Run `bun run check`.
3. **Expected:** Non-zero exit. Error identifies the offending id + path. Other checks still run; summary prints.
4. Run `bun run dev`.
5. **Expected:** Dev server does not start. Offending path + id printed. User fixes or removes the link; dev starts on retry.

## RSC-15: Scanner rejects malformed wiki-links

1. Add `[[::]]` to a content file. Run `bun run check`.
2. **Expected:** Non-zero exit. Malformed-link error with path.
3. Replace with a nested form: `[[a[[b::c]]d::e]]`. Run `bun run check`.
4. **Expected:** Non-zero exit. Nested-bracket error.

## RSC-16: Duplicate id gate

1. Add a second reference object with an id that already exists in `aviation.ts`.
2. Run `bun run check`.
3. **Expected:** Non-zero exit. Duplicate-id error names the id + both source files.

## RSC-17: Missing required tag gate

1. Remove the `flightRules` field from any reference in `aviation.ts`.
2. Run `bun run check`.
3. **Expected:** Non-zero exit. Error names the reference id + missing axis.

## RSC-18: Conditional phase-of-flight gate

1. Set an entry's `knowledgeKind` to `procedure` without a `phaseOfFlight` array.
2. Run `bun run check`.
3. **Expected:** Non-zero exit. Error names the reference id + the conditional rule triggered.

## RSC-19: Related symmetry gate

1. Edit an entry so `related` includes an id whose entry does not include the first id back.
2. Run `bun run check`.
3. **Expected:** Non-zero exit. Error names both endpoints of the asymmetric edge.

## RSC-20: Tooltip a11y - keyboard focus

1. On any page rendering a wiki-link through `ReferenceText`, Tab to a rendered `<ReferenceTerm>`.
2. **Expected:** Focus visible. Popover appears, linked via `aria-describedby`. Enter navigates to the detail page.

## RSC-21: Tooltip a11y - touch

1. On a touch device (or responsive-mode emulator), tap a wiki-link term.
2. **Expected:** First tap opens the popover. Second tap navigates to the detail page.

## RSC-22: Detail page 404

1. Navigate to `/glossary/not-a-real-id`.
2. **Expected:** 404 response. Friendly "reference not found" message with link back to `/glossary`.

## RSC-23: Deep link from verbatim-pending badge

1. On a detail page showing "verbatim pending extraction," click the source-URL link rendered with the badge.
2. **Expected:** Opens the source URL (CFR, AIM, etc.) in a new tab.

## RSC-24: Nav entry

1. After login, check the app nav.
2. **Expected:** Glossary link present. Click navigates to `/glossary`.

## RSC-25: Filter URL round-trip

1. Apply filters (source + two tags). Copy the URL.
2. Open the URL in a fresh tab.
3. **Expected:** Same filtered view rendered from URL state alone. Back/forward work.
