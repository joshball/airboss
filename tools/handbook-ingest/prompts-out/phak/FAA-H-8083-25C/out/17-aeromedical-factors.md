# Section-extraction prompt -- phak FAA-H-8083-25C chapter 17

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `17`
- Chapter title: `Aeromedical Factors`
- Page range (printed FAA pages): `17-1..17-30`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/17/_chapter_plaintext.txt`
- Expected SHA-256: `3ba67b2be97fa8e62f75f707ae4395923202360a4fb754c501d0079a79e243e0`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 3ba67b2be97fa8e62f75f707ae4395923202360a4fb754c501d0079a79e243e0, got <observed>`

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
- L1 Introduction (17-1)
- L1 Obtaining a Medical Certificate (17-2)
- L1 Health and Physiological Factors Affecting Pilot Performance (17-3)
  - L2 Hypoxia (17-3)
  - L2 Hypoxic Hypoxia (17-3)
  - L2 Hypemic Hypoxia (17-3)
  - L2 Stagnant Hypoxia (17-3)
  - L2 Histotoxic Hypoxia (17-4)
  - L2 Symptoms of Hypoxia (17-4)
  - L2 Treatment of Hypoxia (17-4)
  - L2 Hyperventilation (17-4)
  - L2 Middle Ear and Sinus Problems (17-5)
  - L2 Spatial Disorientation and Illusions (17-6)
  - L2 Vestibular Illusions (17-7)
  - L2 Visual Illusions (17-8)
  - L2 Postural Considerations (17-8)
  - L2 Demonstration of Spatial Disorientation (17-8)
  - L2 Climbing While Accelerating (17-9)
  - L2 Climbing While Turning (17-9)
  - L2 Diving While Turning (17-9)
  - L2 Tilting to Right or Left (17-9)
  - L2 Reversal of Motion (17-9)
  - L2 Diving or Rolling Beyond the Vertical Plane (17-9)
  - L2 Coping with Spatial Disorientation (17-9)
  - L2 Optical Illusions (17-10)
  - L2 Runway Width Illusion (17-10)
- L1 Runway and Terrain Slopes Illusion (17-10)
- L1 Featureless Terrain Illusion (17-10)
- L1 Water Refraction (17-10)
- L1 Haze (17-10)
- L1 Fog (17-10)
- L1 Ground Lighting Illusions (17-10)
- L1 How To Prevent Landing Errors Due to Optical Illusions (17-10)
- L1 Motion Sickness (17-12)
- L1 Carbon Monoxide (CO) Poisoning (17-12)
- L1 Stress (17-12)
- L1 Fatigue (17-13)
- L1 Exposure to Chemicals (17-13)
- L1 Hydraulic Fluid (17-13)
- L1 Engine Oil (17-14)
- L1 Fuel (17-14)
- L1 Dehydration and Heatstroke (17-14)
- L1 Alcohol (17-15)
- L1 Drugs (17-16)
- L1 Altitude-Induced Decompression Sickness (DCS) (17-18)
- L1 DCS After Scuba Diving (17-18)
- L1 Vision in Flight (17-19)
- L1 Vision Types (17-20)
- L1 Photopic Vision (17-20)
- L1 Mesopic Vision (17-21)
- L1 Scotopic Vision (17-21)
- L1 Central Blind Spot (17-21)
- L1 Empty-Field Myopia (17-22)
- L1 Night Vision (17-22)
- L1 Night Blind Spot (17-22)
- L1 Dark Adaptation (17-23)
- L1 Scanning Techniques (17-23)
- L1 Night Vision Protection (17-23)
- L1 Self-Imposed Stress (17-25)
- L1 Distance Estimation and Depth Perception (17-25)
- L1 Binocular Cues (17-26)
- L1 Night Vision Illusions (17-26)
- L1 Autokinesis (17-26)
- L1 False Horizon (17-26)
- L1 Reversible Perspective Illusion (17-26)
- L1 Size-Distance Illusion (17-27)
- L1 Fascination (Fixation) (17-27)
- L1 Flicker Vertigo (17-27)
- L1 Night Landing Illusions (17-27)
- L1 Enhanced Night Vision Systems (17-27)
- L1 Synthetic Vision System (17-28)
- L1 Enhanced Flight Vision System (17-28)
- L1 Chapter Summary (17-29)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/17/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/17/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/17/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/17/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/17/_chapter_plaintext.txt` (or equivalent) and compare to
   `3ba67b2be97fa8e62f75f707ae4395923202360a4fb754c501d0079a79e243e0`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/17/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `17-1..17-30`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/17/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/17/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
