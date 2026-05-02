---
feature: study-bc-domain
category: security
date: 2026-05-01
branch: main
counts:
  critical: 0
  major: 2
  minor: 5
  nit: 3
status: unread
review_status: pending
---

## Summary

Reviewed `libs/bc/study/src/` (full directory, ~30 BC files + citations + seeders). The study BC has a clean security posture overall: every per-user read and write path is consistently scoped by `userId` predicate (cards, scenarios, reviews, sessions, plans, snooze, feedback, calibration, stats, references read-state, review-sessions, saved-decks, goals). All SQL goes through Drizzle. The two `aliasedTable` + `sql.identifier` patterns in `scenarios.ts` and `dashboard.ts` are used for correlated-subquery aliasing, not user input. All `sql\`...\`` template tags interpolate column refs and bound parameters, never raw user strings; `sql.raw` appears only in `schema.ts` DDL (CHECK constraints built from constants arrays, not user input). Zod is used at the BC boundary for cards and scenarios; goals and references fall back on caller-side validation.

No critical, exploitable issues. The findings are defense-in-depth gaps (BC writers exposed without auth gates, missing pagination ceilings, BC-level zod skipped on goals/knowledge writes, and a documented "any authenticated user can cite from a node" v1 carve-out in citations).

## Issues

### MAJOR: Knowledge-graph and credential write paths exposed from BC barrel without auth gate

File: `libs/bc/study/src/knowledge.ts`, `libs/bc/study/src/credentials.ts`, `libs/bc/study/src/syllabi.ts`, `libs/bc/study/src/references.ts`, `libs/bc/study/src/index.ts`

Problem: `upsertKnowledgeNode`, `replaceNodeEdges`, `refreshEdgeTargetExists`, `upsertCredential`, `upsertCredentialPrereq`, `upsertCredentialSyllabus`, `upsertSyllabus`, `upsertSyllabusNode`, `replaceSyllabusNodeLinks`, `upsertReference`, `upsertReferenceSection`, `replaceFiguresForSection`, `attachSupersededByLatest` are all exported from the BC barrel (`index.ts`). Their docstrings call them "build-only helpers (consumed by `scripts/db/seed-...`)" but the BC layer carries no `userId`/admin-role check, no caller assertion, and no env guard. Any future route that imports `@ab/bc-study` could call these and rewrite shared knowledge nodes, syllabi, credentials, or reference rows for every user. This is a latent IDOR/authz bypass if a route author wires one up without adding their own gate.

Fix: Either (a) split build-only helpers into a separate non-public barrel (e.g. `@ab/bc-study/admin` exported only to scripts), or (b) require an `actor` argument and assert `actor.role === 'admin'` (or equivalent) inside each upsert before issuing the write. Option (a) matches the patterns elsewhere in the repo. As a stopgap, add `// build-only: not safe for route handlers` comments + a lint rule that bans these symbols outside `scripts/`.

### MAJOR: `goals.ts` write paths skip BC-level zod validation that cards/scenarios run

File: `libs/bc/study/src/goals.ts`

