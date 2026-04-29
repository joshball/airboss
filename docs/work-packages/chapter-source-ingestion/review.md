---
title: 'Review: Chapter source ingestion'
product: platform
feature: chapter-source-ingestion
type: review
status: unread
review_status: done
reviewer: claude (opus 4.7)
reviewed_at: 2026-04-29
addressed_at: 2026-04-29
target: spec.md + design.md + tasks.md + test-plan.md
---

> All 12 items addressed in spec.md / design.md / tasks.md / test-plan.md as of 2026-04-29. Audit log:
>
> 1. **PHAK ancillary count -- probed empirically.** Result: PHAK does NOT publish ancillaries as separate PDFs (verified by curl against the PHAK index page + chapter-1 page). The whole-doc bundles them. PHAK reclassified as **Class A1**; spec table now shows A1 vs A2 split. AFH is A2 with front + glossary + index ancillaries (also empirically verified).
> 2. **AIM chapter 0 -- added to inventory.** Real chapter ("General Information / Explanation of Changes"). One section. URL is irregular (`chap0_info_eoc.html` instead of the chap-N-section-S pattern). Added as `chapter_0_section_url_override` in YAML; `sections_per_chapter` extended to 12 elements.
> 3. **AIM chapter 8 -- count verified.** Probed empirically: ch8 really does have 1 section with 8 paragraphs (`8-1-1` through `8-1-8` covering fitness, altitude, hyperventilation, CO poisoning, illusions, aerobatic flight, judgment). Publisher's structural choice; our count is correct.
> 4. **YAML location single source of truth.** Resolved by consolidating ALL source-corpus YAML into `scripts/sources/config/`. Existing handbook YAMLs migrate from `tools/handbook-ingest/ingest/config/` via `git mv`. Both TS downloader and Python ingest tool read from the new location. Updated in spec §1, §Naming and storage decisions, and tasks Phase 1 + Phase 2.
> 5. **Two-hop scrape contract locked: ordinal-prefix-match.** PHAK uses inconsistent kebab slugs (`chapter-7-aircraft-systems`, `chapter-1-introduction-flying` -- no "to"). Spec now specifies `chapter_page_pattern: chapter-{N}-` and the scraper matches `<a href="*chapter-{N}-*">`, ignoring slug content. Resilient to publisher slug renames.
> 6. **Concurrent-edit boundary contract specified.** Spec §H now contains the explicit `chapter_plaintext.py` entry-point shape with the chapter-mode early-return at the top and the existing whole-doc path inside `_build_from_whole_doc_with_page_ranges`. Contract-v2 owns inside; this WP owns the early-return. Merge-conflict prevention by structure.
> 7. **`excluded_assets: []` added to YAML schema.** Optional field on every handbook config; default empty. Documented in §1 with rationale (publisher-published-but-we-don't-want artifacts).
> 8. **SHA-256 prefix length justified.** 12 hex chars = 6 bytes = 48 bits, matching git's full-prefix convention. Documented in spec §1 item 10.
> 9. **Verifier output format specified.** Both 404s and AIM section-count mismatches produce structured remediation including the YAML field path and a copy-pasteable replacement value. Sample output in spec §1 item 9.
> 10. **Manifest field renamed `resolved_via` -> `chapter_page_url`.** Self-documenting. Spec §F schema updated.
> 11. **Phase 7 vs Phase 6 dependency clarified.** Inventory walks the download-manifest tier, not extraction status. Phase 7 does NOT depend on Phase 6. Documented in design.md.
> 12. **Fixture budget set: 5 MB per file, 50 MB total.** Test-plan §Test data fixtures updated. PHAK ch1 chapter PDF (~5 MB) is the natural unit-test fixture.

## Post-merge implementation findings (2026-04-29 manual test pass)

After PR #337 merged, manual operator tests surfaced bugs that need follow-up beyond the AIM count reconciliation already landed:

- **(fixed in cleanup PR)** `verify-urls.ts:28` had an unused `loadRegsConfig` import. `bun run check` failed.
- **(fixed in cleanup PR)** `scrape.test.ts` had a formatter-violating multi-line `expect`. `bun run check` failed.
- **(fixed in cleanup PR)** `html-fetch.ts` sent `Accept: text/html`, which the FAA's CDN returns 406 for on certain URLs (chap0_info_eoc.html, some appendices). Changed to `Accept: */*` to match curl's default behavior; we still validate the returned `Content-Type` ourselves.
- **(fixed in cleanup PR)** `aim.yaml` `sections_per_chapter` was `[1, 9, 5, 7, 14, 6, 5, 7, 1, 4, 7, 6]` (78 plans). Correct array per empirical curl probe of the per-chapter TOC stubs is `[1, 2, 3, 5, 7, 6, 5, 7, 1, 1, 2, 8]` (54 plans). The original WP-authoring probe had read the AIM master nav dropdown (which lists every paragraph across the whole AIM) and miscounted per-chapter section files. Spec, design, tasks, test-plan all updated to the empirical truth.
- **(known follow-up bug)** `html-fetch.ts` does not implement HEAD-cache idempotency. PDF re-runs are zero-network; HTML re-runs always re-fetch (53 of 54 AIM files re-fetched on the second download). Spec acceptance only required PDF idempotency, but HTML should follow the same pattern. Separate fix PR.
- **(known follow-up bug)** `python -m ingest phak --strategy prompt --chapter 7` errors with "sidecar count (17) does not match chapter count (1)". The chapter-PDF mode emits sidecars for all chapters but the prompt-strategy CLI only wants one when filtered. The unfiltered run works fine. Separate fix PR.
- **(operator action)** `bun run sources verify-urls` reports 7 of 8 `handbooks-extras.yaml` URLs are 404. These were stale before this WP -- migrated as-is from the pre-existing TS arrays. Operator updates the YAML with current FAA URLs.
- **WP correctness goal achieved.** PHAK ch7 chapter-PDF sidecar is 156 KB (vs old 60K cap), contains all 5 expected literals (`Turbine Engines`, `Fuel Systems`, `Oxygen Systems`, `Pressurized Aircraft`, `Chapter Summary`), ends cleanly at the chapter's last sentence. The whole point of the WP works.

# Review: Chapter source ingestion

Self-review pass on the four-doc work package. Same lens as #326: where would a future implementer get stuck, where is the contract ambiguous, where did I leave a "decide later" hole?

**Verdict draft:** spec is comprehensive but has 8 items needing tightening before sign-off. Most are scope clarification or contract sharpness; one (item 1) is a real bug in my own reasoning.

## Must fix

### 1. PHAK ancillary count is unverified -- spec asserts "4 ancillaries" without evidence

§Acceptance criteria says "4 ancillary PDFs (front, toc, glossary, index)". I never probed the PHAK index page to count the actual ancillary files the publisher offers. The list I wrote (front, toc, glossary, index) is what I'd expect from a typical FAA handbook, but PHAK might also have erratas listed as separate downloads, supplements, or fewer than four ancillaries.

**Action:** the spec should say "ancillary PDFs as listed on the PHAK index page; count to be verified at implementation time." OR I should probe the PHAK index page before merge and lock the count in the spec.

I'd lean **probe and lock** -- this is a 60-second curl. Doing it now.

### 2. AIM chapter 0 / "General Information" stub is missing from sections_per_chapter

While probing AIM, I noticed `chap_0.html` exists ("General Information / Explanation of Changes" -- referenced in the navigation). My `sections_per_chapter: [9, 5, 7, 14, 6, 5, 7, 1, 4, 7, 6]` is for chapters 1-11. Chapter 0 is real and contains content.

**Action:** decide whether to cache chap_0 sections as well. Either:

- **A.** Add chapter 0 to the array: `sections_per_chapter` becomes 12-element. Each section caches as `chap00_section_<S>.html`.
- **B.** Cache `chap_0.html` and `chap0_info_eoc.html` as a special chapter 0 with one section.
- **C.** Skip chapter 0 -- it's just "explanation of changes", not pilot-relevant content.

I'd lean **A** for completeness. The probe cost is tiny.

### 3. Chapter 8 ("Medical Facts for Pilots") has only 1 section -- verify

My `sections_per_chapter` array has `1` for chapter 8. That's based on the AIM nav dropdown. But the brief talks about AIM chapter 8 having multiple medical topics (drugs, alcohol, fatigue, etc.). Either:

- The publisher really does put it all under "Section 1" with many paragraphs
- I miscounted from the nav
- The site has more sections that aren't in the nav dropdown

**Action:** probe `chap_8.html` (TOC stub) before locking the count. Same 60-second curl.

### 4. The "config not code" rule has a contradiction at the per-handbook YAML level

The spec migrates AC/ACS/AIM/regs URL inventories from TS code to `scripts/sources/config/<corpus>.yaml`. Good.

But the per-handbook configs at `tools/handbook-ingest/ingest/config/<slug>.yaml` ALSO get extended. So PHAK's URL inventory now lives in TWO files: `tools/handbook-ingest/ingest/config/phak.yaml` (whole-doc URL + chapter URLs + ancillaries) AND it's referenced from `scripts/sources/config/handbooks-extras.yaml` for the 8 handbooks that already had a TS-tool entry.

**Action:** clarify the contract. Either:

- **A.** PHAK is in the Python-tool config only; TS downloader cross-reads `tools/handbook-ingest/ingest/config/<slug>.yaml` for handbook URL inventory. Two paths into one source of truth.
- **B.** PHAK is duplicated in both files. Disgusting.
- **C.** Move ALL handbook YAMLs (including PHAK, AFH, etc.) into `scripts/sources/config/handbooks/<slug>.yaml`, with the Python tool also reading from there. Single dir.

I'd lean **C** -- a single `scripts/sources/config/` directory under TS-tool ownership, Python tool reads from it. This matches the brief's "all docs and locations should be config, not code" goal at one source of truth, not two.

But this contradicts my own §Naming and storage decisions row which said "single tool ownership per dir." That row is wrong -- the principle should be "single source of truth per logical entity." The right tool ownership for handbook YAML is jointly TS+Python, because both tools need it.

### 5. The two-hop scrape pattern syntax is underspecified

Spec example:

```yaml
chapter_pdfs:
  index_url: https://www.faa.gov/.../phak
  chapter_page_pattern: /regulationspolicies/handbooksmanuals/aviation/phak/chapter-{N}-{slug}
```

The `{N}` is the chapter ordinal. What's `{slug}`? PHAK chapter 7 is "aircraft-systems" -- where does that come from? Is it derived from chapter title? Configured separately? The spec doesn't say.

**Looking at the actual PHAK index URL:** `chapter-7-aircraft-systems`. The `aircraft-systems` part is a kebab-cased chapter title. Which means the YAML needs to carry the title list:

```yaml
chapter_pdfs:
  index_url: ...
  chapter_page_pattern: /.../chapter-{N}-{slug}
  chapter_count: 17
  chapter_slugs:
    - introduction-to-flying
    - aeronautical-decision-making
    # ... 17 entries
```

OR the scraper finds chapter pages by ordinal-prefix match (anchor href contains `/chapter-7-` regardless of slug). The latter is more resilient (publisher renames a chapter -> our YAML stays valid).

**Action:** lock the scrape contract. I'd lean **ordinal-prefix-match**: scraper finds `<a href="*chapter-{N}-*">` and reads whatever follows. No need to maintain a slug list.

### 6. Concurrent edit conflict mitigation in §H is hand-wavy

Spec §H says "if both PRs are open simultaneously, the agent that merges second rebases and resolves on top." That's true but doesn't help. It needs a concrete rule for the `chapter_plaintext.py` entry-point shape.

**Action:** define the entry-point contract:

```python
def build_chapter_plaintext(handbook_config: HandbookConfig, ...):
    if handbook_config.chapter_pdfs is not None and chapter_pdfs_in_cache(handbook_config):
        return _build_from_chapter_pdfs(handbook_config, ...)
    return _build_from_whole_doc_with_page_ranges(handbook_config, ...)  # existing path
```

The chapter-mode branch is one early-return at the top. Contract-v2 owns whatever happens INSIDE `_build_from_whole_doc_with_page_ranges` (truncation logic, prompt template). If contract-v2 lands first, this WP just adds the early-return; if this WP lands first, contract-v2 modifies the inside of the existing function.

This is a structural rule that prevents merge conflict by making the boundary explicit.

## Should fix

### 7. The "always grab everything available" rule has an unhandled failure mode

What if the publisher offers a chapter PDF AND a slightly different "Latest Errata" version of the same chapter? Or what if the FAA publishes an "Addendum" PDF that's not really a chapter but lives at a chapter URL?

The spec assumes everything in the YAML is a clean asset class. But the FAA's distribution can be messier than the YAML schema admits. The schema needs an "ignore" or "exclude" list for cases where the publisher offers something we explicitly DON'T want to cache.

**Action:** add `excluded_assets: []` to the YAML schema. Operator lists URL patterns to NOT fetch. Documented but rarely used.

I lean YES on adding this.

### 8. Inventory format spec says "first 12 chars" of SHA-256 -- why 12?

Spec §F shows `SHA-256 (12)` column. 12 chars is 6 bytes = 48 bits. Plenty for human disambiguation but not enough for adversarial collision resistance. That's fine for an inventory doc, but the choice of 12 is arbitrary.

**Action:** justify 12 in the spec, or change to a more obvious number (8 = git short-SHA convention; 12 is git's longer prefix). I lean **12** to match git's full-prefix convention but document that.

### 9. The verifier doesn't have a "what to fix" for the AIM section count case

Spec says "AIM section count mismatch (publisher added/removed sections to AIM) is also a hard error here." But the verifier reports the chapter and YAML field; it doesn't say HOW to fix.

**Action:** verifier output for the AIM mismatch case includes:

- Which chapter has wrong count
- Expected count (from YAML)
- Actual count (from probe)
- Suggested YAML edit (literal new array value)

This is consistent with the "structured remediation" promise made elsewhere. Not making the verifier guess; just having it format the diff so an operator can copy-paste.

## Nits

### 10. Manifest schema `chapters[].resolved_via` is for two-hop only -- field name is unclear

`resolved_via: string | null` -- null for direct-pattern handbooks, the intermediate chapter-page URL for two-hop. The field name doesn't say that.

**Action:** rename to `chapter_page_url` (only set for two-hop). Self-documenting.

### 11. Phase ordering: the test-plan covers Phase 7 (verify-urls + inventory) before Phase 6 finishes (AIM extraction)

Tasks Phase 6 (AIM HTML extraction) lands `aim_html_extract.py`. Phase 7's "inventory" command might want to read AIM extraction status. If Phase 7 runs first, the inventory is technically incomplete.

**Action:** clarify. The inventory walks DOWNLOAD manifests, not extraction status. Phase 7 doesn't depend on Phase 6. State this in the design.md.

### 12. The fixture file size budget isn't documented

Test plan says "fixtures < 1 MB each" but the PHAK ch1 chapter PDF is probably 4-8 MB. Either we use a tinier synthetic PDF or relax the budget.

**Action:** budget is ~5 MB per fixture, ~50 MB total. Document.

## Summary

The 4-doc package is well-structured but has 6 must-fix items concentrated around:

- **Empirical gaps** (1, 2, 3): I asserted counts/structure I didn't probe. 60-second curl each; do them before merge.
- **Contract underspecification** (4, 5, 6): two-hop scrape pattern, YAML location single source of truth, concurrent edit boundary.

The 3 should-fix items are scope tightening (excluded_assets, SHA prefix justification, verifier output format). The 3 nits are cosmetic.

Once the must-fix items are addressed, the package is ready for the spec PR.

> **Audit log of resolutions**: pending (will be filled when fixes land in spec.md/design.md/tasks.md).
