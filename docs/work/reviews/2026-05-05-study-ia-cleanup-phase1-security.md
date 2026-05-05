# Security review -- study-ia-cleanup Phase 1

issues_found: 2

## SEC-1 (minor) -- POST `/api/page-explainer` has no rate limit; abuse is high-volume audit-row generation

`apps/study/src/routes/api/page-explainer/+server.ts`

Every successful POST emits one `auditWrite` row through `setUserPref`. An authenticated user (or any compromised session token) can repeatedly toggle dismissals -- e.g. flip the same key on/off in a loop -- and write unbounded audit rows. The audit log is the system of record for compliance, so flooding it is a meaningful DoS vector against the table's read paths.

Mitigation options:

- Short-circuit when the requested state already matches the stored state (skip both the upsert and the audit write). This is the cheapest fix and eliminates 100% of "no-op" abuse.
- Add a per-user rate limit (e.g. 10 dismissal writes / minute) using the existing rate-limit infra if one exists for `/api/auth`.

Recommendation: ship the no-op-skip in this slice; defer the rate limit until we have a generic per-user limiter to lean on.

## SEC-2 (nit) -- pageKey allows arbitrary strings; the JSON map can be filled with attacker-controlled keys

`apps/study/src/routes/api/page-explainer/+server.ts:23`

```typescript
pageKey: z.string().min(1).max(128),
```

A bored user can fill their own `study.page_explainer.dismissed` row with thousands of distinct keys (each up to 128 chars), bloating the JSONB column and the audit trail. The attack surface is bounded to their own user (the Zod schema rejects empty + over-long), but it's still a minor nuisance.

Defense-in-depth: validate `pageKey` against an allowlist (e.g. a `PAGE_EXPLAINER_KEYS` constant in `libs/constants/`). Phase 1 only mounts `home`; the allowlist starts at one entry and grows as new pages adopt the explainer. Same pattern as `USER_PREF_KEYS`. This also gives us a grep-able catalog of every page that has an explainer, useful when Settings-side "hide all" lands.
