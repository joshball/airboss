---
feature: hangar-cluster
category: security
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 0
  major: 2
  minor: 6
  nit: 4
---

## Summary

The hangar cluster's authn/authz scaffolding is solid. Every page-server load and form action invokes `requireRole` at the page level, the per-action dual gate documented in `libs/auth/src/auth.ts` is honored everywhere I checked, write helpers funnel through `bc/hangar/registry.ts` with rev-based optimistic locking, audit-write coverage looks complete, and Drizzle is the only DB path (no raw SQL outside parameterized `sql\`\`` template fragments). better-auth backs sessions with sameSite + crossSubDomain cookies, CSRF checks are framework-default, and CSP/security-headers are wired in `hooks.server.ts` + `svelte.config.js`. Path traversal is guarded in three different ways across the file-serving routes, and the upload action defangs the original filename by writing to a fixed temp path before the worker even sees it.

The two notable gaps are SSRF in the binary-visual fetch pipeline (operator-supplied `bv_index_url` and source `url` can target loopback/metadata hosts) and the `bv_index_url` Zod gap that lets the same field skip the http(s) regex applied to the main `url` column. Neither is exploitable by an unauthenticated attacker -- both require an AUTHOR+ session -- but the surface is the authoring console for the whole platform, which is exactly where defense-in-depth around outbound fetches matters. The remaining findings are mostly DiD nits: missing scheme/host allowlisting for the citation URL, unverified job ownership on cancel, archive-rotation regex assumes well-formed dates, and the upload extension can include `/` characters and produce nested directories under the blob root (no escape, just messy).

## Issues

### MAJOR: Server-side request forgery via binary-visual `bv_index_url` and source `url`

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/source-fetch.ts:205-211`, `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/source-form.ts:84-105`, `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/form-schemas.ts:132-137`

Problem: Any AUTHOR/OPERATOR/ADMIN can create a `binary-visual` source and supply an arbitrary `bv_index_url`. The fetch job spawns `defaultFetchHtml(locator.index_url)` which calls `fetch(url)` with no scheme allowlist, no host check, and no private-IP filtering. The resolved download URL is then handed to `downloadFile(...)` which writes the response body to disk and streams the response into the job log (visible to all authoring users). An author-tier account could point `bv_index_url` at `http://169.254.169.254/latest/meta-data/iam/security-credentials/` (cloud metadata), `http://localhost:5435/` (internal Postgres), `http://localhost:5173/api/auth/...` (sibling app's auth), or any internal corp service, and read responses out of the live job log. The same applies to the `url` column on every source kind: `sourceSchema` only enforces `^https?://` (no host check) and the fetcher follows it verbatim.

Fix: Add an outbound-URL allowlist (or denylist of RFC1918 + 127.0.0.0/8 + 169.254.0.0/16 + 0.0.0.0 + ::1 + fe80::/10 + the cloud metadata IPs) inside `defaultFetchHtml` and `defaultDownloader`, applied to both the configured URL and any redirected target (resolve hostname to IP, reject if private). Tighten the form schema: add a `bv_index_url` Zod field that mirrors the main `url` regex, and consider an env-var allowlist of permitted external hosts (`AIRBOSS_FETCH_ALLOWED_HOSTS`) since the only legitimate index targets are `aeronav.faa.gov` / `www.faa.gov` / similar operator-known domains. At minimum: enforce `https://`, reject literal-IP hosts, and reject hosts that resolve to private ranges. This is the kind of fetch wrapper that belongs in a shared lib so any future job kind that fetches operator-supplied URLs gets the guard for free.

### MAJOR: `bv_index_url` skips http(s) regex enforced on the main `url` column

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/source-form.ts:84-105`

Problem: The form pipeline runs `sourceSchema.safeParse({ ... url, ... })` for the top-level fields, where `url` is regex-checked as `^https?:\/\//i`. The `bv_index_url`, `bv_region`, and `bv_cadence_days` fields are validated separately via inline empty/integer checks before being stuffed into `locatorShape.index_url`. There's no scheme check, no length cap, no character whitelist. An author could submit `bv_index_url=javascript:alert(1)` (rendered later in form-rehydrate flows), `bv_index_url=file:///etc/passwd` (Node's `fetch` rejects but the string still hits log lines and the DB), or any other scheme. The companion sectional fetcher (issue above) consumes this value as-is.

