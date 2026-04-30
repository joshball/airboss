# Section-extraction prompt -- phak FAA-H-8083-25C chapter 2

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `2`
- Chapter title: `Aeronautical Decision-Making`
- Page range (printed FAA pages): `2-1..2-32`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/02/_chapter_plaintext.txt`
- Expected SHA-256: `5c12400e8f871668f1a6595565679d434aa27fb67556dbe58a62b1d6ee8469f4`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected 5c12400e8f871668f1a6595565679d434aa27fb67556dbe58a62b1d6ee8469f4, got <observed>`

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
- L1 Introduction (2-1)
- L1 History of ADM (2-2)
- L1 Risk Management (2-3)
- L1 Crew Resource Management (CRM) and Single- Pilot Resource Management (2-4)
- L1 Hazard and Risk (2-4)
  - L2 Hazardous Attitudes and Antidotes (2-5)
  - L2 Risk (2-6)
  - L2 Assessing Risk (2-6)
  - L2 Mitigating Risk (2-8)
  - L2 The PAVE Checklist (2-8)
  - L2 P = Pilot in Command (PIC) (2-8)
  - L2 A = Aircraft (2-8)
  - L2 V = EnVironment (2-9)
  - L2 E = External Pressures (2-9)
- L1 Human Factors (2-10)
- L1 Human Behavior (2-11)
- L1 The Decision-Making Process (2-12)
- L1 Single-Pilot Resource Management (SRM) (2-13)
- L1 The 5 Ps Check (2-13)
- L1 The Plan (2-14)
- L1 The Plane (2-14)
- L1 The Pilot (2-14)
- L1 The Passengers (2-14)
- L1 The Programming (2-15)
- L1 Perceive, Process, Perform (3P) Model (2-15)
- L1 PAVE Checklist: Identify Hazards and Personal Minimums (2-15)
- L1 CARE Checklist: Review Hazards and Evaluate Risks (2-16)
- L1 TEAM Checklist: Choose and Implement Risk Controls (2-16)
- L1 The DECIDE Model (2-18)
- L1 Detect (the Problem) (2-20)
- L1 Estimate (the Need To React) (2-20)
- L1 Choose (a Course of Action) (2-20)
- L1 Identify (Solutions) (2-20)
- L1 Do (the Necessary Actions) (2-20)
- L1 Evaluate (the Effect of the Action) (2-20)
- L1 Decision-Making in a Dynamic Environment (2-21)
- L1 Automatic Decision-Making (2-21)
- L1 Operational Pitfalls (2-21)
- L1 Stress Management (2-21)
- L1 Use of Resources (2-21)
- L1 Internal Resources (2-23)
- L1 External Resources (2-23)
- L1 Situational Awareness (2-24)
- L1 Obstacles to Maintaining Situational Awareness (2-24)
- L1 Workload Management (2-24)
- L1 Managing Risks (2-25)
- L1 Automation (2-25)
- L1 Results of the Study (2-27)
- L1 Equipment Use (2-27)
- L1 Autopilot Systems (2-27)
- L1 Familiarity (2-27)
- L1 Respect for Onboard Systems (2-29)
- L1 Getting Beyond Rote Workmanship (2-29)
- L1 Understand the Platform (2-29)
- L1 Managing Aircraft Automation (2-29)
- L1 Information Management (2-30)
- L1 Enhanced Situational Awareness (2-30)
- L1 Automation Management (2-31)
- L1 Risk Management (2-31)
- L1 Chapter Summary (2-32)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/02/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/02/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/02/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/02/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/02/_chapter_plaintext.txt` (or equivalent) and compare to
   `5c12400e8f871668f1a6595565679d434aa27fb67556dbe58a62b1d6ee8469f4`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/02/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `2-1..2-32`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/02/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/02/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
