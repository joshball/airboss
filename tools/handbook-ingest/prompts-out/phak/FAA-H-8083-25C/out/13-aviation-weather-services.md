# Section-extraction prompt -- phak FAA-H-8083-25C chapter 13

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `13`
- Chapter title: `Aviation Weather Services`
- Page range (printed FAA pages): `13-1..13-24`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/13/_chapter_plaintext.txt`
- Expected SHA-256: `3ea49ffd7ab0a0fd43ec7e0a231f5818edda38d9aed38d9d4cc1cf263a56d6f5`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 3ea49ffd7ab0a0fd43ec7e0a231f5818edda38d9aed38d9d4cc1cf263a56d6f5, got <observed>`

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
- L1 Introduction (13-1)
- L1 Observations (13-2)
  - L2 Surface Aviation Weather Observations (13-2)
  - L2 Air Route Traffic Control Center (ARTCC) (13-2)
  - L2 Upper Air Observations (13-2)
  - L2 Radar Observations (13-3)
  - L2 Satellite (13-4)
- L1 Service Outlets (13-4)
  - L2 Flight Service Station (FSS) (13-4)
  - L2 Telephone Information Briefing Service (TIBS) (13-4)
  - L2 Hazardous Inflight Weather Advisory Service (HIWAS) (13-4)
  - L2 Transcribed Weather Broadcast (TWEB) (Alaska Only) (13-4)
- L1 Weather Briefings (13-5)
  - L2 Standard Briefing (13-5)
  - L2 Abbreviated Briefing (13-5)
  - L2 Outlook Briefing (13-5)
- L1 Aviation Weather Reports (13-5)
  - L2 Aviation Routine Weather Report (METAR) (13-6)
  - L2 Pilot Weather Reports (PIREPs) (13-8)
  - L2 Aviation Forecasts (13-9)
  - L2 Terminal Aerodrome Forecasts (TAF) (13-9)
  - L2 Area Forecasts (FA) (13-10)
  - L2 Inflight Weather Advisories (13-11)
  - L2 AIRMET (13-11)
  - L2 SIGMET (13-12)
  - L2 Convective Significant Meteorological Information (WST) (13-12)
  - L2 Winds and Temperature Aloft Forecast (FB) (13-13)
- L1 Weather Charts (13-13)
  - L2 Surface Analysis Chart (13-13)
  - L2 Weather Depiction Chart (13-15)
  - L2 Significant Weather Prognostic Charts (13-15)
- L1 ATC Radar Weather Displays (13-16)
  - L2 Weather Avoidance Assistance (13-18)
- L1 Electronic Flight Displays (EFD) /Multi-Function Display (MFD) Weather (13-18)
  - L2 Weather Products Age and Expiration (13-18)
  - L2 What Can Pilots Do? (13-19)
  - L2 NEXRAD Abnormalities (13-21)
  - L2 NEXRAD Limitations (13-21)
  - L2 AIRMET/SIGMET Display (13-21)
  - L2 Graphical METARs (13-21)
  - L2 Data Link Weather (13-21)
  - L2 Data Link Weather Products (13-23)
  - L2 Flight Information Service- Broadcast (FIS-B) (13-23)
  - L2 Pilot Responsibility (13-24)
  - L2 Chapter Summary (13-24)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/13/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/13/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/13/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/13/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/13/_chapter_plaintext.txt` (or equivalent) and compare to
   `3ea49ffd7ab0a0fd43ec7e0a231f5818edda38d9aed38d9d4cc1cf263a56d6f5`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/13/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `13-1..13-24`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/13/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/13/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
