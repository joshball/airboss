# Section-extraction prompt -- phak FAA-H-8083-25C chapter 3

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `3`
- Chapter title: `Aircraft Construction`
- Page range (printed FAA pages): `3-1..3-16`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/03/_chapter_plaintext.txt`
- Expected SHA-256: `7ceae1edc01735cdd13a39b7e83f6c03934ecd081b3409ee9254297d45746517`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 7ceae1edc01735cdd13a39b7e83f6c03934ecd081b3409ee9254297d45746517, got <observed>`

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
- L1 Introduction (3-1)
- L1 Aircraft Design, Certification, and Airworthiness (3-2)
  - L2 A Note About Light Sport Aircraft (3-2)
- L1 Lift and Basic Aerodynamics (3-2)
- L1 Major Components (3-3)
  - L2 Fuselage (3-3)
  - L2 Wings (3-3)
  - L2 Empennage (3-6)
  - L2 Landing Gear (3-7)
  - L2 The Powerplant (3-7)
- L1 Subcomponents (3-8)
- L1 Types of Aircraft Construction (3-8)
  - L2 Truss Structure (3-8)
  - L2 Semimonocoque (3-9)
  - L2 Composite Construction (3-9)
  - L2 History (3-9)
  - L2 Advantages of Composites (3-10)
  - L2 Disadvantages of Composites (3-10)
  - L2 Fluid Spills on Composites (3-11)
  - L2 Lightning Strike Protection (3-11)
  - L2 The Future of Composites (3-12)
- L1 Instrumentation: Moving into the Future (3-12)
  - L2 Control Instruments (3-13)
  - L2 Navigation Instruments (3-13)
- L1 Global Positioning System (GPS) (3-13)
- L1 Chapter Summary (3-13)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/03/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/03/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/03/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/03/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/03/_chapter_plaintext.txt` (or equivalent) and compare to
   `7ceae1edc01735cdd13a39b7e83f6c03934ecd081b3409ee9254297d45746517`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/03/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `3-1..3-16`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/03/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/03/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
