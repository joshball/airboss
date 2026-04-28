# Section-extraction prompt -- phak FAA-H-8083-25C chapter 15

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `15`
- Chapter title: `Airspace`
- Page range (printed FAA pages): `15-1..15-12`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/15/_chapter_plaintext.txt`
- Expected SHA-256: `58e9907e4b5dc10912ea75bea76555ac0bfa36598aba86b03239906f13336cf6`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 58e9907e4b5dc10912ea75bea76555ac0bfa36598aba86b03239906f13336cf6, got <observed>`

The JSON output contract:

- Path: `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md`

Read the contract file before producing your output. It defines the array
shape, the per-entry fields, the ordering rules, and the strict-JSON
discipline. Your output JSON must conform exactly.

## Output files

Write exactly two files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/15/_llm_section_tree.json`
   The JSON section tree (per the contract).
2. `handbooks/phak/FAA-H-8083-25C/15/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/15/_llm_section_tree.json (model: <self-reported>)`
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/15/_chapter_plaintext.txt` (or equivalent) and compare to
   `58e9907e4b5dc10912ea75bea76555ac0bfa36598aba86b03239906f13336cf6`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification.
3. Read `handbooks/phak/FAA-H-8083-25C/15/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
5. Write the JSON to `handbooks/phak/FAA-H-8083-25C/15/_llm_section_tree.json` (one trailing newline; no markdown
   fencing).
6. Write `handbooks/phak/FAA-H-8083-25C/15/_model_self_report.txt`
   containing the model name you self-report running on.
7. Return the success status line with the entry count.

Begin.
