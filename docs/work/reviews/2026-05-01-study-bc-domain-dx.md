---
feature: study-bc-domain
category: dx
date: 2026-05-01
branch: main
counts:
  critical: 0
  major: 4
  minor: 5
  nit: 3
status: unread
review_status: done
---

## Status as of 2026-05-04

| Severity | Count | Closed | Open |
| -------- | ----: | -----: | ---: |
| critical |     0 |      0 |    0 |
| major    |     4 |      2 |    2 |
| minor    |     5 |      1 |    4 |
| nit      |     3 |      0 |    3 |

### MAJOR: `SessionNotFoundError` thrown on review-ownership failure -- CLOSED

PR #437. `libs/bc/study/src/sessions.ts:862-870, 920-927` introduces `ReviewNotFoundError(reviewId, userId)` and the `assertReviewForUser` helper now throws it. Test at `sessions.test.ts:351-369` asserts the disambiguation. Closed.

### MAJOR: `process.stderr.write` short-circuits logger contract -- CLOSED

`libs/bc/study/src/library-by-cert.ts:14,20,97`. `createLogger('study:library-by-cert')` adopted; the formerly-stderr "missing prereq DAG node" path now calls `log.warn('cert has no credential row; returning primary refs only', ...)`. Closed.

### MAJOR: `buildSyllabusTreeFromRows` orphan silent surface -- STILL OPEN

`libs/bc/study/src/syllabi.ts:140-170` still pushes orphans at root with no log + no `{ roots, orphans }` return shape. Trigger: roll into next syllabi-tree refactor; either add `createLogger('study:syllabi')` + `log.warn` on orphan, or change return shape to surface the data-integrity event.

### MAJOR: Two `SourceRefRequiredError` classes collide at barrel -- STILL OPEN

`libs/bc/study/src/cards.ts:53-58` and `libs/bc/study/src/scenarios.ts:98-103` still define separate classes; only the cards version is in `index.ts:45`. Trigger: roll into the BC error-class hygiene sweep mentioned in DX MINOR + backend MINOR; hoist a single class and barrel it once.

### MINOR: Bare `throw new Error(...)` for upsert RETURNING-empty paths -- STILL OPEN

Same finding as backend MINOR ("`goals.ts` returns `Error('createGoal failed')`"). `libs/bc/study/src/goals.ts:267,272,352,408`, `credentials.ts:478`, `syllabi.ts:502,534` still bare-Error. Trigger documented in backend audit.

### MINOR: `CitationNotFoundError` masks ownership failure in `deleteCitation` -- STILL OPEN

`libs/bc/study/src/citations/citations.ts:312-313` still throws `CitationNotFoundError` for both not-found and not-owned cases. Trigger: introduce `CitationNotOwnedError` in next citation-permissions WP; route layer can map both to 404 for security obfuscation, BC truth-tells.

### MINOR: `FeedbackCommentRequiredError` / `SnoozeCommentRequiredError` lack valid-options -- STILL OPEN

`libs/bc/study/src/feedback.ts:21-26` and `libs/bc/study/src/snooze.ts:42-47` error messages still name only the failing signal, not the requiring set. Trigger: small DX-polish PR; include the "signals requiring comment" set in each message.

### MINOR: `seeders/section-tree.ts` silent missing body -- CLOSED

`libs/bc/study/src/seeders/section-tree.ts:55-65`. `if (!existsSync(bodyAbsPath)) throw new Error('section-tree manifest references missing body file: ...')`. Mirrors `whole-doc.ts:34-38` per the source comment. Closed.

### MINOR: `mapToPanelError` "An unexpected error occurred" too generic -- STILL OPEN

`libs/bc/study/src/dashboard.ts:652-661` still returns the bare string with no correlation id. Trigger: roll into next observability/log-correlation pass; emit a short ref hash on both the logged event and the returned string.

### NIT: `LensError` `[lensKind]` prefix style -- STILL OPEN

`libs/bc/study/src/lenses.ts` unchanged. Trigger: bundle into BC error-class hygiene sweep.

### NIT: Cycle-error messages as id-only paths -- STILL OPEN

`knowledge.ts:59-63` and `credentials.ts:69-77` cycle messages remain id-only. Trigger: when the next seed authoring task surfaces a cycle in the wild, lift to slug/title formatting then.

### NIT: `manifest-validation.ts` Zod refines voice variance -- STILL OPEN

Trigger: small follow-up sweep in next manifest-validation PR; quote the offending value in every refine message.

### Final verdict

2 of 4 majors closed (`SessionNotFoundError` -> `ReviewNotFoundError`, stderr -> logger). 1 of 5 minors closed (seeders consistency). 2 majors + 4 minors + 3 nits remain with concrete triggers, mostly clustered around the BC error-class hygiene sweep that backend audit also calls for. `review_status` flipped to `done`.

## Summary

