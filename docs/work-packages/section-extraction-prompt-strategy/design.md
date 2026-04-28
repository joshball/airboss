---
title: 'Design: Section Extraction via Prompt Strategy'
product: cross-cutting
feature: section-extraction-prompt-strategy
type: design
status: unread
review_status: pending
date: 2026-04-28
machine: airboss
branch: main
authors: agent (drafting), Joshua (reviewing)
supersedes: tools/handbook-ingest/ingest/sections_via_llm.py (delete), tools/handbook-ingest/ingest/prompts/run-llm-comparison.md (delete)
review_log:
  - 2026-04-28 reviewer agent (general-purpose) -- ship-with-changes-listed; surfaced issues 1, 4, 5, 6, 7. All addressed in revision 2.
  - 2026-04-28 reviewer agent (Opus 4.7, see review.md) -- ship-with-changes; surfaced C1, C2, C3, M1-M4, m1-m6, four tinies. All addressed in revision 3 (see "Closure of revision-3 review items").
---

# Design: Section Extraction via Prompt Strategy

## TL;DR

Replace the API-driven LLM section-extraction path (`sections_via_llm.py` + the `run-llm-comparison.md` runner) with a no-key, prompt-emitting path. The CLI dumps per-chapter PDF plaintext, generates a self-contained prompt set into a per-run output directory under source control, and stops with a clear "paste this orchestrator prompt into Claude Code" banner. The user pastes once, sub-agents fan out one-per-chapter, each writes its JSON next to the sidecar. A second CLI invocation reads the JSON files and renders the compare report. No API key, no model pin, no `[llm]` extra dependency.

## Goals

1. **Zero API surface.** No `ANTHROPIC_API_KEY`, no anthropic SDK, no model pin to maintain. Section extraction runs via a fresh Claude Code session (or any equivalent agent harness) using whatever model that session is configured with.
2. **Per-chapter agent isolation.** Each chapter's prompt is self-contained so a sub-agent can pick it up alone, read its sidecar, write its JSON, and finish. Smaller context per agent → sharper extraction; failures are isolated; parallelism shrinks wall-clock to ~1 chapter's worth of latency.
3. **Audit trail per run.** Every input that influenced an output is committed alongside the output: chapter plaintext sidecars, the orchestrator prompt, the parameters prompt, the JSON contract, all per-chapter prompts. A reviewer at PR time can read every byte that shaped the run.
4. **Templates evolve, runs are frozen.** Tool-side templates are versioned in git history; per-run snapshots are immutable in `prompts-out/<doc>/<edition>/<run-id>/`. Re-running a year later from a frozen run dir produces the same prompts even if templates have moved on.
5. **Verbose, narrating CLI.** Every step of every run prints WHAT it's doing, WHY, and HOW. The user is never confused about which phase they're in or what file is being produced.

## Non-goals

- API-path determinism. Once we drop the API caller, we accept that two re-runs against different model versions may diverge. The git diff on `_llm_section_tree.json` files at PR review time surfaces drift; the user decides whether the drift is acceptable.
- Cross-handbook unification. Each handbook keeps its own config + outline strategy. The prompt strategy is shared (one set of templates, one CLI flow); the inputs (chapter list, plaintext) are per-handbook.
- Anything outside section-tree extraction. Figures, tables, outline detection, manifest generation are unchanged.

## Constraints

- **`handbooks/<doc>/<edition>/` stays the artifact home for chapter content.** Chapter dirs already hold `index.md`, `<NN>-*.md`, figures, tables. The chapter-plaintext sidecar (`_chapter_plaintext.txt`) and section-tree JSON (`_llm_section_tree.json`) live next to those, named with a leading underscore so the seed/normalize pass ignores them.
- **`prompts-out/` is committed, not gitignored.** It's audit material.
- **Templates are pure substitution.** Per-chapter prompts derive from a chapter template by substituting title/sidecar-path/page-range; orchestrator from an orchestrator template; parameters/contract are copied verbatim. No conditional logic per handbook.
- **CLI verbosity is opinionated.** Every section header in the output explains WHAT/WHY/HOW. No silent steps.
- **The `sections.extract_sections` PyMuPDF path is the source of truth for plaintext.** The sidecar is the on-disk form of `SectionBody.body_md` for chapter rows.

## Architecture

### Tool-side templates (versioned in git history)

```text
tools/handbook-ingest/ingest/prompts/
  section_tree.md                   # JSON contract (existing; stays here)
  section-extraction/
    parameters.md                   # general agent rules: sub-agent type, file rules, error handling, JSON-only output
    orchestrator.md                 # template with placeholders for chapter-prompt list + compare invocation
    chapter.md                      # per-chapter template (placeholder set below)
    run_readme.md                   # README skeleton for each run dir
```

These five files are the *editable surface*. They evolve over time and are reviewed in normal PRs. They are NOT the audit artifact for any specific run.

**`chapter.md` placeholder set (REVISED per reviewer m6):**

