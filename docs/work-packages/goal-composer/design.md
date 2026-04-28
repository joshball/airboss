---
title: 'Design: Goal Composer'
product: study
feature: goal-composer
type: design
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 9
---

# Design: Goal Composer

Companion to [spec.md](./spec.md). Notes the route shape, page composition, node-picker UX, and the boundary against sibling WPs.

## Route shape

| Route                | Purpose                                                      | Loader inputs       |
| -------------------- | ------------------------------------------------------------ | ------------------- |
| `/goals`             | Index of all goals grouped by status; primary pinned         | `userId`            |
| `/goals/new`         | Create form (title, notes, target date, primary toggle)     | `userId`            |
| `/goals/[id]`        | Detail read mode (header, notes, syllabus list, node list)  | `userId`, `id`      |
| `/goals/[id]?edit=1` | Detail edit mode (same page, edit form active, pickers open) | `userId`, `id`      |

Edit mode is a query toggle, not a separate route. This mirrors the memory-card edit pattern (`/memory/[id]?edit=1`) and keeps deep links to a goal stable.

## Page composition

### Index (`/goals`)

```text
[ Header: "Your goals"  +  "New goal" CTA ]
[ Primary section -- starred goal pinned, expanded card ]
[ Active group ]
   ┌────────────────────────────────────┐
   │ ☆ / ★    Title          target date │
   │ Notes (truncated, 1 line)          │
   │ syllabi: N    nodes: M             │
   └────────────────────────────────────┘
[ Paused group (count) ]    [ collapsible ]
[ Completed group (count) ] [ collapsible ]
[ Abandoned group (count) ] [ collapsed by default ]
```

### Create (`/goals/new`)

```text
[ Header: "New goal" ]
[ Form ]
  Title *               [ text input, max 200 ]
  Notes                 [ markdown textarea, max 16384 ]
  Target date           [ date picker, optional ]
  Make primary          [ checkbox, default off ]
  [ Cancel ]  [ Create goal ]
```

After submit, redirect to `/goals/[newId]` (read mode) so the user can immediately compose syllabi + nodes.

### Detail read (`/goals/[id]`)

```text
[ Breadcrumbs: Goals > <title> ]
[ Header: title  | status pill  | ★ primary  | target date  | Edit / Make primary / Archive ]
[ Status actions row: Pause / Resume / Complete / Abandon -- contextual to current status ]
[ Notes panel (markdown) ]
[ Syllabi panel: rows with weight badges; "Add syllabus" disabled in read mode ]
[ Nodes panel: rows with weight badges + domain pills; "Add node" disabled in read mode ]
[ Footer: "This goal targets N knowledge nodes" (from getGoalNodeUnion) ]
```

### Detail edit (`/goals/[id]?edit=1`)

```text
[ Header: title input | status select | ★ primary | target date input | Save / Cancel ]
[ Notes panel: markdown textarea ]
[ Syllabi panel: rows with weight slider + Remove + "Add syllabus" button ]
[ Nodes panel: rows with weight slider + Remove + "Add node" button ]
[ Footer: live N node-union count ]
```

Save and Cancel both strip `?edit=1`. Save calls the `update` form action; Cancel discards local form state and routes back to read mode.

## Node-picker UX

