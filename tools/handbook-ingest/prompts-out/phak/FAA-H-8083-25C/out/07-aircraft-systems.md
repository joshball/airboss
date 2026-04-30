# Section-extraction prompt -- phak FAA-H-8083-25C chapter 7

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `7`
- Chapter title: `Aircraft Systems`
- Page range (printed FAA pages): `7-1..7-42`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/07/_chapter_plaintext.txt`
- Expected SHA-256: `88565855e02b81034095e396f61e827d73f8537b5ba90ccdee6dbc165e67e406`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 88565855e02b81034095e396f61e827d73f8537b5ba90ccdee6dbc165e67e406, got <observed>`

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
- L1 Introduction (7-1)
- L1 Powerplant (7-1)
  - L2 Reciprocating Engines (7-2)
  - L2 Propeller (7-4)
- L1 Fixed-Pitch Propeller (7-5)
- L1 Adjustable-Pitch Propeller (7-6)
- L1 Propeller Overspeed in Piston Engine Aircraft (7-7)
- L1 Induction Systems (7-7)
- L1 Carburetor Systems (7-8)
- L1 Mixture Control (7-9)
- L1 Carburetor Icing (7-9)
- L1 Carburetor Heat (7-10)
- L1 Carburetor Air Temperature Gauge (7-11)
- L1 Outside Air Temperature Gauge (7-11)
- L1 Fuel Injection Systems (7-11)
- L1 Superchargers and Turbosuperchargers (7-12)
- L1 Superchargers (7-12)
- L1 Turbosuperchargers (7-13)
- L1 System Operation (7-14)
- L1 High Altitude Performance (7-14)
- L1 Ignition System (7-15)
- L1 Oil Systems (7-16)
- L1 Engine Cooling Systems (7-17)
- L1 Exhaust Systems (7-18)
- L1 Starting System (7-18)
- L1 Combustion (7-18)
- L1 Full Authority Digital Engine Control (FADEC) (7-20)
- L1 Turbine Engines (7-20)
- L1 Types of Turbine Engines (7-20)
- L1 Turbojet (7-20)
- L1 Turboprop (7-21)
- L1 Turbofan (7-21)
- L1 Turboshaft (7-21)
- L1 Turbine Engine Instruments (7-22)
- L1 Engine Pressure Ratio (EPR) (7-22)
- L1 Exhaust Gas Temperature (EGT) (7-22)
- L1 Torquemeter (7-22)
- L1 N1 Indicator (7-23)
- L1 N2 Indicator (7-23)
- L1 Turbine Engine Operational Considerations (7-23)
- L1 Engine Temperature Limitations (7-23)
- L1 Thrust Variations (7-23)
- L1 Foreign Object Damage (FOD) (7-23)
- L1 Turbine Engine Hot/Hung Start (7-23)
- L1 Compressor Stalls (7-23)
- L1 Flameout (7-24)
- L1 Performance Comparison (7-24)
- L1 Airframe Systems (7-25)
- L1 Fuel Systems (7-25)
- L1 Gravity-Feed System (7-25)
- L1 Fuel-Pump System (7-25)
- L1 Fuel Primer (7-25)
- L1 Fuel Tanks (7-25)
- L1 Fuel Gauges (7-26)
- L1 Fuel Selectors (7-26)
- L1 Fuel Strainers, Sumps, and Drains (7-27)
- L1 Fuel Grades (7-27)
- L1 Fuel Contamination (7-27)
- L1 Fuel System Icing (7-28)
- L1 Prevention Procedures (7-28)
- L1 Refueling Procedures (7-29)
- L1 Heating System (7-29)
- L1 Fuel Fired Heaters (7-29)
- L1 Exhaust Heating Systems (7-29)
- L1 Combustion Heater Systems (7-29)
- L1 Bleed Air Heating Systems (7-30)
- L1 Electrical System (7-30)
- L1 Hydraulic Systems (7-31)
- L1 Landing Gear (7-33)
- L1 Tricycle Landing Gear (7-33)
- L1 Tailwheel Landing Gear (7-33)
- L1 Fixed and Retractable Landing Gear (7-34)
- L1 Brakes (7-34)
- L1 Pressurized Aircraft (7-34)
- L1 Oxygen Systems (7-37)
- L1 Oxygen Masks (7-38)
- L1 Cannula (7-38)
- L1 Pressure-Demand Oxygen Systems (7-38)
- L1 Continuous-Flow Oxygen System (7-38)
- L1 Electrical Pulse-Demand Oxygen System (7-38)
- L1 Pulse Oximeters (7-39)
- L1 Servicing of Oxygen Systems (7-39)
- L1 Anti-Ice and Deice Systems (7-40)
- L1 Airfoil Anti-Ice and Deice (7-40)
- L1 Windscreen Anti-Ice (7-41)
- L1 Propeller Anti-Ice (7-41)
- L1 Other Anti-Ice and Deice Systems (7-41)
- L1 Chapter Summary (7-41)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/07/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/07/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/07/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/07/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/07/_chapter_plaintext.txt` (or equivalent) and compare to
   `88565855e02b81034095e396f61e827d73f8537b5ba90ccdee6dbc165e67e406`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/07/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `7-1..7-42`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/07/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/07/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