| Placeholder         | Source                                                                       | Purpose                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `{document_slug}`   | YAML config                                                                  | Handbook context (e.g. `phak`).                                                                             |
| `{edition}`         | YAML config or `--edition` flag                                              | Handbook edition (e.g. `FAA-H-8083-25C`).                                                                   |
| `{title}`           | `OutlineNode.title`                                                          | Chapter title for the prompt header.                                                                        |
| `{chapter_ordinal}` | `OutlineNode.ordinal`                                                        | Chapter number for the agent's status line.                                                                 |
| `{page_range}`      | derived from `OutlineNode` + `extract_sections`                              | Printed FAA page range (e.g. `1-1..1-24`) for citation context.                                             |
| `{sidecar_path}`    | `handbooks/<doc>/<ed>/<NN>/_chapter_plaintext.txt`                           | Repo-relative path the sub-agent reads.                                                                     |
| `{sidecar_sha256}`  | SHA-256 of the sidecar at emit time                                          | Sub-agent verifies BEFORE reading; fails loud on mismatch (defends against half-written or stale sidecars). |
| `{output_path}`     | `handbooks/<doc>/<ed>/<NN>/_llm_section_tree.json`                           | Where the sub-agent writes its JSON.                                                                        |
| `{contract_path}`   | `tools/handbook-ingest/prompts-out/<doc>/<ed>/out/_section_tree_contract.md` | The JSON contract; sub-agent reads it.                                                                      |

`{document_slug}` and `{edition}` give the agent handbook context for tie-breakers. `{contract_path}` makes each chapter prompt self-contained — the sub-agent doesn't depend on the orchestrator having loaded the contract first. `{sidecar_sha256}` is the partial-write defense.

**`chapter.md` is "pure substitution" only.** Reviewer #3 (named trigger): if a future handbook needs branching logic in `chapter.md` itself (rather than just additional placeholders), that's the trigger to introduce `chapter-overrides.md` with a per-handbook delta. Forbidden today.

### Per-run output directory

Two-part layout: a mutable `out/` for the most recent run (the paste target) and an `archive/<run-id>/` snapshot of every run for audit. Reviewer issue m5: `current/` and `latest/` both read like pointers. Renamed to `out/` (it's the run's output, plain). Reviewer's archive-by-default request: applied. **Final scheme:**

```text
tools/handbook-ingest/prompts-out/<doc>/<edition>/
  out/                              # mutable; overwritten in place on every run; the paste target
    README.md                       # auto-generated; what this run is, when, why, how to replay
    _run.md                         # the orchestrator prompt — the ONE thing the user pastes
    _parameters.md                  # snapshot of parameters.md at run time
    _section_tree_contract.md       # snapshot of section_tree.md at run time
    _config.yaml                    # snapshot of the handbook YAML at run time (reviewer m3)
    meta.json                       # run metadata: timestamp, repo SHA, template SHA-256s, sidecar paths
    01-introduction-to-flying.md
    02-aeronautical-decision-making.md
    …
    17-aeromedical-factors.md
  archive/                          # always written; one frozen snapshot per run
    20260428-1432/                  # YYYYMMDD-HHMM UTC, append -N for collisions where N >= 2
      … same files as out/ at run time …
```

**Why mutable `out/` AND archive-by-default:** the user wants archive-by-default. So every run produces both. `out/` is the *paste target* — a stable path the user can reference without picking a run-id. `archive/<run-id>/` is the *audit snapshot* — a frozen copy of what `out/` looked like at run time. Re-running produces a clean two-part diff: the new `out/` (overwriting the old) plus a new `archive/<run-id>/` directory. No symlinks anywhere; cross-platform safe.

**Run-id format:** `YYYYMMDD-HHMM` UTC, e.g. `20260428-1432`. Sortable. On collision (rare, but possible if two runs land in the same minute), append `-N` where `N >= 2`.

**Disk cost:** ~100KB per run × maybe 5 runs/year × 3 handbooks = ~1.5MB/year of audit snapshots. Trivial.

**Opt out:** `--no-archive` flag skips writing `archive/<run-id>/` for the rare case where the user genuinely doesn't want a snapshot (e.g. throwaway debugging runs). Default behavior always archives.

### Chapter-plaintext sidecars (committed)

```text
handbooks/<doc>/<edition>/<NN>/
  _chapter_plaintext.txt            # PyMuPDF-extracted body, capped at chapter_text_max_chars
  _llm_section_tree.json            # written by the agent that processes the chapter prompt
  index.md                          # (existing)
  <NN>-*.md                         # (existing)
```

**Why these two files live with the chapter, not under `prompts-out/`:** they're chapter-scoped artifacts (sidecar bound to chapter content; JSON bound to chapter content). Putting them under `prompts-out/<run-id>/` would force the agent prompts to embed run-ids in paths, which means re-runs invalidate everything and the `manifest.json` consumer has to know the latest run-id. By keeping them at chapter scope, every consumer (manifest, compare pipeline, future strategies) reads from a stable location.

**Trade-off accepted:** the JSON file is overwritten on re-run. **Audit story (REVISED per reviewer C2/M2):** the JSON is committed to git; `git diff` is the time machine. `meta.json` does NOT record `output_sha256` (no mutable post-emission state, no drift detection machinery). If the user wants to audit "what produced this JSON commit?", they look at `prompts-out/<doc>/<edition>/out/` at the same git revision, which is frozen by virtue of git itself. Hand-edits to the JSON are visible in `git diff` at PR review time, no special tooling needed.

