---
title: 'Out of Scope: Personal Minimums as a Typed Contract'
product: study
feature: personal-minimums-as-typed-contract
type: out-of-scope
status: unread
---

# Out of Scope: Personal Minimums as a Typed Contract

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope plus the design-time decisions captured in [design.md](./design.md) "Open questions resolved during spec authoring."

## Summary

| Item                                              | Status       | Trigger to revisit                                                                                 |
| ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| Logbook-ingestion integration                     | Follow-on WP | When `logbook-ingestion` WP is authored; this WP unblocks it                                       |
| XC-viewer overlay implementation                  | Follow-on WP | When `xc-viewer-personal-minimums-overlay` WP is authored; this WP unblocks it                     |
| Decision-debrief replay                           | Follow-on WP | When `decision-debrief-replay` WP is authored; this WP unblocks it                                 |
| Multi-aircraft personal minimums                  | Deferred     | When the platform supports per-aircraft logbook AND a pilot documents the need for split minimums  |
| AI/LLM-suggested personal minimums                | Rejected     | Never -- defeats the pre-commitment pedagogy                                                       |
| Sharing personal minimums with a CFI / instructor | Deferred     | When CFI-sharing / access-model work is opened as its own WP                                       |
| Auto-tightening over time                         | Deferred     | When user-zero documents a real need + a pedagogically-justified rule                              |
| Day-vs-night split floors                         | Deferred     | When user-zero (or another pilot) documents friction with the single-floor + `isNight` observation |
| "Tighter than legal" check / legal-floor compare  | Rejected     | Out of scope for the typed primitive -- the legal floor lives in airspace knowledge, not here      |
| Soft (warning) vs hard (block) conformance        | Rejected     | The platform never blocks the pilot; conformance is informational, the pilot decides               |
| Inline-modal editor (instead of page-level form)  | Rejected     | The page-level form is deliberate; a modal trivializes the discipline                              |
| Suggested-floor templates ("currency-blocks")     | Deferred     | When the v1 free-form numeric form is documented as too unconstrained for new pilots               |

## Logbook-ingestion integration

Status: Follow-on WP

What was deferred:
Reading the pilot's actual recent flights (night landings, IMC approaches, crosswind exposures) to compare against the stated minimums. The v1 implications subpanel ships a "could not yet be verified" placeholder for the night-currency check; the placeholder pre-wires the UX seam.

Why:
Logbook ingestion is its own significant body of work -- file-format parsing (LogTen, ForeFlight, paper-to-photo OCR), per-flight schema design, currency-computation rules, conflict resolution for overlapping import sources. Conflating it with personal-minimums plumbing would balloon this WP's scope by 5x and miss the chance to ship the typed primitive other consumers need.

