---
id: regulations-course-weeks-3-10
title: Regulations course Weeks 3-10
product: course
category: content
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-04-29
owner: agent
depends_on: []
unblocks: []
tags:
  - course
  - regulations
legacy_fields:
  review_status: done
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# Regulations course Weeks 3-10

Author the FAR navigation course Weeks 3 through 10, plus the two unblocked capstone orals (`friend-flight-review`, `ppl-applies-for-ir`). Weeks 1 and 2 have shipped; this WP scopes the rest of the 10-week course in one push, now that ADR 019 (`airboss-ref:` identifier syntax) is fully accepted and ingestion phases 1-9 are merged.

## Why now

Three of the conditions that gated the rest of the course are clear:

- **ADR 019 phases 1-9 shipped.** The `airboss-ref:` identifier system is live with CFR / handbook / AIM / AC ingestion. New lessons can be authored against the canonical citation form on day one.
- **Week 1 + Week 2 are the template.** Six lessons + drills + oral on Part 61 set the depth, voice, and citation style. Weeks 3-10 inherit that bar.
- **Two capstone orals are unblocked.** `friend-flight-review` (extension of Week 3's oral) and `ppl-applies-for-ir` (PPL into IFR training) were deferred specifically until ADR 019 landed; both can now ship.

Continuing to leave Weeks 3-10 in skeleton is a known issue. The course's value is in being readable end-to-end, not in being one tenth complete.

## Scope

Eight weeks of content plus two capstone orals.

| Week | Slug                                      | Subject       | Treatment | Topics                                                                                                                                                                          |
| ---- | ----------------------------------------- | ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3    | week-03-part-61-cfi                       | The pilot     | Deep      | Subpart H, 61.183/187/189/193/195/197, AC 61-65 endorsements, spin endorsement, light-sport CFIs                                                                                |
| 4    | week-04-part-91-general-and-flight-rules  | The flight    | Very deep | 91.3, 91.13, 91.7, 91.103, 91.105/107, 91.111/113/115, 91.119, 91.151/155/157/159, 91.167/169/171, 91.175/177/179/181/183/185, 91.211, 91.215                                   |
| 5    | week-05-part-91-equipment-and-maintenance | The flight    | Very deep | Subparts C, D, E. 91.205, 91.207, 91.213, 91.225/227, 91.319 vs 91.327, 91.403/405/407/409/411/413/417, MEL/CDL, ferry permits                                                  |
| 6    | week-06-part-91-special-ops               | The flight    | Deep      | Aerobatic 91.303, parachute 91.307, towing 91.309, formation 91.111(b), restricted/limited/experimental 91.311/313/317; subparts F-N (skim layer); whole-of-91 integration      |
| 7    | week-07-parts-141-and-135                 | The operation | Cursory   | Part 141 structure + appendices, Part 119, Part 135, ops specs, pilot duty/rest, "when does it touch a freelance CFI"                                                           |
| 8    | week-08-companion-documents               | Foundation    | Required  | AIM as expected knowledge, AC numbering + canon, Chief Counsel letters, Order 8900.1, FAA Safety Briefing                                                                       |
| 9    | week-09-enforcement                       | Foundation    | Required  | Compliance Program, ASRP/ASAP, pilot deviation process, certificate actions, NTSB Part 830                                                                                      |
| 10   | week-10-capstone                          | Integration   | Required  | Integrated oral, partner exam mechanics, capstone scenario, reflection. Plus 2 new capstone orals (`friend-flight-review`, `ppl-applies-for-ir`) in `course/regulations/orals/` |

Each week ships:

- `overview.md` (replace existing skeleton; drives reader from outside)
- 4-6 lesson files numbered `01-...md` through `0N-...md` per the SYLLABUS topic list
- `drills.md` (15-30 prompts in the four formats Week 2 established: Locate / Diagnose / Distinguish / Trap-detector)
- `oral.md` (one integration question + model answer + failure modes + variant prompts)

Lesson length floor: 250 lines. Ceiling: 410 lines. Match Week 2 voice and citation style.

## Citation policy

All regulation, AIM, AC, Chief Counsel, and Order references use the `airboss-ref:` URI form per ADR 019:

- `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` for CFR sections
- `[@cite](airboss-ref:handbooks/phak/8083-25C/12/3?at=2026)` for handbook sections
- `[@cite](airboss-ref:aim/5-1-7?at=2026-09)` for AIM paragraphs
- `[@cite](airboss-ref:ac/61-65/j)` for ACs (revision is slug-encoded)
- `[@cite](airboss-ref:interp/chief-counsel/mangiamele-2009)` for Chief Counsel letters
- `[@cite](airboss-ref:orders/faa/8900-1/vol-5/ch-1?at=2026)` for FAA Orders

`bun scripts/airboss-ref.ts` (the ADR 019 validator) must pass clean post-authoring. References that don't yet have registry entries surface as ERROR per ADR 019 §1.5; if any week needs a corpus-not-yet-ingested escape hatch, the lesson uses the `airboss-ref:unknown/<slug>` form per §1.7 and surfaces the gap to the dispatcher rather than silently inlining a paraphrase.

## Pedagogical rules (binding)

Per [DESIGN.md](../../../course/regulations/DESIGN.md):

- **Discovery-first.** Lead every lesson with WHY. Scenario or question first. Reveal the regulation as confirmation, not as the premise.
- **Common Misreadings on every lesson.** No exceptions. The trap is the load-bearing pedagogical commitment of this course; a lesson without one isn't done.
- **Quote actual CFR text** for the load-bearing section of each lesson, not a paraphrase. Paraphrase is OK for explanation as long as it is marked "Plain reading:" and never confused with the regulation.
- **Cite by section, not by name.** "[§61.57(c)](airboss-ref:regs/cfr-14/61/57?at=2026)" not "the IFR currency rule."
- **Date every claim** that depends on a regulation. Lessons carry `last_verified` in frontmatter.
- **Cumulative orals.** Week N's oral can pull from any of Weeks 1..N. The orals are the spine of the integration pillar.

Voice is the Week 2 voice: direct, instructive, structurally aware, builds toward the cumulative oral. No hedging. No "honest" qualifiers in agent voice (the word in pedagogical prose -- "a CFI must be honest with themselves about a student's readiness" -- is fine).

## Markdown formatting (binding)

- Blank line before every list and after every heading.
- Fenced code blocks always carry a language tag (`text`, `markdown`, `typescript`, `sql`).
- No em-dash, en-dash, or `--` as sentence separator. Use single hyphen, comma, colon, parens, or split sentences.
- Tables align (MD060). Cells padded so columns line up visually.

## Success criteria

A finished WP looks like:

- [ ] Every week 3 through 10 has `overview.md`, drills.md, oral.md, and N lesson files matching the SYLLABUS topic list
- [ ] Every lesson has a `Common misreadings` section
- [ ] Every regulation/handbook/AIM/AC/Chief-Counsel/Order citation uses `airboss-ref:` URI form
- [ ] `bun scripts/airboss-ref.ts` exits clean (ERROR-tier rules pass)
- [ ] `bun run check` passes with 0 errors / 0 warnings
- [ ] `course/regulations/CHANGELOG.md` status table flipped: every Week 3 through 10 row from "Skeleton" to "Authored"; the capstone row from "2/4" to "4/4"
- [ ] `docs/work/NOW.md` "FAR navigation course Weeks 3-10" entry moved from "In flight" to "Just shipped" with one-line per-week summary
- [ ] `course/regulations/orals/friend-flight-review.md` and `course/regulations/orals/ppl-applies-for-ir.md` authored at capstone difficulty matching `night-ifr-passenger.md`
- [ ] All five WP frontmatter `status` fields flipped to `done`; `review_status` flipped to `done`

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## References

- [course/regulations/README.md](../../../course/regulations/README.md) -- design philosophy, three pedagogical pillars
- [course/regulations/DESIGN.md](../../../course/regulations/DESIGN.md) -- authoring rules (binding)
- [course/regulations/SYLLABUS.md](../../../course/regulations/SYLLABUS.md) -- week-by-week topic list (the brief)
- [course/regulations/CHANGELOG.md](../../../course/regulations/CHANGELOG.md) -- prior pulls, decisions, status table
- [course/regulations/week-02-part-61-deep/](../../../course/regulations/week-02-part-61-deep/) -- the model week
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) -- citation syntax
- [docs/decisions/011-knowledge-graph-learning-system/decision.md](../../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy
- [docs/platform/DESIGN_PRINCIPLES.md](../../platform/DESIGN_PRINCIPLES.md) -- product shaping
