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

## Browser-safe libraries

Several `@ab/*` libs are imported from both server and client code. SvelteKit `.svelte` files import from these libs, and Vite traces them into the browser bundle. The libs that are bundled into the browser:

`@ab/constants`, `@ab/utils`, `@ab/types`, `@ab/themes`, `@ab/ui`, `@ab/help`, `@ab/aviation`, `@ab/audit`, `@ab/sources`, `@ab/activities`, `@ab/bc-study`, `@ab/bc-sim`

### The rule

Files inside those libs **MUST NOT** statically import `node:*` modules at module top level. Vite externalizes those imports for browser compatibility, and the externalized stub throws at first property access:

> Error: Module "node:fs" has been externalized for browser compatibility. Cannot access "node:fs.existsSync" in client code.

This is true even if every function in the file is server-only. Just loading the module on the client is enough to register the error in the console; touching any of the symbols crashes the page.

Biome's `correctness/noNodejsModules` rule is wired up in `biome.json` to enforce this on the listed libs. Test files, `**/server/**` paths, and `*.server.ts` files are excluded.

### The pattern

If you need a Node built-in inside one of these libs, lazy-load it via `process.getBuiltinModule(spec)` (Node 22+, Bun). Vite's static analyzer cannot follow runtime string arguments, so the bundler never sees the `node:*` specifier and never externalizes it.

```typescript
type NodeFs = { readFileSync: (p: string) => Buffer };

let cachedFs: NodeFs | null = null;

function loadBuiltin<T>(spec: string): T {
  const proc = (typeof process !== 'undefined' ? process : undefined) as
    | (NodeJS.Process & { getBuiltinModule?: (spec: string) => unknown })
    | undefined;
  const get = proc?.getBuiltinModule;
  if (typeof get !== 'function') {
    throw new Error(`${spec} unavailable in this runtime`);
  }
  return get(spec) as T;
}

function nodeFs(): NodeFs {
  if (!cachedFs) cachedFs = loadBuiltin<NodeFs>('node:fs');
  return cachedFs;
}

export function readSomething(path: string): Buffer {
  return nodeFs().readFileSync(path);
}
```

The browser will load the module (since the barrel re-exports it) but never executes the function bodies, so `getBuiltinModule` is never called and no `node:*` is ever resolved.

### The escape hatches

If a file is truly server-only and shouldn't be importable from the client at all:

1. Move it under a `**/server/**` subdirectory in the lib. The `noNodejsModules` Biome override excludes `**/server/**` paths.
2. Or move it out of these libs entirely (e.g., into `libs/sources/**` if it's pipeline / ingest code).

Don't silence the lint rule with `// biome-ignore`. The rule is enforcement, not advice.

### Worked examples

- [libs/constants/src/source-cache.ts](../../libs/constants/src/source-cache.ts) - canonical pattern. PR #471.
- [libs/utils/src/outbound-url.ts](../../libs/utils/src/outbound-url.ts) - DNS lookup + IP parsing, lazy-loaded.
- [libs/bc/study/src/deck-spec.ts](../../libs/bc/study/src/deck-spec.ts) - `node:crypto` for deck hash, lazy-loaded.

## Resolver inversion (libs/ui -> libs/help)

`libs/ui` is a leaf in the dependency graph -- `libs/help` and most other libs depend on it, never the reverse. When a `libs/ui` component needs data from a higher-level lib (e.g. `<InfoTip>` resolving help-page validity, `<Tooltip>` reading glossary entries), invert the edge: `libs/ui` exposes a `setXResolver(resolver)` registry, the consuming app registers a resolver at boot, and the component reads through it. Never `import` from a higher-level lib.

### Canonical examples

- [libs/ui/src/lib/info-tip-resolver.ts](../../libs/ui/src/lib/info-tip-resolver.ts) -- `<InfoTip>` -> `@ab/help` registry validation.
- [libs/ui/src/lib/tooltip-glossary-resolver.ts](../../libs/ui/src/lib/tooltip-glossary-resolver.ts) -- `<Tooltip>` -> `@ab/help/glossary` term + short.

### When you need a third resolver

If a third `libs/ui` component needs the same inversion (e.g. number `?` popovers reading metric formulas), generalize: introduce a single `setUiResolver(kind, resolver)` registry keyed by a `UI_RESOLVER_KINDS` enum in `libs/constants/`. Don't ship a third bespoke resolver file.

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

## E2E selectors

Playwright tests in this repo target stable `data-testid` hooks, not CSS classes, ARIA roles for nav anchors, or visible text. Testids survive copy churn and IA reorgs without rewriting tests.

Conventions (kebab-case, lowercase):

| Pattern                                | Example                                     | Meaning                                                                                       |
| -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `data-testid="page-anchor"`            | (one per route)                             | Single sentinel on the page's `<h1>` or primary section header. Flow tests assert visibility. |
| `data-testid="nav-{section}"`          | `nav-home`, `nav-program`, `nav-insights`   | Top-level nav links.                                                                          |
| `data-testid="{section}-tab-{name}"`   | `program-tab-quals`, `program-tab-goal`     | Sub-tabs / sub-anchors within a section.                                                      |
| `data-testid="{page}-cta-primary"`     | `home-cta-primary`, `goal-detail-start-cta` | The page's primary call-to-action.                                                            |
| `data-testid="{page}-cta-secondary"`   | `home-cta-secondary`                        | Secondary CTAs. Multiple per page allowed.                                                    |
| `data-testid="first-run-set-goal-cta"` | (Home, no-goal state)                       | State-specific testid for the first-run Home CTA.                                             |

Rules:

- **Never repurpose a testid.** If meaning changes, rename the testid -- never quietly point an old name at a new affordance. Tests built against the old meaning will silently green on the wrong thing.
- **Exactly one `page-anchor` per page.** A CI guard fails the build if any route under `apps/study/src/routes/(app)/**` ships without one.
- **Authoring order:** name the testid first (in the spec or work-package), wire it up in the component, then write the test against the name. Don't let test code be the place a name is invented.
- **Where to look up active testids:** the IA flow test `tests/e2e/ia-flow.spec.ts` is the canonical list of top-level routes + anchors.

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
