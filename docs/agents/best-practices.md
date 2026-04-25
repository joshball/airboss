# Best Practices

Battle-tested rules from production SvelteKit + Svelte 5 + Drizzle + Biome projects. Adapted for airboss-firc.
Originally extracted from legion-overwatch (2026-03-24).

---

## CSP (Content Security Policy)

- **NEVER set CSP on page responses in hooks.** SvelteKit inline scripts need nonces for hydration -- manual CSP kills all JS silently. Page renders fine visually but nothing interactive works.
- Page CSP: use `kit.csp.directives` in `svelte.config.js` with `'nonce'` in script-src.
- API CSP: set manually in hooks (auth endpoints only).
- Other security headers (X-Frame-Options, HSTS) are fine on all responses.

## Auth Forms

- Use SvelteKit form actions for login/signup/password-reset. NOT client-side `authClient.signIn.email()`.
- `<form method="POST">` + `+page.server.ts` action calling auth handler server-side.
- Native form POST works without JS. Playwright tests interact reliably.
- When forwarding auth cookies from form actions: `decodeURIComponent()` the value before `cookies.set()` -- SvelteKit re-encodes.

## SSR Decision

- For each app, ask: does it have public pages needing SEO?
  - **sim**: NO (fully authenticated) -- disable SSR
  - **hangar**: NO (fully authenticated) -- disable SSR
  - **ops**: NO (fully authenticated) -- disable SSR
  - **runway**: YES (public-facing site, marketing, course catalog) -- keep SSR
- Disabling SSR (`export const ssr = false` in root `+layout.ts`) eliminates hydration mismatches entirely.

## Svelte 5 Patterns

### Components

- `interface Props` + `$props()` destructuring. Never `export let`.
- `children: Snippet` rendered with `{@render children()}`. Never `<slot>`.
- `$state()` for local, `$derived()` for computed. Never `$:`.
- Derived from props MUST use `$derived()`. Plain `const x = propA ?? propB` captures initial values only -- Svelte warns `state_referenced_locally`.
- Never put interactive ARIA roles on non-interactive HTML elements.
- `$app/state` not `$app/stores`.
- `.svelte.ts` extension for rune files outside components.
- Never assign `$state(prop)` -- props are read-only. Use tracked-toggle pattern for local overrides.

### Forms

- Prefer native `<form method="POST">` with form actions over `onsubmit` + `e.preventDefault()`.
- `use:enhance` inside `{#snippet}` blocks may not hydrate. Verify or avoid.
- `$state` vars don't sync with Playwright `fill()` through component prop `oninput` handlers.

### Styling

- CSS custom properties only. No Tailwind. No hardcoded values.
- All visual values come from role tokens (`var(--ink-body)`, `var(--surface-page)`, `var(--action-default)`, ...).
- CSS in component `<style>` blocks only.

### Theme System

Full reference: [docs/platform/theme-system/](../platform/theme-system/00-INDEX.md). Quick lookup for "which token do I use": [QUICK_REFERENCE.md](../platform/theme-system/QUICK_REFERENCE.md).

**Two libs:** `libs/themes/` defines TypeScript theme objects + emits `tokens.css`. `libs/ui/` provides Svelte components that consume role tokens. No styling decisions in apps.

**Three orthogonal axes** set on `<html>` via the pre-hydration script and `ThemeProvider`:

- `data-theme` -- one of `airboss/default`, `study/sectional`, `study/flightdeck`, `sim/glass`
- `data-appearance` -- `light` or `dark`
- `data-layout` -- `reading`, `dashboard`, or `cockpit`

**Themes are picked by route + user preference** in `libs/themes/resolve.ts`. Routes never set `data-theme` directly. `/sim/*` is locked to `sim/glass` (dark-only safety); everywhere else respects the user's theme cookie, falling back to the path default.

**Adding a new component -- token contract:**

- Use role tokens directly: `var(--ink-body)`, `var(--surface-panel)`, `var(--action-default)`, `var(--signal-warning)`, etc. State variants are derived per-theme (hover, active, wash, edge, ink, disabled) -- consume the derived tokens, don't compute them.
- For interactive controls, prefer the `button-*` / `input-*` slot tokens (e.g. `var(--button-primary-bg)`) so theme-specific gradients/shadows propagate correctly.
- Never write a hex / rgb / hsl / oklch literal in a component or page. The `tools/theme-lint` rule fails CI on raw colors and raw `px`/`ms` values.

