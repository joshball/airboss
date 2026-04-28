# User Stories: Cert Dashboard

Persona: returning CFI rebuilding PPL/IR/CPL/CFI/CFII/MEI/MEII knowledge from a 30-year hiatus (user zero). Stories are framed against this profile.

## US-1 -- Multi-cert progress at a glance

**As a** returning CFI pursuing seven credentials,
**I want** one page that shows mastery and coverage on each credential I'm targeting,
**so that** I can see "where am I weakest across all of these" without opening seven dashboards.

### Acceptance

- `/credentials` lands in two clicks from the dashboard
- Cards are ordered by primary-goal sequence, then `kind` + `slug`
- Each card shows mastery and coverage as separate numbers
- A no-primary-goal banner reminds me to set one if I haven't

## US-2 -- Drill into a credential's structure

**As a** learner deciding what to study next,
**I want** to drill from the credential into its ACS Areas and into the K/R/S elements within,
**so that** I see the FAA's structure, not just a flat list of nodes.

### Acceptance

- Clicking a credential card opens the detail page
- The detail page shows the primary syllabus's Areas with mastery bars
- Clicking an Area opens the Area drill with Tasks and K/R/S elements
- Each element shows linked knowledge nodes I can jump to with one click

## US-3 -- See prereqs in DAG shape

**As a** CFI working toward CFII,
**I want** the credential page to surface that CFII = CFI + IR add-on,
**so that** I'm not surprised when CFII gates on holding both.

### Acceptance

- The detail page shows immediate prereqs (one hop)
- Required and recommended prereqs are visually distinct
- Each prereq is a deep link to its own detail page

## US-4 -- Stay on the edition I started prep on

**As a** learner mid-prep on the 2024 PPL ACS,
**I want** the dashboard to keep me on that edition even after the FAA publishes a new one,
**so that** my mastery, citations, and syllabus tree stay consistent.

### Acceptance

- Visiting `/credentials/private?edition=faa-s-acs-25` resolves to that edition
- The URL keeps `?edition=` across navigation within the credential
- A banner reads "Pinned to edition X. Switch to current." with an opt-in switch
- Mastery rollups reflect the pinned edition's leaves, not the current edition's

## US-5 -- Read the cited handbook section without leaving the flow

**As a** learner studying an Area V element,
**I want** to click a citation chip and land in the handbook reader at the right section,
**so that** the cited FAA wording is one click away, not lost in PDF navigation.

### Acceptance

- Citation chips render on every element row
- Clicking a chip opens the handbook reader at the cited section
- The handbook reader's "knowledge nodes that cite this section" panel includes the leaf I came from

## US-6 -- Recover when a credential has no primary syllabus

**As a** learner pursuing a credential whose ACS / PTS is not yet transcribed,
**I want** the page to tell me what's happening rather than show a blank surface,
**so that** I don't think the system is broken.

### Acceptance

- The detail page shows "Syllabus not yet authored" with an explanation
- The explanation links to ADR 016 phase 10 (full transcription is iterative)
- The credential is still listed on `/credentials` with mastery 0/0

## US-7 -- See coverage vs mastery distinct

**As a** learner with deep but narrow study so far,
**I want** to see "90% mastered of 30% covered" rather than a single number,
**so that** I know I have great recall on a slim slice and most of the cert is untouched.

### Acceptance

- Every mastery surface shows coverage % and mastery % distinct
- Hovering or tapping the metric explains the difference
- The Area list bars render coverage and mastery as two stacked bars or two distinct bars

## Out of scope (future stories)

- US-future-1 -- Full prereq DAG visualisation (multi-hop graph) -- triggered when the one-hop snippet feels insufficient
- US-future-2 -- Edition diff surface -- triggered when a real second ACS edition publishes
- US-future-3 -- Cross-cert weakness view -- ships in [lens-ui](../lens-ui/spec.md)
- US-future-4 -- Goal composition -- ships in [goal-composer](../goal-composer/spec.md)