**Byte-source clarification (reviewer C3):** `_chapter_plaintext.txt` is produced by `sections.extract_sections` (PyMuPDF body) — the same function that historically fed `sections_via_llm.py` via `SectionBody.body_md`. The deleted `run-llm-comparison.md` runner instructed agents to *concatenate index.md + per-section markdowns*, which is a different byte source; that runner's claim of byte-comparability with the API path was wrong. The new sidecar path closes that gap by routing both flows through `extract_sections`. There are no existing `_llm_section_tree.json` files in any handbook (this PR produces the first set), so no migration consideration.

### CLI surface

```text
bun run sources extract handbooks <doc> [--edition <e>] [options]
```

Flags:

- `--strategy {toc,prompt,compare}` — overrides YAML `section_strategy`. **Default = the YAML value** (typically `toc` for shipped handbooks). The CLI never silently switches strategy; if the YAML says `toc`, that's what runs.
- `--no-archive` — skip writing `archive/<run-id>/` for the current `--strategy prompt` invocation. Default is to archive every run.
- `--force` — re-extract plaintext sidecars even if hashes match; re-emit prompt set even if `out/` is up to date.
- All existing flags (`--edition`, `--chapter`, `--dry-run`) preserved.

**`--strategy prompt --dry-run` semantics (reviewer m2):** dry-run with prompt strategy is a hard error. The prompt strategy's whole purpose is to write files; "validate without writing" doesn't apply. The CLI errors with `--dry-run is not supported with --strategy prompt; use --strategy toc --dry-run for outline validation`.

**Sidecar policy:**

- `--strategy toc`: does NOT write sidecars. Avoids polluting handbooks that don't use the prompt path.
- `--strategy prompt`: writes sidecars (the agent reads them).
- `--strategy compare` (REVISED per reviewer M3): does NOT re-extract sidecars. Reads the existing committed `_chapter_plaintext.txt`. PDF-drift is detected by the existing `fetch_result` checksum check — if the source PDF changed since the prompt run, the run is invalid and the user re-runs prompt. Compare does not silently mutate committed sidecar bytes.

Default behavior of `bun run sources extract handbooks phak` (no `--strategy` override; YAML says `toc`):

```text
1. Fetch / cache PDF.
2. Run outline + extract_sections (in-memory bodies).
3. Resolve strategy (toc, from YAML).
4. Run extract_via_toc.
5. Continue into seed + manifest paths (unchanged from today).
```

Default behavior of `bun run sources extract handbooks phak --strategy prompt`:

```text
1. Fetch / cache PDF.
2. Run outline + extract_sections.
3. Write _chapter_plaintext.txt per chapter (sidecar pass).
4. Render prompts-out/<doc>/<edition>/out/:
     a. Copy parameters.md, section_tree.md into out/.
     b. Snapshot handbook YAML to out/_config.yaml.
     c. Render orchestrator.md → _run.md.
     d. Render chapter.md → N per-chapter prompts.
     e. Write meta.json + README.md.
5. Unless --no-archive: copy out/ → archive/<run-id>/.
6. Print NEXT-STEP banner with the orchestrator path.
7. EXIT (do not write manifest, do not seed sections).
```

Default behavior of `bun run sources extract handbooks phak --strategy compare`:

```text
1. Fetch / cache PDF (verifies source.pdf SHA matches the cache).
2. Read meta.json from prompts-out/<doc>/<edition>/out/.
3. If meta.json.source_sha256 != fetch_result.sha256, fail loudly:
     "PDF changed since the last prompt run. Re-run with --strategy prompt."
4. Read each chapter's _llm_section_tree.json:
     a. Fail loudly if any JSON is missing OR malformed (reviewer m1).
     b. Banner names the failing chapter and points at out/_run.md.
5. Run extract_via_toc against the chapter list from meta.json.
6. Run compare_strategies; render markdown report.
7. EXIT (compare is informational; does not seed manifest, does not mutate sidecars).
```

**No drift detection machinery (REVISED per reviewer M2).** Hand-edits to `_llm_section_tree.json` are visible in `git diff` at PR review time, the same way every other file change is reviewed. Adding bespoke drift tooling is plumbing for a problem git already solves.

**No implicit "did the JSONs land yet?" branch.** The user picks the verb. `prompt` always emits and stops; `compare` always reads.

### Verbose narration

Every CLI run begins with a banner showing the strategy + reason. Each phase has a 3-line header (WHAT, WHY, HOW) before its work, then per-action progress lines. Example for `--strategy prompt`:

