---
title: 'Handoff: Session State after SMI Walkthrough'
date: 2026-04-24
from_session: manual-test walkthrough + help-system review + product decisions
status: mid-session-snapshot
companion: 20260424-help-system-fix-pass.md
---

# Handoff: Session State after SMI Walkthrough

Fresh session picks up cold from this file. Pairs with [20260424-help-system-fix-pass.md](20260424-help-system-fix-pass.md) (the executable fix-pass plan for the help system).

## What this session did

1. **Wave A decisions** captured: no FIRC migration, keep flat Bloom thresholds, punt manual tests until after B + C.
2. **Wave B code cleanups** shipped -- PR #90 merged. CERTS unified as curated subset of CERT_APPLICABILITIES, ui subpath exports, `/plans` tab URL, review_status audit, scenario index decision, references scripts consolidated. Biome import-order follow-up in PR #91.
3. **Wave C docs work** shipped -- PR #89 merged. URL deep-linking plan promoted to ADR 013, IDEAS.md 2026-04-23 review pass, ADR 012 idempotency addendum (no gap found: DB UNIQUE + UPSERT is strictly stronger than the removed `REP_DEDUPE_WINDOW_MS`).
4. **Manual test walkthrough of spaced-memory-items** started. User walked `/memory/new`, `/memory/browse`, `/memory/review`, `/memory/[id]`, `/memory`. Raw feedback captured in `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` -- 24 items grouped into 7 clusters.
5. **Help-system review** run as a read-only audit. Found one critical bug (PageHelp ships unstyled -- references `--ab-*` tokens that do not exist) and wide coverage collapse on memory surfaces. Plan written: [20260424-help-system-fix-pass.md](20260424-help-system-fix-pass.md), shipped in PRs #100 + #101.
6. **Magic-strings / magic-numbers audit** launched as a read-only background agent. Report not yet received at time of this handoff.

## Shipped PRs this session

| PR   | Title                                                                | State  |
| ---- | -------------------------------------------------------------------- | ------ |
| #89  | docs(cleanup): wave C -- ADR 013 + IDEAS + idempotency addendum      | Merged |
| #90  | cleanup: wave B code (CERTS, ui exports, /plans tab, scripts, audit) | Merged |
| #91  | fix(study): biome import order in sessions.ts after CERTS migration  | Merged |
| #100 | docs(work): handoff for help-system fix pass                         | Merged |
| #101 | docs(work): require /ball-worktree + parallelization in help handoff | Merged |

All branches and worktrees from these PRs cleaned up.

## Product decisions locked in

From the SMI walkthrough and follow-up Q+A:

| Topic                                                | Decision                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Item #4 (review-this-card button on detail)          | **Drop it.** Replaced by separate card-detail vs card-page surfaces (see Cluster E).                  |
| Cluster F scope (optional reg ref on cards)          | **Broad.** Polymorphic `content_citations` across cards / reps / scenarios / nodes. One schema.       |
| Item #9 rating button copy                           | `Wrong / Hard / Right / Easy` as defaults, **as constants** in `libs/constants/src/study.ts`.         |
| Item #10 "Remove entirely" semantics                 | **Soft-remove from user's deck, reversible from Browse.** Capture why on every snooze / remove.       |
| `remove` reason comment                              | **Required**, not optional.                                                                           |
| Bad-question author-review loop                      | **Explicit re-entry banner**: "this was updated, does it look better now?"                            |
| Snooze duration UI                                   | **Three labeled levels, as constants.** No slider.                                                    |
| Snooze / remove mid-session replacement              | **Shrink on snooze, replace on remove.** Matches user intent per reason code.                         |
| Card-detail vs card-page split (new from user)       | Two surfaces: `/memory/<id>` owner-only detail, new public `/cards/<id>` shareable card page.         |
| Card cross-references (new from user)                | On card detail, show which sessions / plans / scenarios / reps cite this card.                        |

## The 24 SMI walkthrough items, clustered

Full verbatim capture: `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md`.

| Cluster | Items                        | Handling                                                             |
| ------- | ---------------------------- | -------------------------------------------------------------------- |
| A: Help / tooltip coverage   | 3, 5, 13, 14, 20, 21, 22, 24 | Covered by [20260424-help-system-fix-pass.md](20260424-help-system-fix-pass.md) Wave 2. |
| B: Review-flow UX            | 7, 8, 9, 12, 13, 16          | Work package `review-flow-v2` -- not yet spec'd.                     |
| C: Snooze + question-quality | 10, 11                       | Work package `snooze-and-flag` -- not yet spec'd.                    |
| D: URL + state for sessions  | 15, 18                       | Work package `review-sessions-url` -- not yet spec'd.                |
| E: Card-page + cross-refs    | 4 reframed + new ask         | Work package `card-page-and-cross-references` -- not yet spec'd.     |
| F: Content citations         | 1                            | Work package `content-citations` -- not yet spec'd.                  |
| G: Small fixes               | 2, 6, 17, 23                 | One small PR -- not yet launched. No work package needed.            |

