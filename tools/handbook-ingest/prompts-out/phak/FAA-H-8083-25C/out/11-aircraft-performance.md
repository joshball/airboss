# Section-extraction prompt -- phak FAA-H-8083-25C chapter 11

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `11`
- Chapter title: `Aircraft Performance`
- Page range (printed FAA pages): `11-1..11-28`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/11/_chapter_plaintext.txt`
- Expected SHA-256: `3b81332887b7361c0ec65949790e00cd85c4ba8cb9fb87347d5835b771453a9c`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 3b81332887b7361c0ec65949790e00cd85c4ba8cb9fb87347d5835b771453a9c, got <observed>`

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
- L1 Introduction (11-1)
- L1 Importance of Performance Data (11-1)
- L1 Structure of the Atmosphere (11-2)
- L1 Atmospheric Pressure (11-2)
- L1 Pressure Altitude (11-3)
- L1 Density Altitude (11-3)
  - L2 Effects of Pressure on Density (11-4)
  - L2 Effects of Temperature on Density (11-5)
  - L2 Effects of Humidity (Moisture) on Density (11-5)
- L1 Performance (11-5)
  - L2 Straight-and-Level Flight (11-5)
  - L2 Climb Performance (11-6)
  - L2 Angle of Climb (AOC) (11-7)
  - L2 Rate of Climb (ROC) (11-7)
  - L2 Climb Performance Factors (11-8)
  - L2 Range Performance (11-9)
  - L2 Region of Reversed Command (11-11)
  - L2 Takeoff and Landing Performance (11-12)
  - L2 Runway Surface and Gradient (11-12)
  - L2 Water on the Runway and Dynamic Hydroplaning (11-13)
  - L2 Takeoff Performance (11-14)
  - L2 Landing Performance (11-16)
- L1 Performance Speeds (11-18)
- L1 Performance Charts (11-19)
  - L2 Interpolation (11-20)
  - L2 Density Altitude Charts (11-20)
  - L2 Takeoff Charts (11-20)
  - L2 Climb and Cruise Charts (11-21)
  - L2 Crosswind and Headwind Component Chart (11-25)
  - L2 Landing Charts (11-26)
  - L2 Stall Speed Performance Charts (11-27)
  - L2 Transport Category Aircraft Performance (11-28)
  - L2 Air Carrier Obstacle Clearance Requirements (11-28)
  - L2 Chapter Summary (11-28)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/11/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/11/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/11/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/11/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/11/_chapter_plaintext.txt` (or equivalent) and compare to
   `3b81332887b7361c0ec65949790e00cd85c4ba8cb9fb87347d5835b771453a9c`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/11/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `11-1..11-28`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/11/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/11/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