```text
handbook-ingest: phak edition FAA-H-8083-25C
  strategy: prompt (no API calls; emits prompt set for paste-into-Claude flow)

PHASE 1/4 — fetch source PDF
  WHAT: download / read-from-cache the source PDF for phak FAA-H-8083-25C.
  WHY:  every downstream step (plaintext, prompts, JSON) is anchored to
        the bytes of this specific PDF. Cache + checksum guarantees
        re-runs use the same source.
  HOW:  read $AIRBOSS_HANDBOOK_CACHE/handbooks/phak/FAA-H-8083-25C/source.pdf;
        download from source_url if missing or sha256 mismatch.
  -> source.pdf 32881212 bytes sha256 247929cace0a... (cached)

PHASE 2/4 — extract chapter plaintext sidecars
  WHAT: produce _chapter_plaintext.txt for each chapter directory.
  WHY:  the agent that runs the section-extraction prompt reads the
        sidecar verbatim. Same bytes for every re-run regardless of
        which agent / model is processing the prompt.
  HOW:  PyMuPDF page-by-page, chrome stripping, paragraph normalization,
        truncated to chapter_text_max_chars (60000 for phak) from the END
        so the chapter head is always intact.
  -> handbooks/phak/FAA-H-8083-25C/01/_chapter_plaintext.txt (24180 chars)
  -> handbooks/phak/FAA-H-8083-25C/02/_chapter_plaintext.txt (37412 chars)
  ... (15 more)
  17 sidecars written.

PHASE 3/4 — emit prompt set
  WHAT: render the orchestrator + per-chapter prompts + parameters/contract
        snapshots into the run directory.
  WHY:  every input that shapes the agent's output is committed alongside
        the output. A reviewer can read the exact bytes that produced
        any committed _llm_section_tree.json file.
  HOW:  substitute placeholders in tools/.../section-extraction/{chapter,orchestrator}.md;
        copy parameters.md and section_tree.md verbatim into the run dir.
  -> tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_run.md
  -> tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_parameters.md
  -> tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md
  -> tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_config.yaml
  -> tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/01-introduction-to-flying.md
  ... (16 more)
  -> tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/meta.json
  -> tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/README.md
  -> archived to tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/archive/20260428-1432/
  21 files written + archived.

PHASE 4/4 -- handoff
  This run does NOT seed manifest rows; the prompt strategy is two-step.
  Section JSON files do not yet exist. Render the compare report only
  after the agent has populated them.

  NEXT STEP (manual; reviewer C1):
    1. Open a FRESH Claude Code session in this repo (NOT this session;
       the orchestrator is meant for a separate paste-driven session so
       the no-key story holds and parent context isn't burned).
    2. Paste the contents of:
         tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_run.md
    3. Wait for the 17 sub-agents to finish writing
         handbooks/phak/FAA-H-8083-25C/<NN>/_llm_section_tree.json
       and
         handbooks/phak/FAA-H-8083-25C/<NN>/_model_self_report.txt
    4. Then run:
         bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy compare

done. (run-id: 20260428-1432; archived)
```

For `--strategy compare`, similar 3-section headers (WHAT/WHY/HOW) per phase: PHASE 1 fetch + PDF-drift check, PHASE 2 read JSON + model-self-report sidecars, PHASE 3 run TOC strategy, PHASE 4 diff + render report.

**Header structure clarification (reviewer tiny):** "3-section header" means three labeled sections (WHAT, WHY, HOW). Each section is one or two lines. Total visual height per phase header is 4-7 lines depending on prose length, not literally three lines.

### Template authoring

**One set of templates serves all handbooks.** No `parameters-phak.md` / `parameters-afh.md` split. Two reasons:

1. The agent rules (sub-agent type, file rules, JSON-only output, error handling) are about *the prompt-execution discipline*, not about the handbook content. They're the same whether you're processing PHAK or AFH or AvWX.
2. The only per-handbook variation is the chapter inputs (title, sidecar path, page range, ordinal). Those are placeholders in `chapter.md`, substituted per chapter.

If a future handbook needs special handling — say, an FAA pub with charts that aren't standard "headings in prose" — the right answer is **additive**: a new optional placeholder in `chapter.md` that handbooks opt into via their YAML config. Not a fork of `parameters.md`. We accept "additive only" as a design rule.

**Named trigger for forking** (per reviewer #3): if `parameters.md` ever needs a per-handbook conditional (an agent rule that varies by handbook content, not just chapter content), introduce `parameters-overrides.md` with a per-handbook delta block. This is forbidden for `chapter.md` (always pure substitution) but permitted for `parameters.md` once. If we hit this trigger, log it in this design doc's review_log so the next iteration sees the precedent.

### Sub-agent dispatch contract

**Where this runs (REVISED per reviewer C1).** The orchestrator prompt is meant to be pasted into a **fresh, separate Claude Code session opened by the user** — not into the airboss session that emitted the prompt set. Agents in the emitting session must NOT dispatch this prompt themselves via the Agent tool; doing so burns the emitting session's model calls and defeats the no-key story (the standing memory note `feedback_llm_comparison_runner_is_interactive.md` documents a prior incident where this happened). The fresh session is the user's own paste-driven session; that session is the one that fans out sub-agents.

The orchestrator prompt template MUST specify, in its rendered output:

1. **The sub-agent type to use.** `general-purpose`. Rationale: the prompt is fully self-contained; it doesn't need a specialized agent.
2. **Parallel dispatch in a single message.** The orchestrator instructs the (fresh-session) parent: "send all N sub-agent invocations in a single tool-call block to maximize parallelism." Sequential dispatch is explicitly forbidden because it (a) negates the per-chapter speedup and (b) burns parent context per dispatch round.
3. **Sub-agent return contract.** Each sub-agent returns a one-line status to the parent: `ok: wrote {N} entries to handbooks/.../{NN}/_llm_section_tree.json (model: {self-reported})` on success, or `error: {reason}` on failure. The parent collates these into a final summary report (which chapters succeeded, which failed, total entries written, which models the sub-agents self-reported).
4. **No file writes outside the chapter's own directory.** Each sub-agent writes exactly TWO files inside `handbooks/<doc>/<edition>/<NN>/`: `_llm_section_tree.json` (the section tree) and `_model_self_report.txt` (a one-line file containing the model the sub-agent self-reports running on, e.g. `claude-opus-4-7`). It MUST NOT modify any other file (no tweaking the sidecar, no writing under `prompts-out/`, no writing in any other chapter's directory).
5. **No retries inside a sub-agent.** If a sub-agent fails (malformed model output, sidecar unreadable, sidecar SHA-256 mismatch), it returns the error. The parent does not retry; the user does, by re-pasting the failing chapter's prompt manually.

