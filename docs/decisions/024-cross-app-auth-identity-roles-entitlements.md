# 024: Cross-App Auth — Identity, Roles, Entitlements

Decided 2026-05-04.

Extends: [ADR 007 — Auth Topology (partially superseded)](007-AUTH_TOPOLOGY.md), [ADR 009 — Role Model](009-ROLE_MODEL.md).

## Context

ADR 007 established the shared-session, common-domain cookie principle. ADR 009 established the role model (`LEARNER`/`AUTHOR`/`OPERATOR`/`ADMIN`) and per-app role gates. Both predate two changes:

1. **More apps coming.** `apps/flightbag/` shipped. `apps/firc/`, `apps/avionics/`, eventual `apps/runway/` (public marketing surface) on the way. The "four apps" frame from ADR 007 is gone; the right frame is "N apps and growing, one auth realm."
2. **Paid vs. free distinctions are coming.** A learner who registered for free gets a different surface than a paid student enrolled in a course. Today's role model (`LEARNER`) doesn't distinguish "registered free" from "paid for FIRC 2026 spring cohort." Tying that to roles would explode the role table; tying it to per-app code paths would distribute the same logic across every app.

The user articulated the model: **"one auth for all apps; cross-app sessions; role-based auth in all; if we sell certain courses/apps the same authN works but authZ is based on registration/paid support."**

## Decision

Three orthogonal authorization layers, evaluated in order on every protected request:

| Layer | Question | Owner | Lifecycle |
|-------|----------|-------|-----------|
| **Authentication** | Are you signed in? | `@ab/auth` session validation | Per-session |
| **Roles** | What can you do across the platform? | `identity.user.role` (per ADR 009) | Slow-changing; admin-managed |
| **Entitlements** | What have you registered or paid for? | `identity.entitlement` (new) | Dynamic; tied to billing/registration |

### Identity (authN)

One canonical session, validated identically in every app. Implementation already present:

- **`@ab/auth`** owns session cookie creation, validation, refresh, sign-out. All apps import.
- **Cookie domain.** Wildcard parent domain so subdomain apps share the cookie:
  - Dev: `.airboss.test` (already in place).
  - Prod: `.airboss.com` (or final apex; see "Production domain" below).
- **Cookie flags.** `HttpOnly`, `Secure` (prod), `SameSite=Lax`, parent-domain scope.
- **Sign-in surface.** A single sign-in flow per ADR 007's principle. Today it lives in study (highest-traffic surface). Other apps redirect to it when an unauthenticated user hits a protected route. Eventually a dedicated `auth.airboss.com` is fine; not required.
- **Sign-out.** Clears the parent-domain cookie; effective in every app immediately.

A user who signs in to study and clicks a `airboss-ref:` chip pointing into flightbag arrives signed-in. This is the property that justifies the cross-app architecture.

### Roles (RBAC)

Per ADR 009. No change to the role model itself. Roles are coarse, slow-changing, attached to the user, enforced by `requireRole(role)` helpers in `@ab/auth`.