## Build order (user-approved sequencing)

Sequential where marked depends-on, parallel otherwise. All work uses `/ball-worktree`.

| # | Work                                              | Type         | Depends on                  | Scope |
| - | ------------------------------------------------- | ------------ | --------------------------- | ----- |
| 1 | **Help-system Wave 1** (PageHelp tokens + polish) | Small PR     | none                        | Small |
| 2 | **Help-system Wave 2** (memory coverage pass)     | Medium PR    | Wave 1 merged               | Med   |
| 3 | **Small-fixes PR** (items 2, 6, 17, 23)           | Small PR     | none; can run parallel to 1/2 | Small |
| 4 | **Magic-strings fix PR** (from audit findings)    | Small/Med PR | audit report                | Depends on audit |
| 5 | `review-flow-v2` work package                     | Work package | help system in place        | Med   |
| 6 | `snooze-and-flag` work package                    | Work package | 5 (shares review chrome)    | Med   |
| 7 | `review-sessions-url` work package                | Work package | 5 (shares review chrome)    | Med   |
| 8 | `card-page-and-cross-references` work package     | Work package | none                        | Med   |
| 9 | `content-citations` work package                  | Work package | none                        | Large |

Items 5+6 may bundle into one PR since they both touch the review screen. Items 8+9 can run fully parallel with 5-7.

## Work package scope summaries

Notes for specs that have not yet been authored. When the user says go, run `/ball-wp-spec` with the relevant scope.

### `review-flow-v2`

Items 7, 8, 9, 12, 13, 16. Review screen overhaul:

- Confidence slider stays on question screen, not post-reveal. Button affordance (clickable), `1-5` keyboard, space = skip, adjustable on reveal page.
- Rating buttons redesigned with two-line labels: `Wrong` / `Hard` / `Right` / `Easy` (top line) + next-review interval (bottom line). Labels from `REVIEW_RATING_LABELS` constant. FSRS math unchanged.
- Undo toast: reposition below card, longer timeout, fade -- no layout shift.
- `?` help trigger replaced by a chicklet-shaped affordance (already covered by help-system Wave 1).
- Revisit "Wild Guess" confidence label. Low priority, user half-retracted.

### `snooze-and-flag`

Items 10, 11. Mid-session card action orthogonal to rating:

- Single `Snooze` button opens reason menu. Reason codes: `bad-question`, `wrong-domain`, `know-it-bored`, `remove`.
- `bad-question`: flag for author review. Comment required. Card snoozes 14 days default OR until fixed.
- `wrong-domain`: flag (may surface taxonomy issue). Long snooze (60d) or exclude from deck.
- `know-it-bored`: personal scheduling override. No content flag. Three duration levels as constants.
- `remove`: soft-remove from user's deck, reversible from Browse. Comment required.
- Per-card content feedback: like / dislike / flag during review, separate from recall rating. Dislike requires comment.
- Author-review loop: when `bad-question` resolves with a card edit, re-enters user queue with explicit "this was updated -- does it look better now?" banner.
- Replacement flow: **shrink on snooze, replace on remove.** Same-domain next-candidate query.
- New columns on `session_item_result` or new `card_snooze` table (schema decision in spec).
- Admin-facing author-review queue (future Hangar view, not user-facing in v1).

### `review-sessions-url`

Item 18. URL state for memory review sessions, three layers:

- **(a) Resume**: `/memory/review/<sessionId>`. New `memory_review_session` row at start. Close + reopen + same URL = same card list, same position. Summary state when complete.
- **(b) Redo**: `/memory/review?deck=<filterHash>`. Filter spec encodes domain / deck type / due-only / etc. Bookmarkable entry point for e.g. "my daily airspace review." Fresh session each visit.
- **(c) Share**: card detail URL already exists. Share button in review screen copies **the card URL**, not the session URL. Button opens popover with:
  - Copy link (card URL)
  - Report this card (hands off to Cluster C `snooze-and-flag` flag flow)

Build order inside the package: (a) first, (b) on top, (c) last.

### `card-page-and-cross-references`

Item 4 reframed + user's new cross-reference ask. Two connected pieces:

