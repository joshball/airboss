---
status: deferred
trigger: when `apps/avionics/` is created (per MULTI_PRODUCT_ARCHITECTURE.md)
source: 2026-04-27 architecture review
---

# Extract sim instruments to a shared lib

## Problem

`apps/sim/src/lib/instruments/`, `apps/sim/src/lib/horizon/`, and `apps/sim/src/lib/panels/` ship reusable visual components (Altimeter, Asi, AttitudeIndicator, HeadingIndicator, Tachometer, TurnCoordinator, Vsi, Horizon3D, AnnunciatorStrip, ...). The avionics app on the roadmap will want these.

## Scope (deferred to avionics app creation)

Move:

- `apps/sim/src/lib/instruments/` -> `libs/avionics-ui/src/instruments/`
- `apps/sim/src/lib/horizon/` -> `libs/avionics-ui/src/horizon/`
- relevant `apps/sim/src/lib/panels/` panels -> `libs/avionics-ui/src/panels/`

Both apps consume from the new lib.

## Trigger

When `apps/avionics/` is created. Don't pre-extract per the "create when needed, not before" rule.