Trigger that fires the follow-on:
When the `logbook-ingestion` WP is authored. The personal-minimums lens is one of its first consumers (computing per-flight conformance against the minimums active on the flight's date).

Implementation pattern when triggered:
The new WP reads `getPersonalMinimumsHistory(userId)`, picks the revision whose `effective_from <= flight.date` and (`effective_until > flight.date OR effective_until IS NULL`), builds a `PersonalMinimumsObservation` from the flown conditions, calls `projectAgainstPersonalMinimums` per flight, surfaces the conformance in the logbook detail view. Backfills the night-currency check in this WP's implications subpanel (replace the placeholder with a real "your last night landing was N days ago" computation).

References:

- [spec.md](./spec.md) Scope -> Out
- [design.md](./design.md) "Why the 'implications' subpanel exists at v1"
- This WP's `unblocks: [logbook-ingestion]` frontmatter

## XC-viewer overlay implementation

Status: Follow-on WP

What was deferred:
The xc-viewer-side overlay that surfaces personal-minimums conformance per waypoint as the pilot pans the route map. The v1 implications subpanel ships a stop-gap (list of scenario violations) that the xc-viewer overlay will replace with a higher-fidelity per-waypoint rendering.

Why:
Per [xc-viewer VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md), the xc-viewer is its own surface with its own design discipline (sectional rendering, route layer, weather layer composition). The personal-minimums overlay is one consumer among several future overlay kinds (alternate selection, terrain buffer, fuel reserve). Building it inside this WP would couple the typed-primitive's scope to the xc-viewer's design surface, neither of which is the right place to do that integration.

Trigger that fires the follow-on:
When the `xc-viewer-personal-minimums-overlay` WP is authored. The xc-viewer's [VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md) "Done" criteria call out personal-minimums as a planned second consumer beyond the weather-course step.

Implementation pattern when triggered:
The new WP's `+page.server.ts` calls `getActivePersonalMinimums(locals.user.id)` and passes the row through the page data. The `<WaypointWxChip>` component calls `projectAgainstPersonalMinimums(active, observation)` inline for each waypoint and renders a "below your floor" badge on chips that don't conform. The implications subpanel in this WP shrinks (or is removed entirely) when the overlay is in production -- the overlay covers the same information at higher fidelity.

References:

- [xc-viewer VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md) "Done"
- [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md)
- This WP's `unblocks: [xc-viewer-personal-minimums-overlay]` frontmatter

## Decision-debrief replay

Status: Follow-on WP

What was deferred:
A debrief surface that compares "what the pilot said their minimums were before the flight" against "what they actually flew." Walks the personal-minimums history to find the revision active on the flight's date and surfaces per-field conformance against the flown observation.

Why:
Decision-debrief is its own surface with its own design discipline (chronological replay, per-decision branching, contrastive analysis). It's also gated on logbook-ingestion (the "flown observation" has to come from somewhere). Building it inside the personal-minimums WP would conflate three concerns: persistence, lens, debrief UX.

Trigger that fires the follow-on:
When the `decision-debrief-replay` WP is authored. Gated on logbook-ingestion (or on an equivalent source of flown observations, e.g. manual debrief entry).

Implementation pattern when triggered:
The new WP reads `getPersonalMinimumsHistory(userId)` and `<flown observations for the flight in question>`, picks the revision whose effective window contains the flight, calls `projectAgainstPersonalMinimums` per leg, surfaces the conformance in the debrief replay. The "if you violated your floor here, why?" prompt is the pedagogical surface this enables.

References:

- [spec.md](./spec.md) Scope -> Out
- [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md)
- This WP's `unblocks: [decision-debrief-replay]` frontmatter

## Multi-aircraft personal minimums

Status: Deferred

What was deferred:
Separate personal-minimums records per aircraft type. A pilot flying a C172N and a PA-46 might reasonably have different crosswind floors for each; v1 carries one record per user.

Why:
Per [design.md](./design.md): the v1 primitive captures the pilot's personal floor, not the aircraft's. A pilot who flies multiple aircraft can use the `notes` field to capture aircraft-specific context ("when flying the PA-46, tighten this by..."). The full per-aircraft split is a real future need but adds substantial schema complexity (per-aircraft history, per-aircraft active record, per-aircraft conformance reads) that the platform doesn't yet have the surrounding infrastructure to support.

Trigger to revisit:
When the platform supports per-aircraft logbook tracking AND a real pilot (user-zero or another) documents that the single floor isn't capturing their actual decision-making.

Implementation pattern when triggered:
Add an `aircraft_id` foreign key (or `aircraft_type` text column) to `personal_minimums`. The partial unique index becomes `(user_id, aircraft_id) WHERE is_active = true`. The BC functions accept an optional `aircraftId` parameter; the lens accepts an optional `aircraftId` in the observation. The page's UI grows a tab / selector. The logbook-ingestion overlay's per-flight pick walks history filtered by aircraft.

References:

- [design.md](./design.md) "Open questions resolved during spec authoring"
- [spec.md](./spec.md) Scope -> Out

## AI/LLM-suggested personal minimums

Status: Rejected

What was rejected:
A "suggest reasonable minimums based on your hours / recency / aircraft" affordance that pulls from a per-pilot model or from aggregate statistics.

Why:
Per the [`wx-personal-minimums` knowledge node](../../../course/knowledge/weather/personal-minimums/node.md): the discipline lives in the pilot making the decision when they are not under decision pressure. Outsourcing the decision to an AI / aggregate model shortcuts the deliberation that makes personal minimums load-bearing. The pilot must defend the floor to themselves (and ideally to another CFI); a suggested number is too easy to accept without that defense.

A future enhancement could surface anonymized comparison data ("pilots with similar hours typically set X") as a calibration anchor without prescribing the value -- but that's a separate WP with its own pedagogical scrutiny and would need to clear a high bar to ensure it doesn't replace deliberation.

Trigger to revisit:
Never -- this is a definitional rejection rooted in the knowledge-node pedagogy. If the question reopens, the discussion goes back to the pre-commitment thesis in the knowledge node.

References:

- [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) "Reveal" rules of operation
- [design.md](./design.md) "Why no AI-suggested minimums in v1"

## Sharing personal minimums with a CFI / instructor

Status: Deferred

What was deferred:
A surface where a pilot can share their stated personal minimums with a designated CFI / instructor, and the CFI can comment / suggest adjustments. v1 is single-user; no sharing.

Why:
Sharing requires a CFI-pilot relationship model (who is whose CFI, what scope of access, revocable trust). The platform doesn't yet have that model. Building a one-off "share minimums" affordance without the broader access model would either (a) ship a fragile bespoke flow, or (b) prefigure the access model in a place that doesn't get the design discipline that work deserves.

Trigger to revisit:
When the broader CFI-sharing / access-model work is opened as its own WP. Personal-minimums sharing becomes one of several consumers (sharing flight logs, sharing goals, sharing decision debriefs).

Implementation pattern when triggered:
The new WP designs the access model. Personal-minimums sharing piggybacks on it: a CFI granted access can call `getActivePersonalMinimums(menteeUserId)` and `getPersonalMinimumsHistory(menteeUserId)` through the access layer. The mentee retains write authority; the CFI is read + comment only.

References:

- [spec.md](./spec.md) Scope -> Out

## Auto-tightening over time

Status: Deferred

What was deferred:
An automated "tighten the floor every N hours / months without recent currency" rule that the platform applies without the pilot's explicit re-commitment.

Why:
Per the knowledge node "Reveal" rules of operation: the minimums are recalibrated on a fixed cadence (annually, after every IPC, after every 100 hours), not after every borderline trip, and the recalibration is the pilot's deliberate act. Auto-tightening shortcuts the deliberate-act discipline and would feel paternalistic if applied silently.

A future enhancement could nudge ("it's been 12 months -- time to recalibrate?") without auto-modifying the record. That nudge is a UX concern, not a typed-primitive concern, and would land in a separate WP.

Trigger to revisit:
When user-zero (or another pilot) documents a real need for an automated nudge AND a pedagogically-justified rule for what / when to nudge. Auto-modification of the floor stays rejected even if the nudge surface ships.

Implementation pattern when triggered:
Add a scheduled-job (per `scripts/scheduler/`) that walks personal-minimums records and flags those whose `effective_from` is older than the configured cadence. The page surfaces a banner ("your minimums were last reviewed N months ago -- recalibrate?"). The job does NOT modify any record.

References:

- [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) "Reveal" rules of operation
- [design.md](./design.md) "Why no AI-suggested minimums in v1"

## Day-vs-night split floors

Status: Deferred

What was deferred:
Separate ceiling / visibility floors for day vs night (the knowledge node's "Reveal" table shows distinct night rows). v1 carries one ceiling / visibility floor and accepts `isNight` as an observation field that the lens reads but doesn't combine with a separate night floor.

Why:
Most pilots think about night as a margin multiplier on the daytime floor (the "add margin for: night, mountainous terrain, unfamiliar field, marginal currency, fatigue, passengers, time pressure" rule from the knowledge node). Storing two sets of numbers doubles the column count and forces the pilot to maintain two records of the same underlying decision. v1 keeps the schema lean and lets the pilot tighten the single floor when they're flying at night.

Trigger to revisit:
When user-zero (or another pilot) documents that the single-floor pattern isn't capturing their actual decision-making. Concretely: when a pilot says "I'd accept a 1500 ft ceiling during the day but only 3000 ft at night, and the platform can't represent that without me re-keying my values for each flight."

Implementation pattern when triggered:
Add `ceiling_ft_night` and `visibility_sm_night` columns to `personal_minimums`. The Zod schema adds the new fields. The lens reads the night fields when `observation.isNight === true`. The page's form grows night columns visible by a "split day/night" toggle. The constants table grows `_NIGHT` variants of the constraints.

References:

- [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) "Reveal" table
- [design.md](./design.md) "Open questions resolved during spec authoring"

## "Tighter than legal" check / legal-floor compare

Status: Rejected

What was rejected:
A check that compares the pilot's stated personal floor against the legal floor (14 CFR 91.155 VFR minimums, 14 CFR 61.57 currency, etc.) and warns if the personal floor is at or below the legal floor.

Why:
The typed-primitive's job is to capture the pilot's chosen floor, not to police the legal envelope. The legal floor is content (it lives in airspace / regulations knowledge nodes); the personal floor is data. Conflating them risks the platform appearing to "approve" minimums that happen to be at the legal floor -- a false signal of safety the knowledge node explicitly warns against.

The pedagogy lives in the knowledge node: "Legal minimums are the regulatory floor for any pilot. Personal minimums are the pre-committed numerical floor a specific pilot adopts to remove the moment-of-decision negotiation." The platform respects that boundary by not collapsing the two.

Trigger to revisit:
Never -- this is a definitional rejection. The legal floor stays in the airspace knowledge surface; the personal floor stays here.

References:

- [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) "Problem"
- [design.md](./design.md) "Open questions resolved during spec authoring"

## Soft (warning) vs hard (block) conformance

Status: Rejected

What was rejected:
A distinction in `ConformanceResult` between "warning" (still allow the flight planning to proceed) and "block" (prevent the next step). v1 reports `pass: 'within' | 'below' | 'unknown'` only; the pilot decides what to do.

Why:
The platform's job is to surface conformance, not to enforce it. Adding a "block" tier would force the platform into a policing role that contradicts the pre-commitment pedagogy -- the pilot is supposed to defend the floor to themselves, not have a UI force them to obey.

A future consumer could choose to surface "below" results more prominently or to require a confirmation click; that's a consumer-side design choice. The typed primitive doesn't dictate.

Trigger to revisit:
Never -- the platform's relationship to the pilot's decisions is informational. If a future safety-critical surface wants to enforce, it does so consumer-side, not in the primitive.

References:

- [design.md](./design.md) "Open questions resolved during spec authoring"

## Inline-modal editor (instead of page-level form)

Status: Rejected

What was rejected:
A quick-edit modal that opens over any page when the pilot clicks a "minimums" affordance in a nav or header, instead of a dedicated `/personal-minimums` page.

Why:
Per [design.md](./design.md) "Why the form is page-level, not a modal": personal minimums are a deliberate, infrequent decision. A modal makes the edit feel glanceable and transactional -- the opposite of the discipline the knowledge node teaches. The page-level form reinforces the discipline by making the edit a destination.

Trigger to revisit:
Never -- the design choice is load-bearing for the pedagogy.

References:

- [design.md](./design.md) "Why the form is page-level, not a modal"

## Suggested-floor templates ("currency-blocks")

Status: Deferred

What was deferred:
A library of suggested floor templates (e.g., "200-hour PPL," "500-hour CPL," "1000-hour CFI") the pilot can pick from as a starting shape before tuning.

Why:
v1 ships one starter shape (the FAA P-8740-25 Solo / VFR column from the knowledge node). That's enough to get a pilot off zero. Building a template library is a content-authoring undertaking that should be informed by real pilot use, not by speculative grouping.

Trigger to revisit:
When the v1 free-form numeric form is documented as too unconstrained for new pilots -- concretely, when more than 3 first-time users skip the form because they don't know where to start.

Implementation pattern when triggered:
Add a `personal_minimums_template` table (or static const) carrying named templates with frontmatter (template name, target experience level, citations). The form's empty state grows a "pick a starting template" selector before the numeric inputs. Each template seeds the form; the pilot then tunes. The lens is unchanged.

References:

- [spec.md](./spec.md) Scope -> Out
- [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) "Reveal" table (the FAA P-8740-25 shape)
