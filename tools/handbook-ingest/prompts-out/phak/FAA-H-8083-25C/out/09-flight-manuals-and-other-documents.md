# Section-extraction prompt -- phak FAA-H-8083-25C chapter 9

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `9`
- Chapter title: `Flight Manuals and Other Documents`
- Page range (printed FAA pages): `9-1..9-14`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/09/_chapter_plaintext.txt`
- Expected SHA-256: `08c6ce62eeefa02e7fd2c12c9d05d9fd757a4e26a1a5d1594c50c4006d6cffd3`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 08c6ce62eeefa02e7fd2c12c9d05d9fd757a4e26a1a5d1594c50c4006d6cffd3, got <observed>`

The JSON output contract:

- Path: `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md`

Read the contract file before producing your output. It defines the array
shape, the per-entry fields, the ordering rules, and the strict-JSON
discipline. Your output JSON must conform exactly.

## TOC parser checklist

The deterministic Python TOC parser produced this view of THIS chapter's
structure. Use it as a CHECKLIST, not as truth. Verify each entry against
body text; emit headings the parser missed; emit disagreements where the
parser is wrong (per the contract's DISAGREEMENTS section).

```text
- L1 Introduction (9-1)
  - L2 Preliminary Pages (9-2)
  - L2 General (Section 1) (9-2)
  - L2 Limitations (Section 2) (9-2)
  - L2 Airspeed (9-2)
  - L2 Powerplant (9-3)
  - L2 Weight and Loading Distribution (9-3)
  - L2 Flight Limits (9-4)
  - L2 Placards (9-4)
  - L2 Emergency Procedures (Section 3) (9-4)
  - L2 Normal Procedures (Section 4) (9-4)
  - L2 Performance (Section 5) (9-4)
  - L2 Weight and Balance/Equipment List (Section 6) (9-4)
  - L2 Systems Description (Section 7) (9-4)
  - L2 Handling, Service, and Maintenance (Section 8) (9-5)
  - L2 Supplements (Section 9) (9-5)
  - L2 Safety Tips (Section 10) (9-6)
- L1 Aircraft Documents (9-6)
  - L2 Certificate of Aircraft Registration (9-6)
  - L2 Airworthiness Certificate (9-7)
  - L2 Aircraft Maintenance (9-8)
- L1 Aircraft Inspections (9-8)
  - L2 Annual Inspection (9-8)
  - L2 100-Hour Inspection (9-8)
  - L2 Other Inspection Programs (9-9)
  - L2 Altimeter System Inspection (9-9)
  - L2 Transponder Inspection (9-9)
  - L2 Emergency Locator Transmitter (9-9)
  - L2 Preflight Inspections (9-9)
- L1 Minimum Equipment Lists (MEL) and Operations With Inoperative Equipment (9-9)
- L1 Preventive Maintenance (9-10)
  - L2 Maintenance Entries (9-10)
  - L2 Examples of Preventive Maintenance (9-10)
  - L2 Repairs and Alterations (9-12)
  - L2 Special Flight Permits (9-12)
- L1 Airworthiness Directives (ADs) (9-12)
- L1 Aircraft Owner/Operator Responsibilities (9-13)
- L1 Chapter Summary (9-13)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/09/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/09/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/09/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/09/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/09/_chapter_plaintext.txt` (or equivalent) and compare to
   `08c6ce62eeefa02e7fd2c12c9d05d9fd757a4e26a1a5d1594c50c4006d6cffd3`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/09/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `9-1..9-14`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/09/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/09/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