Fix: Promote the BV-specific fields to a real Zod schema that mirrors `sourceSchema.url` for `index_url`, caps `region` length, and bounds `cadence_days`. Run `safeParse` over the BV branch the same way the text branch runs through `sourceSchema`. This collapses validation into one consistent code path and removes the second-class manual checks.

### MINOR: Upload `originalFilename` extension can contain path-segment characters and produce nested directories

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/upload-handler.ts:82-84`, `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/upload-helpers.ts:7-12`

Problem: `extensionOf(originalFilename)` returns `filename.slice(lastDot + 1).toLowerCase()` with no character filtering. Because `lastIndexOf('.')` is the last dot, the resulting extension cannot contain `..` (verified) so path-escape outside `<blobRoot>/<type>` is not possible. However the extension CAN contain `/` characters: a filename of `x.foo/bar` produces extension `foo/bar`, and `destFilename(sourceId, ext)` builds `myid.foo/bar` which `resolve()` collapses to a real subdirectory under destDir. The `path` column stored in DB is then `<type>/myid.foo/bar`, the `/files` browser lists nothing under it (it filters by `<id>.` prefix on the same flat dir), and the file becomes effectively orphaned but still on disk and writable through the upload handler. Not a security boundary breach, but it lets one author quietly seed a nested directory tree under an operator's blob root.

Fix: In `extensionOf`, strip everything after the first non-`[a-z0-9]` character in the slice, or run the extension through a `[a-z0-9]+` whitelist and fall back to the existing-row `format` when validation fails. Same fix applies to `archiveFilename` which feeds the extension verbatim into the prune-eligible filename.

### MINOR: Job cancel does not verify ownership; any AUTHOR can cancel any other actor's running job

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/jobs/[id]/+page.server.ts:46-60`, `/Users/joshua/src/_me/aviation/airboss/libs/hangar-jobs/src/worker.ts:264-281`

Problem: `cancelJob(jobId, user.id)` is called from the page action with no check that `job.actorId === user.id` or that the user has elevated privilege. The role gate is just `AUTHOR | OPERATOR | ADMIN`. In practice this is fine for a small co-located authoring team, but the gate is wider than the concept "I can cancel my own jobs"; a low-trust author can interrupt an admin's long-running fetch/extract without any audit signal that distinguishes "user cancelled their own work" from "user cancelled someone else's work."

Fix: Either gate `cancel` to `OPERATOR | ADMIN` only (operationally simplest), or verify `job.actorId === user.id || user.role === ADMIN` before calling `cancelJob`. The latter keeps self-service cancellation working while preventing cross-actor interference. The audit row is already written by `cancelJob` with the cancelling actor's id, so the trail exists, but the gate should enforce the policy before the write.

### MINOR: Audit-detail page ships full `before` / `after` / `metadata` payloads with no field allowlist

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/admin/audit/[id]/+page.server.ts:23-42`, `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/audit-queries.ts:257-294`

Problem: `getAuditEntry` returns every column on the audit row including the full `before` / `after` JSONB blobs and the entire `metadata` object. The audit-detail page passes them through to the client untouched. Audit rows for the registry write paths (createReference, updateReference, etc.) snapshot the entire row, which is fine; audit rows for ban/role-change snapshot only the touched columns, also fine. But the BC has no schema constraint on what gets written to `metadata` -- a future caller could stick a session token, a temp-file path, or an internal IP into metadata and the admin audit explorer would render it. Today the surface is ADMIN-only so the blast radius is small, but there's no defense-in-depth guarding the rendered payload.

Fix: Either run the rendered fields through a schema-aware redactor (e.g. recursively scrub keys matching `/token|secret|password|cookie|key/i`), or constrain the audit-write call sites to a typed `AuditMetadata` shape that the type system enforces. The latter is cleaner long-term -- audit metadata types per `targetType` -- but the redactor is a one-file fix that closes the gap immediately.

### MINOR: Reference citation URL allows any `https?:` host -- including internal hosts a future renderer would resolve

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/form-schemas.ts:90-95`

Problem: `citationSchema.url` uses the same loose `^https?:\/\//i` regex. Today no server-side code de-references citation URLs, so this is purely a content-quality concern (an author can drop in `http://10.0.0.1/`). But the cited-by panel and the manifest pipeline both render the URL into HTML; a future change that follows the URL (link previews, validation pings, archive captures) would inherit the SSRF surface from issue #1. Lock it down at the schema layer now so future surfaces don't have to remember.

