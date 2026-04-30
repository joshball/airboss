# Section-extraction prompt -- phak FAA-H-8083-25C chapter 14

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `14`
- Chapter title: `Airport Operations`
- Page range (printed FAA pages): `14-1..14-40`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/14/_chapter_plaintext.txt`
- Expected SHA-256: `0b02833883cc28ae1d8aec81b909001c7488a750b9a36cfdc84253a38c8e905f`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 0b02833883cc28ae1d8aec81b909001c7488a750b9a36cfdc84253a38c8e905f, got <observed>`

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
- L1 Introduction (14-1)
- L1 Airport Categories (14-1)
  - L2 Types of Airports (14-2)
  - L2 Towered Airport (14-2)
  - L2 Nontowered Airport (14-2)
- L1 Sources for Airport Data (14-3)
  - L2 Aeronautical Charts (14-3)
  - L2 Chart Supplement U.S. (formerly Airport/Facility Directory) (14-3)
  - L2 Notices to Airmen (NOTAM) (14-4)
  - L2 Automated Terminal Information Service (ATIS) (14-5)
- L1 Airport Markings and Signs (14-5)
  - L2 Runway Markings and Signs (14-5)
  - L2 Relocated Runway Threshold (14-5)
  - L2 Displaced Threshold (14-5)
  - L2 Runway Safety Area (14-6)
  - L2 Runway Safety Area Boundary Sign (14-6)
  - L2 Runway Holding Position Sign (14-6)
  - L2 Runway Holding Position Marking (14-8)
  - L2 Runway Distance Remaining Signs (14-8)
  - L2 Runway Designation Marking (14-8)
  - L2 Land and Hold Short Operations (LAHSO) (14-10)
  - L2 Taxiway Markings and Signs (14-11)
  - L2 Enhanced Taxiway Centerline Markings (14-12)
  - L2 Destination Signs (14-12)
  - L2 Holding Position Signs and Markings for an Instrument Landing System (ILS) Critical Area (14-12)
  - L2 Holding Position Markings for Taxiway/Taxiway Intersections (14-14)
  - L2 Marking and Lighting of Permanently Closed Runways and Taxiways (14-14)
  - L2 Temporarily Closed Runways and Taxiways (14-15)
  - L2 Other Markings (14-15)
  - L2 Airport Signs (14-15)
- L1 Airport Lighting (14-16)
  - L2 Airport Beacon (14-16)
- L1 Approach Light Systems (14-16)
- L1 Visual Glideslope Indicators (14-16)
- L1 Visual Approach Slope Indicator (VASI) (14-16)
- L1 Other Glidepath Systems (14-16)
- L1 Runway Lighting (14-17)
- L1 Runway End Identifier Lights (REIL) (14-17)
- L1 Runway Edge Lights (14-17)
- L1 In-Runway Lighting (14-18)
- L1 Control of Airport Lighting (14-18)
- L1 Taxiway Lights (14-19)
- L1 Omnidirectional (14-19)
- L1 Clearance Bar Lights (14-19)
- L1 Runway Guard Lights (14-19)
- L1 Stop Bar Lights (14-19)
- L1 Obstruction Lights (14-19)
- L1 New Lighting Technologies (14-19)
- L1 Wind Direction Indicators (14-20)
- L1 Traffic Patterns (14-20)
- L1 Example: Key to Traffic Pattern Operations— Single Runway (14-21)
- L1 Example: Key to Traffic Pattern Operations— Parallel Runways (14-21)
- L1 Radio Communications (14-22)
- L1 Radio License (14-22)
- L1 Radio Equipment (14-22)
- L1 Using Proper Radio Procedures (14-22)
- L1 Lost Communication Procedures (14-23)
- L1 Air Traffic Control (ATC) Services (14-24)
- L1 Primary Radar (14-24)
- L1 ATC Radar Beacon System (ATCRBS) (14-24)
- L1 Transponder (14-25)
- L1 Automatic Dependent Surveillance– Broadcast (ADS-B) (14-26)
- L1 Radar Traffic Advisories (14-26)
- L1 Wake Turbulence (14-26)
- L1 Vortex Generation (14-26)
- L1 Terminal Area (14-27)
- L1 En Route (14-27)
- L1 Vortex Behavior (14-27)
- L1 Vortex Avoidance Procedures (14-28)
- L1 Collision Avoidance (14-28)
- L1 Clearing Procedures (14-28)
- L1 Best Practices to See and Avoid Pilot Deviations (PDs) (14-31)
- L1 Runway Incursion Avoidance (14-31)
- L1 Causal Factors of Runway Incursions (14-32)
- L1 Runway Confusion (14-32)
- L1 Causal Factors of Runway Confusion (14-32)
- L1 ATC Instructions (14-33)
- L1 ATC Instructions—“Hold Short” (14-33)
- L1 ATC Instructions—Explicit Runway Crossing (14-34)
- L1 ATC Instructions—“Line Up and Wait” (LUAW) (14-34)
- L1 ATC Instructions—“Runway Shortened” (14-35)
- L1 Pre-Landing, Landing, and After-Landing (14-35)
- L1 Engineered Materials Arresting Systems (EMAS) (14-36)
- L1 Incidents (14-36)
- L1 EMAS Installations and Information (14-37)
- L1 Pilot Considerations (14-37)
- L1 Chapter Summary (14-38)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/14/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/14/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/14/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/14/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/14/_chapter_plaintext.txt` (or equivalent) and compare to
   `0b02833883cc28ae1d8aec81b909001c7488a750b9a36cfdc84253a38c8e905f`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/14/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `14-1..14-40`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/14/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/14/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
