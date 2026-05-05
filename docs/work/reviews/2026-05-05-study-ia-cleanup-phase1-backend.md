# Backend review -- study-ia-cleanup Phase 1

issues_found: 3

## B-1 (minor) -- `setPageExplainerDismissal` does a read-modify-write without a transaction

`libs/bc/study/src/user-prefs.ts:166-203`

```typescript
const current = await getPageExplainerDismissals(userId, db);
const next: PageExplainerDismissals = { ...current };
if (dismissed) next[pageKey] = true; else delete next[pageKey];
await setUserPref(userId, USER_PREF_KEYS.PAGE_EXPLAINER_DISMISSED, next, db);
```

Two simultaneous calls (e.g. user collapses two explainers in quick succession across two tabs) race: both read the old map, both write their own merge, the later write overwrites the earlier one. The window is narrow but not zero -- collapse round-trip is ~50ms.

Fix options:

- Wrap the operation in a transaction with `SELECT ... FOR UPDATE` on the `user_pref` row.
- Push the merge into a single `INSERT ... ON CONFLICT DO UPDATE SET value = value || excluded.value` style upsert (Postgres' `||` operator on JSONB is associative for overlapping keys).
- Use a per-user pageKey row (one row per `(userId, pageKey)`) instead of a JSON map. Cleaner but breaks the "stay inside the closed `USER_PREF_KEYS` set" goal.

Recommendation: option (B) -- use Postgres' JSONB merge operator inside a single statement. Keeps the schema, removes the race.

## B-2 (minor) -- `setUserPref` audit "before" payload duplicates the entire dismissal map on every dismissal write

`libs/bc/study/src/user-prefs.ts:153-163` (existing code, exposed by this WP's design choice)

Because the dismissal map is one JSONB row, every dismissal toggle writes both the prior full map and the new full map into `audit.audit_log`. After 50 dismissals, audit rows carry 50-key JSON blobs. The cost is small per write but compounds. If the goal is "trace when user X dismissed page Y", the audit row is now harder to filter -- you must diff `before.value` and `after.value` instead of reading a single field.

This is an acceptable trade against schema simplicity; document the cost in the BC helper jsdoc so future readers don't try to "fix" the audit shape independently.

## B-3 (nit) -- `+server.ts` uses `error()` for invalid body but the BC throws plain `Error` for empty pageKey

`libs/bc/study/src/user-prefs.ts:171` -- `if (pageKey.length === 0) throw new Error('pageKey must be non-empty');`

The endpoint's Zod schema already rejects empty pageKey before the BC sees it (`z.string().min(1)`), so the throw is defensive only. A plain `Error` will surface as a 500 from `+server.ts` since there's no try/catch. If anyone calls the BC directly (unit test, future internal route), the error type loses information.

Mirror the existing `UnknownUserPrefKeyError` / `InvalidUserPrefValueError` shape: introduce `EmptyPageKeyError extends Error` with a `name` property so callers can disambiguate.
