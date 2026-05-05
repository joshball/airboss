# Backend review -- study-ia-cleanup Phase 2

issues_found: 2

## B-1 (minor) -- `+page.server.ts` redirect uses 303

```typescript
throw redirect(303, ROUTES.PROGRAM_QUALS);
```

303 (See Other) is correct for "redirect to GET", which is what the SvelteKit redirect helper does. 302 would also work; 301 is wrong here because the canonical destination for `/program` depends on user state (goal exists -> goal detail; no goal -> quals list) and we do not want browsers caching the redirect across users.

No fix.

## B-2 (info) -- All form actions on the moved `/program/goals/[id]/+page.server.ts` redirect back to `ROUTES.PROGRAM_GOAL(id)` / `ROUTES.PROGRAM_GOALS`

The `?/update`, `?/setStatus`, `?/archive`, `?/setSyllabusWeight`, etc. actions still use the new `PROGRAM_*` routes after the mass-rename. Verified by grep: `apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts` references `ROUTES.PROGRAM_GOAL` + `ROUTES.PROGRAM_GOALS` only. Same for plans `+page.server.ts`. Action redirects do not point at the legacy URLs.

No fix.
