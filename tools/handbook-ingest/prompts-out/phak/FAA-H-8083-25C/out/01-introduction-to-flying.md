# Section-extraction prompt -- phak FAA-H-8083-25C chapter 1

You are extracting the section structure of one FAA handbook chapter and
writing the result as strict JSON to a fixed path. You are running as a
`general-purpose` sub-agent dispatched from a fresh Claude Code session
that paste-loaded the orchestrator at `_run.md`. Read
`_parameters.md` (in the same directory as `_run.md`) for the discipline
that governs this run if you have not already.

## Chapter

- Document: `phak`
- Edition: `FAA-H-8083-25C`
- Chapter ordinal: `1`
- Chapter title: `Introduction To Flying`
- Page range (printed FAA pages): `1-1..1-24`

## Inputs

The chapter plaintext sidecar:

- Path: `handbooks/phak/FAA-H-8083-25C/01/_chapter_plaintext.txt`
- Expected SHA-256: `ef385d2ac6699dbd3c1035057e6c8ba818d3381b6d766b5b85ed5f136a45e3a0`

Before reading the sidecar, compute its SHA-256 and compare against the
expected value above. On mismatch, do NOT proceed; return:

`error: sidecar SHA-256 mismatch -- expected ef385d2ac6699dbd3c1035057e6c8ba818d3381b6d766b5b85ed5f136a45e3a0, got <observed>`

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
- L1 Introduction (1-1)
- L1 History of Flight (1-2)
  - L2 Transcontinental Air Mail Route (1-4)
  - L2 Federal Certification of Pilots and Mechanics (1-4)
  - L2 The Federal Aviation Act of 1958 (1-6)
  - L2 Department of Transportation (DOT) (1-6)
  - L2 ATC Automation (1-6)
  - L2 The Professional Air Traffic Controllers Organization (PATCO) Strike (1-6)
  - L2 The Airline Deregulation Act of 1978 (1-7)
- L1 The Role of the FAA (1-7)
  - L2 The Code of Federal Regulations (CFR) (1-7)
  - L2 Primary Locations of the FAA (1-8)
  - L2 Field Offices (1-8)
  - L2 Aviation Safety Inspector (ASI) (1-9)
  - L2 FAA Safety Team (FAASTeam) (1-9)
  - L2 Obtaining Assistance from the FAA (1-9)
  - L2 Aeronautical Information Manual (AIM) (1-9)
  - L2 Handbooks (1-10)
  - L2 Advisory Circulars (ACs) (1-10)
  - L2 Flight Publications (1-11)
  - L2 Pilot and Aeronautical Information (1-12)
  - L2 Notices to Airmen (NOTAMs) (1-12)
  - L2 Safety Program Airmen Notification System (SPANS) (1-14)
- L1 Aircraft Classifications and Ultralight Vehicles (1-14)
- L1 Pilot Certifications (1-16)
  - L2 Privileges: (1-16)
  - L2 Limitations: (1-17)
  - L2 Recreational Pilot (1-17)
  - L2 Privileges: (1-17)
  - L2 Limitations: (1-17)
  - L2 Private Pilot (1-17)
  - L2 Commercial Pilot (1-18)
  - L2 Airline Transport Pilot (1-18)
  - L2 Selecting a Flight School (1-18)
  - L2 How To Find a Reputable Flight Program (1-19)
  - L2 How To Choose a Certificated Flight Instructor (CFI) (1-19)
  - L2 The Student Pilot (1-20)
  - L2 Basic Requirements (1-20)
  - L2 Medical Certification Requirements (1-20)
  - L2 Becoming a Pilot (1-21)
  - L2 Knowledge and Skill Tests (1-21)
  - L2 Knowledge Tests (1-21)
  - L2 When To Take the Knowledge Test (1-22)
  - L2 Practical Test (1-22)
  - L2 When To Take the Practical Test (1-23)
  - L2 Who Administers the FAA Practical Tests? (1-23)
  - L2 Role of the Certificated Flight Instructor (1-23)
  - L2 Role of the Designated Pilot Examiner (1-24)
  - L2 Chapter Summary (1-24)

