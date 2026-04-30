# Section-extraction prompt -- phak FAA-H-8083-25C chapter 10

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `10`
- Chapter title: `Weight and Balance`
- Page range (printed FAA pages): `10-1..10-12`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/10/_chapter_plaintext.txt`
- Expected SHA-256: `2699c1f70ec06edb402c71d0bda618d4b86e9508b317be2acde436cabe20f301`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 2699c1f70ec06edb402c71d0bda618d4b86e9508b317be2acde436cabe20f301, got <observed>`

The JSON output contract:

- Path: `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md`

Read the contract file before producing your output. It defines the array
shape, the per-entry fields, the ordering rules, and the strict-JSON
discipline. Your output JSON must conform exactly.

## Output files

Write exactly two files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/10/_llm_section_tree.json`
   The JSON section tree (per the contract).
2. `handbooks/phak/FAA-H-8083-25C/10/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/10/_llm_section_tree.json (model: <self-reported>)`
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/10/_chapter_plaintext.txt` (or equivalent) and compare to
   `2699c1f70ec06edb402c71d0bda618d4b86e9508b317be2acde436cabe20f301`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `3`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check, and
   the difficult-cases catalog.
3. Read `handbooks/phak/FAA-H-8083-25C/10/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
5. Run the contract's coverage self-check. The chapter's printed page
   range is `10-1..10-12`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect
   the trailing pages in the sidecar: if they contain only figure
   callouts, table titles, captions, or blank space (no body-text
   headings), the shortfall is acceptable -- proceed to write JSON.
   Otherwise return `error: incomplete coverage -- last anchor at
   <anchor>, expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON to `handbooks/phak/FAA-H-8083-25C/10/_llm_section_tree.json` (one trailing newline; no markdown
   fencing).
7. Write `handbooks/phak/FAA-H-8083-25C/10/_model_self_report.txt`
   containing the model name you self-report running on.
8. Return the success status line with the entry count.

Begin.