The single new interaction in this WP. Default proposed shape: **modal**. See [spec.md open question](./spec.md#open-question) for shape alternatives.

### Layout

```text
[ Modal header: "Add knowledge node"  | x ]
[ Filter chip row ]
   Domain:    [weather] [airspace] [aerodynamics] [systems] [...]
   Cert:      [PPL] [IR] [CPL] [CFI] [CFII] [MEI] [MEII]
   Lifecycle: [skeleton] [started] [complete]
[ Search box: "Filter by title..." (debounced 200 ms) ]
[ Result list (virtualised) ]
   ┌────────────────────────────────────────────┐
   │ Crosswind component       [weather] [PPL]  │ <- already attached, disabled
   │ VFR cloud clearance       [airspace] [PPL] │ [ Add ]
   │ ...                                        │ [ Add ]
   └────────────────────────────────────────────┘
[ Footer: "12 of 487 match" ]
```

### Interaction rules

| Behaviour                          | Detail                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Open                               | "Add node" button in detail edit mode                                                              |
| Close                              | x button, Escape, click backdrop                                                                    |
| Filter chips                       | Multi-select within each row; intersection across rows                                              |
| Search                             | Debounced 200 ms; queries `listNodesWithFacets` on the server via fetch                            |
| Already-attached rows              | Greyed out, "Add" disabled, tooltip "Already on this goal"                                          |
| Add                                | Form action `addGoalNode`; on success row flips to disabled, parent goal's node list updates       |
| Empty state                        | "No nodes match these filters" + "Clear filters" link                                              |
| Keyboard                           | Tab order: chips -> search -> first result; Enter on a result triggers Add; Escape closes          |
| Screen reader                      | aria-modal, focus trap, list rows announced with title + cert + lifecycle                          |

### Why modal over alternatives

| Alternative                                | Why not                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| (b) Inline collapsible groups by domain    | Pulls hundreds of rows into the goal page; overwhelms the read-mode density we want for the goal |
| (c) Dedicated subpage `/goals/[id]/nodes`  | Pulls the user away from goal context; back button friction; harder to compare to current list   |

The modal idiom matches the citation picker already in the app (consistency), keeps the goal page dense (readable), and scales to hundreds of nodes (search + filters).

## Syllabus picker

Lighter than the node picker -- syllabi are scarce (one per active credential edition + personal syllabi).

```text
[ Modal: "Add syllabus" ]
[ Grouped by credential ]
   PPL ASEL
     - PPL ACS (active edition)         [ Add ]
     - Personal: stick-and-rudder slice [ Add ]
   IR Airplane
     - IR ACS (active edition)          [ Add ]
```

No filters, no search; the list is short enough. Already-attached syllabi greyed out and disabled.

## Status lifecycle

```text
   active <-> paused
     |
     +--> completed     (terminal, kept on index in Completed group)
     +--> abandoned     (terminal, hidden by default in index)
```

| Action     | From          | To           | BC call                                  |
| ---------- | ------------- | ------------ | ---------------------------------------- |
| Pause      | active        | paused       | `updateGoal({ status: 'paused' })`       |
| Resume     | paused        | active       | `updateGoal({ status: 'active' })`       |
| Complete   | active        | completed    | `updateGoal({ status: 'completed' })`    |
| Abandon    | active/paused | abandoned    | `archiveGoal` (sets abandoned + clears primary) |

`archiveGoal` is the BC's chosen path for "abandon"; it both sets status and unflags `is_primary` atomically.

## Boundary against sibling WPs

| Concern                          | Owned by                                       | Why                                                                                                |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `/goals/...`                     | this WP                                         | Goal CRUD is the surface ADR 016 phase 9 names                                                     |
| `/credentials/...`               | [cert-dashboard](../cert-dashboard/spec.md)    | Per-credential dashboard reads `getPrimaryGoal` for default-filter; never writes goals             |
| `/lens/...`                      | [lens-ui](../lens-ui/spec.md)                  | Cross-lens browse (handbook lens, weakness lens); never writes goals                               |
| Goal data model + BC             | shipped on main                                | This WP consumes existing reads + writes; never adds BC functions or schema                        |
| Engine cutover to goal filter    | follow-on WP                                   | The engine still drives off `study_plan`; routing it through `getGoalNodeUnion` is its own WP      |

## Design principles applied

| Principle                                  | Application                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Goal vs course (Learning #4)               | A goal is the learner's union; the page never imposes a course shape                                     |
| Cert as constraint set (Learning #2)       | Goals reference syllabi by id; the cert dashboard renders the constraint set, the goal renders the union |
| Debrief Culture                            | Lifecycle includes "paused" + "abandoned"; pausing a goal is not failure, it's a transition              |
| Discoverability                            | Node picker leads with filters + search, not a flat dump; the learner finds nodes by intent              |

## Performance

`listNodesWithFacets` is a single round-trip with server-side filtering; result list is paged (or virtualised) on the client. Worst case: ~2000 nodes across the platform; with filters applied, expected < 200 rendered rows.

`getGoalNodeUnion` resolves the goal's effective node set (syllabus-derived + ad-hoc); cached on the server per request, recomputed on writes.

## Risks

| Risk                                                                                       | Mitigation                                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Picker filter combinations return empty results often (returning CFI's mental model differs) | Empty-state copy explicit + "Clear filters" link; default search returns recent + popular nodes |
| Weight semantics (0..10) confuse users -- "what does 7 mean?"                              | InfoTip on the slider header explains relative weighting; weights are advisory, not absolute |
| Concurrent primary toggles produce surprising star moves                                   | `setPrimaryGoal` is atomic in the BC; UI reads the fresh primary after each click          |
| Status transitions feel buried (four buttons + Archive)                                    | Group transitions in a single "Lifecycle" row; show only the legal next-state buttons      |
