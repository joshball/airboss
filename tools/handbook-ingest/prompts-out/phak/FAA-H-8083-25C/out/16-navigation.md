# Section-extraction prompt -- phak FAA-H-8083-25C chapter 16

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `16`
- Chapter title: `Navigation`
- Page range (printed FAA pages): `16-1..16-35`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/16/_chapter_plaintext.txt`
- Expected SHA-256: `2bac8bd92b434132f32c64943cd52ec086c3cff15628159a7aa863a578a2fb45`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 2bac8bd92b434132f32c64943cd52ec086c3cff15628159a7aa863a578a2fb45, got <observed>`

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
- L1 Introduction (16-1)
- L1 Aeronautical Charts (16-2)
  - L2 Sectional Charts (16-2)
  - L2 VFR Terminal Area Charts (16-2)
  - L2 World Aeronautical Charts (16-2)
- L1 Latitude and Longitude (Meridians and Parallels) (16-3)
  - L2 Time Zones (16-3)
  - L2 Measurement of Direction (16-5)
  - L2 Variation (16-6)
  - L2 Magnetic Variation (16-7)
  - L2 Magnetic Deviation (16-7)
  - L2 Deviation (16-8)
- L1 Effect of Wind (16-8)
- L1 Basic Calculations (16-11)
  - L2 Converting Minutes to Equivalent Hours (16-11)
  - L2 Time T = D/GS (16-11)
  - L2 Distance D = GS X T (16-11)
  - L2 GS GS = D/T (16-11)
  - L2 Converting Knots to Miles Per Hour (16-11)
  - L2 Fuel Consumption (16-11)
  - L2 Flight Computers (16-12)
  - L2 Plotter (16-12)
- L1 Pilotage (16-12)
- L1 Dead Reckoning (16-13)
  - L2 Wind Triangle or Vector Analysis (16-13)
  - L2 Step 1 (16-14)
  - L2 Step 2 (16-15)
  - L2 Step 3 (16-15)
  - L2 Step 4 (16-15)
- L1 Flight Planning (16-17)
  - L2 Assembling Necessary Material (16-17)
  - L2 Weather Check (16-17)
  - L2 Use of Chart Supplement U.S. (formerly Airport/Facility Directory) (16-17)
  - L2 Airplane Flight Manual or Pilot’s Operating Handbook (AFM/POH) (16-17)
- L1 Charting the Course (16-18)
  - L2 Steps in Charting the Course (16-18)
- L1 Filing a VFR Flight Plan (16-21)
- L1 Ground-Based Navigation (16-22)
  - L2 Very High Frequency (VHF) Omnidirectional Range (VOR) (16-22)
  - L2 Using the VOR (16-23)
  - L2 Course Deviation Indicator (CDI) (16-23)
  - L2 Horizontal Situation Indicator (16-24)
  - L2 Radio Magnetic Indicator (RMI) (16-24)
  - L2 Tracking With VOR (16-25)
  - L2 Tips on Using the VOR (16-26)
  - L2 Time and Distance Check From a Station Using a RMI (16-26)
  - L2 Time and Distance Check From a Station Using a CDI (16-27)
  - L2 Course Intercept (16-27)
  - L2 Rate of Intercept (16-27)
  - L2 Angle of Intercept (16-27)
  - L2 Distance Measuring Equipment (DME) (16-27)
  - L2 VOR/DME RNAV (16-28)
  - L2 Automatic Direction Finder (ADF) (16-29)
  - L2 Global Positioning System (16-30)
  - L2 Selective Availability (16-31)
  - L2 VFR Use of GPS (16-32)
  - L2 RAIM Capability (16-32)
  - L2 Tips for Using GPS for VFR Operations (16-33)
  - L2 VFR Waypoints (16-33)
  - L2 Lost Procedures (16-34)
  - L2 Flight Diversion (16-34)
  - L2 Chapter Summary (16-35)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/16/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/16/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/16/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/16/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/16/_chapter_plaintext.txt` (or equivalent) and compare to
   `2bac8bd92b434132f32c64943cd52ec086c3cff15628159a7aa863a578a2fb45`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/16/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `16-1..16-35`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/16/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/16/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
