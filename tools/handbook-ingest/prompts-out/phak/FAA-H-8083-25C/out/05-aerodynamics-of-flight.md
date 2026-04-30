# Section-extraction prompt -- phak FAA-H-8083-25C chapter 5

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `5`
- Chapter title: `Aerodynamics of Flight`
- Page range (printed FAA pages): `5-1..5-51`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/05/_chapter_plaintext.txt`
- Expected SHA-256: `d8055d328b88d705ae9f68d98a86e706671feee43afe5b178385fdc7ea26aa75`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected d8055d328b88d705ae9f68d98a86e706671feee43afe5b178385fdc7ea26aa75, got <observed>`

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
- L1 Forces Acting on the Aircraft (5-1)
  - L2 Thrust (5-2)
  - L2 Lift (5-3)
  - L2 Lift/Drag Ratio (5-5)
  - L2 Drag (5-6)
  - L2 Parasite Drag (5-6)
  - L2 Induced Drag (5-7)
  - L2 Weight (5-8)
- L1 Wingtip Vortices (5-8)
  - L2 Formation of Vortices (5-8)
  - L2 Avoiding Wake Turbulence (5-9)
- L1 Ground Effect (5-11)
- L1 Axes of an Aircraft (5-12)
- L1 Moment and Moment Arm (5-13)
- L1 Aircraft Design Characteristics (5-14)
  - L2 Stability (5-14)
  - L2 Static Stability (5-14)
  - L2 Dynamic Stability (5-14)
  - L2 Longitudinal Stability (Pitching) (5-15)
  - L2 Lateral Stability (Rolling) (5-17)
  - L2 Directional Stability (Yawing) (5-19)
  - L2 Free Directional Oscillations (Dutch Roll) (5-20)
  - L2 Spiral Instability (5-20)
- L1 Effect of Wing Planform (5-20)
- L1 Aerodynamic Forces in Flight Maneuvers (5-22)
  - L2 Forces in Turns (5-22)
  - L2 Forces in Climbs (5-23)
  - L2 Forces in Descents (5-24)
- L1 Stalls (5-25)
- L1 Angle of Attack Indicators (5-26)
- L1 Basic Propeller Principles (5-28)
  - L2 Torque and P-Factor (5-30)
  - L2 Torque Reaction (5-31)
  - L2 Corkscrew Effect (5-31)
  - L2 Gyroscopic Action (5-31)
  - L2 Asymmetric Loading (P-Factor) (5-32)
- L1 Load Factors (5-33)
  - L2 Load Factors in Aircraft Design (5-33)
  - L2 Load Factors in Steep Turns (5-34)
  - L2 Load Factors and Stalling Speeds (5-34)
  - L2 Load Factors and Flight Maneuvers (5-36)
  - L2 Vg Diagram (5-37)
  - L2 Rate of Turn (5-38)
  - L2 Radius of Turn (5-39)
  - L2 Weight and Balance (5-40)
  - L2 Effect of Weight on Flight Performance (5-42)
  - L2 Effect of Weight on Aircraft Structure (5-42)
  - L2 Effect of Weight on Stability and Controllability (5-42)
  - L2 Effect of Load Distribution (5-43)
  - L2 High Speed Flight (5-44)
  - L2 Subsonic Versus Supersonic Flow (5-44)
  - L2 Speed Ranges (5-44)
  - L2 Mach Number Versus Airspeed (5-45)
  - L2 Boundary Layer (5-46)
  - L2 Laminar Boundary Layer Flow (5-46)
  - L2 Turbulent Boundary Layer Flow (5-46)
  - L2 Boundary Layer Separation (5-46)
  - L2 Shock Waves (5-46)
  - L2 Sweepback (5-48)
  - L2 Mach Buffet Boundaries (5-49)
  - L2 High Speed Flight Controls (5-49)
  - L2 Chapter Summary (5-51)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/05/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/05/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/05/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/05/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/05/_chapter_plaintext.txt` (or equivalent) and compare to
   `d8055d328b88d705ae9f68d98a86e706671feee43afe5b178385fdc7ea26aa75`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/05/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `5-1..5-51`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/05/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/05/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
