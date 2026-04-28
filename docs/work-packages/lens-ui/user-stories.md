---
title: 'User Stories: Lens UI'
product: study
feature: lens-ui
type: user-stories
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 8
---

# User Stories: Lens UI

Stories framed against the persona that drives airboss: a **returning CFI rebuilding seven credentials** (PPL, IR, CPL, CFI, CFII, MEI, MEII) after a 30-year hiatus. He reads in handbook order. He doubts every retrieval. He wants to know where he is weakest and why.

## US-1: Walk PHAK in the order I read it, but tagged with what I've studied

**As** a returning CFI re-reading PHAK Ch. 12 on weight & balance
**I want** to see, alongside each section, the knowledge nodes that cite it and how I'm doing on each
**So that** I can choose between re-reading the FAA wording, drilling a card, or moving on -- without leaving the chapter

Acceptance:

- `/lens/handbook/phak/ch-12` lists every section with citing-node chips.
- Each chip shows mastery state (mastered / due / overdue / never-attempted) by color.
- Clicking a chip lands on the node detail page; back returns to the chapter view with scroll preserved.

## US-2: Know which edition I'm reading

**As** a learner who started this study session in 2024 and is now on PHAK 25C
**I want** an explicit signal when I'm pinned to a superseded edition
**So that** I never quote outdated wording on a checkride

Acceptance:

- Edition banner appears whenever `?edition=` resolves to a row whose `superseded_by_id` is set.
- Banner's primary CTA flips back to the current active edition without losing chapter context.

## US-3: See where I'm weakest, with reasons

**As** a CFI candidate who took 12 cards yesterday and felt unsure on six
**I want** a single page that buckets my weak nodes by severity and shows why
**So that** I can decide what to attack next without grinding the whole deck

Acceptance:

- `/lens/weakness` shows three buckets (severe / moderate / mild).
- Each bucket has top-N node rows (default 10) with a numeric score and one chip per active reason.
- Reason chips: `miscalibration`, `overdue`, `low accuracy`, `never attempted`.

## US-4: Drill straight from the weakness lens

**As** a learner staring at a severe-bucket row for "load factor"
**I want** to start a session targeting that one node in two clicks
**So that** the lens is a launchpad, not a static report

Acceptance:

- Each row has a "Drill" CTA.
- Click queues a new study session prefilled with that node ID.
- Returning to `/lens/weakness` after the session shows the row's score updated (or the row gone if it left the bucket).

## US-5: Switch between lenses without losing context

**As** a learner who just looked at "load factor" in the weakness lens
**I want** to flip to the ACS lens for the same concept and see where it appears in the PPL ACS
**So that** the lens framework feels like one tool with multiple projections, not separate apps

Acceptance:

- LensPicker in the (app) shell switches between handbook / weakness / ACS / domain.
- Active lens highlighted; query state preserved where overlap exists.
- ACS / domain entries link to the sibling WP routes (`/credentials/...`).

## US-6: See an empty bucket clearly when I haven't studied yet

**As** a brand-new user with zero calibration data
**I want** the weakness lens to say "no signal yet -- start a session" instead of fake-buckets
**So that** I know the page works and what to do next

Acceptance:

- All three severity buckets render an empty state with a primary CTA to start a session.
- Page does not crash on zero data.
- Once any session lands, refresh shows real buckets.

## US-7: Trust the lens to scope to my current goal

**As** a CFI candidate with an active goal "rebuild PPL + IR by July"
**I want** the weakness lens to rank only nodes inside that goal's syllabi
**So that** I'm not told a CPL-only node is severe when I'm not studying for CPL

Acceptance:

- If the user has an active goal, `getWeakNodes` filters by `goal_node` membership.
- If no active goal, falls back to "every node the user has any card / rep / read state on".
- The page shows the active goal name in the header so the scope is never invisible.

## US-8: Land on the lens index from the home dashboard

**As** a learner who just opened `/dashboard` and saw the domain weak-areas panel
**I want** a "see all weaknesses" link on that panel
**So that** the existing dashboard becomes a doorway, not a dead end

Acceptance:

- `WeakAreasPanel` on `/dashboard` gains a "See all" link to `/lens/weakness`.
- The link survives in the existing dashboard tests (no regression on the domain rollup itself).
