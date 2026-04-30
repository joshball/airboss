# Section-extraction prompt -- phak FAA-H-8083-25C chapter 12

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `12`
- Chapter title: `Weather Theory`
- Page range (printed FAA pages): `12-1..12-26`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/12/_chapter_plaintext.txt`
- Expected SHA-256: `42e41a4c07aebb30eb50bbce30656eca4e7fac59b56e547346f930a05c90de7c`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 42e41a4c07aebb30eb50bbce30656eca4e7fac59b56e547346f930a05c90de7c, got <observed>`

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
- L1 Introduction (12-1)
- L1 Atmosphere (12-2)
  - L2 Composition of the Atmosphere (12-2)
  - L2 Atmospheric Circulation (12-3)
  - L2 Atmospheric Pressure (12-3)
- L1 Coriolis Force (12-3)
- L1 Measurement of Atmosphere Pressure (12-4)
- L1 Altitude and Atmospheric Pressure (12-5)
- L1 Altitude and Flight (12-6)
- L1 Altitude and the Human Body (12-6)
- L1 Wind and Currents (12-7)
  - L2 Wind Patterns (12-7)
  - L2 Convective Currents (12-7)
  - L2 Effect of Obstructions on Wind (12-8)
  - L2 Low-Level Wind Shear (12-11)
  - L2 Wind and Pressure Representation on Surface Weather Maps (12-12)
- L1 Atmospheric Stability (12-12)
  - L2 Inversion (12-13)
  - L2 Moisture and Temperature (12-13)
  - L2 Relative Humidity (12-13)
  - L2 Temperature/Dew Point Relationship (12-13)
  - L2 Methods by Which Air Reaches the Saturation Point (12-14)
  - L2 Dew and Frost (12-15)
  - L2 Fog (12-15)
  - L2 Clouds (12-15)
  - L2 Ceiling (12-17)
  - L2 Visibility (12-17)
  - L2 Precipitation (12-17)
- L1 Air Masses (12-17)
- L1 Fronts (12-18)
  - L2 Warm Front (12-18)
  - L2 Flight Toward an Approaching Warm Front (12-19)
  - L2 Cold Front (12-20)
  - L2 Fast-Moving Cold Front (12-20)
  - L2 Flight Toward an Approaching Cold Front (12-20)
  - L2 Comparison of Cold and Warm Fronts (12-20)
  - L2 Wind Shifts (12-21)
  - L2 Stationary Front (12-21)
  - L2 Occluded Front (12-21)
  - L2 Thunderstorms (12-22)
  - L2 Hazards (12-23)
- L1 Squall Line (12-23)
- L1 Tornadoes (12-23)
- L1 Turbulence (12-24)
- L1 Icing (12-24)
- L1 Hail (12-25)
- L1 Ceiling and Visibility (12-25)
- L1 Effect on Altimeters (12-25)
- L1 Lightning (12-25)
- L1 Engine Water Ingestion (12-25)
- L1 Chapter Summary (12-25)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/12/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/12/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/12/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/12/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/12/_chapter_plaintext.txt` (or equivalent) and compare to
   `42e41a4c07aebb30eb50bbce30656eca4e7fac59b56e547346f930a05c90de7c`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/12/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `12-1..12-26`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/12/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/12/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