The study BC overall sets a high DX bar: typed errors are pervasive (40+ named error classes), error messages identify the offending entity by id/key, deck-spec preserves `cause`, and `dashboard.ts` sets the gold-standard pattern (`createLogger('study:dashboard')` plus `mapToPanelError` that logs the raw cause server-side and returns a user-safe phrase). The 2am-debuggable foundations are largely there.

The findings below are concentrated in three patterns that drift from that bar:

1. Direct callers of unexpected-state paths get misleading error names (`SessionNotFoundError` thrown when a `review` row lookup actually failed; `CitationNotFoundError` thrown when ownership failed).
2. Logging is inconsistent across the BC: most files have no logger, `library-by-cert.ts` uses `process.stderr.write`, only two files have adopted `createLogger`. Quiet failures like the silent-orphan path in `buildSyllabusTreeFromRows` and the silent missing-body path in `seeders/section-tree.ts` lose the seam an operator needs.
3. Two distinct `SourceRefRequiredError` classes (one in `cards.ts`, one in `scenarios.ts`) collide on the public barrel: `instanceof` checks against the barrel-exported class miss the scenarios variant.

Plus a handful of bare `throw new Error(...)` left from boilerplate that should be typed errors, and a few thin error messages that don't list valid options.

## Issues

### MAJOR: SessionNotFoundError is thrown when the actual failure is a review-ownership check

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/sessions.ts:874-881`

Problem: `recordItemResult` does two pre-write lookups - the session row and (when `result.reviewId` is provided) the review row scoped to the user. Both failures throw `SessionNotFoundError(sessionId, userId)`. So when a caller passes a `reviewId` that doesn't belong to the user (or doesn't exist), the operator at 2am sees "Session abc not found for user xyz" - except the session exists. The traceback points at the wrong primary key, a wasted half hour searching session data, and the actual mismatched review id is gone. This is the `instanceof`-friendly typed-error pattern that exists everywhere else (`SessionSlotNotFoundError`, `CardNotFoundError`, `ReferenceNotFoundError` -- all carry the failing entity's id) failing at exactly the spot where it matters.

Fix: introduce a `ReviewNotFoundError` (or reuse `NoReviewToUndoError` shape) that carries `reviewId` + `userId`, and throw it from the second lookup. The route layer can still translate any of these to a 4xx; the BC contract should not lie about which row failed.

### MAJOR: `process.stderr.write` short-circuits the logger contract

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/library-by-cert.ts:94-98`

Problem: Two files in the BC adopted `createLogger('study:...')` (`dashboard.ts`, `engine-targeting.ts`). The rest stay silent. `library-by-cert.ts` instead writes a multiline message directly to `stderr` with manual `\n` and string interpolation. At 2am, structured log search ("show me every `library-by-cert` warn for user X this week") finds nothing - the line is unstructured prose with no level, no logger name, no operation tag. Worse: the comment frames it as "a missing prereq DAG node is a seed bug" which is exactly the kind of signal you want filterable.

Fix: replace with `const log = createLogger('study:library-by-cert')` + `log.warn('cert has no credential row for slug', { metadata: { cert, slug } })`. Then the whole BC has one logging idiom.

### MAJOR: `buildSyllabusTreeFromRows` silently surfaces orphans at root with a misleading comment

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/syllabi.ts:154-160`

Problem: When a `parentId` doesn't resolve to a known node, the orphan is pushed at the tree root. The comment claims this prevents the row from "disappearing silently" - but the resolution is just as silent: the orphan renders as if it were a top-level area, and downstream readers can't distinguish "real area" from "orphan with broken parent". The data-integrity event leaves zero trace. There's no logger, no flag on the returned tree, nothing.

Fix: log a `warn` with the syllabusId + orphan node id + dangling parentId, OR return a `{ roots, orphans }` shape so consumers (and tests) can assert on the seam. Surfacing-at-root without a signal is the worst of both worlds.

### MAJOR: Two `SourceRefRequiredError` classes collide at the barrel

Files:
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/cards.ts:53-58`
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/scenarios.ts:98-103`
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/index.ts:45` (only the cards version is barreled)

Problem: Both classes have identical name (`SourceRefRequiredError`) and identical message text, but are distinct classes. The cards version is exported from `@ab/bc-study`; the scenarios version is not. A route handler that imports `SourceRefRequiredError` from `@ab/bc-study` and does `if (err instanceof SourceRefRequiredError)` to render a friendly form error will silently miss the scenarios case - it'll fall through to the generic 500 path even though the function name reads correct in code review. Self-comment in `scenarios.ts` even claims the names are "mirrored" so callers can discriminate uniformly, which is the opposite of what happens.

Fix: hoist a single `SourceRefRequiredError` to a shared location (or re-export the cards version from scenarios.ts) and barrel one class. Drop the duplicate definition.

### MINOR: Bare `throw new Error(...)` for "shouldn't happen" upsert paths

