---
title: Hangar Review Queue -- User Stories
product: hangar
feature: hangar-review-queue
type: user-stories
status: draft
review_status: pending
---

# Hangar Review Queue -- User Stories

User = Joshua (single-user MVP). Stories anchor what each phase has to deliver from the user's seat.

## Browsing repo docs

**As Joshua, I want to read any markdown file in `docs/**` from inside the hangar app, so that I don't have to leave the app to look at an ADR or spec.**

- I open `/docs`, see a directory tree, click into anything.
- Tables align, code is highlighted, internal links between docs work.
- Frontmatter (status, type, etc.) is visible at a glance.
- Search finds a phrase across all docs.

## Seeing what to review

**As Joshua, I want to open the hangar and immediately see "what should I review next" without scanning 89 markdown files myself.**

- I open `/review`, see a small number of bucket cards (not 90 individual cards).
- Each bucket has a count badge so I know the size of each pile.
- I can filter to "Reviews" only, or "Tasks" only, when one mode dominates.

## Drilling into a bucket

**As Joshua, I want to click into a bucket and see the items at the right granularity, so I can pick one to start on.**

- Bucket expands to a drawer with item rows.
- Each row links to the right per-kind review view.
- "Show full list" goes to a sortable / filterable page if the bucket is huge.

## Reviewing a WP spec

**As Joshua, I want one screen that shows a WP's spec / tasks / test-plan / design / user-stories with tabs, so I can review the whole package without opening 5 files.**

- Tabs render each markdown file inline.
- Frontmatter is visible.
- Footer actions: mark spec read, open walker, flip `review_status`.

## Walking a manual test plan

**As Joshua, I want to walk a test plan step-by-step and have my pass/fail/blocked + notes persisted, so I can pause for hours and come back without losing place.**

- Each row of the test-plan table becomes an interactive checklist row.
- Outcomes save on click, notes save on blur.
- Reload, close-tab, open-next-day -- session resumes.
- "Finish" prompts to flip `review_status: done` if all steps pass.

## Reviewing a reference TOC

**As Joshua, I want a fast TOC-on-left / content-on-right spot-check tool with keyboard shortcuts, so I can verify a reference's structure without RSI.**

- TOC list shows entries.
- Clicking loads content on right.
- `j` / `k` / `b` mark pass / fail / blocked and advance.

## Tracking ad-hoc tasks

**As Joshua, I want a simple kanban for "fix this thing" tasks that don't fit a review kind, so I have one place to capture and track them.**

- Click "+ Ad-hoc" on the board, fill a title, get a card.
- Drag across columns the old way.
- Type / product area badges for visual filtering.

## Trusting the system

**As Joshua, I want the markdown frontmatter to remain authoritative, so my review state is visible in `git diff` and survives a database reset.**

- Drag actions on the board write back to frontmatter.
- DB caches frontmatter for fast reads but is rebuildable from the markdown at any time.
- A `db reset` doesn't lose review state (only ephemeral session/step state).

## Tuning the board without a SQL edit

**As Joshua, I want to add, edit, or remove buckets through a UI, so I can retune the board as my reviewing habits change without touching the database.**

- `/review/admin/buckets` lists all buckets with name, kind, filter summary, count.
- A form lets me create a bucket: name + kind + filter (structured for the common case, jsonb advanced for the rare one) + sort + target column.
- I can edit or delete any bucket; deleting doesn't delete the items in it -- they fall through.
- New buckets show up on the board immediately with live counts.

## Searching across all docs

**As Joshua, I want full-text search across `docs/**`, `course/**`, `handbooks/**`, `regulations/**`, so I can find a phrase in seconds without grepping the repo.**

- Postgres FTS index is built by the loader; reads the same files the docs browser shows.
- Search box ranks title matches above body matches and shows highlighted snippets.
- Stems work ("disco" -> "discovery"); typo tolerance is not promised but partial-word matches do.
- If the index is empty, the UI tells me to run the loader (and gives me a button).

## Adding a new review kind later

**As Joshua, I want to add a new review kind (e.g. "course module review") without redesigning the board, so the system grows with my needs.**

- Add a `REVIEW_KINDS` entry, a discovery rule, and a per-kind page.
- Board, item cards, walker, frontmatter rules require no changes.