- **Card page** (`/cards/<id>` or similar): public, shareable view of a card. Front, back, domain, source if relevant. No scheduling internals. No edit. No owner-only actions. Safe to link externally.
- **Cross-references panel on card detail** (`/memory/<id>`): shows which sessions, study plans, scenarios, and reps cite or include this card. Query exists today via `session_item_result.card_id`. Plan-to-card enrollment still TBD.
- Navigation: "Share" button on card detail links to the public card page.

### `content-citations`

Item 1, broad scope. Polymorphic citation across content surfaces:

- New `content_citations` table: `source_type` (card / rep / scenario / node) + `source_id`, `target_type` (regulation_node / ac_reference / external_ref / ...) + `target_id`, `citation_context` (optional note).
- Authoring UI affordance on each content type: "cite a reference" picker.
- Read pattern: given a content item, show its citations. Given a reference (reg node), show what cites it.
- Migration for existing cards to backfill citations where the body text contains `14 CFR X.Y` patterns (optional; spec decides).

## What's pending at time of writing

| Item                                                  | State                                |
| ----------------------------------------------------- | ------------------------------------ |
| Magic-strings / magic-numbers audit                   | Background agent running; no report yet |
| Help-system fix pass (Wave 1 + Wave 2)                | Handoff shipped (#100 / #101); awaiting fresh-session execution |
| 5 work-package specs (items 5-9 above)                | Not authored yet; awaiting user go   |
| Small-fixes PR                                        | Not launched yet                     |
| Manual test walkthroughs for the other 5 features     | Deferred until SMI feedback is resolved |

## Other work the user flagged as out of scope for me

User instruction (from session context): mind your own business on other agents' work. Do not narrate, audit, or comment on:

- `wp-hangar-scaffold` (PR #72 -- shipped pre-session)
- `wp-hangar-registry` (Phases 1-5 in #92 + #97; Phases 6-10 agent running)
- `wp-hangar-sources-v1` (blocked on registry)
- `wp-hangar-non-textual` (spec in #96; impl blocked on sources-v1)
- `session-legibility-and-help-expansion` parent WP

If you see concrete blockers (conflict, broken state, data loss risk) speak up; otherwise leave them alone.

## Rules that apply to all next-session work

From `CLAUDE.md` global + project:

- **Bun only.** Never npm / yarn / pnpm.
- **Svelte 5 runes only.** No `$:`, no `export let`, no `<slot>`, no Svelte 4 stores, `$app/state` not `$app/stores`.
- **`@ab/*` imports** across libs. No relative paths across lib boundaries.
- **No magic strings / numbers.** Everything in `libs/constants/`.
- **All routes through `ROUTES`** in `libs/constants/src/routes.ts`.
- **Drizzle ORM only.** No raw SQL.
- **NO AI attribution** in commits, PR bodies, or docs. No Co-Authored-By, no "Generated by Claude".
- **Never use the word "honest"** as an agent qualifier.
- **Never use em-dash or `--`** as a sentence separator in doc prose.
- **`/ball-worktree`** for every file-writing task. Never edit from the main repo root.
- **Parallelize within a wave** where files do not overlap. Default to parallel.
- **Never commit directly to main.** Always branch + PR.
- **`bun run check`** passes clean before every PR.
- **Clean up worktree + branch** after each merge.

## Launch prompt for the next session

Paste this into a fresh session to resume all pending work:

```text
You are continuing the airboss SMI walkthrough work. Read these three files in full before doing anything:

1. docs/work/handoffs/20260424-session-state-smi-walkthrough.md (this snapshot)
2. docs/work/handoffs/20260424-help-system-fix-pass.md (executable plan for the help system)
3. docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md (raw user feedback, 24 items)

Pending in priority order:

A. Help-system Wave 1 + Wave 2 per the fix-pass handoff. Uses /ball-worktree. Wave 1 merges before Wave 2. Parallelize within Wave 2 where content and placements do not overlap files.

B. Check if the magic-strings audit report is available. If it is, read it and propose a fix-PR plan for the user. If not, leave the audit running and check back.

C. Small-fixes PR (SMI items 2, 6, 17, 23): missing Status / Source badges on card detail, rename Start nav for clarity, rephrase the 91.155(b)(2) question for clarity, add per-card scheduling stats to browse rows. /ball-worktree; independent of A and B; can run in parallel.

Do NOT spec or start the 5 pending work packages (review-flow-v2, snooze-and-flag, review-sessions-url, card-page-and-cross-references, content-citations) without explicit user go-ahead. Their scope summaries are in this handoff doc if the user asks.

When reporting to the user, stay concise. State results and decisions directly. No narration of internal deliberation.
```
