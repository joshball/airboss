---
title: 'Tasks: Sim Theme — Glass (deferred)'
feature: sim-theme-glass
type: tasks
---

# Tasks (deferred)

Do not start without sim work resuming.

- [ ] Design `glass` palette (dark-only). Consult CFI/pilot eyes for instrument color accuracy.
- [ ] `libs/themes/sim/glass/index.ts` + `palette.dark.ts` + `typography.ts` + `chrome.ts`.
- [ ] `libs/themes/sim/glass/layouts/cockpit.css`.
- [ ] `libs/themes/sim/vocab.ts` with SIM_VOCAB.
- [ ] Type-level scoping to prevent cross-app vocab leakage.
- [ ] `libs/sim-ui/` scaffold (if not already present) for instrument primitives.
- [ ] Contrast tests extended to cover instrument-specific pairs.
- [ ] Registry enforcement: dark-only themes refuse light appearance.
- [ ] Sim resolver: path-based mapping for cockpit vs other sim surfaces.