| Role | Surface |
|------|---------|
| `LEARNER` | Public consumer surfaces (study, sim, flightbag, future firc) |
| `AUTHOR` | Authoring surfaces (hangar) |
| `OPERATOR` | Ops/admin tooling (today: hangar's admin section; eventually a dedicated app) |
| `ADMIN` | Short-circuits role and entitlement checks |

Role changes are an admin action, not a billing action.

### Entitlements (authZ — the new layer)

A user's entitlements describe what they have *access to* — an enrollment, a paid course, a tier, a feature flag. This is independent of role.

#### Shape

```typescript
identity.entitlement {
  id            string PK     // ent_<ULID>
  user_id       string FK
  key           string        // canonical entitlement key (see "Key naming" below)
  granted_at    timestamp
  expires_at    timestamp NULL // null = permanent
  source        string        // 'registration' | 'purchase' | 'admin' | 'bundle'
  metadata      jsonb         // billing receipt id, cohort id, etc.
  revoked_at    timestamp NULL // soft-delete; null = active
}
```

A user has an entitlement if a row exists with `revoked_at IS NULL` AND (`expires_at IS NULL` OR `expires_at > now()`).

#### Key naming

Hierarchical, colon-separated, app-prefixed:

- `flightbag:read` — can read flightbag content
- `study:enroll` — can enroll in study courses
- `firc:enroll` — can enroll in FIRC courses
- `firc:course:2026-spring` — enrolled in a specific cohort
- `cfi:author` — can author content (paired with role `AUTHOR`)
- `sim:scenarios:premium` — premium scenario library

Wildcards via prefix match: a check for `flightbag:read` matches a row with that exact key. A check for any `firc:*` entitlement uses a prefix query.

#### Default grants

Every newly registered user receives a baseline entitlement bundle (e.g. `flightbag:read`, `study:browse`). Bundles live as code constants in `libs/constants/src/entitlements.ts` so the registration flow doesn't hardcode strings.

#### Helpers in `@ab/auth`

```typescript
requireUser(event)                     // 401 if not signed in
requireRole(event, ROLES.AUTHOR)       // 403 if role insufficient
requireEntitlement(event, 'flightbag:read')  // 403 if not entitled
hasEntitlement(user, 'firc:enroll')    // boolean check (no throw)
```

Apps compose these in `+layout.server.ts` for app-wide gates and per-route `+page.server.ts` for finer-grained gates.

### Per-app posture

| App | authN required? | authZ requirement |
|-----|----------------|-------------------|
| study | yes | `study:browse` (default for all registered users) |
| sim | yes | `sim:scenarios:basic` (default) or `sim:scenarios:premium` for premium content |
| hangar | yes | role `AUTHOR` or `ADMIN` |
| flightbag | yes (for now) | `flightbag:read` (default for all registered users) |
| firc | yes | `firc:enroll` AND `firc:course:<cohort>` for the cohort the user is enrolled in |
| runway (future public) | no | n/a — public surface |

#### Flightbag specifically

Flightbag is registered-but-default-granted. Every registered user gets `flightbag:read` automatically. The app checks for it on every route via `requireEntitlement(event, 'flightbag:read')` in its `+layout.server.ts`. This means:

- Today: any registered learner can read.
- When the platform sells courses: paid users still have `flightbag:read` (it's bundled). No regression.
- When flightbag goes public-deploy (per `REFERENCES_ROADMAP.md` Wave 8 trigger): the route guard's check changes to "if signed in, require entitlement; if not signed in, allow read-only with no per-user features." A single config switch, not a rewrite.

#### Future-app extensions

Adding a new app means:

1. New subdomain under the parent (`<newapp>.airboss.com`).
2. The app's `+layout.server.ts` calls `requireUser` + whatever role/entitlement guard fits.
3. Maybe a new entitlement key in `libs/constants/src/entitlements.ts`.
4. Default-grant bundles updated if the new app should be free for all registered users.

No new auth surface, no new session cookie, no new login flow.

## Production domain

The cross-subdomain cookie pattern requires all apps to share an apex. Confirmed by user: production deployment will use a single apex (most likely `airboss.com` with subdomains per app — `study.airboss.com`, `flightbag.airboss.com`, etc., matching today's `*.airboss.test` dev pattern).

If at any point an app must deploy off-apex, the bridge primitive becomes signed-token handoff (short-lived JWT in URL fragment, exchanged for a session) rather than cookie sharing. Out of scope for this ADR; document then.

## Migration path

### What exists today

- `@ab/auth` with Better Auth, session cookies, role checks. Per ADRs 007 + 009.
- Apps gate by role in their `+layout.server.ts`.

### What this ADR adds

- `identity.entitlement` table.
- `entitlement` BC functions in `libs/auth/`.
- `requireEntitlement(event, key)` and `hasEntitlement(user, key)` helpers in `@ab/auth`.
- `libs/constants/src/entitlements.ts` for entitlement-key constants and default-grant bundles.
- Default-grant invocation in the registration flow (Better Auth's `onSignUp` hook or equivalent) to seed `flightbag:read` + `study:browse` per new user.
- Flightbag's `+layout.server.ts` gains `requireEntitlement(event, 'flightbag:read')` instead of a bare `requireUser`.

### What this ADR does NOT change

- The role model. ADR 009 stands.
- The session cookie shape or the shared-domain principle. ADR 007 stands (its "what's still authoritative" section).
- Existing app gates. They keep using `requireRole`. They get `requireEntitlement` as an additional, not replacement, primitive.

## Open questions deferred to implementation

- **Entitlement caching.** Hitting the DB on every request is fine at our scale, but a session-scoped cache of user entitlements is a small optimization. Defer to first profiling.
- **Group entitlements.** Cohort-based grants ("everyone in FIRC 2026 spring gets `firc:course:2026-spring`") could be implemented as direct rows or as a group-membership join. Direct rows are simpler; revisit if cohort sizes get large.
- **Stripe / billing integration.** When billing is wired, the purchase webhook inserts an `entitlement` row with `source: 'purchase'` and a `metadata.payment_id`. Out of scope for this ADR; design then.
- **Free vs. paid public posture.** When flightbag (or runway) goes public, "free public" might still be a registered tier with `flightbag:read` granted on signup. Or it might be fully unauth. Both are supported; pick when the moment comes.

## Anchors

- [ADR 007 — Auth Topology (partially superseded)](007-AUTH_TOPOLOGY.md). Shared-session, common-domain principle.
- [ADR 009 — Role Model](009-ROLE_MODEL.md). RBAC layer.
- [ADR 023 — Flightbag as canonical references reader app](023-flightbag-as-canonical-references-app/decision.md). Why flightbag exists as a separate app, which is what makes the cross-app auth question matter.
- [WP-FLIGHTBAG-BOOK-EXPERIENCE](../work-packages/wp-flightbag-book-experience/spec.md). Phase 6 read-state implementation depends on this ADR.
- `libs/auth/src/` — current auth implementation.

## Status

Accepted, 2026-05-04.