**Single source of truth (reviewer M1).** These rules live in `parameters.md` and only there. `orchestrator.md` does NOT restate them; it links to `_parameters.md` ("read `_parameters.md` in this directory before dispatching"). Restating in two places guarantees drift; one source per rule.

**Memory-note update (reviewer C1):** as part of this PR, the standing memory `feedback_llm_comparison_runner_is_interactive.md` is updated to cite this design as the canonical reference and to explicitly distinguish "agents in the *emitting* session must not dispatch" (still forbidden) from "agents in the *fresh paste-driven* session do dispatch via Agent tool" (this design's flow).

### Self-reported model in `meta.json` (reviewer M4)

Each sub-agent's status line includes its model self-report (e.g. `model: claude-opus-4-7`). The orchestrator's final summary lists `chapters[].produced_by_model_self_reported` per chapter. The user pastes that summary back into the airboss session OR runs `--strategy compare` which reads it from… nowhere durable, since the orchestrator's summary lives in the fresh session's transcript.

Resolution: ask the orchestrator to ALSO write the self-reported model into a one-line `_model_self_report.txt` next to each chapter's `_llm_section_tree.json`. Compare reads these and includes them in the report. Cheap, gives reviewers the "what model wrote this?" signal without forcing meta.json into mutability.

### Drift detection: removed (REVISED per reviewer C2 + M2)

The original design had compare hash each `_llm_section_tree.json` and compare against `meta.json.output_sha256`, mutating `meta.json` post-emission. The reviewer correctly flagged that this makes `meta.json` simultaneously immutable audit and mutable state, which collapses the audit story.

**Resolution: drop drift detection entirely.**

- `meta.json` is fully write-once. No `output_sha256` field. No mutation post-emission.
- The JSON files are committed to git. Hand-edits show in `git diff` at PR review time. That's the same review path every other file change uses; no new tooling needed.
- Compare reads the JSON files, runs the comparison, renders the report. If a JSON is missing → fail loud. If malformed → fail loud (no asymmetric "skip with warning" — see reviewer m1).

This is simpler, more honest, and aligns with CLAUDE.md "zero tolerance for known issues" (the warning-row middle ground was the worst of both options).

### `meta.json` schema (write-once)

```json
{
  "run_id": "20260428-1432",
  "generated_at_utc": "2026-04-28T14:32:18Z",
  "document_slug": "phak",
  "edition": "FAA-H-8083-25C",
  "repo_sha": "5b75e966...",
  "source_pdf_sha256": "247929cace0a...",
  "templates": {
    "parameters_md_sha256": "ab12...",
    "section_tree_md_sha256": "0f0e...",
    "orchestrator_md_sha256": "cd34...",
    "chapter_md_sha256": "ef56...",
    "run_readme_md_sha256": "9988..."
  },
  "config": {
    "chapter_text_max_chars": 60000,
    "section_strategy": "prompt",
    "config_yaml_sha256": "1122..."
  },
  "chapters": [
    {
      "ordinal": 1,
      "code": "1",
      "title": "Introduction To Flying",
      "page_range": "1-1..1-24",
      "sidecar_path": "handbooks/phak/FAA-H-8083-25C/01/_chapter_plaintext.txt",
      "sidecar_sha256": "12ab...",
      "sidecar_chars": 24180,
      "output_path": "handbooks/phak/FAA-H-8083-25C/01/_llm_section_tree.json",
      "model_self_report_path": "handbooks/phak/FAA-H-8083-25C/01/_model_self_report.txt",
      "prompt_path": "tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/01-introduction-to-flying.md",
      "prompt_sha256": "78cd..."
    }
  ]
}
```

`meta.json` is the authoritative replay record. Every field is write-once; nothing mutates after emission. A reviewer can checksum each input and prompt against `meta.json` to confirm the committed run is internally consistent.

**Notable additions** vs the original schema:

- `source_pdf_sha256` — guards compare against PDF drift (reviewer M3).
- `templates.run_readme_md_sha256` — the README template is part of the audit surface too.
- `config.config_yaml_sha256` — full YAML snapshot's hash (reviewer m3).
- `chapters[].model_self_report_path` — points at the per-chapter `_model_self_report.txt` written by the sub-agent (reviewer M4).
- `chapters[].output_sha256` and `output_sha256_observed_at` — REMOVED (reviewer C2).

### `README.md` schema (auto-generated per run)

Concise, human-readable, ~50 lines. Sections:

1. **What this run is** — handbook, edition, run-id, generated-at, repo SHA.
2. **What's in this directory** — file-by-file what each prompt is for.
3. **How this was generated** — the CLI command that produced it.
4. **How to replay** — the paste-target file (`_run.md`), the follow-up CLI command (`--strategy compare`).
5. **Templates as of this run** — the template SHA-256s.

A static template file at `tools/handbook-ingest/ingest/prompts/section-extraction/run_readme.md` holds the README skeleton; the emitter substitutes the run-specific values.

## Code changes

### Files deleted

- `tools/handbook-ingest/ingest/sections_via_llm.py`
- `tools/handbook-ingest/tests/test_sections_via_llm.py`
- `tools/handbook-ingest/ingest/prompts/run-llm-comparison.md`
- `[project.optional-dependencies] llm = ["anthropic..."]` block in `pyproject.toml`
- All references to `ANTHROPIC_API_KEY`, `LlmKeyMissingError`, `MODEL`, `extract_via_llm` in `cli.py`

### Files added

- `tools/handbook-ingest/ingest/chapter_plaintext.py` — sidecar writer.
- `tools/handbook-ingest/ingest/prompt_emit.py` — generates the run dir contents.
- `tools/handbook-ingest/ingest/sections_via_sidecar.py` — reads `_llm_section_tree.json` files into `SectionTreeNode`s.
- `tools/handbook-ingest/ingest/prompts/section-extraction/parameters.md`
- `tools/handbook-ingest/ingest/prompts/section-extraction/orchestrator.md`
- `tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md`
- `tools/handbook-ingest/ingest/prompts/section-extraction/run_readme.md`
- `tools/handbook-ingest/tests/test_chapter_plaintext.py`
- `tools/handbook-ingest/tests/test_prompt_emit.py`
- `tools/handbook-ingest/tests/test_sections_via_sidecar.py`
- `docs/agents/section-extraction-prompt-strategy.md` -- the user-facing pattern doc. Scope vs this design (reviewer tiny): this `design.md` captures *why* the architecture is shaped the way it is and survives in `docs/work-packages/.archive/` after the work package ships. The pattern doc at `docs/agents/` is the *how-to* for future agents and is the file CLAUDE.md's "Before You Build" links to. Contents: the three-step flow (run prompt strategy -> paste orchestrator into a fresh CC session -> run compare strategy), the run-dir layout, the `meta.json` schema, common failure modes. Short (under 200 lines), opinionated, no architectural justification.

### Files modified

- `tools/handbook-ingest/ingest/cli.py` -- verbose narration, prompt-emit phase, sidecar-fed compare. Default strategy comes from YAML (no CLI default flip).
- `tools/handbook-ingest/ingest/config_loader.py` -- add `SECTION_STRATEGY_PROMPT = "prompt"`; remove `SECTION_STRATEGY_LLM`. Hard error on stale `llm` per below. Remove `SECTION_STRATEGY_PER_CHAPTER`. Rename YAML `llm:` block to `prompt:` (reviewer tiny).
- `tools/handbook-ingest/ingest/sections_compare.py` -- accept nodes from the sidecar reader; docstring update only.
- `tools/handbook-ingest/ingest/config/{phak,afh,avwx}.yaml` -- `section_strategy: toc` stays. Rename `llm:` block to `prompt:`. Remove `per_chapter_section_strategy: {}` field.
- `tools/handbook-ingest/README.md` -- point at the new pattern doc.
- `CLAUDE.md` "Before You Build" section -- add a new bullet "Source ingestion / handbook section extraction" pointing at `docs/agents/section-extraction-prompt-strategy.md` (reviewer tiny).
- `~/.claude/projects/-Users-joshua-src--me-aviation-airboss/memory/feedback_llm_comparison_runner_is_interactive.md` -- update body to cite this design and distinguish emitting-session vs paste-driven-session dispatch (reviewer C1).

### Sidecar write policy (REVISED per reviewer #7-3)

Sidecars are written ONLY for `--strategy prompt` and `--strategy compare`. `--strategy toc` does NOT write `_chapter_plaintext.txt`, even though the bytes are in memory. Reasons:

1. Avoids 17 spurious file writes on every TOC run for handbooks that don't use the prompt path.
2. Keeps the TOC fast path lean.
3. The compare strategy re-extracts the sidecar at run time so it's always fresh; there's no value in stashing one from a TOC-only run.

A future need for "always-fresh sidecars regardless of strategy" can be unlocked with a `--write-plaintext-sidecar` flag, but we don't need it today.

### `per_chapter` strategy: removed entirely (reviewer #7-1)

The current code supports `section_strategy: per_chapter` with `per_chapter_section_strategy: { 1: toc, 12: llm, ... }` overrides. **All three YAML files have empty overrides; the feature is unused.** Delete:

- The `_run_per_chapter` helper in `cli.py`.
- The `SECTION_STRATEGY_PER_CHAPTER` constant.
- The `per_chapter_section_strategy` field from all YAML configs.
- The validation/loader code paths for it.

If we ever genuinely need per-chapter strategy mixing, we re-add it then with a clear use case. Today it's dead weight.

### YAML migration: hard error on stale `section_strategy: llm` (reviewer #7-2)

`config_loader.py` currently accepts `section_strategy: llm`. After this change:

```python
VALID_STRATEGIES = {"toc", "prompt", "compare"}

if raw_strategy not in VALID_STRATEGIES:
    if raw_strategy == "llm":
        raise ConfigError(
            f"{config_path}: section_strategy: llm has been removed. "
            f"Rename to `prompt` (no API key required). "
            f"See docs/agents/section-extraction-prompt-strategy.md."
        )
    raise ConfigError(
        f"{config_path}: unknown section_strategy `{raw_strategy}`. "
        f"Valid: {sorted(VALID_STRATEGIES)}."
    )
```

Loud, specific, points at the doc. No silent fallback.

### `pyproject.toml` cleanup (reviewer #7-5)

Drop the `[project.optional-dependencies] llm = ["anthropic..."]` block. Anyone who had the extra installed runs:

```bash
cd tools/handbook-ingest
uv sync                    # or pip install -e .
```

…to drop `anthropic` from the resolved env. The CLI will surface a clear "no anthropic dep needed" line in its banner on next run, so users notice. Add a one-liner to the user-facing doc.

### Migration: existing `_llm_section_tree.json` files

There are none in PHAK currently (this PR is producing the first set). For AFH/AvWX, the same applies — they all default to `--strategy toc` today. No migration concern.

If a user has an old `_llm_section_tree.json` from the deleted API path, the new sidecar reader handles it identically — same JSON contract, same `_entries_to_nodes` logic ported from `sections_via_llm.py`. Re-running `--strategy compare` against an old JSON file produces the same comparison report.

## Failure modes + handling

| Failure                                                       | Detection                                | Recovery                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Sidecar missing for chapter N                                 | prompt-emit phase                        | Error with sidecar path; suggest `--force` to regenerate sidecars.                                                  |
| `_llm_section_tree.json` missing during compare               | compare phase                            | Hard-fail with chapter ordinal; banner: paste `out/_run.md`.                                                        |
| `_model_self_report.txt` missing during compare               | compare phase                            | Hard-fail with chapter ordinal; banner: paste `out/_run.md`. Sub-agents must write both files.                      |
| Per-chapter JSON malformed                                    | compare phase via `_parse_response_json` | Hard-fail; user re-pastes that chapter's prompt manually. (No skip-with-warning per reviewer m1.)                   |
| Template SHA-256 mismatch between `meta.json` and the run dir | manual audit                             | Re-run with `--force` to regenerate; or restore the missing template from git history.                              |
| Two runs collide in a single minute (archive)                 | archive write                            | Append `-N` for `N >= 2` to the run-id.                                                                             |
| User paste produces wrong-shape JSON                          | compare phase                            | Same as malformed; hard-fail; user re-pastes the chapter prompt.                                                    |
| JSON edited by hand after the run                             | git diff at PR review                    | No bespoke tooling; surfaces in `git diff` like every other file change. (Drift detection dropped per reviewer M2.) |
| PDF bytes changed since prompt run                            | compare phase via `source_pdf_sha256`    | Hard-fail; banner: re-run `--strategy prompt` (the JSONs were produced against stale bytes).                        |
| Stale YAML carries `section_strategy: llm`                    | config load                              | Fail loudly with "rename to `prompt`" message; do NOT silently fall through.                                        |

## Test plan

Unit tests:

- `test_chapter_plaintext.py`:
  - Sidecar contains the expected first/last 200 chars from a known fixture PDF.
  - Truncation drops the tail past `chapter_text_max_chars`.
  - Sidecar NOT written when `--strategy toc`.
  - Sidecar IS written when `--strategy prompt` or `--strategy compare`.
- `test_prompt_emit.py`:
  - `out/` contains all expected files (`_run.md`, `_parameters.md`, `_section_tree_contract.md`, `_config.yaml`, `meta.json`, `README.md`, N per-chapter prompts).
  - `meta.json` template SHA-256s match the actual file hashes in `out/`.
  - `meta.json.config.config_yaml_sha256` matches the SHA-256 of `out/_config.yaml`.
  - `meta.json.source_pdf_sha256` matches the cached `source.pdf`.
  - Re-running overwrites `out/` (not appends), and produces a fresh `archive/<run-id>/` snapshot.
  - `--no-archive` skips the `archive/<run-id>/` write.
  - Two runs in the same minute produce `archive/<run-id>/` and `archive/<run-id>-2/`.
  - Per-chapter prompt contains all nine placeholders' substituted values (title, ordinal, page_range, sidecar_path, sidecar_sha256, output_path, contract_path, document_slug, edition).
  - `_run.md` lists all chapter prompt paths in ordinal order and references `_parameters.md` (does not restate its rules).
- `test_sections_via_sidecar.py`:
  - Well-formed JSON parses to `SectionTreeNode` list with correct `provenance`.
  - Malformed JSON raises a hard error (no skip-with-warning).
  - Missing JSON file raises `SidecarMissingError` with the chapter ordinal.
  - Missing `_model_self_report.txt` raises a similar hard error.
- `test_config_loader.py` (additions):
  - Loading a YAML with `section_strategy: llm` raises `ConfigError` with the rename hint.
  - Loading a YAML with an unknown strategy raises `ConfigError` listing valid options.
  - Loading a YAML with `per_chapter_section_strategy` warns (deprecated, ignored) — OR the field is removed and the YAML schema rejects it. **Decision: remove the field; warn via schema rejection.**

Integration tests (`tests/test_cli_integration.py`):

- **Round-trip prompt → compare** with a tiny fixture PDF (3 chapters, ~5 pages each):
  1. `--strategy prompt --dry-run` exits non-zero with the "dry-run not supported with prompt" message (reviewer m2).
  2. Run `--strategy prompt`. Assert `out/` populated with 3 chapter prompts + scaffolding (`_run.md`, `_parameters.md`, `_section_tree_contract.md`, `_config.yaml`, `meta.json`, `README.md`). Assert sidecars written. Assert `archive/<run-id>/` populated identically (archive-by-default).
  3. Stage 3 fixture `_llm_section_tree.json` files + 3 `_model_self_report.txt` files (pre-computed by hand to match the fixture PDF).
  4. Run `--strategy compare`. Assert PDF SHA-256 verified vs `meta.json.source_pdf_sha256`. Assert report rendered. Assert sidecars NOT mutated by the compare run.
  5. Mutate the cached PDF bytes (simulate drift). Re-run `--strategy compare`. Assert exit code, error message names the SHA mismatch.
- **Archive-by-default**: assert running `--strategy prompt` twice produces two `archive/<run-id>/` snapshots and one `out/` overwritten in place.
- **`--no-archive` opt-out**: assert `--strategy prompt --no-archive` writes `out/` only.
- **Hard-error YAML migration**: a fixture YAML with `section_strategy: llm` produces the rename hint and exits non-zero.
- **Missing JSON during compare**: stage 2 of 3 JSON files; run `--strategy compare`; assert exit code, error message naming the missing chapter, banner pointing at `out/_run.md`.
- **Malformed JSON during compare**: stage 1 invalid JSON; assert hard fail (NOT skip-with-warning, per reviewer m1).

Manual:

- Real PHAK run: `bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy prompt` produces `out/` and `archive/<run-id>/`; paste `out/_run.md` into a fresh Claude Code session; sub-agents fan out and write JSON + model-self-report; `--strategy compare` produces the report; eyeball the agreement table for sanity.

## Open questions (resolved)

1. ~~Symlink portability.~~ Symlinks dropped (revision 2). Cross-platform safe.
2. **Run-dir size.** PHAK's `out/` is ~17 prompt files × ~5KB + 4 scaffolding files ~ 100KB. AFH ~ 200KB. With archive-by-default at 5 runs/year × 3 handbooks ~ 1.5MB/year. Trivial.
3. **Template churn.** Mutable `out/` means each re-run produces a single coherent diff for `out/` plus a new `archive/<run-id>/` directory. Reviewers see exactly what changed.
4. **Compare-mode paths.** Compare reads `handbooks/<doc>/<edition>/<NN>/_llm_section_tree.json` and `_model_self_report.txt`. `meta.json` lives at `prompts-out/<doc>/<edition>/out/meta.json`. No version selection needed.

## Out-of-scope follow-ups (decided per CLAUDE.md "no undecided considerations")

- **Auto-running the orchestrator inside the same CLI invocation.** Wrong shape -- the agent harness is the user's choice; the CLI's job is to hand off, not orchestrate. Decision: **drop**, called out as explicit non-goal.
- **A "verify" subcommand that runs the JSON files through the same shape-check used by `_parse_response_json`.** Redundant -- `--strategy compare` does it during read. Decision: **drop**.
- **A git hook that warns when `parameters.md` changed but no run dir was regenerated.** Premature. We run this rarely. Decision: **defer with a specific trigger** -- open a 5-minute work package if we re-run more than 3x in one quarter.

## Closure of revision-3 review items

| Item                             | Status   | Where addressed                                                                                                        |
| -------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| C1                               | Resolved | "Sub-agent dispatch contract" -- explicit fresh-session paragraph; memory note update listed in Files modified         |
| C2                               | Resolved | "Drift detection: removed"; `meta.json` schema is write-once; `output_sha256` field deleted                            |
| C3                               | Resolved | "Byte-source clarification" added to Chapter-plaintext sidecars section                                                |
| M1                               | Resolved | "Sub-agent dispatch contract" -- single source of truth in parameters.md; orchestrator links rather than restates      |
| M2                               | Resolved | Drift detection dropped entirely; `git diff` is the audit surface                                                      |
| M3                               | Resolved | Compare reads existing sidecar; PDF-drift via `source_pdf_sha256` check; no silent sidecar mutation                    |
| M4                               | Resolved | Per-chapter `_model_self_report.txt` written by sub-agents; `meta.json.chapters[].model_self_report_path` points at it |
| m1                               | Resolved | Compare hard-fails on malformed JSON (test-plan exercise added)                                                        |
| m2                               | Resolved | `--strategy prompt --dry-run` is a hard error; test exercises it                                                       |
| m3                               | Resolved | `meta.json.config.config_yaml_sha256` + `out/_config.yaml` snapshot                                                    |
| m4                               | Resolved | "append `-N` for `N >= 2`" wording                                                                                     |
| m5                               | Resolved | `current/` -> `out/` everywhere                                                                                        |
| m6                               | Resolved | `chapter.md` placeholder set table includes all four additions                                                         |
| tiny: 3-line vs 3-section header | Resolved | Header structure clarification paragraph in PHASE-3 example                                                            |
| tiny: pattern-doc scope          | Resolved | Doc-scope sentence in Files-added entry                                                                                |
| tiny: `llm:` rename              | Resolved | Files-modified entry explicitly renames YAML block to `prompt:`                                                        |
| tiny: CLAUDE.md placement        | Resolved | Files-modified entry names a new "Source ingestion" bullet                                                             |
