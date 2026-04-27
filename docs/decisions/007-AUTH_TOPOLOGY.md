# 007: Auth Topology (PARTIALLY SUPERSEDED)

> **Partially superseded 2026-04-26.** The shared-session-via-cross-subdomain-cookie principle survives the pivot and is the implementation today. Specifics changed:
>
> - Domain is `*.airboss.test` in dev (`fircboss.com` was a pre-pivot decision; final production domain TBD).
> - Auth provider is **Better Auth** ([libs/auth/src/](../../libs/auth/src/)) rather than the placeholder "Auth lib middleware" described below.
> - The four-app stack (sim/hangar/ops/runway) is gone -- post-pivot apps are study, sim, hangar (active) plus future surfaces. `ops` is folded into hangar.
> - Per-app subdomains today: `study.airboss.test`, `sim.airboss.test`, `hangar.airboss.test` (dev). See [docs/devops/LOCAL_DEV.md](../devops/LOCAL_DEV.md).
> - Role model is in [ADR 009 -- Role Model](009-ROLE_MODEL.md), which extends this ADR. The role table below pre-dates ADR 009.
>
> **What's still authoritative:** shared-session principle, common-domain cookie, role gates on every request, cross-app links via subdomain URLs.
>
> **What's stale:** the four-app list, the `fircboss.com` domain, the role-by-app matrix (current authoritative source: hangar's layout-level `requireRole` + per-app gates).

Decided 2026-03-25.

## Context

Four apps, all authenticated (three fully, one partially). Users need to move between apps without re-authenticating. The auth lib is shared, but the session strategy was undefined.

## Decision

### Shared Session, Common Domain

All apps share a single session via HTTP-only cookie on a common domain (e.g., `*.fircboss.com`).

| Aspect          | Decision                                        |
| --------------- | ----------------------------------------------- |
| Session storage | `identity.session` table (PostgreSQL)           |
| Cookie scope    | Wildcard subdomain (`*.fircboss.com`)           |
| Cookie flags    | `HttpOnly`, `Secure`, `SameSite=Lax`            |
| Session lookup  | Auth lib middleware, identical in all apps      |
| Auth provider   | Email/password initially. OAuth (Google) later. |

### Per-App Subdomains

| App    | Subdomain                                |
| ------ | ---------------------------------------- |
| sim    | `app.fircboss.com` or `sim.fircboss.com` |
| hangar | `hangar.fircboss.com`                    |
| ops    | `ops.fircboss.com`                       |
| runway | `fircboss.com` (apex)                    |

### Role-Based App Access

Not every user can access every app. The session contains the user's role; each app checks role on every request.

| Role     | sim | hangar | ops | runway |
| -------- | --- | ------ | --- | ------ |
| learner  | yes | --     | --  | yes    |
| author   | --  | yes    | --  | yes    |
| operator | yes | yes    | yes | yes    |
| admin    | yes | yes    | yes | yes    |

A learner navigating to `hangar.fircboss.com` gets a "not authorized" page, not a login page.

### Cross-App Navigation

Apps link directly to each other via subdomain URLs. No shared navigation chrome -- each app has its own layout. An ops user viewing a learner's evidence can click through to the scenario in sim.

### Local Development

Caddy reverse-proxies `*.firc.test` subdomains to SvelteKit dev servers, mirroring the production topology. Local DNS resolves `*.firc.test` to `127.0.0.1`. Caddy terminates TLS using its built-in local CA.

| App    | Domain             | Port |
| ------ | ------------------ | ---- |
| sim    | `sim.firc.test`    | 7600 |
| hangar | `hangar.firc.test` | 7610 |
| ops    | `ops.firc.test`    | 7620 |
| runway | `runway.firc.test` | 7640 |

Cookie is set on `.firc.test` (wildcard). Session sharing works across subdomains, same as production on `.fircboss.com`. See `docs/devops/LOCAL_DEV.md` for setup details.

## Rationale

- **Shared cookie is simplest.** No OAuth between apps, no token exchange, no redirect chains. One cookie, one session table, done.
- **Subdomains, not paths.** `/sim`, `/hangar` would require a reverse proxy. Subdomains let each SvelteKit app own its full URL space.
- **Role check, not separate auth.** All apps use the same auth flow. The difference is authorization (role), not authentication (identity).

## See Also

- [ADR-009: Role Model and Registration Policy](009-ROLE_MODEL.md) -- registration model per app, learner lifecycle semantics, app-level enforcement strategy, REVIEWER role deferral.
