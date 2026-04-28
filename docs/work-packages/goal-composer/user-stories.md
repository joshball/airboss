---
title: 'User Stories: Goal Composer'
product: study
feature: goal-composer
type: user-stories
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 9
---

# User Stories: Goal Composer

Persona: returning CFI rebuilding PPL/IR/CPL/CFI/CFII/MEI/MEII knowledge from a 30-year hiatus (user zero). Stories are framed against this profile.

## US-1 -- Compose a multi-cert goal

**As a** returning CFI pursuing seven credentials,
**I want** to build a goal that bundles multiple ACS syllabi plus a few sharp ad-hoc nodes,
**so that** my study targets one coherent union, not seven separate course feeds.

### Acceptance

- `/goals/new` accepts title, notes, optional target date, primary toggle
- Detail edit mode lets me add multiple `goal_syllabus` rows
- Detail edit mode lets me add `goal_node` rows on top of those syllabi
- The "this goal targets N nodes" footer reflects the union, not the sum

## US-2 -- Mark a goal as primary

**As a** learner with two active goals,
**I want** to flip which goal is primary with a single click,
**so that** the engine and other surfaces default to whatever I'm focused on this week.

### Acceptance

- The index shows a star toggle on each active goal
- Clicking the star atomically unstars the previous primary
- Clicking the star on the current primary returns "already primary" (or is a no-op)
- The detail header shows the primary badge

## US-3 -- Pause a goal without losing it

**As a** CFI whose CPL prep got shelved by life,
**I want** to pause a goal rather than abandon it,
**so that** when I resume in three months, the syllabi, nodes, weights, and notes are intact.

### Acceptance

- Active goals show a "Pause" action; paused goals show "Resume"
- Pausing moves the goal to the Paused group on the index
- Resuming restores it to Active with all composition intact
- A paused goal cannot be primary; pausing the primary clears the primary flag with a banner

## US-4 -- Find a knowledge node by domain + cert

**As a** learner whose weakness this week is "weather products for IR cross-country,"
**I want** to filter the node picker by `weather` domain + `IR` cert,
**so that** I'm not scrolling through hundreds of unrelated nodes.

### Acceptance

- Node picker exposes domain + cert + lifecycle filter chips
- Filters intersect (multi-select within row, AND across rows)
- Filtered list updates within 200 ms of chip toggle
- Empty result state offers a "Clear filters" link

## US-5 -- Add a node and immediately see the picker stay open

**As a** learner triaging a list of weak nodes,
**I want** to add several nodes back-to-back without closing and reopening the picker,
**so that** I can compose a goal in one focused pass.

### Acceptance

- Clicking "Add" on a result row keeps the modal open
- The added row flips to a disabled "already attached" state
- The goal's node list updates live behind the modal
- The result list keeps its scroll position

## US-6 -- Stop composing without committing changes

**As a** learner who opened edit mode "just to look,"
**I want** Cancel to discard my unsaved title / notes / status edits,
**so that** I'm not afraid to enter edit mode.

### Acceptance

- Edit mode is a `?edit=1` query toggle
- Cancel strips the query param and returns the goal to its persisted state
- Add / Remove / Weight changes commit immediately (they are explicit actions, not pending edits)
- Save commits the form-bound fields (title, notes, status, target date) atomically

## US-7 -- See where a goal's targets come from

**As a** learner with a goal composed of two syllabi plus 12 ad-hoc nodes,
**I want** to see the syllabus-derived nodes and ad-hoc nodes distinguished on the goal page,
**so that** I know which targets came from a structured source vs my own picks.

### Acceptance

- Detail page renders the syllabus list and the ad-hoc node list as separate panels
- Syllabus rows show weight + the credential they belong to
- Ad-hoc node rows show weight + domain + cert badges
- The footer summarises the effective union as a single number

## US-8 -- Recover when I have no goals yet

**As a** brand-new user (or Abby just after seed reset),
**I want** the index to greet me with a clear "create your first goal" path,
**so that** I'm not staring at an empty page wondering what to do.

### Acceptance

- Zero-goals state shows a hero card with explanation + "Create your first goal" CTA
- The CTA routes to `/goals/new`
- After creating, the index renders the new goal in the Active group
- A help-drawer link explains primary semantics and the difference between syllabus + ad-hoc nodes

## Out of scope (future stories)

- US-future-1 -- Goal templates ("PPL prep starter") -- triggered after manual compose proves friction
- US-future-2 -- Goal collaboration / sharing -- triggered when multi-user CFI / student pairing is on the roadmap
- US-future-3 -- Engine cutover (engine reads `getGoalNodeUnion` instead of `study_plan`) -- separate WP
- US-future-4 -- Bulk node operations (multi-select add) -- triggered when single-add hits friction in real use
