---
title: Theme Rollout - Test Plan
status: done
date: 2026-03-31
---

# Theme Rollout Test Plan

## Phase 1: Contract

| Step | Action                    | Expected                                                         |
| ---- | ------------------------- | ---------------------------------------------------------------- |
| 1    | Read updated strategy doc | Token ownership (core/family/app) clearly documented             |
| 2    | Read ADR 003/008          | Consistent with strategy; font roles and file structure resolved |

## Phase 2: Primitives

| Step | Action                               | Expected                                                            |
| ---- | ------------------------------------ | ------------------------------------------------------------------- |
| 1    | Open hangar, ops, sim in browser     | Shared primitives (Button, Input, Badge, Alert) render consistently |
| 2    | Tab through forms in each app        | Focus rings visible, consistent style                               |
| 3    | Toggle dark/light mode               | All primitives respect mode tokens                                  |
| 4    | Grep app routes for `<style>` blocks | Zero visual CSS in route files                                      |

## Phase 3: Workbench

| Step | Action                              | Expected                                         |
| ---- | ----------------------------------- | ------------------------------------------------ |
| 1    | Open hangar                         | WorkbenchShell with sidebar, header, page titles |
| 2    | Open ops                            | Same shell structure as hangar, denser feel      |
| 3    | Compare hangar and ops side-by-side | Same shell, different density/accent             |
| 4    | Toggle dark mode in both apps       | Consistent workbench dark treatment              |
| 5    | Resize browser to narrow width      | Sidebar collapses, content reflows               |

## Phase 4: Focus

| Step | Action                 | Expected                                                    |
| ---- | ---------------------- | ----------------------------------------------------------- |
| 1    | Open sim               | FocusShell -- lighter chrome, no heavy sidebar              |
| 2    | Navigate scenario flow | Reading rhythm feels distinct from hangar                   |
| 3    | View progress page     | Progress visuals use focus family styling                   |
| 4    | Compare sim to hangar  | Clearly different shell, shared primitives still consistent |

## Phase 5: Brand

| Step | Action                  | Expected                                            |
| ---- | ----------------------- | --------------------------------------------------- |
| 1    | Open runway             | BrandShell -- landing page sections, not CRUD shell |
| 2    | Check SSR               | Page source has full HTML (SSR on)                  |
| 3    | Check marketing flow    | Hero, pricing, CTA sections render correctly        |
| 4    | Compare to product apps | Distinct feel, shared primitive consistency         |

## Phase 6: Governance

| Step | Action                           | Expected                                        |
| ---- | -------------------------------- | ----------------------------------------------- |
| 1    | Search for dead theme references | No references to removed themes                 |
| 2    | Check app override count         | Each app has fewer than ~10 app-specific tokens |
| 3    | Read updated ARCHITECTURE.md     | Family model documented                         |

## General

- `bun run check` passes after each phase
- No visual regressions in apps not being modified in current phase
