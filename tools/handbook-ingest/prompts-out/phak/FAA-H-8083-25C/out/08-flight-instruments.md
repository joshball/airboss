# Section-extraction prompt -- phak FAA-H-8083-25C chapter 8

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `8`
- Chapter title: `Flight Instruments`
- Page range (printed FAA pages): `8-1..8-28`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/08/_chapter_plaintext.txt`
- Expected SHA-256: `78f1019ce220f7535b9567814b6dd2e4fece44e4528493eae9060f5ed02f7ceb`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 78f1019ce220f7535b9567814b6dd2e4fece44e4528493eae9060f5ed02f7ceb, got <observed>`

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
- L1 Introduction (8-1)
- L1 Pitot-Static Flight Instruments (8-1)
  - L2 Impact Pressure Chamber and Lines (8-2)
  - L2 Static Pressure Chamber and Lines (8-2)
  - L2 Altimeter (8-3)
  - L2 Principle of Operation (8-3)
  - L2 Effect of Nonstandard Pressure and Temperature (8-4)
  - L2 Setting the Altimeter (8-5)
  - L2 Altimeter Operation (8-6)
  - L2 Types of Altitude (8-6)
  - L2 Instrument Check (8-7)
  - L2 Vertical Speed Indicator (VSI) (8-7)
- L1 Principle of Operation (8-7)
- L1 Instrument Check (8-8)
- L1 Airspeed Indicator (ASI) (8-8)
- L1 Airspeed Indicator Markings (8-9)
- L1 Other Airspeed Limitations (8-9)
- L1 Instrument Check (8-10)
- L1 Blockage of the Pitot-Static System (8-10)
- L1 Blocked Pitot System (8-10)
- L1 Blocked Static System (8-11)
- L1 Electronic Flight Display (EFD) (8-12)
- L1 Airspeed Tape (8-12)
- L1 Attitude Indicator (8-13)
- L1 Altimeter (8-13)
- L1 Vertical Speed Indicator (VSI) (8-13)
- L1 Heading Indicator (8-13)
- L1 Turn Indicator (8-13)
- L1 Tachometer (8-13)
- L1 Slip/Skid Indicator (8-13)
- L1 Turn Rate Indicator (8-13)
- L1 Air Data Computer (ADC) (8-14)
- L1 Trend Vectors (8-14)
- L1 Gyroscopic Flight Instruments (8-15)
- L1 Gyroscopic Principles (8-15)
- L1 Rigidity in Space (8-15)
- L1 Precession (8-15)
- L1 Sources of Power (8-16)
- L1 Turn Indicators (8-16)
- L1 Turn-and-Slip Indicator (8-16)
- L1 Turn Coordinator (8-17)
- L1 Inclinometer (8-18)
- L1 Yaw String (8-18)
- L1 Instrument Check (8-18)
- L1 Attitude Indicator (8-18)
- L1 Heading Indicator (8-19)
- L1 Attitude and Heading Reference System (AHRS) (8-20)
- L1 The Flux Gate Compass System (8-20)
- L1 Remote Indicating Compass (8-21)
- L1 Instrument Check (8-22)
- L1 Angle of Attack Indicators (8-22)
- L1 Compass Systems (8-23)
- L1 Magnetic Compass (8-23)
- L1 Magnetic Compass Induced Errors (8-24)
- L1 The Vertical Card Magnetic Compass (8-27)
- L1 Lags or Leads (8-27)
- L1 Eddy Current Damping (8-27)
- L1 Outside Air Temperature (OAT) Gauge (8-28)
- L1 Chapter Summary (8-28)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/08/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/08/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/08/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/08/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/08/_chapter_plaintext.txt` (or equivalent) and compare to
   `78f1019ce220f7535b9567814b6dd2e4fece44e4528493eae9060f5ed02f7ceb`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/08/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `8-1..8-28`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/08/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/08/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