```

## Handbook hints

Per-handbook quirks the contract's generic difficult-cases catalog doesn't
cover. Apply these when extracting THIS handbook.

(no handbook-specific hints for this run)

## Output files

Write up to three files in the chapter directory:

1. `handbooks/phak/FAA-H-8083-25C/01/_llm_section_tree.json`
   The JSON section tree (per the contract). REQUIRED.
2. `handbooks/phak/FAA-H-8083-25C/01/_model_self_report.txt`
   A one-line file containing the model you self-report running on (e.g.
   `claude-opus-4-7`). One trailing newline. REQUIRED.
3. `handbooks/phak/FAA-H-8083-25C/01/_llm_disagreements.json`
   A JSON array per the contract's DISAGREEMENTS schema. OPTIONAL --
   write only when you actually disagree with the TOC checklist above
   (level / parent / anchor mismatch, missing-in-body, extra-in-toc).
   Skip when the checklist is empty or when you fully agree with it.

Do NOT write any other file. Do NOT modify the sidecar. Do NOT write
under `tools/handbook-ingest/prompts-out/`.

## Return contract

Reply with exactly one status line to the parent:

- Success:
  `ok: wrote {N} entries to handbooks/phak/FAA-H-8083-25C/01/_llm_section_tree.json (model: <self-reported>{disagreements_suffix})`
  -- where `{disagreements_suffix}` is `; D disagreements` when you wrote
  `_llm_disagreements.json` with D entries, or empty string otherwise.
- Failure:
  `error: <one-sentence reason>`

Do NOT echo the JSON back to the parent; the section tree lives on disk.

## Procedure

1. Compute `shasum -a 256 handbooks/phak/FAA-H-8083-25C/01/_chapter_plaintext.txt` (or equivalent) and compare to
   `ef385d2ac6699dbd3c1035057e6c8ba818d3381b6d766b5b85ed5f136a45e3a0`. On mismatch, return the error status line above.
2. Read `tools/handbook-ingest/prompts-out/phak/FAA-H-8083-25C/out/_section_tree_contract.md` to load the JSON output specification. The
   contract opens with a `CONTRACT VERSION:` line; the current version is
   `4`. Apply every rule in that file -- entry shape, page-anchor handling,
   boilerplate inclusion, hierarchy preference, coverage self-check,
   the difficult-cases catalog, and the disagreements protocol.
3. Read `handbooks/phak/FAA-H-8083-25C/01/_chapter_plaintext.txt` (the chapter plaintext).
4. Apply the contract to produce the section tree array. Use only
   headings that appear verbatim in the sidecar text. Do not invent.
   Page anchors should match the printed FAA format (e.g. `12-7`).
   Cross-reference your output against the TOC parser checklist above:
   verify each TOC entry exists in body text; find body headings the
   TOC missed.
5. Run the contract's coverage self-check. The chapter's printed page
   range is `1-1..1-24`. If your last entry's page anchor is more
   than one printed page short of the chapter's last page, inspect the
   trailing pages in the sidecar: if they contain only figure callouts,
   table titles, captions, or blank space (no body-text headings),
   the shortfall is acceptable -- proceed to write JSON. Otherwise
   return `error: incomplete coverage -- last anchor at <anchor>,
   expected on-or-after <last_page>` instead of writing JSON.
6. Write the JSON section tree to `handbooks/phak/FAA-H-8083-25C/01/_llm_section_tree.json` (one trailing newline;
   no markdown fencing).
7. If you disagree with the TOC parser checklist on any entry (level,
   parent, anchor, missing in body, or extra in TOC), write a
   `_llm_disagreements.json` array next to the section tree per the
   contract's DISAGREEMENTS schema. Cap at 50 entries. Skip the file
   entirely when the checklist is empty or you fully agree.
8. Write `handbooks/phak/FAA-H-8083-25C/01/_model_self_report.txt`
   containing the model name you self-report running on.
9. Return the success status line with the entry count and (if any)
   the disagreements count.

Begin.
