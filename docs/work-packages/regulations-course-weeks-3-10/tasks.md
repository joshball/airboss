---
status: pending
review_status: pending
---

# Tasks -- regulations course Weeks 3-10

Phase 1 ships the WP itself (this directory) on its own branch and merges it. Phase 2 dispatches eight parallel sub-agents, one per week. Phase 3 runs the validator + final pass solo. Phase 4 opens a single content PR.

## Phase 1 -- Work package author + merge

- [ ] Author `spec.md`, `tasks.md`, `test-plan.md`, `design.md`, `user-stories.md` in this directory with `status: pending` / `review_status: pending` frontmatter
- [ ] Stage the five files by name (no `git add -A`)
- [ ] Commit on the WP branch with message `docs(work-package): regulations course weeks 3-10 authoring plan`
- [ ] Push the WP branch to origin with `-u`
- [ ] Open the WP PR via `gh pr create` (concise body, references SYLLABUS and ADR 019)
- [ ] Merge the WP PR with `gh pr merge --squash --delete-branch`
- [ ] Pull main into the worktree and create the content branch `course/regulations-content-weeks-3-10`

## Phase 2 -- Per-week content authoring (parallel)

Eight parallel sub-agents dispatched in a single message. Each owns exactly one week directory; the Week 10 agent additionally owns two files in `course/regulations/orals/`. No file collisions.

- [ ] Week 3 sub-agent -- `course/regulations/week-03-part-61-cfi/` -- subpart H, endorsements, FOI
- [ ] Week 4 sub-agent -- `course/regulations/week-04-part-91-general-and-flight-rules/` -- subparts A-B (very deep)
- [ ] Week 5 sub-agent -- `course/regulations/week-05-part-91-equipment-and-maintenance/` -- subparts C-E (very deep)
- [ ] Week 6 sub-agent -- `course/regulations/week-06-part-91-special-ops/` -- special ops + integration
- [ ] Week 7 sub-agent -- `course/regulations/week-07-parts-141-and-135/` -- 141 + 135 literacy
- [ ] Week 8 sub-agent -- `course/regulations/week-08-companion-documents/` -- AIM, AC, Chief Counsel, Orders
- [ ] Week 9 sub-agent -- `course/regulations/week-09-enforcement/` -- compliance + NTSB Part 830
- [ ] Week 10 sub-agent -- `course/regulations/week-10-capstone/` + `course/regulations/orals/friend-flight-review.md` + `course/regulations/orals/ppl-applies-for-ir.md`

Each sub-agent deliverable per week:

- [ ] `overview.md` -- replaces existing skeleton
- [ ] N lesson files (4-6 typical, driven by SYLLABUS topic count)
- [ ] `drills.md` (Locate / Diagnose / Distinguish / Trap-detector formats matching Week 2)
- [ ] `oral.md` (Week 2 oral structure)

Each sub-agent constraint:

- [ ] Lessons 250-400 lines
- [ ] Common Misreadings section on every lesson
- [ ] All citations in `airboss-ref:` URI form
- [ ] No em-dash / `--` in prose; no "honest" qualifier in agent voice
- [ ] Markdown rules followed (blank line before lists / after headings, language tags on code fences)
- [ ] Exclusive write to assigned directory (Week 10 also owns its two oral files); zero touches elsewhere

## Phase 3 -- Final pass (solo, sequential)

- [ ] Run `bun scripts/airboss-ref.ts` -- ERROR rules clean. Fix any broken citations directly.
- [ ] Run `bun scripts/references.ts validate` (the wiki-link side, separate system) and fix anything broken
- [ ] Update `course/regulations/CHANGELOG.md` -- new top entry dated today; flip status table for Weeks 3-10 to "Authored"; flip capstone row from "2/4" to "4/4"
- [ ] Update `docs/work/NOW.md` -- move "FAR navigation course Weeks 3-10" from "In flight" to "Just shipped"; one-line per-week summary
- [ ] Reconcile `course/regulations/SYLLABUS.md` only if a sub-agent's authoring revealed a topic-ordering or scope mismatch; otherwise leave alone
- [ ] Run `bun run check` -- 0 errors, 0 warnings. Fix any markdown lint or type issues.
- [ ] Verify file presence: every Week 3-10 directory has overview / drills / oral / N lesson files
- [ ] Flip frontmatter on all 5 WP files: `status: pending` -> `status: done`, `review_status: pending` -> `review_status: done`

## Phase 4 -- Single content PR (no merge)

- [ ] `git status` -- confirm working tree contains all new content + CHANGELOG + NOW.md + (optional) SYLLABUS update + WP status flips
- [ ] Stage and commit per logical chunk (one commit per week, plus a "Week 10 + capstones" commit, plus a "status / docs flip" commit). Stage by filename only.
- [ ] Push the content branch with `-u`
- [ ] Open content PR via `gh pr create` with a body that lists per-week lesson counts, validator status, and references SYLLABUS + ADR 019
- [ ] Return the PR URL to the dispatcher; do NOT merge -- user merges manually

## Estimated scope

Eight parallel sub-agents authoring 4-6 lessons each at ~300 lines per lesson is roughly 9,000-15,000 lines of net new content, plus drills, orals, and two new capstones. Validator + status flips + commits is the trailing solo pass. The branching structure makes per-week effort independent; the integration risk is in citation consistency (caught by the validator) and pedagogical voice consistency (caught by manual review against the Week 2 bar).
