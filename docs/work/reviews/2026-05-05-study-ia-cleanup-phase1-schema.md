# Schema review -- study-ia-cleanup Phase 1

issues_found: 1

## SC-1 (info) -- no schema migration; reuses existing `study.user_pref` table

This Phase 1 fix slice does NOT generate a new Drizzle migration. The dismissal store is a single JSONB row keyed by `(userId, 'study.page_explainer.dismissed')` on the existing `study.user_pref` table. Two reasons this is the right call:

1. The `user_pref` table was designed for exactly this -- one row per `(userId, key)` with a JSONB `value`. Per-key Zod schemas in `USER_PREF_SCHEMAS` enforce shape; one of them now matches `z.record(z.string().min(1), z.literal(true))`.
2. Adding a dedicated `page_explainer_dismissal` table for what amounts to "a set of strings per user" would create a parallel data path the team has to maintain, with its own audit hook, FK cascade, and read/write helpers. The existing audit + cascade plumbing on `user_pref` covers the new use case for free.

No issues. The decision is documented inline in `libs/constants/src/study-home.ts` and `libs/bc/study/src/user-prefs.ts`. A future dedicated table is justified ONLY if "show me when user X dismissed page Y" becomes a hot query (today the audit log answers it acceptably).
