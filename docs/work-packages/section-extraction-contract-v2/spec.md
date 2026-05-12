---
id: section-extraction-contract-v2
title: 'Section extraction contract v2'
product: platform
category: platform
status: in-flight
agent_review_status: done
human_review_status: pending
created: 2026-04-29
owner: user
depends_on: []
unblocks: []
tags: [ingestion, extraction, prompt]
legacy_fields:
  feature: section-extraction-contract-v2
  type: spec
  closed_at: '2026-04-30'
  closed_by: 'PR #366 (Phase 4 v4 production run) + housekeeping'
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# Spec: Section extraction contract v2

Rewrite the LLM section-extraction contract and the prompt template that
drives the no-API-key paste flow. Fix the input-truncation pitfall that
silently drops the back half of long chapters. Reframe the TOC parser
and the LLM as **mutual reviewers** rather than competing oracles.
Codify the patterns observed in the first phak FAA-H-8083-25C run as
explicit contract rules so they cannot recur silently.

This WP touches templates, the contract document, and the parameters
file. It does NOT touch download / cache layout (owned by the
chapter-source-ingestion WP) and it does NOT touch the deterministic
TOC parser (separate work).

## Why this WP exists

The first phak FAA-H-8083-25C LLM run produced demonstrably incomplete
trees on most chapters. Verified facts (2026-04-29):

- **11 of 17 phak chapters hit the 60K input cap** in
  `chapter_text_max_chars`. Their `_chapter_plaintext.txt` sidecars
  were truncated mid-content; the LLM never saw the back half of those
  chapters.
- **Chapter 7 produced 22 entries vs the deterministic TOC parser's 88.**
  The LLM is missing turbines, fuel systems, oxygen, anti-ice, and the
  chapter summary -- because they were not in its input. The sidecar
  ends mid-sentence in engine cooling.
- **All 17 chapters emit `no-anchor` for every entry**, even though the
  page footer text (`7-12`, `7-13`, ...) is present in the sidecar. The
  contract does not ask for page anchors.
- **All 17 chapters skip "Introduction" and "Chapter Summary" L1
  sections.** The contract is silent on whether to include them.