Fix: Apply the same allowlist or denylist used for source `url` (issue #1). At minimum, require `https://` (drop the `http?` alternation) since every legitimate aviation source the platform cites is HTTPS today.

### MINOR: `appearance` and `theme` cookie endpoints are unauthenticated and lack a CSRF token

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/appearance/+server.ts:14-34`, `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/theme/+server.ts:1-13`

Problem: Both endpoints accept `POST` with a JSON body and write a cookie (`Path=/; Max-Age=1y; SameSite=Lax`) without any session check or CSRF token. The endpoints validate the value (`isAppearancePreference` / theme registry), so they can't be turned into arbitrary cookie injectors -- but the SameSite=Lax cookie still rides along with same-site navigations, which means an attacker who lands a victim on a hangar page from a third-party link (e.g. a phishing domain that anchor-tags into hangar) could change the victim's appearance/theme. Cosmetic only, but it's also unnecessary -- both endpoints exist to persist a UI choice the authenticated user just made, so gating to `event.locals.user !== null` would close the door.

Fix: Add `if (!event.locals.user) throw error(401, ...)` to both endpoints. The user is going to be signed in to use hangar at all; any unauthenticated POST to these endpoints is either a probe or noise. Keep `SameSite=Lax` for read-paths and consider `SameSite=Strict` on the appearance cookie since it never needs cross-origin reach.

### MINOR: Login form returns the typed email back into the `fail()` body, including 401 paths

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/login/+page.server.ts:67-79`

Problem: On every failure branch (400/401/429/500) the action echoes the submitted `email` back into the `fail()` payload so the form re-renders with the value. That's standard re-population UX, but combined with the current `data?.message ?? 'Invalid email or password'` line, the better-auth response message is also forwarded to the client. better-auth's email-and-password adapter exposes distinct messages for "user not found" vs "invalid password" (depending on the active version's settings), which can be combined with the email echo to do user enumeration. The handler does redact the email from server logs (good), but the client copy is inconsistent -- error-message uniformity is the user-facing half of that protection.

Fix: Force the user-facing copy to a single message regardless of `data.message` for the 400/401 branches: `return fail(authResponse.status, { error: 'Invalid email or password', email })`. Keep the structured `data.message` only on 429 (where "Too many sign-in attempts" is non-enumerating). Leave the email echo -- that's UX, not a leak per se.

### NIT: `recoverOrphanedRunning` resets jobs to `queued` without checking actor-id staleness

File: `/Users/joshua/src/_me/aviation/airboss/libs/hangar-jobs/src/enqueue.ts:146-165`

Observation: On worker boot any `running` row is flipped back to `queued` and re-claimed. If the actor was banned or had their session revoked between enqueue and worker recovery, the requeued job still runs under the original `actorId`, and the audit row reflects the ban/revoke happened first but the job carried on. Fine for the current threat model (operators don't run untrusted jobs) but worth a two-line comment explaining the choice or a guard that defers requeue until the actor is re-validated.

Fix: Either document the trade-off (current path) or, before re-queuing, drop jobs whose `actorId` is now banned (`bauthUser.banned === true`) and write a `cancelled-on-recovery` audit row instead. The first path is cheaper and matches the in-process worker's design; the second is the strict reading of "ban revokes ongoing work."

### NIT: Sync job actor gate is too low (`AUTHOR`) for a path that pushes to git / opens PRs

File: `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/+page.server.ts:90-107`, `/Users/joshua/src/_me/aviation/airboss/apps/hangar/src/routes/(app)/glossary/sources/+page.server.ts:54-71`, `/Users/joshua/src/_me/aviation/airboss/libs/hangar-sync/src/commit-and-maybe-pr.ts`

Observation: The `?syncAll` action enqueues a `sync-to-disk` job that, in `pr` mode (production), runs `git checkout -b ...`, `git push`, and `gh pr create` against the repo. Any AUTHOR can fire it. The role boundary between AUTHOR and OPERATOR is documented as "AUTHOR can edit content; OPERATOR can run flow operations" -- pushing branches / opening PRs against the live repo feels operator-tier.

Fix: Gate `?syncAll` and the `enqueueGlobalAction` family (`rescan`, `revalidate`, `build`) to `OPERATOR | ADMIN`. AUTHORs flip dirty bits via reference/source edits; the sync push that materialises those edits is operational, not authorial.

### NIT: `pruneOldArchives` regex assumes well-formed `<id>@<version>.<ext>` filenames, no length cap on iteration

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/upload-handler.ts:171-193`

Observation: `pruneOldArchives` filters by string prefix (`<id>@`) and suffix (`.<ext>`), then calls `pickArchivesToPrune` on whatever's left. There's no upper bound on the number of archives or filename length. A blob root that drifts (manual ops, concurrent worker bug) could leave thousands of files matching the prefix, all of which `readdir` enumerates. Operationally fine today, but the loop is unbounded.

Fix: Add a hard cap on `entries.length` (say 1000) and log + skip when exceeded so an operator notices the drift. Same hardening could go on the `/files` browser scan.

### NIT: `runReferenceScript` shells out via argv; sourceId is row-derived but not re-validated

File: `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/source-jobs.ts:162-194`, `/Users/joshua/src/_me/aviation/airboss/libs/bc/hangar/src/source-jobs.ts:251-263`

Observation: `nodeSpawnRunner` uses `spawn(head, rest, ...)` (not `shell: true`), so command-injection via argv is not possible -- args go directly to the child's `argv`. The `sourceId` flows from URL param -> DB lookup (which validates existence) -> job payload -> `extraArgs: ['--id', sourceId]`, never crossing a shell boundary. Safe today, but the chain depends on the source-id schema (`/^[a-z][a-z0-9-]*$/`) being enforced on every write path, and the shell-out adds a "what if a future caller forgets" failure mode.

Fix: Re-run the source-id schema check inside `readSourceId` before calling `runReferenceScript`. Cheap, idempotent, and defends against a future code path that bypasses the form layer.

## Status as of 2026-05-04

| Finding                                                    | Verdict | Closure                                                                                                                                                           |
| ---------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR: SSRF via `bv_index_url` and source `url`            | CLOSED  | PR #441 -- `validateOutboundUrl` (`@ab/utils/outbound-url`) + denylist for RFC1918 / loopback / link-local / metadata IPs, wired through `source-form.ts:168-175` |
| MAJOR: `bv_index_url` skips http(s) regex                  | CLOSED  | PR #441 -- `outboundUrlSchema` and BV branch share the same Zod schema (`form-schemas.ts:92-127`)                                                                 |
| MINOR: upload extension can contain `/`                    | CLOSED  | PR #442 -- `extensionOf` whitelist + extension-format guard                                                                                                       |
| MINOR: Job cancel does not verify ownership                | CLOSED  | PR #467 wave -- gate widened to OPERATOR/ADMIN with self-cancel exception, audit row records cancelling actor                                                     |
| MINOR: Audit-detail page ships unredacted payloads         | CLOSED  | PR #467 -- `redactSensitive` (`@ab/utils`) routes sensitive keys through `REDACTED_PLACEHOLDER` on render                                                         |
| MINOR: Citation URL allows any `https?:` host              | CLOSED  | PR #441 -- citation URL flows through `outboundUrlSchema`                                                                                                         |
| MINOR: appearance / theme cookie endpoints unauthenticated | CLOSED  | PR #467 -- `event.locals.user` gate added                                                                                                                         |
| MINOR: Login form echoes typed email + better-auth message | CLOSED  | PR #467 -- copy clamped to "Invalid email or password" on 400/401                                                                                                 |
| NIT: `recoverOrphanedRunning` actor-id staleness           | CLOSED  | Documented trade-off in `enqueue.ts:200-235`; matches in-process worker design                                                                                    |
| NIT: Sync job actor gate too low                           | CLOSED  | PR #467 -- `?syncAll` and global flow actions gated to OPERATOR/ADMIN                                                                                             |
| NIT: `pruneOldArchives` no length cap                      | CLOSED  | PR #442 -- hard cap added; logs + skips when exceeded                                                                                                             |
| NIT: `runReferenceScript` source-id re-validation          | CLOSED  | PR #467 -- source-id Zod re-check on `readSourceId`                                                                                                               |

Total: 12 closed / 0 open. `review_status: done` (preserved -- closed at original sweep).
