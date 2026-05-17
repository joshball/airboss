---
status: done
review_status: done
---

# Design -- regulations course Weeks 3-10

The design problem is small but easy to get wrong. We have eight weeks of content to author, each independent in subject matter but mutually consistent in voice, structure, citation style, and the cumulative orals. The dispatcher could do all eight serially or fan out. Fan-out wins on time; the risk is voice drift and citation inconsistency.

## Approach -- file-scoped parallel sub-agents, then a solo final pass

Per CLAUDE.md memory `parallel agents scope by file, not by block`, we partition by week directory. One sub-agent per week, exclusive write access to its directory and only its directory. The Week 10 sub-agent additionally owns two specific files in `course/regulations/orals/`. There is no overlap; the design is collision-free by construction.

```text
Phase 2 (parallel):
  agent-week-03  ->  course/regulations/week-03-part-61-cfi/         (overview, lessons, drills, oral)
  agent-week-04  ->  course/regulations/week-04-part-91-general-and-flight-rules/
  agent-week-05  ->  course/regulations/week-05-part-91-equipment-and-maintenance/
  agent-week-06  ->  course/regulations/week-06-part-91-special-ops/
  agent-week-07  ->  course/regulations/week-07-parts-141-and-135/
  agent-week-08  ->  course/regulations/week-08-companion-documents/
  agent-week-09  ->  course/regulations/week-09-enforcement/
  agent-week-10  ->  course/regulations/week-10-capstone/
                  +  course/regulations/orals/friend-flight-review.md
                  +  course/regulations/orals/ppl-applies-for-ir.md

Phase 3 (solo, sequential):
  parent-agent   ->  airboss-ref validator
                  ->  references.ts validator
                  ->  course/regulations/CHANGELOG.md
                  ->  docs/work/NOW.md
                  ->  course/regulations/SYLLABUS.md (only if drift uncovered)
                  ->  bun run check
                  ->  WP frontmatter flips
```

## Why parallel here

The eight weeks have:

- Independent subject matter (Part 61 subpart H is disjoint from Part 91 maintenance)
- Independent file footprints (separate directories)
- Shared style requirements that are spec'd up front (Week 2 is the template; DESIGN.md is binding)
- A trailing reconciliation pass that catches consistency issues

The convergent risks (voice drift, citation form drift) are caught by the solo final pass in Phase 3 and by manual review against the Week 2 template. Sequential authoring would buy us nothing here that the spec + final pass don't already provide, and would block content authoring for 8x as long.

## Why the final pass is solo

Per CLAUDE.md memory `Token migration passes run last, alone`, finishing passes that touch the cross-cutting state (CHANGELOG, NOW.md, validator output, WP frontmatter) own no risk of collision because nothing else is writing. Doing this work as the parent agent (not as another sub-agent) keeps the audit trail simple.

## Why the WP itself ships in its own merged PR

Per CLAUDE.md memory `Ship sequence -- edit first, pull main, then branch`, we author the WP, branch off main, push, open the WP PR, merge it, pull main again, and only THEN cut the content branch. This pattern keeps the content PR's diff focused on content, not on planning artifacts, and keeps the branch protections happy.

## Citation discipline -- the only real consistency risk

ADR 019's `airboss-ref:` syntax lets every lesson cite from the same pool with no per-lesson flexibility. The risks are:

- **Wrong corpus name.** "regs/cfr-14/91/103" vs "reg/cfr-14/91/103" vs "regs/14CFR/91/103". Validator catches.
- **Missing pin.** "?at=2026" omitted. Validator catches (ERROR per ADR 019 §1.5 row 1).
- **Stale pin.** "?at=2024" in a 2026 lesson. Validator emits WARNING.
- **Author wrote a paraphrase but forgot to mark "Plain reading:"** -- not validator-catchable; manual review against DESIGN.md "Voice and accuracy" rule.

Each sub-agent's brief includes the four `airboss-ref:` shape examples (`regs/`, `handbooks/`, `acs/`, `interp/`, `orders/`, `aim/`, `ac/`) inline so they don't have to consult ADR 019 for syntax.

## Pedagogy discipline -- the second risk

Discovery-first is easy to forget when the topic is dry. Subpart-walk lessons especially tempt straight-into-the-rule openings ("Subpart H covers flight instructors. Section 61.183 says..."). The Week 2 template `01-subpart-walk.md` opens with WHY ("Memorizing them is brittle and almost nobody who works in this field actually does it") and that posture has to carry forward.

The sub-agent brief makes this binding by quoting the Week 2 lessons as a model, not by repeating the rule abstractly.

## Data flow -- not applicable

This is a content authoring WP. Nothing runs at runtime. The content's only consumers are:

- Course readers (the lessons render as Markdown)
- The cited regulations registry (lessons reference but don't mutate)
- The future spaced-rep card system (drills become flashcards in `apps/study/` -- not in scope here)

## Risks and mitigations

| Risk                                                                     | Mitigation                                                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sub-agent goes shallow on a hard topic (e.g. ferry permits, MEL/CDL)     | Brief includes the SYLLABUS topic list verbatim; the lesson must address every named topic                                                                        |
| Citation drift across sub-agents                                         | All citations validated by `bun scripts/airboss-ref.ts` in Phase 3; broken citations get fixed inline                                                             |
| Voice drift -- Week 4 reads like a different course than Week 3          | Sub-agents required to read Week 1 + Week 2 in full before authoring; Phase 3 includes a manual voice check (read first paragraph of every overview side by side) |
| Pedagogical drift -- Common Misreadings missing on a lesson              | Test plan checklist; final pass greps every lesson file for `## Common misreadings`                                                                               |
| Sub-agent edits files outside its assigned directory                     | Worktree boundary hook + brief explicitly forbids; if it happens, those edits get backed out before commit                                                        |
| Capstone orals don't match `night-ifr-passenger.md` rigor                | Week 10 sub-agent reads `night-ifr-passenger.md` and `gear-up-night-ifr.md` first; tests-plan checklist requires same section structure                           |
| `bun run check` fails after authoring (markdown lint or table alignment) | Phase 3 runs the check; fixes are inline; no separate cycle                                                                                                       |

## What changes if a sub-agent fails

If one sub-agent returns short or with quality problems, the parent agent re-runs that single sub-agent with a sharpened brief. The other seven weeks proceed unaffected because they're already-written files. There is no global rollback; the content PR can ship six or seven weeks if one is irrecoverably stuck, with a follow-up to land the missing week. This is unlikely; the Week 2 template is concrete enough that "match this depth" is an executable instruction.

## Definition of done

The WP is done when all five frontmatter blocks read `status: done` and `review_status: done`, the content PR is open with the user-merge handoff complete, and the dispatcher's to-dispatcher.md log has the per-week summary plus the final PR URL.
