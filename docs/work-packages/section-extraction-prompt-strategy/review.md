---
title: 'Review: Section Extraction via Prompt Strategy'
product: cross-cutting
feature: section-extraction-prompt-strategy
type: review
status: unread
review_status: done
date: 2026-04-28
machine: airboss
branch: chore/ideas-adr019-follow-ons
repo_sha: 21b58748
reviewer: agent (Opus 4.7)
target: design.md
verdict: ship-with-changes
---

# Review: Section Extraction via Prompt Strategy

## Verdict

**Ship-with-changes.** Strong design. Internally consistent for the most part, resolves prior reviewer feedback correctly, and matches the no-key paste-once fan-out shape the user has already validated. Three critical issues must be fixed before merging the design; four major issues should be resolved (or explicitly deferred per CLAUDE.md "no undecided considerations"); minors can fold into the implementation PR.

## Scope of review

Read in full:

- [design.md](design.md)
- [tools/handbook-ingest/ingest/sections_via_llm.py](../../../tools/handbook-ingest/ingest/sections_via_llm.py) (being deleted)
- [tools/handbook-ingest/ingest/prompts/run-llm-comparison.md](../../../tools/handbook-ingest/ingest/prompts/run-llm-comparison.md) (being deleted)
- [tools/handbook-ingest/ingest/cli.py](../../../tools/handbook-ingest/ingest/cli.py) (modified)
- [tools/handbook-ingest/ingest/config_loader.py](../../../tools/handbook-ingest/ingest/config_loader.py) (modified)
- [tools/handbook-ingest/ingest/sections_compare.py](../../../tools/handbook-ingest/ingest/sections_compare.py) (touched)
- [tools/handbook-ingest/ingest/prompts/section_tree.md](../../../tools/handbook-ingest/ingest/prompts/section_tree.md) (kept)
- The three handbook YAMLs (phak, afh, avwx)
- Standing memory note on `run-llm-comparison.md` being human-interactive

## Strengths

- **Non-symlink `current/` + opt-in `archive/`** correctly resolves the prior reviewer's portability concern. Mutable-but-git-tracked is the right shape; git is the time machine.
- **Three-template factoring** (`parameters.md` / `orchestrator.md` / `chapter.md`) is the right separation. The "additive only" rule on `chapter.md` is the right stake in the ground for cross-handbook reuse.
- **Loud `section_strategy: llm` rename hint** with no silent fallback matches the CLAUDE.md "no quietly-deferred legacy" stance.
- **`per_chapter` deletion** is the right call. Three YAMLs with empty overrides is dead weight per the no-legacy rule.
- **Verbose CLI narration spec** is the single biggest UX improvement in this design and is well-scoped. WHAT/WHY/HOW per phase makes the run self-documenting.
- **Sub-agent return contract** (one-line ok/error per chapter) is concrete enough that the orchestrator can collate without ambiguity.

## Critical issues

### C1. Sub-agent dispatch contract conflicts with the standing "human-interactive" memory note

