---
title: Theme Rollout - Tasks
status: done
date: 2026-03-31
---

# Theme Rollout Tasks

## Phase 1: Lock the Contract

- [x] Confirm family names: `workbench`, `focus`, `brand`
- [x] Define token ownership: core vs family vs app (document in strategy doc)
- [x] Decide: keep/absorb/rename `glass-cockpit` and `aviation` -- kept as style themes, family is orthogonal
- [x] Resolve ADR 003 font roles (5 vs 8) -- keep current 5
- [x] Resolve ADR 003 file structure (tokens/dark/light vs fonts/layout) -- keep current structure
- [x] Document shell responsibilities (tokens vs layout components)
- [x] Update strategy doc with resolved decisions

## Phase 2: Stabilize Shared Primitives

- [x] Wire family tokens into AppShell (--t-shell-gap, --t-shell-padding, --t-page-padding, --t-panel-radius)
- [x] Wire family tokens into Panel (--t-panel-padding, --t-panel-radius)
- [x] Wire family tokens into Button (--t-control-height-sm/md/lg)
- [x] Audit shared primitives: controls already use --t-control-\* tokens with fallbacks
- [x] Verify ADR 003: no visual CSS in app routes (lint passes)

## Phase 3: Build Workbench

- [x] Define `WorkbenchShell` component (sidebar required, header, content)
- [x] Create workbench family tokens (`--t-sidebar-width`, `--t-shell-gap`, `--t-panel-padding`, etc.)
- [x] Wire hangar to WorkbenchShell
- [x] Tune ops variant (denser via data-app-id='ops' overrides in workbench.css)
- [x] Wire ops to WorkbenchShell

## Phase 4: Build Focus

- [x] Define `FocusShell` component (header only, no sidebar, centered content)
- [x] Create focus family tokens (larger content area, more breathing room)
- [x] Wire sim to FocusShell

## Phase 5: Build Brand

- [x] Define `BrandShell` component (nav + content + footer slots)
- [x] Create brand family tokens (section rhythm, hero typography)
- [x] Wire runway public layout to BrandShell

## Phase 6: Governance

- [x] Verify no dead AppShell references in apps
- [x] Verify app routes have no visual CSS (lint passes)
- [x] Update strategy doc with resolved decisions and implementation details
- [x] Update feature tasks with completion status