Problem: `cards.ts` runs `newCardSchema.parse(...)` and `updateCardSchema.parse(...)` inside the BC ("Inputs are validated here in addition to the route layer so cross-BC callers and scripts can't inject invalid values" -- per the file's own docstring). `scenarios.ts` runs `newScenarioSchema.parse` and `submitAttemptSchema.parse` for the same reason. `goals.ts` does not -- `createGoal`, `updateGoal`, `addGoalSyllabus`, `addGoalNode`, `setGoalFocusDomains`, `setGoalSkipDomains`, `setGoalSkipNodes`, `setGoalNodeWeight`, `setGoalSyllabusWeight`, and `applyCertGoalsToPrimaryGoal` accept their inputs typed but never call the matching schemas in `credentials.validation.ts` (`createGoalInputSchema`, `addGoalSyllabusInputSchema`, `addGoalNodeInputSchema`). Title length, notesMd length, weight bounds, target-date format, and status enum all rely entirely on the route layer.

Fix: Mirror the cards/scenarios pattern and add `createGoalInputSchema.parse(input)` (etc.) at the top of each goals write path. The schemas already exist; this is purely an integration gap.

### MINOR: `recordPhaseVisited` / `recordPhaseCompleted` accept arbitrary `nodeId` and `phaseId` strings

File: `libs/bc/study/src/knowledge.ts:1218`, `libs/bc/study/src/knowledge.ts:1264`

Problem: These functions write into `knowledge_node_progress` keyed on `(userId, nodeId)` and append `phaseId` to the `visitedPhases`/`completedPhases` arrays without verifying that the node exists or that the phase id is one of the recognised phase slugs. A caller can poison the per-user progress arrays with any string. Compare with `plans.ts:addSkipNode` which calls `getNodesByIds` to validate the node id before writing.

Fix: Validate `nodeId` against `knowledge_node` (single-row read or batch through `getNodesByIds`) and validate `phaseId` against the constants vocabulary before write. Own-account-only data integrity today, but the BC contract is "validate at the boundary."

### MINOR: `setNotes` / `recordHeartbeat` / `setReadStatus` / `setComprehended` do not verify `referenceSectionId` exists

File: `libs/bc/study/src/references.ts:576-783`

Problem: The handbook read-state writers accept any `referenceSectionId` and upsert into `reference_section_read_state`. The FK in the schema enforces target existence at the DB level (per ADR 020 / `reference_section`) -- so an unknown id will throw. But `setNotes` (line 695) inserts up to 64KB of `notesMd` via `onConflictDoUpdate`; if the FK check happens after the insert path builds the row, that's wasted work and the error surfaces as a generic constraint-violation rather than a typed `HandbookSectionNotFoundError`. Cards/scenarios pre-check.

Fix: Add a single existence probe (`select id from reference_section where id = ?`) at the top of each write path and throw `HandbookSectionNotFoundError` -- consistent with how `snooze.ts:ensureCardExistsForUser` handles the analogous case.

### MINOR: `searchRegulationNodes` / `searchAcReferences` / `searchKnowledgeNodes` accept unbounded `limit`

File: `libs/bc/study/src/citations/search.ts:42`, `:75`, `:108`

Problem: Each search function takes `limit: number = DEFAULT_LIMIT (25)` but does not cap the value when the caller passes a larger one. A route that forwards a query-string `?limit=` value (or any cross-BC caller) can request unbounded result sets.

Fix: `const cappedLimit = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT)` at the top of each function (define `MAX_SEARCH_LIMIT` in `@ab/constants`). Same pattern is missing on `getCards` / `getCardsCount` / `getScenarios` / `getScenariosCount` / `getSessions` etc. -- the BC trusts caller-supplied limits everywhere. A repo-wide `MAX_PAGE_SIZE` constant + uniform clamping is the cleanest fix.

### MINOR: External-ref citation `targetId` validation accepts any `http(s)://...` URL with no scheme/host allowlist

File: `libs/bc/study/src/citations/citations.ts:212`

Problem: `verifyTargetExists` for `EXTERNAL_REF` accepts any URL whose protocol is `http:` or `https:`. This is fine for the read path, but the URL is later returned through `resolveCitationTargets` as a `href` which the public card surface (`composePublicCardCitations`) emits as a clickable link. There is no host allowlist, no SSRF guard, and `http:` (cleartext) is allowed alongside `https:`. The actual XSS guard happens at the UI render layer, but a `data:` URL won't reach here because the protocol check rejects it -- so XSS is not exposed; the gap is more about link quality (cleartext) and any future BC consumer that round-trips this URL into a server-side fetch.

Fix: (a) Tighten the protocol check to `https:` only, since external citations are user-shared evidence sources where cleartext is rarely intentional. (b) Document explicitly in `composePublicCardCitations` and the picker that the URL is user-supplied and must be `rel="noopener noreferrer nofollow"` + `target="_blank"` at every render site.

### MINOR: Citation source ownership for `NODE` type allows any authenticated user to attribute citations to any knowledge node

File: `libs/bc/study/src/citations/citations.ts:165`

Problem: `verifySourceOwnership` for `CITATION_SOURCE_TYPES.NODE` returns `true` for any node that exists, with the docstring "For v1 we allow any authenticated user to cite from a node they are viewing (authoring is via the hangar/editor, not here). A future permissions gate lands in the node-editor PR when per-node ACLs arrive." The citation is then attributable in the "Cited by" panel for that node, visible to every user. A bad actor could inject low-quality / spam citations on shared knowledge nodes; `createdBy` is recorded but the row is visible everywhere.

Fix: Either (a) implement the deferred per-node ACL gate now (preferred -- the ADR/spec already calls it out as needed), or (b) restrict node-as-source citations to a whitelist of admin/author users at the BC layer until the ACL lands. The CLAUDE.md "no undecided 'considerations for future work'" rule applies: pick a trigger and document it in an ADR, or close it now.

### NIT: `decodeDeckSpec` returns parsed JSON cast to `ReviewSessionDeckSpec` without runtime schema validation

File: `libs/bc/study/src/deck-spec.ts:128`

Problem: `decodeDeckSpec` validates that the decoded value is an object but doesn't validate field shapes against a zod schema. A user-controlled `?deck=` URL could carry `{ domain: 12345, dueOnly: "yes", tags: { not: "an array" } }`. Most fields are read defensively (e.g. `summarizeDeckSpec` type-guards each field), and `normalizeDeckSpec` rewrites unknown domains to null. But the spec is then stored verbatim as JSONB on `memory_review_session.deckSpec` and travels through `computeDeckHash` (canonical JSON of arbitrary input). Storage bloat / hash collisions across malformed specs are theoretical.

Fix: Add a lightweight `reviewSessionDeckSpecSchema` zod and call it inside `decodeDeckSpec`. Throw `DeckSpecDecodeError` on shape mismatch so the resolver can render a 400 with a helpful message instead of silently storing junk.

### NIT: `getPublicCard` exposes any active card by id with no ownership scoping

File: `libs/bc/study/src/cards-public.ts:85`

Problem: This is documented as intentional ("`userId` is intentionally not a parameter -- the public view does not know who 'owns' a shared card and the author's ownership is not part of the identity projection exposed here"), but worth flagging: anyone with a card id can read its `front`/`back`/`domain`/`cardType`/`sourceType` regardless of who authored it. The card id is `card_<ULID>` (122 bits, unguessable in practice), so this is closer to a capability URL than a true public surface. Also exposes user-authored content (potentially private notes) to anyone the link is shared with.

Fix: If the spec genuinely calls for "share by URL," add an explicit `is_public` boolean on `card` and gate `getPublicCard` on it (require the author to opt in before the URL becomes shareable). If the spec only ever wanted course/product cards public, gate on `sourceType !== CONTENT_SOURCES.PERSONAL` here. Either path narrows the capability surface and matches the principle of least exposure.

### NIT: `restoreCardByCard` error message leaks the lookup tuple

File: `libs/bc/study/src/snooze.ts:243`

Problem: `throw new SnoozeNotFoundError(\`${cardId}:${userId}\`)` puts the userId into the error message. This propagates into logs and (depending on route handler) potentially into HTTP responses. The userId is the caller's own id today (the function only writes the caller's row), so the leak is to the caller themselves -- minor, but the pattern would bite if the function ever grows a "restore on behalf of another user" path.

Fix: Drop the userId from the error message: `throw new SnoozeNotFoundError(cardId)`. The class already has `snoozeId` as a public field; if the field name is misleading (it's a card+user composite here), rename or add a separate `CardSnoozeNotFoundForUserError` that does not surface the user id at all.
