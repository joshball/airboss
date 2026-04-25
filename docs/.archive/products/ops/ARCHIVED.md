# Archived: ops/ product tree (2026-04-25)

`ops` was a pre-pivot SvelteKit app: an admin/operations surface for FAA records, certificate issuance, enrollment management, learner progress, deployment hardening, cross-app analytics, and user management. It was originally planned alongside `hangar`, `sim`, and `runway`.

## Why this was archived

Post-pivot ([PIVOT.md](../../../platform/PIVOT.md)), airboss is a surface-typed monorepo and `ops` is no longer a current app. The post-pivot surface taxonomy in [MULTI_PRODUCT_ARCHITECTURE.md](../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) does not include `ops`; admin and operations responsibilities will be picked up by `hangar` (content authoring + admin) and per-surface admin views as the products that need them ship.

These PRD/VISION/ROADMAP/TASKS files described a non-existent app and were dragging on greps for stale theme tokens, post-pivot orientation, and cross-doc cleanups. Archived rather than deleted because the feature specs (certificate issuance, FAA records, etc.) capture domain detail that may inform future hangar work.

## Where to look instead

- Surface taxonomy and post-pivot apps: [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../../platform/MULTI_PRODUCT_ARCHITECTURE.md)
- Hangar (content authoring + admin): [docs/products/hangar/](../../../products/hangar/)
- Active apps: `apps/hangar`, `apps/sim`, `apps/study`

**Current source of truth for theme work referenced by these docs:** [docs/platform/theme-system/](../../../platform/theme-system/00-INDEX.md).
