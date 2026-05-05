# TEMP fixes

Each entry: what's temporary, why, what closes it.

## PageExplainer dismissal failure toast

- **What:** `libs/ui/src/components/PageExplainer.svelte` `handleCollapse` rolls back the optimistic UI on a network failure and logs `console.warn(...)`. There is no user-facing toast.
- **Why:** No shared toast subsystem in `libs/ui/` yet. Adding one for a single failure path is overscoped for the study-app-ia-cleanup Phase 1 slice.
- **Closes:** When the toast / inline-feedback subsystem lands (likely Phase 3 Insights work or a future shared-UI WP), replace the `console.warn` with a toast emit. Grep target: `libs/ui/src/components/PageExplainer.svelte` -> `console.warn('PageExplainer'`.