**Route files may only have layout-flow CSS:** `display`, `flex`, `grid`, `gap`, `position`, `width`, `height`, `overflow`. No colors, fonts, padding, margin, borders, or shadows. Enforced by `tools/theme-lint`.

## Database (adapted for PostgreSQL)

- Drizzle ORM only. No raw SQL.
- ALL tables organized by domain (legion uses `bauth_`/`app_` prefixes; airboss-firc uses PostgreSQL schema namespaces: `course`, `published`, `enrollment`, `evidence`, `compliance`, `identity`, `audit`, `platform`).
- No CASCADE DELETE. Cleanup in application logic.
- Soft delete for core entities, hard delete for junctions/memberships.
- IDs via a `generateId(domain)` function -- deterministic, short, unique per domain.
- Form actions don't have `parent()`. Use helper functions to get context.

## Form Actions Pattern

```typescript
// +page.server.ts
export const actions: Actions = {
  default: async ({ request, locals, params }) => {
    const user = requireAuth(locals);
    requireOrgAdmin(locals, orgId);

    const data = await request.formData();
    const input = { field: data.get('field') as string };

    const result = schema.safeParse(input);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return fail(400, { error: Object.values(errors).flat()[0], ...input });
    }

    try {
      db.insert(table).values(result.data);
    } catch (err) {
      return fail(500, { error: 'Operation failed' });
    }

    auditLog({ action: 'entity.create', actorId: user.id, ... });
    redirect(303, ROUTES.WHEREVER);
  },
};
```

- Capture user from `requireAuth(locals)` -- use `user.id`, never `locals.user!.id`.
- Validate with Zod `.safeParse()`, flatten errors for display.
- Auth/permissions before DB writes.
- `fail()` for errors, `redirect()` for success.
- Return submitted values on failure for form re-population.

### Form Error Handling

- **Field errors on the field, system errors as toasts.**
- Always add `required` to mandatory fields (native HTML validation).
- Return `fieldErrors` from server actions, render inline on form components.
- Toasts only for success messages and unexpected 500 errors.
- In `use:enhance` handlers, let `update()` re-render the form -- `form` prop contains `fieldErrors` automatically.

## Validation

- Zod schemas in `libs/types/src/schemas/`.
- Enum values from constants lib, never hardcoded strings.
- Export inferred types: `export type Foo = z.infer<typeof fooSchema>`.

## Constants

- All domain values from constants lib. No magic strings or numbers.
- `ROUTES` object with path strings and functions: `ROUTES.DASHBOARD`, `ROUTES.ORG_ADMIN(slug)`.
- Auth roles as constants.
- Table names as constants.
- App config (max lengths, password rules, limits).
- Port numbers as constants.
- NEVER hardcode route paths anywhere -- server, Svelte, tests.
- When adding new routes: add to constants FIRST, then use.

## Monorepo

- `libs/` are plain TS directories, not packages. No package.json in libs.
- Path aliases: `@namespace/*` -> `libs/*/src`.
- App is a thin shell. Logic goes in libs.
- `$lib/server/` for app-specific server helpers.
- Check UI lib before creating new components.

## Formatting (Biome)

- Tabs (width 2), single quotes, 120 char lines, trailing commas, semicolons.
- Import order enforced by Biome:
  1. `bun:*` / `node:*` built-ins
  2. External packages
  3. Workspace libs
  4. SvelteKit internals (`$app/*`, `$lib/*`)
  5. Relative imports

## Logging

- NEVER use `console.log`/`console.warn`/`console.error` directly.
- Use a `createLogger(domain)` wrapper from types lib.
- Swappable implementation for production logging (Sentry, Axiom, etc.).

## Type Safety

- No `any`. No non-null assertions (`!`).
- Capture guard function return values: `const user = requireAuth(locals)`.
- `bun run check` runs tsc + svelte-check. Must pass with 0 errors, 0 warnings.

## Common Mistakes (ranked by debugging pain)

1. CSP on page responses -- hours wasted, misleading symptoms
2. Client-side auth instead of form actions -- silent failures
3. Cookie double-encoding -- session silently invalid
4. Shell-mangled env vars in tests -- auth fails, no obvious cause
5. `use:enhance` in snippets -- form doesn't submit, no errors
6. `oninput` state sync with Playwright -- state empty, logic fails
7. Hardcoded strings instead of constants -- drift, inconsistency
8. Raw SQL instead of Drizzle -- bypasses type safety
9. Tailwind or hardcoded CSS values -- breaks theming
10. `$:` or `export let` in new code -- legacy Svelte 4 syntax
