---
title: 'Tasks: Appearance — Dark Mode'
feature: appearance-dark-mode
type: tasks
---

# Tasks

- [ ] Design dark palette for `airboss/default`:
  - [ ] Surface scale (page, panel, raised, sunken, muted, overlay).
  - [ ] Ink scale.
  - [ ] Edge scale.
  - [ ] Action bases (default, hazard, caution, neutral, link).
  - [ ] Signal bases (success, warning, danger, info).
  - [ ] Accent (code, reference, definition).
  - [ ] Focus ring.
- [ ] Write `airboss-default/palette.dark.ts` with the designed values.
- [ ] Override dark values in `study/sectional/palette.dark.ts` where it wants to diverge.
- [ ] Override dark values in `study/flightdeck/palette.dark.ts` (darker panels, deeper mono feel).
- [ ] Re-emit CSS; verify dark block sizes look reasonable.
- [ ] `apps/study/src/routes/appearance/+server.ts` or form action: accept POST, set cookie, return 204.
- [ ] `apps/study/src/hooks.server.ts`: read cookie; attach to locals.
- [ ] `apps/study/src/routes/(app)/+layout.server.ts`: return appearance.
- [ ] `apps/study/src/routes/(app)/+layout.svelte`: pass appearance to ThemeProvider; surface toggle.
- [ ] Appearance toggle UI in identity menu: Radio primitives from #6.
- [ ] Client-side `prefers-color-scheme` listener to react when preference is `system`.
- [ ] Update pre-hydration script to honor `system` cookie value.
- [ ] Contrast tests now run for dark (from #4 harness) and must pass.
- [ ] Playwright: toggle dark, reload, dark; toggle system with matcher simulating dark; page dark.
- [ ] Full visual sweep of every study route in light + dark.
- [ ] Update login page to respect appearance (logged-out users).