Files:
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/goals.ts:253,258,338,394`
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/credentials.ts:480`
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/syllabi.ts:502,534`

Problem: Five upserts throw `new Error('upsertX failed for ${id}')` when `RETURNING` produces no row. These should be typed (`UpsertFailedError` or per-entity variants) for the same reason the rest of the BC standardised on typed errors: route layers that catch `Error` swallow real bugs, and 2am operator log search by error name misses these. The message is fine; the type isn't.

Fix: introduce one `UpsertReturnedNoRowError` in a shared place (or per-BC variants) so callers can distinguish "DB returned empty" from "user tried to do an invalid thing".

### MINOR: `CitationNotFoundError` masks the ownership failure in `deleteCitation`

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/citations/citations.ts:312-313`

Problem: When a row exists but `createdBy !== userId`, the function throws `CitationNotFoundError`. This is intentional security obfuscation against the caller, but the *server log* and the *typed error* shouldn't lie - the operator debugging "why can't user X delete citation Y" sees a not-found at the BC layer when the row is right there. The route layer should be the obfuscation seam, not the BC.

Fix: throw a distinct `CitationNotOwnedError` (or `CitationDeleteForbiddenError`) inside the BC; the route maps both to a 404 if the security model requires it. Keep the truth at the BC layer where the operator needs it.

### MINOR: `FeedbackCommentRequiredError` / `SnoozeCommentRequiredError` don't list which signals require comment

Files:
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/feedback.ts:21-26`
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/snooze.ts:42-47`

Problem: The error messages name the failing signal but not the rule (which signals require a comment). A new contributor reading "Feedback signal 'flag' requires a comment" doesn't know whether 'like' also requires one. The "valid options" half of the DX rubric (function name + offending value + valid options) is missing.

Fix: include the requiring set in the message: `Feedback signal 'flag' requires a comment (signals requiring comment: dislike, flag)`. Cheap and 2am-helpful.

### MINOR: `seeders/section-tree.ts` silently substitutes empty body when file is missing

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/seeders/section-tree.ts:57-58`

Problem: `const contentMd = existsSync(bodyAbsPath) ? await readFile(...) : '';` -- a missing body file becomes an empty section row with no warning, no entry in `summary`, no log. The sibling `seeders/whole-doc.ts:34-38` correctly throws when the body file is missing. Inconsistent behaviour between two adapters that share a contract; the section-tree silent path is the dangerous one (a typo in `body_path` produces a successful seed run with blank rows).

Fix: throw the same way `whole-doc.ts` does, OR push a warning into `summary` and emit via `context.onProgress`. Don't both throw and not-throw across adapters.

### MINOR: `mapToPanelError` collapses unknown error to "An unexpected error occurred"

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/dashboard.ts:648-657`

Problem: The function name (and prior author intent) is exemplary - it logs the raw cause to the structured logger and returns a user-safe string. The string itself is too generic for the dev/staging case. There's no correlation id or logger snippet for the user to paste back ("error appeared at 03:14:22 with id ...") so the support loop is "user reports unexpected error -> dev greps logs by user id and timestamp".

Fix: include the `Date.now()` short hash or a log key in both the logged event and the returned string ("An unexpected error occurred (ref dx-1715283145)"). Even a 6-char prefix collapses the support loop.

### NIT: `LensError` prefixes the message with `[lensKind]` -- inconsistent with sibling errors

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/lenses.ts:175-183`

Problem: Every other error in the BC keeps the entity in a `public readonly` field and lets `error.name` + the field's id carry the metadata. `LensError` baked the `[lensKind]` into the message string, which means log filters by message prefix work but `instanceof LensError && err.lensKind === 'acs'` is the only structured-discriminator path. Two valid styles in one BC.

Fix: drop the `[${lensKind}]` prefix from the super call; keep `lensKind` as a public field. The `name` already says `LensError`; consumers that care can read the field.

### NIT: `KnowledgeGraphCycleError` / `CredentialPrereqCycleError` print cycle path with `->` (correct), but no node titles

Files:
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/knowledge.ts:59-63`
- `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/credentials.ts:69-77`

Problem: At 2am with a cycle in the credential prereq DAG, the message `Credential prereq cycle detected: cred_01... -> cred_02... -> cred_01...` is a database-id list. The operator has to round-trip through a separate query to see the human cert names. Fine for an internal CI guard; less fine for a hand-driven seed run.

Fix: optionally accept a `slug` (for credential) or `title` (for knowledge node) lookup at construction and emit "Cycle: private (cred_01...) -> recreational (cred_02...) -> private". The cycle field stays canonical (ids); only the formatted message changes. Pure polish.

### NIT: `manifest-validation.ts` message strings vary in voice

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/study/src/manifest-validation.ts` (multiple)

Problem: Zod refines mix imperative ("must start with `airboss-ref:`") and declarative ("targetPage must match printed FAA <chapter>-<page> format") and don't always include the failing value. The companion errors in `reference-errata.ts` (`validateErrataInsert`) consistently echo the bad value - that's the right pattern.

Fix: a follow-up sweep to ensure every refine quotes the offending value. Not load-bearing today; pays off the first time a manifest fails CI in a strange shape.
