---
feature: study-app-surfaces (chunk 1)
category: security
date: 2026-05-01
branch: main
issues_found: 9
critical: 0
major: 1
minor: 6
nit: 2
status: unread
review_status: done
---

## Summary

The (app) group has well-disciplined auth: `+layout.server.ts` runs `requireAuth`, and every `+page.server.ts` re-runs it on load + each form action so SvelteKit form-action invocation (which skips parent layout loads) cannot bypass the gate. Ownership is enforced in the bc-study read API via `userId` filters (sessions, plans, goals, cards, scenarios). The handbook-asset path-traversal guard is correct, the login flow has an explicit safe-redirect allowlist, the cookie story is consistent (host rewrite + clearOnLogout idempotent), the CSP + security headers (HSTS, frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) are emitted defensively, and `renderMarkdown` html-escapes input and allowlists URL protocols.

The one real gap is the `(dev)` route group: `/(dev)/references` and `/(dev)/primitives` are deployed without an auth gate and without an `import { dev } from '$app/environment'` guard. Worse, `/(dev)/references` mutates a module-global registry (`__sources_internal__.setActiveTable`) at first request, polluting the production sources registry with fixture rows. That mutation is the major item.

The remaining findings are minor or defense-in-depth nits: a couple of input fields lacking explicit length caps at the route boundary (notesMd on goals, seed/q strings on session-start and citation search), and the documented `style-src 'unsafe-inline'` CSP relaxation.

No critical findings. No SQL injection surfaces (Drizzle ORM end-to-end). No `{@html}` over user-supplied content (the four `@html` sites all consume server-authored markdown rendered through the escaping `renderMarkdown`/`substituteTokens` pipelines). No password hashes / session tokens leaked through `LayoutServerLoad`.

## Issues

### MAJOR: `(dev)` route group exposed in production with no auth and module-global side effects

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(dev)/references/+page.server.ts`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(dev)/primitives/+page.svelte`

Problem: There is no `+layout.server.ts` under `apps/study/src/routes/(dev)/` and neither dev page checks `dev` from `$app/environment`. Both routes ship to production and any unauthenticated visitor can hit them. `(dev)/references/+page.server.ts` calls `ensurePrimed()` on first request, which writes seven fixture rows into the live in-memory `__sources_internal__` source registry via `setActiveTable(next)`. That registry is shared by every server request -- the lesson renderer, knowledge-graph citations, and any other surface that resolves `airboss-ref:` ids against the active table. Once primed, production source resolution returns fixture metadata (canonical_short `§91.103`, fixture acknowledgments, fixture supersession chain). The flag is module-scoped (`let primed = false`), so it sticks for the lifetime of the server process, and there is no admin-only / dev-only gate to prevent a hostile (or curious) anonymous client from triggering it. The fixture markdown in `(dev)/references/fixtures/*.md` is read from disk on every request, so this is also an unauthenticated arbitrary-disk-IO surface.

Fix: Add `apps/study/src/routes/(dev)/+layout.server.ts` that does:

```typescript
import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	if (!dev) error(404, 'Not found');
};
```

Belt-and-braces: also gate `ensurePrimed()` behind `if (!dev) return;` and consider isolating the fixture priming to a separate registry instance instead of mutating `__sources_internal__` (a hostile prod request would otherwise still corrupt the shared table for the process lifetime even if the page renders 404). Re-verify with a curl against `/references` on a non-dev build that returns 404 and confirms the active source table is unchanged.

### MINOR: `notesMd` on goals/plans has no server-side length cap

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/goals/new/+page.server.ts`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/goals/[id]/+page.server.ts`

Problem: The `goals/new` and `goals/[id] update` actions pull `notesMd` straight out of the form with `String(form.get('notesMd') ?? '')` and forward to `createGoal`/`updateGoal` with no upper bound. The handbook read-state route caps notesMd at `HANDBOOK_NOTES_MAX_LENGTH` (per ADR), so the precedent exists; goals don't follow it. An authenticated user can post arbitrarily large `notesMd` payloads -- a single 50 MB request is cheap to send and expensive to store/render in markdown later. The plan `update` action has the same gap on `title` and the implicit notes pathway through plan fields.

Fix: Add an explicit max length (introduce `GOAL_NOTES_MAX_LENGTH` in `libs/constants/src/study.ts` alongside the existing `HANDBOOK_NOTES_MAX_LENGTH`), validate at the route boundary, and return `fail(400, ...)` when exceeded. Same pattern for any other free-text Markdown field on the user-write surfaces.

### MINOR: `session-start seed` and `seed` query param have no length / charset cap

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/session/start/+page.server.ts`

Problem: `seed = String(form.get('seed') ?? '') || undefined` (and the corresponding `?seed=` query param in load) are forwarded into `previewSession`/`startSession` without validation. Per the engine spec the seed deterministically picks the cards for the session; a long or weird-charset seed isn't a critical bug, but it's a large, untyped string flowing into BC code with no boundary check.

Fix: Cap to a small length (e.g. 64 chars) and restrict to `^[A-Za-z0-9_-]+$`. Reject otherwise with `fail(400, ...)`.

### MINOR: `/api/citations/search` accepts unbounded `q`

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/api/citations/search/+server.ts`

