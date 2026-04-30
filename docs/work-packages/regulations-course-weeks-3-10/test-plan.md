---
status: pending
review_status: pending
---

# Test plan -- regulations course Weeks 3-10

This is a content WP, not a code WP. The test plan is a manual review checklist applied per week, plus the two automated validators that gate citation correctness.

## Per-week checklist

Apply to each of Weeks 3 through 10 individually before declaring the week authored.

### Structure

- [ ] `overview.md` exists and replaces the prior skeleton
- [ ] N lesson files numbered `01-...md` through `0N-...md` matching the SYLLABUS topic list for this week (4-6 typical)
- [ ] `drills.md` exists with at least 15 prompts across the four formats (Locate / Diagnose / Distinguish / Trap-detector)
- [ ] `oral.md` exists with one integration question, model answer, failure modes, and variant prompts

### Lesson content (apply to every lesson in the week)

- [ ] 250-400 lines
- [ ] Frontmatter has `title`, `week`, `section_order`, `covers_regulations`, `last_verified` (per DESIGN.md)
- [ ] Lesson opens with `What you'll be able to do`
- [ ] Lesson has a `Why this matters` section that leads with WHY before introducing the regulation
- [ ] Lesson has a `Common misreadings` section with at least one specific trap (binding per DESIGN.md)
- [ ] CFR text quoted (not paraphrased) for the load-bearing section; paraphrases marked `Plain reading:`
- [ ] All citations use `airboss-ref:` URI form
- [ ] No em-dash, en-dash, or `--` in prose
- [ ] No "honest" / "honestly" qualifier in agent voice (the word in pedagogical content -- "a CFI must be honest with themselves" -- is fine if pedagogically apt)
- [ ] Blank line before every list and after every heading
- [ ] Fenced code blocks carry a language tag

### Cross-week pedagogical alignment

- [ ] Week N's oral pulls integrative scenarios that are answerable from Weeks 1..N (cumulative)
- [ ] No lesson references regulations outside its own treatment scope without a forward / backward reference link
- [ ] Voice matches Week 2 -- direct, structurally aware, builds toward the integration oral

## Capstone orals (Week 10 sub-agent owns these in addition to its week dir)

### `course/regulations/orals/friend-flight-review.md`

- [ ] Frontmatter matches `night-ifr-passenger.md` (`difficulty: capstone`, full `pulls_from_regulations` array, `last_verified`)
- [ ] Question + What this is testing + Model answer (full walkthrough) + Compressed answer + Failure modes + Variant prompts -- every section present per DESIGN.md template
- [ ] Pulls from at least: `61.56`, `61.57`, `61.193`, `61.195`, AC 61-65, plus other regs as appropriate
- [ ] Failure modes table has 8+ entries
- [ ] All citations use `airboss-ref:` URI form

### `course/regulations/orals/ppl-applies-for-ir.md`

- [ ] Same structural checklist as above
- [ ] Pulls from at least: `61.65`, `61.51`, `61.57`, `61.56`, the Part 141 vs Part 61 distinction, `91.169`, plus other regs as appropriate

## Automated validators (gate the PR)

- [ ] `bun scripts/airboss-ref.ts` exits with no ERROR-tier issues
- [ ] `bun scripts/references.ts validate` (separate wiki-link system) is clean for any new wiki-link content
- [ ] `bun run check` exits with 0 errors and 0 warnings

## Documentation flips (gate the PR)

- [ ] `course/regulations/CHANGELOG.md` has a new top entry dated today
- [ ] CHANGELOG status table flipped: Weeks 3 through 10 from "Skeleton" to "Authored"
- [ ] CHANGELOG capstone row flipped from "2/4" to "4/4"
- [ ] `docs/work/NOW.md` moved the "FAR navigation course Weeks 3-10" entry from "In flight" to "Just shipped" with a one-line per-week summary
- [ ] All five WP files (this directory) have `status: done` and `review_status: done`

## What this test plan does NOT cover

- **Knowledge graph nodes** -- candidate slugs surface in lesson frontmatter; the nodes themselves ship in a later pull, per Week 2 precedent
- **Drill -> flashcard import in `apps/study/`** -- separate engineering pull
- **Manual user-zero walkthrough** -- normally required by CLAUDE.md before a feature is considered shipped, but this is content not a feature; the user reviews the prose directly when reading
- **Translation to runway / hangar / spatial surfaces** -- this is content; surfacing it elsewhere is downstream work

## Sign-off

The WP is closed when:

1. All per-week checklists are green
2. Both capstone oral checklists are green
3. Both automated validators pass clean
4. Both documentation flips are committed
5. Content PR is open (the user merges; do not auto-merge)
6. WP frontmatter is flipped to `status: done` / `review_status: done`
