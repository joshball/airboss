# UX review -- study-ia-cleanup Phase 2

issues_found: 4

## UX-1 (major) -- "Goal" tab clicks land on the goal detail page when one exists, skipping the goal LIST view

`apps/study/src/routes/(app)/program/+layout.svelte` `goalHref` derives:

```typescript
const goalHref = $derived(data.primaryGoal ? ROUTES.PROGRAM_GOAL(data.primaryGoal.id) : ROUTES.PROGRAM_GOALS);
```

Effect: a user with a primary goal who clicks the "Goal" tab is taken straight to the goal detail. They cannot reach the goals LIST (`/program/goals`) by clicking the tab -- they would have to type the URL or click "Back to goals" from the detail crumb.

This is intentional per design.md Q1 ("one mental destination") + the spec's preference for direct deep-link to the user's active intent. The goal-LIST stays reachable via the breadcrumb on the detail page. Phase 2 ships this shape; if usage tells us users want to see the list more often than the detail, flip the default.

No fix in this slice. Capture as a "watch on first user contact" item.

## UX-2 (minor) -- The "Coverage" tab is a placeholder

`/program/coverage/+page.svelte` renders a goal count + plan presence + a primary CTA. It is not the gap-coverage matrix described in the long-term vision (areas covered by the active plan vs. uncovered, by qual). Phase 2 ships the seed shape so the tab is not empty; the deeper projection is a later WP.

The placeholder is still useful: it answers "do I have a plan and a goal?" with one glance, which is the question the IA cleanup is fundamentally trying to make trivial.

No fix; document the trim in the PR body so reviewers know.

## UX-3 (minor) -- Goal-detail "Start studying" CTA only appears when not editing

When the user clicks "Edit", the action group switches to "Cancel" and the start-studying CTA disappears. That is the correct UX (no half-saved state) but worth noting -- the e2e spec lands on the read view, so this never trips the test.

No fix.

## UX-4 (nit) -- `<PageExplainer>` mounted on every Program tab introduces vertical chrome

Each of the 4 tabs (`Quals`, `Goal`, `Plan`, `Coverage`) now ships a "Why am I here?" panel. Stacking them all open by default may feel verbose to a power user. The Phase 1 dismissal mechanism handles this -- the user collapses each once and never sees them again. The Settings global toggle (deferred to a later WP) closes the loop.

No fix.
