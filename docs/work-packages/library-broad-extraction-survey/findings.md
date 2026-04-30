---
title: 'Library broad-extraction survey -- 2026-04-30 findings'
product: platform
feature: library-broad-extraction-survey
type: findings
status: unread
review_status: pending
---

# Library broad-extraction survey -- findings

A pass to drive every configured corpus through its register/extract pipeline and capture state. Goal: surface which corpora are currently queryable, which need code work to be queryable, and which manifests reflect real vs simulated state.

## Per-corpus status (2026-04-30)

| Corpus | Configured | Cached | Pipeline runs? | Entries registered | Notes |
| ------ | ---------- | ------ | -------------- | ------------------ | ----- |
| **PHAK** FAA-H-8083-25C | ✅ | ✅ | ✅ | **850** | LLM section trees + 357 disagreements committed under contract v4. |
| **AFH** FAA-H-8083-3C | ✅ | ✅ | ✅ | **531** | TOC strategy. Re-extract + single errata re-apply produces fewer paragraphs than current main (main has duplicate-applied MOSAIC errata; stashed cleanup at `agent-library-extract`). |
| **AVWX** FAA-H-8083-28B | ✅ | ✅ | ✅ | **480** | TOC strategy. Re-extract is byte-identical to main (only manifest timestamp drift). |
| **AIM** | ✅ | ✅ | ✅ | **744** | HTML chapter extraction; chapters 1-11 + 5 appendices. |
| **CFR Title 14** | ✅ | ✅ | ✅ | **7,218** | Fresh ingest at edition 2026-04-22. 13,545 .md files written under `regulations/cfr-14/` (gitignored per ADR 018 scale exception). |
| **CFR Title 49** | ✅ | ✅ | ❌ FAIL | 0 | Walker expects `<DIV1 TYPE="TITLE">` root; cache has `<DIV5 TYPE="PART">` root (parts 830 + 1552 only, downloaded as the filtered subset). See `xml-walker.ts:321`. |
| **AC** | ✅ | 12 cached | Partial | **9** | 3 skipped: `ac-150-5210-7d` (slash-style doc number not yet supported by locator), `ac-60-22` and `ac-91-92` (null edition rejected by ADR 019 §1.2 validator). |
| **ACS** | ✅ | 5 cached | Partial | **1** | 4 skipped: `acs-7`, `acs-8`, `acs-11`, `acs-25` (detected editions not wired in `ACS_DETECTED_EDITION_TO_SLUG`). |
| **Handbooks-extras** | ✅ | 6 cached (risk-mgmt, instructor, IFH, IPH, AMT-G, AMT-P) | ❌ NO PIPELINE | 0 | The `register handbooks` dispatcher only knows `phak`/`afh`/`avwx`. Extras are downloaded but not registered. |

## Total queryable

After this pass: **9,823 entries across 8 corpora** registered into the runtime registry. Up from approximately 1,326 before (PHAK 19 + AFH 0 + AVWX 0 + AIM 26 + CFR-14 120 + CFR-49 0 + AC 3 + ACS 1 + extras 0 across `aviation.ts` references seed; plus the test-fixture usage of full handbook trees).

The big delta: **CFR-14 went from 120 hand-curated references in `aviation.ts` to 7,218 structurally-ingested entries.**

## Code gaps surfaced (each is a real bug, scoped small)

These are not part of the broad pass; they need real fixes:

### Gap 1 -- CFR-49 walker rejects part-only XML

`libs/sources/src/regs/xml-walker.ts:321` requires `<DIV1 TYPE="TITLE">` root. The CFR-49 cache holds part-only XML (the filtered subset for parts 830 + 1552). Either the walker needs a part-root mode, or the downloader needs to fetch full title 49 XML. Recommend the walker: title 49 is large and we only care about two parts.

### Gap 2 -- ACS edition slug mapping

`libs/sources/src/acs/ingest.ts` uses `ACS_DETECTED_EDITION_TO_SLUG` to translate detected editions to publication slugs. Five ACSes are cached; only one (`faa-s-acs-6c` -> `ppl-airplane-6c`) is wired. Add four more entries: `faa-s-acs-7b`, `faa-s-acs-8c`, `faa-s-acs-11a`, `faa-s-acs-25` -> respective publication slugs.

### Gap 3 -- AC slash-style doc numbers

`libs/sources/src/ac/locator.ts` doesn't accept slash-style FAA AC doc numbers (e.g. `150/5210-7`). One AC affected: `ac-150-5210-7d`. Either add support to the locator or accept this AC won't be queryable.

### Gap 4 -- AC null editions rejected

ADR 019 §1.2 validator rejects ACs with `edition: null`. Two affected: `ac-60-22`, `ac-91-92`. These are unrevisioned ACs (no rev letter); the FAA's stable URL doesn't carry a rev. Either the validator needs a "stable URL implies edition" exemption or these ACs need a synthetic edition.

### Gap 5 -- Handbooks-extras have no pipeline

`scripts/sources/register/handbooks.ts` only dispatches `phak`/`afh`/`avwx`. The 6 cached extras (risk-management, aviation-instructor, IFH, IPH, AMT-G, AMT-P) are whole-doc PDFs with no chapter splits and no per-edition manifest. Need a "whole-doc handbook extras" register path that walks `scripts/sources/config/handbooks-extras.yaml` and produces minimal manifests.

### Gap 6 -- AFH duplicate-applied errata on main

Current main `handbooks/afh/FAA-H-8083-3C/01/02-role-of-the-faa.md` (and 5 other files) has MOSAIC errata applied twice -- duplicate paragraphs in the body content. Re-extract + single re-apply fixes it; ~615 lines of duplicate content removed. Stashed at `stash@{0}` on branch `chore/library-broad-extraction` for separate cleanup PR.

## Recommended next steps

For going wide:

1. **Fix Gap 5 first.** Handbooks-extras is the highest leverage -- 6 documents, all standard FAA handbooks worth having queryable. The pipeline is small (whole-doc PDF extraction; the figures/tables/manifest writer already exists for PHAK/AFH/AVWX).
2. **Fix Gap 1 next.** CFR-49 parts 830 + 1552 are central regulations (accident reporting, TSA flight training security). Walker fix is small.
3. **Fix Gap 2.** ACS coverage is currently 1/5; the four missing are common ACS documents (instrument, sport, mechanic, etc.).
4. **Defer Gaps 3 + 4 indefinitely.** Single-AC value is low; these affect 3 ACs total, and 2 of them (60-22, 91-92) have minor pedagogical value vs Part 91 / 61 / 67 themselves.

Each gap fix is a small focused PR. Doing all five would take the queryable library from ~9,823 entries to ~10,000+ across all 8 corpora plus extras, and from "PHAK is the demo" to "the FAA library is queryable end-to-end."

## Provenance / signoff WP -- captured separately

This survey also surfaced the need for per-section provenance + signoff tracking. The AFH duplicate-errata case (corrected silently for months until I happened to re-extract) is the canonical motivating evidence. WP draft at `docs/work-packages/extract-provenance-and-signoff/` captures the design space; deferred until corpora-broadening work decides which gaps to fill.