Problem: `const q = url.searchParams.get(QUERY_PARAMS.SEARCH) ?? ''` is passed straight to `searchRegulationNodes(q)` / `searchAcReferences(q)` / `searchKnowledgeNodes(q)`. The endpoint is auth-gated so this isn't an open DoS, but a logged-in user can post `q=<10 MB string>` and the search BC has to LIKE-scan against it. The `target` parameter is type-checked via the switch's `default: throw error(400)` -- that's good, but `q` validation is missing.

Fix: Cap `q.length` (e.g. 200 chars) and trim leading/trailing whitespace before dispatch. Match what the browse page already does with `?search=` query (`.trim()` then optional `undefined` for empty).

### MINOR: handbook-asset endpoint serves figures unauthenticated

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/handbook-asset/[...path]/+server.ts`

Problem: The endpoint is unauth-gated by design (assets are public FAA handbook content). The path-traversal guard is sound (`resolve(HANDBOOKS_DIR, params.path)` then `startsWith` check). However the route does not validate the file extension against the `CONTENT_TYPES` allowlist before streaming -- any file under `handbooks/` (including a markdown file or a `.json` manifest) gets streamed back to anonymous callers as `application/octet-stream`. That widens the attack surface from "all FAA figures" to "every file in the handbooks/ tree". For a dormant LFS layout this is fine today, but if a future seed run drops, e.g., a manifest with internal scoring annotations into the same tree it would silently leak.

Fix: Reject extensions not in `CONTENT_TYPES` with `error(404)`. The endpoint is already content-type-aware -- the allowlist becomes the authoritative gate instead of `application/octet-stream`-fallback.

### MINOR: login getClientAddress relies on adapter trust-proxy config

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.server.ts`

Problem: `getClientAddress()` is forwarded to better-auth as `x-forwarded-for` so the rate limiter buckets per-IP. SvelteKit's adapter-node only trusts `X-Forwarded-For` when `ADDRESS_HEADER`/`XFF_DEPTH` env vars are set. If the production deployment does not configure these (or sets them incorrectly), `getClientAddress()` falls back to the TCP peer IP -- which behind a reverse proxy is the proxy's IP, collapsing the rate-limit bucket to a single value for the entire user base. The route's docstring acknowledges the pre-fix bug ("one attacker could lock out the whole user base"); the same failure mode reappears if the adapter config is wrong.

Fix: Document the required env vars in `docs/devops/` (or wherever deployment is captured) so the rate-limit guarantee survives a redeploy. No code change required, but a runtime self-check at boot ("warn if behind a proxy and `ADDRESS_HEADER` is unset") would catch misconfiguration before login traffic does.

### MINOR: heartbeat endpoint does not validate `?edition=` charset

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/heartbeat/+server.ts`

Problem: `editionParam = event.url.searchParams.get(QUERY_PARAMS.EDITION) ?? undefined` is passed straight into `getReferenceByDocument(documentSlug, { edition: editionParam })`. The BC presumably parameterises the lookup, and Drizzle parameterises the SQL, so this is not an injection vector. But it is also unbounded: a long edition string is a DB query against a varchar column, and the route is on the high-volume tick path (one POST per `HANDBOOK_HEARTBEAT_INTERVAL_SEC`). A scripted client could amplify upstream cost by passing 4 KB editions and forcing a per-request reference lookup.

Fix: Cap `editionParam.length` (e.g. 64) before dispatch. Same applies to `chapterCode` / `sectionCode` URL params -- they flow into `Number(...)` later, but the raw string lookup should reject obviously-bad shapes early.

### NIT: CSP `style-src 'unsafe-inline'` is documented but still a defense-in-depth gap

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/svelte.config.js`

Problem: `'style-src': ['self', 'unsafe-inline']` is necessary today because Svelte component styles emit inline `<style>` blocks. With `'unsafe-inline'` an XSS that lands a `<style>` tag (e.g. via a future renderer hole) can exfiltrate via CSS attribute selectors + background-image fetches. The script-src side is hash-locked; style-src is not. This is a known SvelteKit limitation, not a project bug.

Fix: Track upstream SvelteKit work on style-src nonces (or migrate to an asset-extracting style pipeline). No action this turn; flag the config so it isn't accidentally loosened further.

### NIT: appearance/theme endpoints are not auth-gated by design

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/appearance/+server.ts`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/theme/+server.ts`

Problem: Both endpoints are intentionally not auth-gated (the picker is visible on `/login`, theme is cosmetic). They write a 1-year cookie on every POST. An anonymous attacker can issue cookie-write traffic at high volume; the cookie value is allowlisted (`isAppearancePreference`, theme registry membership) so the value cannot be poisoned, but the write traffic is unbounded. Not a real vulnerability today; flagging as a nit because "not auth-gated" merits a comment if a future change adds anything beyond the cookie write.

Fix: None required. If session-bound user-prefs ever land on this endpoint, gate behind `requireAuth` at that point. The current cookie-only behaviour is fine.