**Where:** [design.md L242-251](design.md#L242-L251) ("Sub-agent dispatch contract").

**What:** The design instructs the orchestrator to fan out via `general-purpose` sub-agents in parallel. The standing feedback memory `feedback_llm_comparison_runner_is_interactive.md` says "do not dispatch sub-agents on this runner from the parent session — burns parent context." The memory note was specifically about the *parent airboss session* dispatching, but the new design is a different shape: the user pastes `_run.md` into a **fresh, separate** Claude Code session, and *that* session fans out. That distinction is correct and is the right shape, but the design never makes it explicit. A reader (or a future agent) will read the dispatch section and conclude "I should Agent-dispatch this from my current session," which is exactly what the memory forbids.

**Fix:** Add one paragraph at the top of "Sub-agent dispatch contract" stating: "The orchestrator runs in a *fresh* Claude Code session opened by the user, not in the parent session that emitted the prompt set. Agents in the emitting session must not dispatch this prompt themselves; the no-key story requires the user's own paste-driven session." Then update the memory note to cite this design doc as the canonical reference.

**Severity:** Critical because it directly contradicts validated user feedback if read at face value.

### C2. The `meta.json` mutation contract is contradictory

**Where:** [design.md L267-307](design.md#L267-L307) ("`meta.json` schema") and [design.md L255-265](design.md#L255-L265) ("JSON-drift detection").

**What:** The design says every input that shaped a run is committed alongside the output, that `meta.json` is the authoritative replay record, and that templates are SHA'd at run time. Then it says `meta.json.output_sha256` is mutable post-emission and gets overwritten by the next compare run. So `meta.json` is simultaneously immutable audit and mutable state.

Two specific failure modes:

1. A reviewer reads `meta.json` at PR review time, sees `output_sha256: "abc12..."`, and assumes that's what the run *produced*. It isn't — it's whatever the most recent compare-run observed, which could be many edits later.
2. The git diff on `meta.json` between two PRs no longer cleanly tells you "templates changed" vs "the human edited the JSON" — both are mixed in.

**Fix options (pick one):**

- **A.** Split. `meta.json` is write-once (templates, sidecars, prompt paths). Observed JSON hashes go in `compare-state.json` written by the compare command. The drift check reads `meta.json` for the *expected* hash and writes the *observed* hash to `compare-state.json`.
- **B.** Drop `output_sha256` from `meta.json` entirely. Compare computes hashes on the fly and renders into the report; you don't need persistent state for drift detection.

**Severity:** Critical because audit integrity is the design's stated goal and this contradiction undermines it.

### C3. The "byte-comparable across paths" claim has an unaddressed hole

**Where:** [design.md L181-191](design.md#L181-L191) ("PHASE 2") and the implicit comparison to the deleted runner.

**What:** The new sidecar uses `sections.extract_sections` (PyMuPDF) — same as `sections_via_llm.py` did. But the deleted [run-llm-comparison.md L75-79](../../../tools/handbook-ingest/ingest/prompts/run-llm-comparison.md#L75-L79) instructed agents to *concatenate index.md + per-section markdowns*, which is a different byte source. The deleted runner's claim of byte-comparability with `sections_via_llm.py` was wrong.

This is fine in practice because no `_llm_section_tree.json` files exist yet for any handbook ([design.md L410](design.md#L410)). But the design says nothing about the discrepancy, so a reader comparing the deleted runner to the new flow will be confused about which one was right.

**Fix:** One sentence in §Constraints or §Migration: "The deleted runner's prose claimed byte-comparability with `sections_via_llm.py`, but it built plaintext from rendered markdown rather than the PyMuPDF body. The new sidecar path closes that gap by routing both the deprecated API path's behavior and the new prompt-strategy path through the same `sections.extract_sections` source of truth."

**Severity:** Critical because the "audit story" depends on this claim being true; a reader needs to be able to verify it.

## Major issues

### M1. Rule duplication between `parameters.md` and `orchestrator.md` will drift

**Where:** [design.md L243-251](design.md#L243-L251).

**What:** "These rules are encoded in `parameters.md` ... and reinforced in `orchestrator.md`." Restating rules in two places guarantees they drift apart over time.

**Fix:** `parameters.md` is the single source of truth. `orchestrator.md` *links* to it ("see `_parameters.md` in this directory") rather than restating. The orchestrator's job is sequencing (read parameters → dispatch N chapters → collate); the *what each sub-agent does* lives in parameters.

### M2. "Warn-not-fail" on JSON drift undermines the audit story

**Where:** [design.md L255-265](design.md#L255-L265), failure modes table at [design.md L424](design.md#L424).

**What:** Hand-editing `_llm_section_tree.json` post-emission produces a warning row in the compare report, not a failure. The whole point of the design is "every byte that shaped the run is committed." If the only signal of a hand-edit is a warning row in a report that doesn't run unless someone re-invokes compare, the audit story collapses.

The user's stance per CLAUDE.md is "zero tolerance for known issues." A drifted JSON is either a legitimate hand-correction (in which case the user should be forced to re-run with `--force` and commit a fresh state) or a mistake. Warning makes neither path obvious.

**Fix options (pick one):**

- Make drift a hard error during compare; `--force` overrides and writes fresh state with the new hash.
- Drop drift detection entirely and rely on git diff at PR review (the JSON file is committed; git already shows hand-edits).

The middle ground in the design is the worst of both: not blocking enough to enforce, not absent enough to remove the implementation surface.

### M3. `--strategy compare` re-extracting the sidecar silently mutates committed state

**Where:** [design.md L148-158](design.md#L148-L158).

**What:** Compare writes `_chapter_plaintext.txt` "needed for hash recheck." But the sidecar pre-exists from the prompt run, and a recheck only matters if PDF bytes changed between prompt and compare. If the PDF *did* change, the JSONs were produced against old bytes and the entire run is invalidated. So either:

- Compare re-extracts and detects PDF drift → fails loudly with "PDF changed since prompt run, re-run prompt." Coherent.
- Compare reads the existing sidecar and trusts it. Sidecar bytes are committed; PDF bytes are cached + checksummed.

The design picks neither. It silently overwrites committed sidecars without surfacing drift.

**Fix:** Compare *reads* the existing sidecar; if missing, errors with the banner pointing at `current/_run.md`. PDF-drift detection comes from the existing fetch_result hash check, not from re-extraction.

### M4. `meta.json` doesn't record the model that produced the JSON

**Where:** [design.md L267-307](design.md#L267-L307).

**What:** The whole rationale for dropping the API path is "we don't pin a model." That means re-runs against (e.g.) Sonnet 4.6 vs Opus 4.7 produce different JSON. The design says `git diff` on `_llm_section_tree.json` surfaces drift, but `meta.json` doesn't capture *which model the user's CC session was running when the JSON was written*. A reviewer sees a JSON diff and can't tell: did the prompt change, did the input change, or did the user's CC default model change?

**Fix:** Have the orchestrator instruct each sub-agent to emit, alongside its JSON, a one-line status that includes the model it's running on. Parent collates these into a `chapters[].produced_by_model` block (in `meta.json` if C2 keeps it write-once, or in `compare-state.json` per C2-A). Cheap, gives reviewers the missing signal.

## Minor issues

### m1. Missing-vs-malformed JSON: asymmetric handling

**Where:** [design.md L153-154](design.md#L153-L154) and [design.md L420](design.md#L420).

Missing JSON → error. Malformed JSON → "skip the chapter with a warning." Skipping a malformed chapter is *worse* than a missing one (silent data loss vs loud absence). Either both fail or both warn; recommended: both fail.

### m2. Test plan has a phantom `--dry-run` step

**Where:** [design.md L458](design.md#L458).

"Run `--strategy prompt --dry-run` (?) → fail (dry-run not supported for prompt)." The `(?)` is unresolved. Either dry-run is meaningful (emit prompts to a temp dir, exit) or the CLI rejects the combination with a specific error. Don't ship `(?)`.

### m3. `meta.json.config` is under-specified

**Where:** [design.md L284-287](design.md#L284-L287).

Records `chapter_text_max_chars` and `section_strategy`. But `outline_strategy`, `page_offset`, `chapter_overrides`, `title_overrides`, and `page_label_walk_back` all influence which chapters get processed and how their text is built. Right now an audit can't reproduce "why did chapter 7 have these page boundaries."

**Fix:** Snapshot the full YAML to `current/_config.yaml` and add `config_yaml_sha256` to the templates block in `meta.json`. Same audit pattern as the templates.

### m4. Archive collision suffix wording reads like a hard cap

**Where:** [design.md L85](design.md#L85).

"If two `--archive` runs collide in a single minute, append `-2`, `-3`." A reader assumes there's a hard cap at `-3`. Say "append `-N` for N≥2."

### m5. `current/` reads like a symlink target; banner uses `latest/` once

**Where:** [design.md L66](design.md#L66) (`current/`) vs [design.md L219](design.md#L219) (`latest/_run.md` in the banner example).

The design notes "no symlinks" (good), but `current/` and `latest/` both read like pointers, and the banner inconsistency suggests the design itself isn't sure which name it picked. Pick one; consider `out/` or `mutable/` to avoid the pointer connotation.

### m6. `chapter.md` placeholder list is incomplete

**Where:** [design.md L55](design.md#L55).

Lists `{title}`, `{sidecar_path}`, `{output_path}`, `{chapter_ordinal}`, `{page_range}`. Missing:

- `{document_slug}` + `{edition}` — the agent needs handbook context for tie-breakers and citations.
- `{contract_path}` — so the chapter prompt cites `_section_tree_contract.md` in the run dir explicitly rather than relying on the orchestrator to have loaded it.
- `{sidecar_sha256}` — defensive against partial writes / a stale sidecar; the agent verifies before reading.

## Tiny

- [design.md L165](design.md#L165) says "3-line header (WHAT, WHY, HOW)" but the example at [design.md L172-176](design.md#L172-L176) is 3 *labels* on 6 lines. Update the spec to "3-section header" or restructure the example.
- [design.md L343](design.md#L343) adds `docs/agents/section-extraction-prompt-strategy.md` but the design doesn't explain its scope vs this design doc. Is it the user-facing pattern doc that survives after this work-package is archived? Say so explicitly.
- [design.md L350](design.md#L350): "the `llm:` block stays (still controls `chapter_text_max_chars`)." Rename it. `llm:` is now a misnomer — there's no LLM in this CLI's path. Rename to `prompt:` or `chapter_text:`. One-line YAML migration; loud naming is cheap.
- [design.md L352](design.md#L352): "CLAUDE.md 'Before You Build' — link to the new pattern doc." Specify which bullet (or add a new "Source ingestion / handbook extraction" bullet).

## Open decisions for the user (per "no undecided considerations")

These need calls in the same turn the design is updated. Each has a recommended option in **bold**.

1. **C2 split:** **(A) `meta.json` write-once + separate `compare-state.json`** vs (B) drop `output_sha256` entirely.
2. **M2 drift handling:** **hard error + `--force`** vs drop drift detection.
3. **M3 sidecar in compare:** **read-only with PDF-drift detection** vs keep re-extract.
4. **m5 directory name:** `current/`, `mutable/`, **`out/`**.
5. **m6 chapter prompt placeholders:** **add `{document_slug}` + `{edition}` + `{contract_path}` + `{sidecar_sha256}`** vs keep current set.

## Convergence with prior review

The five issues the prior reviewer raised (#1 symlinks, #2 meta.json drift, #3 named trigger for parameters fork, #5 sub-agent dispatch underspec, #6 test coverage gap, #7 sidecar-write policy + YAML migration + pyproject cleanup) are all addressed. The new criticals (C1, C2, C3) are issues that were latent under the prior reviewer's concerns rather than rebuttals to this revision.

## Next steps

1. User answers the five open decisions above.
2. Author updates `design.md` to fold in the answers, fix C1/C2/C3, address M1-M4, and clean up minors.
3. Re-review (this file gets updated, not replaced).
4. Implementation PR runs against the signed-off design.

## Re-review (revision 3)

**Verdict: ship-with-changes.** Most closures hold up. C1, C2, C3, M1, M3, m2, m3, m4, m6, and all four tinies are cleanly resolved. The fresh-session requirement (C1) is stated firmly in three places (sub-agent dispatch contract, NEXT-STEP banner, memory-note update line item) and a future agent reading this design will not Agent-dispatch from the parent session. The `meta.json` write-once contradiction (C2) is gone; `output_sha256` is excised from the schema and from the field-additions list. The `_config.yaml` snapshot has its SHA in `meta.json.config.config_yaml_sha256` and its purpose is clear. Archive-by-default file layout, opt-out flag, and disk-cost analysis are correct.

Three vestigial-drift items survive the M2 "removed entirely" claim and must be cleaned up before this design ships. They are mechanical (text-only in design.md), but they directly contradict the design's own resolution.

### M2-followup. Failure-modes table still has a "drift check" row

**Where:** design.md L478 ("JSON edited by hand after the run | compare drift check | Warn in CLI + insert 'Drift' row in the report").

The "Drift detection: removed" section at L300-310 explicitly drops this. The failure-modes row contradicts that and reintroduces the worst-of-both warning behavior M2 was meant to kill. **Fix:** delete the row outright (git diff is the audit surface) or, if a row must remain, replace with "JSON edited by hand after the run | git diff at PR review | reviewer decides whether to keep the edit; no CLI machinery."

### m1-followup. Failure-modes table still says "skip the chapter with a warning"

**Where:** design.md L474 ("Per-chapter JSON malformed | compare phase via `_parse_response_json` | Skip the chapter with a warning recorded in the report; re-paste that chapter's prompt manually").

Contradicts the m1 closure (L182-183 + L308: hard-fail on malformed). **Fix:** change the recovery cell to "Hard-fail compare; banner names the chapter; user re-pastes that chapter's prompt and re-runs compare."

### m5/M2-followup. Test plan still references `current/` and `meta.json.output_sha256`

**Where:** design.md L491-492, L502.

L491-492: "`current/` contains all expected files... `meta.json` template SHA-256s match the actual file hashes in `current/`." Should be `out/`.

L502: "SHA-256 drift detection: when the on-disk hash differs from `meta.json.output_sha256`, drift is recorded." `output_sha256` no longer exists; this entire test bullet must be deleted.

**Fix:** rename `current/` to `out/` in both bullets; delete the SHA-256-drift test bullet from `test_sections_via_sidecar.py`.

### M4-followup. Sub-agent file-writes rule contradicts the model-self-report artifact

**Where:** design.md L287 ("No file writes outside the chapter's own directory. Each sub-agent writes ONE file: its `_llm_section_tree.json`.").

The M4 resolution (L298) and meta.json schema (L344) both require each sub-agent to also write `_model_self_report.txt`. The dispatch-contract rule says exactly one file. **Fix:** rewrite rule 4 as "Each sub-agent writes exactly two files in its chapter directory: `_llm_section_tree.json` and `_model_self_report.txt`. No other files anywhere."

### Notes (not blocking)

- The orchestrator-template-must-instruct-self-report obligation lives only in prose (L298, "ask the orchestrator to ALSO write..."). Worth a one-line addition under "Sub-agent dispatch contract" stating that `orchestrator.md` MUST instruct sub-agents to emit `_model_self_report.txt` -- belt and braces, since templates are the audit surface.
- C3 closure sentence is in the right place and reads cleanly. No issue.

Once the four mechanical fixes above land, this is **ship**. No further architectural review needed.

### Revision 3 followup verification

**Verdict: ship.** All four vestigial-text findings are closed.

- **M2-followup (failure-modes drift row).** [design.md L479](design.md#L479) now reads "JSON edited by hand after the run | git diff at PR review | No bespoke tooling; surfaces in `git diff` like every other file change. (Drift detection dropped per reviewer M2.)" The "Warn in CLI + insert Drift row" recovery is gone and the row is consistent with the L300-310 resolution.
- **m1-followup (malformed JSON skip).** [design.md L475](design.md#L475) now reads "Hard-fail; user re-pastes that chapter's prompt manually. (No skip-with-warning per reviewer m1.)" Aligned with L308.
- **m5/M2-followup (test plan stale paths).** [design.md L493-494](design.md#L493-L494) reference `out/` (not `current/`); the SHA-256 drift bullet is deleted from `test_sections_via_sidecar.py` (now L502-506: well-formed parse, malformed hard-fail, missing JSON, missing `_model_self_report.txt`). No `output_sha256` remains in the test plan.
- **M4-followup (dispatch rule 4).** [design.md L287](design.md#L287) now reads "Each sub-agent writes exactly TWO files... `_llm_section_tree.json`... and `_model_self_report.txt`. It MUST NOT modify any other file..." Matches the meta.json schema and M4 resolution.

The non-blocking note about `orchestrator.md` restating the self-report obligation remains optional and does not gate ship.
