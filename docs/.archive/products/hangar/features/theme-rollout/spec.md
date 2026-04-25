---
title: Theme Family Rollout (Workbench / Focus / Brand)
status: done
date: 2026-03-31
source: docs/work/plans/20260327-APP-THEME-PLAN.md
strategy: docs/platform/APP_THEME_STRATEGY.md
scope: cross-product (hangar, ops, sim, runway)
---

# Theme Family Rollout

Replace the current single-theme system with three visual families that share a core token contract but diverge at the shell level.

## Source Docs

- Plan: [20260327-APP-THEME-PLAN.md](../../../../work/plans/20260327-APP-THEME-PLAN.md)
- Strategy: [APP_THEME_STRATEGY.md](../../../../platform/APP_THEME_STRATEGY.md)
- ADR 003: [003-DESIGN_SYSTEM.md](../../../../decisions/003-DESIGN_SYSTEM.md)
- ADR 008: [008-GLASS_COCKPIT_TOKEN_CONTRACT.md](../../../../decisions/008-GLASS_COCKPIT_TOKEN_CONTRACT.md)

## Family Mapping

| Family      | Apps        | Purpose                                 |
| ----------- | ----------- | --------------------------------------- |
| `workbench` | hangar, ops | CRUD, admin, publishing, operations     |
| `focus`     | sim         | Learning, testing, debrief, progress    |
| `brand`     | runway      | Landing, conversion, pricing, marketing |

## Three Layers

| Layer  | Owns                                      | Stable?                |
| ------ | ----------------------------------------- | ---------------------- |
| Core   | Semantic tokens, scales, accessibility    | Yes -- shared by all   |
| Family | Shell personality, density, layout rhythm | Per-family             |
| App    | Accent hues, thin overrides               | Few tokens, thin layer |

## Phases

### Phase 1: Lock the Contract

Decide what belongs to core, family, and app. Resolve how current themes (`glass-cockpit`, `aviation`) map to families.

Decisions needed:

- Keep `glass-cockpit` / `aviation` as names, or rename to family names?
- ADR 003 says 8 font roles; code has 5. Which is correct?
- ADR 003 says `fonts.css + layout.css`; code has `tokens.css + dark.css + light.css`. Update ADR or add files?

Deliverables: updated strategy doc, ADR 003/008 addendum if contract changes.

### Phase 2: Stabilize Shared Primitives

Audit and clean the shared component layer before family work accelerates.

- Audit: Button, Input, Badge, Alert, Dialog, Toast, Panel
- Extract repeated patterns: page headers, stat cards, form sections, empty states
- Standardize scale/density controls in ThemeEditor
- Review accessibility baseline: focus rings, contrast, motion

Deliverables: cleaner `libs/ui/` primitive layer.

### Phase 3: Build Workbench Family

Define `WorkbenchShell` for hangar and ops.

- Sidebar, header, page header, panel rhythm, content widths
- Hangar variant: more editorial/content-friendly
- Ops variant: denser, more utilitarian
- Align workbench components: tables, filters, admin forms
- Test light and dark modes for both apps

Deliverables: hangar and ops using shared workbench shell with app-level overrides.

### Phase 4: Build Focus Family

Define `FocusShell` for sim.

- Lighter chrome, stronger reading rhythm, progress framing
- Extract focus components: question card, answer groups, debrief blocks, progress visuals
- Tune type and spacing for learning flows
- Reduce admin affordance carryover

Deliverables: dedicated sim shell, reusable focus components.

### Phase 5: Build Brand Family

Define `BrandShell` for runway.

- Hero, sections, footer, campaign layout
- Decide shared vs separate components (primitives shared, shell separate)
- Tune typography and composition for story flow
- Validate SSR and performance (runway has different rendering priorities)

Deliverables: runway visual system for marketing/conversion.

### Phase 6: Governance + Cleanup

- Family-level review checklist (shell, accessibility, token isolation, component ownership)
- Audit app-level overrides -- push repeated patterns back into family or core
- Remove or rename dead themes
- Update docs and examples

## Open Decisions

| Question                                          | Recommendation                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Keep `glass-cockpit` / `aviation` as final names? | Use family names for architecture; keep style names only if they describe actual implementations |
| Should `runway` share the full component library? | Share primitives, not shell assumptions                                                          |
| Should `ops` get its own family?                  | No -- start as workbench variant                                                                 |
| Font roles: 5 or 8?                               | Decide in Phase 1                                                                                |
| Theme file structure vs ADR 003?                  | Decide in Phase 1                                                                                |

## Rollout Order

1. hangar (most active design pressure)
2. ops (derive from hangar's workbench work)
3. sim (deliberate shell break after workbench baseline is solid)
4. runway (moves fastest once product-app assumptions are separated)