- **The LLM and TOC parser disagree on hierarchy.** TOC over-flattens
  (PHAK's printed TOC promotes most subsections to L1); the LLM
  correctly nests them. The compare report surfaces these as "level
  mismatch" / "parent mismatch" entries -- but neither side gets to
  weigh in on whether the disagreement was deliberate.

The LLM artifacts on disk are first-pass output of a flawed contract.
We don't ship them; we replace them with output of v2. This is a
correctness fix, not polish.

## Anchors

- [Section extraction strategies](../../ingestion-pipeline/section-extraction-strategies.md). The current TOC + LLM behavior, the three patterns observed in the phak run, and the proposed mutual-reviewer framing.
- [Section extraction prompt strategy](../../ingestion-pipeline/section-extraction-prompt-strategy.md). The no-API-key paste flow this contract drives.
- [Handbook ingest pipeline](../../ingestion-pipeline/handbook-ingest-pipeline.md). End-to-end pipeline; this WP touches phase 3b (`--strategy prompt`) only.
- The current contract: [tools/handbook-ingest/ingest/prompts/section_tree.md](../../../tools/handbook-ingest/ingest/prompts/section_tree.md).
- The current parameters: [tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md](../../../tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md).
- The current per-chapter prompt template: [tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md](../../../tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md).

## In Scope

### 1. Truncation fix (immediate, lands first)

Raise `chapter_text_max_chars` per-handbook OR remove the cap entirely
for handbooks where chapter-source-ingestion has not yet landed. Either
is acceptable; pick the one with the smallest blast radius.

- Read each handbook's longest chapter plaintext size, set the cap to
  `max(longest_chapter) + 20%` rounded up to a sensible boundary.
- For phak FAA-H-8083-25C: longest chapter is ch 14 (Airport Operations);
  current truncation suggests it is much larger than 60K. Measure it
  ungated and set the cap accordingly. Same for the other 10 truncated
  chapters.
- Document in YAML comments which chapters drove the value. Future
  edition changes might shift sizes; the comment is the audit trail.

This is the cheap fix. Chapter-source-ingestion (separate WP) is the
right architectural fix; until it lands, the cap is the gate.

### 2. The contract: required entry shape

Every entry in `_llm_section_tree.json` is now:

```json
{
  "level": 1,
  "title": "Powerplant",
  "page_anchor": "7-1",
  "ordinal": 1,
  "parent_title": null
}
```

Field rules:

- `level` -- integer 1 or 2 (occasionally 3). Same as today.
- `title` -- verbatim from body text. No paraphrase, no normalization
  beyond whitespace.
- `page_anchor` -- printed FAA page anchor (e.g. `7-12`). **Mandatory
  when the heading is followed within the next 50 chars by a page
  marker in the sidecar.** Use `null` when no page anchor is found,
  not the literal string `no-anchor`.
- `ordinal` -- 1-indexed within the chapter; sequential.
- `parent_title` -- the title of the immediate L<level-1> parent, or
  null for L1 entries. Lets the consumer reconstruct hierarchy without
  re-deriving from order.

### 3. Coverage assertion (postcondition the LLM self-checks)

The contract requires the LLM to verify, before writing:

- The first entry's `page_anchor` matches the chapter's first printed
  page (or null with reason).
- The last entry's `page_anchor` is on or after the chapter's last
  printed page (the prompt names this page; `1-1..1-24` style is
  already in the per-chapter prompt today).
- If the last anchor is not at-or-after the last page, the LLM returns
  `error: incomplete coverage -- last entry at <anchor>, expected
  on-or-after <last_page>`.

This catches output truncation explicitly and converts the failure
into a status-line error that the orchestrator surfaces.

### 4. Boilerplate handling (decided, not silent)

Include "Introduction" and "Chapter Summary" as L1 entries when they
appear as standalone headings in the body text. Document this rule in
the contract. The TOC parser includes them; the LLM should too. If a
specific handbook prefers to exclude them, that's a per-handbook
override (see §6).

### 5. Hierarchy preference

Body text structure wins over printed TOC structure. The contract says
explicitly: when the body text nests a heading under a parent topic
(e.g. "Fixed-Pitch Propeller" appears under "Propeller" in the body),
emit it as a child (`level: 2`, `parent_title: "Propeller"`) regardless
of whether the printed TOC promotes it to L1.

This is what the LLM was doing in the first run; codifying it prevents
regression.

### 6. TOC-as-checklist (mutual-reviewer framing)

The per-chapter prompt now includes the deterministic TOC parser's
output for that chapter as a CHECKLIST, not as truth. Prompt text:

> Below is what our deterministic TOC parser extracted for this chapter.
> It has known limitations (it can over-flatten hierarchy and miss real
> body headings). Use it as a checklist:
>
> - For each TOC entry, verify the heading exists verbatim in the body
>   text. If yes, include it in your output.
> - Find any headings in the body text that the TOC parser missed.
> - If you disagree with the TOC parser on level / parent / page
>   anchor, include the disagreement in a separate `disagreements`
>   array (see contract).

The output JSON shape grows a `disagreements` field at the top level:

```json
{
  "entries": [ ... ],
  "disagreements": [
    {
      "type": "level_mismatch" | "parent_mismatch" | "missing_in_body" | "extra_in_toc" | "anchor_mismatch",
      "title": "Powerplant",
      "toc_says": { "level": 1, "parent_title": null, "page_anchor": "7-1" },
      "body_says": { "level": 1, "parent_title": null, "page_anchor": "7-1" },
      "reason": "TOC promoted Fixed-Pitch Propeller to L1; body text nests it under Propeller."
    }
  ]
}
```

The compare report grows a "Disagreements" section that surfaces these
verbatim, so a human reviewer can decide whether the TOC parser needs
fixing or the LLM is wrong.

### 7. Difficult-cases catalog (in the contract template)

Codify what to do with edge cases observed in the phak run:

- **Pseudo-headings.** Bold or capitalized phrases that look like
  headings but are list-item labels. Examples from phak ch 1:
  "Privileges:", "Limitations:". Rule: if it appears in the body text
  as a label introducing a list rather than a section, do NOT emit it.
- **Two-line wrapped headings.** Long titles that wrap onto two lines
  in the plaintext. Example: "Wind and Pressure Representation on
  Surface" + "Weather Maps". Rule: join consecutive title-case lines
  when the second line continues without an intervening blank line.
- **Sidebar callouts.** Highlighted boxes with their own headings.
  Rule: if the sidebar is structurally part of the chapter content
  (not navigation chrome), emit. If it's a glossary inset / cross-
  reference, skip.
- **Repeated section titles.** Multiple chapters reuse "Introduction"
  / "Chapter Summary" / "Class A". Disambiguate by `chapter_ordinal`
  context, not by title alone.
- **Numeric-prefix headings.** Some chapters number their L2 headings
  ("7.1", "7.2"). Strip the numeric prefix from `title`; preserve
  ordering via the `ordinal` field.

### 8. Per-handbook hints (YAML, optional)

Add an optional `extraction_hints:` block to each handbook's YAML.
Schema:

```yaml
extraction_hints:
  body_heading_style:
    description: "All-caps line, possibly two-line wrapped"
  exclude_titles:
    - "Privileges:"
    - "Limitations:"
  chapter_overrides:
    7:
      heading_split: "Powerplant section ends at 'Airframe Systems'"
```

Hints are passed verbatim to the per-chapter prompt as a final
"per-handbook notes" section. Empty for new handbooks; populated when
patterns emerge.

### 9. Template + parameters edits

Concrete files this WP edits:

- [tools/handbook-ingest/ingest/prompts/section_tree.md](../../../tools/handbook-ingest/ingest/prompts/section_tree.md) -- the JSON contract. Major rewrite: new entry shape, coverage assertion, boilerplate rule, hierarchy preference, difficult-cases catalog. This is the doc the per-chapter prompts cite.
- [tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md](../../../tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md) -- per-chapter template. Adds two new placeholder sections: `{toc_checklist}` (TOC parser's output) and `{handbook_hints}` (YAML extraction_hints). Adjusts the contract reference and the success status line to mention disagreements count.
- [tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md](../../../tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md) -- adds the disagreements file rule and the coverage-error return-line.
- [tools/handbook-ingest/ingest/prompt_emit.py](../../../tools/handbook-ingest/ingest/prompt_emit.py) -- threads TOC checklist data + handbook hints into the chapter template.

### 10. Compare report extensions

[tools/handbook-ingest/ingest/sections_compare.py](../../../tools/handbook-ingest/ingest/sections_compare.py)
grows two new sections in the rendered markdown report:

1. **Coverage report.** Per chapter: did the LLM cover the full page
   range? Plaintext sidecar size vs cap.
2. **Disagreements digest.** Aggregated `disagreements` from the LLM
   side, grouped by type, sorted by chapter. Flags candidate fixes for
   the deterministic TOC parser.

### 11. Re-run phak FAA-H-8083-25C end-to-end

Acceptance test for the contract change. After this WP lands:

1. Re-emit prompts for phak (`bun run sources extract handbooks phak --strategy prompt --force`).
2. Fresh-session paste of `out/_run.md`. 17 sub-agents dispatch in parallel.
3. Run `--strategy compare`. Read the new report.
4. Verify: zero chapters hit the truncation cap; ch 7 entry count is in the 80-100 range; every entry has a `page_anchor`; `disagreements` arrays surface the TOC over-flattening pattern.
5. Replace the existing `_llm_section_tree.json` files in `handbooks/phak/FAA-H-8083-25C/<NN>/` with the new artifacts.

### 12. v3 amendment (post-landing observations)

The phak FAA-H-8083-25C re-run under v2 surfaced two real-world failure modes the v2 contract did not yet handle. Both became contract-version-3 amendments shipped alongside the run (PR #355). These are corrections to the contract based on observed handbook structure, not workarounds.

**v3.1 -- trailing figure-only pages tolerated by the coverage check.**

v2's coverage rule required the last entry's page anchor to be on or after the chapter's last printed page. Reality: FAA chapters frequently end body text mid-page and devote the trailing pages to full-page figure plates with no headings of any kind. PHAK ch 03 ends at 3-13 with figures on 3-14..3-16; ch 14 ends at 14-37 with figures on 14-38..14-40. Both tripped a false-positive `incomplete coverage` error under v2.

v3 amends the coverage self-check to inspect the trailing pages: if they contain only figure callouts ("FIGURE 7-12"), table titles, captions, or blank space (no body-text headings), the shortfall is acceptable -- proceed to write JSON. Real input truncation is still caught: a missed body-text heading on the trailing pages still hard-fails. Source: [tools/handbook-ingest/ingest/prompts/section_tree.md](../../../tools/handbook-ingest/ingest/prompts/section_tree.md) "COVERAGE" section.

**v3.2 -- explicit level cap at 3.**

v2 listed L1/L2/L3 definitions and called L3 "rare; use only when the prose actually distinguishes them" but did not state outright that levels 4+ are forbidden. PHAK ch 17's first-pass output emitted 44/95 entries at level 4 (deep nesting under "Vestibular Illusions" and "Visual Illusions") because the body text legitimately had four nesting tiers. The compare validator hard-rejected the file.

v3 adds an explicit cap line right after the level definitions: **valid values for `level` are exactly 1, 2, or 3; never 4 or deeper.** When body text nests a fourth tier, flatten the leaves to L3 with `parent_title` set to the most meaningful enclosing L2 heading. The amendment includes a worked example (Spatial Disorientation -> Vestibular Illusions -> The Leans / Coriolis Illusion / etc. lands at L3, not L4) and warns against the obvious wrong fix (promoting leaves to L2 to escape the cap). Source: [tools/handbook-ingest/ingest/prompts/section_tree.md](../../../tools/handbook-ingest/ingest/prompts/section_tree.md) levels list.

**Run audit-trail note.**

The v3 amendments were patched in place into the live emitted prompts during the run, then ch 03 / 14 / 17 were re-dispatched against v3. The chapters that succeeded on first dispatch (01, 02, 04-13, 15, 16) ran against v2 prompts; ch 03 / 14 / 17 ran against v3. The committed prompts under `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/` are the v3 versions. `meta.json` for the run still records the v2 template SHA at emit time. The JSON outputs themselves are valid v3 shape regardless of which prompt produced them; a future re-run from the v3 source-of-truth produces the same result. This is a one-time drift -- future contract changes go through a fresh re-emit before dispatch.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Acceptance criteria

### Phases 1, 2, 4 (shipped)

- ✅ `chapter_text_max_chars` for phak fits all 17 chapters with 20% headroom (PR #332, #335). Same for AFH and AVWX.
- ✅ Re-run of phak `--strategy prompt` produces 17 sub-agent outputs that each include `page_anchor` for every entry (PR #355). 913 entries total across all chapters; every entry has a populated `page_anchor` (or `null` with reason); literal `"no-anchor"` is forbidden.
- ✅ Re-run of phak `--strategy compare` produces a report where every chapter's "Coverage" section shows green; ch 7 has 89 entries (was 22 under v1).
- ✅ The contract document at [tools/handbook-ingest/ingest/prompts/section_tree.md](../../../tools/handbook-ingest/ingest/prompts/section_tree.md) reflects the new entry shape, coverage rule, boilerplate rule, hierarchy preference, and difficult-cases catalog. Plus the v3 amendments (level cap, figure-only-trailing-pages tolerance) shipped in PR #355.
- ✅ Existing tests pass (`bun run check` clean; pytest in `tools/handbook-ingest/tests/`).
- ✅ The committed `_llm_section_tree.json` files for phak are present (PR #355) under contract v3. The `phak-llm-v1-baseline` tag preserved the v1 artifacts for the entry-count delta verification; tag deleted post-acceptance.

### Phase 3 (GREENLIT 2026-04-30; pending implementation)

The compare report regenerated 2026-04-30 against PR #355's committed v3 artifacts shows systematic disagreement: 485 parent-mismatches and 317 level-mismatches across 17 chapters, with 15 of 17 chapters carrying parent-diff > 10. Ch 7 alone has 86 of 88 TOC entries flagged L1 -- the printed TOC's flatness is a formatting artifact, not the document's structure. The LLM's nesting matches the body text; the TOC parser over-flattens systematically.

This is the "ship Phase 3" branch of the decision criteria: structural disagreement that's both visible and actionable. See [tasks.md Phase 3](tasks.md) for the metric table and full reasoning.

These criteria are in scope for the Phase 3 PR (separate, follows this WP closure):

- The per-chapter template substitutes `{toc_checklist}` and `{handbook_hints}` placeholders; an emitted prompt for phak ch 7 visibly includes both.
- The compare report's "Disagreements" digest highlights TOC parser over-flattening.
- Sub-agents emit `_llm_disagreements.json` alongside the section tree per the schema reserved in `section_tree.md`.

## Manual test plan

1. Read every YAML config under `tools/handbook-ingest/ingest/config/` and verify `chapter_text_max_chars` is annotated with which chapter drove the value.
2. Run `bun run sources extract handbooks phak --strategy prompt --force` and inspect the emitted `out/01-introduction-to-flying.md` for the new placeholders.
3. Open a fresh CC session, paste `out/_run.md`, watch all 17 sub-agents dispatch in parallel.
4. Inspect three random chapters' `_llm_section_tree.json` files. Verify entry shape matches v2 contract; verify `disagreements` array exists (may be empty for clean chapters).
5. Run `bun run sources extract handbooks phak --strategy compare`. Open the report.
6. Spot-check three chapters manually: do the entries match the printed TOC + body text? Are page anchors right? Are disagreements categorized correctly?
7. Re-run compare a second time without re-extracting. Identical output (deterministic).
8. `git diff` for this WP: confirm only template / parameters / contract / YAML files touched (and the new artifacts under `handbooks/phak/`). No code edits to `chapter_plaintext.py` or `cli.py` beyond the chapter-source-ingestion WP's scope.

## Risk register

| Risk                                                                                | Mitigation                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raising `chapter_text_max_chars` blows past LLM context                             | Verify against per-chapter sidecar size; cap with 20% headroom, not unbounded.                                                                                                                              |
| Coverage assertion fails on a legitimately short chapter                            | Contract requires self-check + error return; not a silent fail. User re-runs that chapter manually.                                                                                                         |
| Disagreements field bloats the JSON                                                 | Cap at 50 entries per chapter; the contract says "summarize systematic issues, don't enumerate each line."                                                                                                  |
| TOC checklist threads stale data when YAML changes                                  | Prompt-emit re-runs the TOC parser at emit time; the data in `meta.json` records its SHA. Re-emitting is fast.                                                                                              |
| Per-handbook hints become hidden coupling                                           | Hints are passed verbatim to the prompt; reviewer can read them in the prompt text without indirection. Hints are validated as opaque strings.                                                              |
| Re-run replaces good chapters with worse v2 output                                  | Side-by-side diff before committing. If v2 is worse on any chapter, debug before merging. The compare report from this WP run is the gate.                                                                  |
| The contract change conflicts with chapter-source-ingestion's edits to `chapter.md` | Coordinate: the chapter-source WP modifies `fetch.py` / `chapter_plaintext.py`; this WP modifies template content + `prompt_emit.py` placeholders. Touch points are different functions in different files. |

## Coordination

Concurrent WP: [chapter-source-ingestion](../chapter-source-ingestion/) (in flight). They edit cache layout, download paths, per-handbook YAML `download_mode`. This WP edits prompt content. The two PRs may both touch `prompt_emit.py` and `tools/handbook-ingest/ingest/cli.py` narration strings.

**Sequencing:** this WP's truncation fix (§1) can land before chapter-source-ingestion, but should be marked as transitional in YAML comments. Chapter-source-ingestion's per-chapter mode obviates the cap; once it ships, the cap can be removed for handbooks in chapter mode (this WP keeps it for whole-doc-only handbooks like AVWX, IFH).

**No content overlap:** they own download/cache; we own contract/templates. Stay in your lane.

## Open questions

1. Does the contract template generation in `prompt_emit.py` need to be config-driven (read TOC checklist size from YAML) or always emit the full TOC for the chapter? Recommend always-emit; let the LLM decide what's relevant.
2. Should `disagreements` be a separate file (`_llm_disagreements.json`) or embedded in `_llm_section_tree.json`? Recommend separate file -- keeps the section-tree JSON consumable by code that doesn't care about disagreements.
3. Per-handbook hint propagation: prompt-emit-time substitution vs pull from YAML at LLM-runtime? Recommend prompt-emit-time so the prompt is self-contained (the no-API-key flow requires it).
