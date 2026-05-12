---
title: 'Out of Scope: Flight evidence and teacher feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: out-of-scope
status: unread
---

# Out of Scope: Flight evidence and teacher feedback

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                       | Status       | Trigger to revisit                                                                            |
| ---------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| FAA logbook integration                                    | Follow-on WP | When a user asks to ingest an existing logbook corpus (LogTen, ForeFlight, paper logbook OCR) |
| Auto maneuver detection from GPS tracks                    | Deferred     | After WP 2 ships and the user has tracks ingested for several flights                         |
| Video / audio upload on flight attempts                    | Rejected     | Never -- see detail below                                                                     |
| Real-time chat between teacher and student                 | Rejected     | Never -- see detail below                                                                     |
| 1-5 star rubric per maneuver                               | Deferred     | When the three-state assessment hits a real ceiling in usage                                  |
| Payment / billing                                          | Follow-on WP | When the platform monetizes (CFI marketplace, subscriptions)                                  |
| Teacher / mentor directory                                 | Rejected     | Never -- see detail below                                                                     |
| Multi-author editing of one teaching syllabus              | Deferred     | When a co-teaching pair asks to share authorship on the same syllabus                         |
| Track diff / comparison across attempts                    | Deferred     | When the user logs the same maneuver across 3+ flights and wants overlay                      |
| Checkride scheduling, endorsement signing, 8710 generation | Follow-on WP | When the platform serves practical-test prep workflows                                        |
| Automatic role promotion beyond student / teacher          | Rejected     | Never -- see detail below                                                                     |
| Certificate verification                                   | Follow-on WP | When the platform monetizes around CFI legitimacy (marketplace, paid tiers)                   |
| Cloud GPS-track storage                                    | Deferred     | When the second uploader hits dev-local cache constraints                                     |
| Sectional / IFR-chart overlay on track viewer              | Deferred     | When the user asks for chart-overlaid maneuver review                                         |

## FAA logbook integration

Status: Follow-on WP

What was deferred:
Ingest of an existing logbook corpus (LogTen export, ForeFlight logbook CSV,
paper logbook OCR) into `study.flight_attempt` rows.

Why:
Separate ingestion pipeline with its own source formats, dedup rules, and
import UX. Mixing it with the in-scope manual-logging flow would expand the
WP past its stated boundary ("zero in-plane evidence today; ship the surfaces

+ rollups").

Trigger to revisit:
When a user asks to ingest an existing logbook corpus. The first concrete
ask is the signal.

Implementation pattern when triggered:
Follow the source-ingestion pattern at `tools/python/` (handbook/CFR ingest)
adapted for logbook formats. Each format ships as a parser plus a dedup
strategy keyed on `(flight_date, aircraft_ident, total_time_minutes)`.
Rows land in `study.flight_attempt`; the schema already supports it.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No FAA logbook integration"
- [ADR 018 -- source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md) -- the cache convention any logbook ingest would follow

## Auto maneuver detection from GPS tracks

Status: Deferred

What was deferred:
Automatic maneuver segmentation + envelope grading from GPS tracks
(CloudAhoy-style auto-grading). A service that reads `flight_track` rows,
detects landings / patterns / steep turns / stalls, and writes proposed
`flight_maneuver` rows for student review.

Why:
Captured as an IDEA in `docs/platform/IDEAS.md` (entry "ADS-B / GPS
auto-grading") for post-WP-2. The manual logging flow has to ship first so
the underlying schema, surfaces, and rollups are proven before layering
auto-detection on top. The forward-compatibility section of design.md
explicitly says "ships as an additional service that writes proposed
`flight_maneuver` rows for student review. No schema change."

Trigger to revisit:
After WP 2 ships and the user has tracks ingested across multiple flights.
The minimum signal is "I have GPX/CSV tracks in the cache and I want them
auto-graded instead of self-logging maneuvers."

Implementation pattern when triggered:
Stand up as a new BC module that reads `flight_track` rows, runs detection
heuristics, and writes `flight_maneuver` rows with `self_assessment = null`

+ a `proposed_by = 'auto'` flag (or equivalent column added at that time).
Student reviews + accepts/edits/rejects each proposed maneuver. No schema
churn on the existing tables in this WP.

References:

- [spec.md](./spec.md) Decisions table, row "ADS-B / GPS auto-grading" captured as IDEA
- [design.md](./design.md) "Forward compatibility" section, "Auto-maneuver-detection from GPS tracks"
- `docs/platform/IDEAS.md` (entry to be captured at WP 2 ship time per spec)

## Video / audio upload on flight attempts

Status: Rejected

What was rejected:
File-upload surfaces and `flight_attempt`-attached storage rows for video
clips (cockpit footage) or audio recordings (CFI debrief audio).

Why:
Tracks only per the spec's "No video / audio upload. Tracks only." line.
Video / audio carry order-of-magnitude larger byte sizes, copyright and
PII concerns (student face, ATC audio), and an entirely different review
UX (player + timeline + per-clip notes). They don't earn their keep
inside this WP's stated boundary. A future product surface (e.g. a
post-flight-debrief surface with video review) would design this from
scratch, not extend `flight_attempt`.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No video / audio upload. Tracks only."

## Real-time chat between teacher and student

Status: Rejected

What was rejected:
Synchronous chat (websocket, presence, typing indicators) between
teacher and student on a maneuver / flight / syllabus.

Why:
Async notes are the design. The teacher feedback model is "leave per-maneuver
assessments + notes, save" -- a fundamentally async, durable, audit-friendly
loop. Real-time chat would compete with that primary loop, add operational
cost (websocket infra), and dilute the durable-record property of the
feedback rows.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No real-time chat between teacher and student. Notes are async."

## 1-5 star rubric per maneuver

Status: Deferred

What was deferred:
A richer maneuver assessment beyond the three-state
`'satisfactory' / 'needs_work' / 'unable'` enum. A 1-5 star or
proficiency-ladder rubric per maneuver.

Why:
Three-state assessment matches ACS practical-test outcomes (satisfactory /
unsatisfactory / not-attempted) and avoids fake precision. A finer rubric
is post-MVP scope per the spec's "No grading rubrics beyond the three-state
assessment" line.

Trigger to revisit:
When the three-state assessment hits a real ceiling -- e.g. a user wants
to track "trending toward satisfactory" or a teacher wants to differentiate
"satisfactory with rough edges" from "polished satisfactory" and the three
buckets aren't enough. The signal is a concrete usage friction, not a
speculative "wouldn't this be nicer."

Implementation pattern when triggered:
Add a `score` integer column to `flight_maneuver` (1-5) alongside the
existing `self_assessment` / `teacher_assessment` enums. Keep both: the
enum maps to ACS language, the score adds granularity. Rollups in
`mastery.ts` would need a second projection for "average score" alongside
"satisfactory count." Mirror the `ENGINE_SCORING` constants pattern at
`libs/constants/src/engine.ts` for any tunable thresholds.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No grading rubrics beyond the three-state assessment"

## Payment / billing

Status: Follow-on WP

What was deferred:
Stripe (or equivalent) integration, billing surfaces, per-role
subscription plans, payment-status gating of teacher / student features.

Why:
Schema is forward-compatible: `account_role.metadata` jsonb can grow
`stripe_customer_id` / `plan` fields without surgery, and a future
`subscription` table can FK into `account_role(user_id, role)` cleanly.
But the v1 product is invite-only and unpaid; billing surfaces have no
audience until monetization is on the roadmap.

Trigger to revisit:
When the platform monetizes -- CFI marketplace launch, paid student tiers,
or any other revenue model that requires a payment-status gate. Captured
in design.md "Forward compatibility -> Billing."

Implementation pattern when triggered:
Author as a new WP. New `study.subscription` table FK'd to
`account_role(user_id, role)`. Per-role plans (student-only, teacher-only,
both). Stripe webhook handler in `apps/study/src/routes/(api)/webhooks/`
(or equivalent). Auth-layer middleware gates feature surfaces on
`subscription.status = 'active'` where applicable. Reuse the audit
emission pattern this WP establishes for every subscription state
change.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No payment / billing"
- [design.md](./design.md) "Forward compatibility -> Billing"

## Teacher / mentor directory

Status: Rejected

What was rejected:
A browsable directory of teachers / mentors that students can search and
self-invite.

Why:
Spec explicitly says "Teachers must be invited; not browsable." The
invite-driven model is intentional: it keeps the relationship intentional
(a specific student asking a specific teacher), avoids cold-marketplace
dynamics, and sidesteps the moderation / verification problem that a
public directory creates. A directory would imply quality signals
(reviews, ratings, verified-CFI badges) that the platform isn't ready to
operate.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No teacher / mentor directory. Teachers must be invited; not browsable."

## Multi-author editing of one teaching syllabus

Status: Deferred

What was deferred:
Two or more teachers co-authoring the same `syllabus` row with
`kind = 'teaching'`.

Why:
Single-author v1 per the spec. The authoring model has one
`author_user_id` FK on `syllabus`, and `assertSyllabusAuthor` gates every
write to "caller equals author." Multi-author would need a join table
(`syllabus_author`) plus a permission model (admin / editor / viewer),
plus conflict-resolution UX for concurrent edits. None of that is
warranted by the current single-user / single-author reality.

Trigger to revisit:
When a co-teaching pair asks to share authorship on the same syllabus.
Concrete signal -- two users asking for the same syllabus to show up in
both their `/teach/syllabus` lists with edit access.

Implementation pattern when triggered:
Add `study.syllabus_author` join table `(syllabus_id, user_id, role)` where
`role` is `'admin' | 'editor' | 'viewer'`. Replace the
`assertSyllabusAuthor` gate with a role-aware check. Audit emits one row
per author-membership change. Mirror the `study.account_role` pattern this
WP establishes for the same shape.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No multi-author editing of one teaching syllabus"

## Track diff / comparison across attempts

Status: Deferred

What was deferred:
Side-by-side or overlay comparison of two or more `flight_track` rows
(e.g., last three short-field landings, overlay the patterns, diff
touchdown points).

Why:
Each track stands alone in v1. Spec says "No track diff / comparison
across attempts. Each track stands alone." The comparison UX is a
non-trivial design problem (timeline alignment, color coding, base-map
overlay layers) that competes for design budget with the more
fundamental "log + view a single track" loop. Ship single-track first.

Trigger to revisit:
When the user logs the same maneuver across 3+ flights and explicitly
wants to see them overlaid. The signal is a specific request driven by
data the user already has, not speculation.

Implementation pattern when triggered:
Extend `TrackViewer.svelte` (the Leaflet component this WP ships) to
accept an array of `flight_track` rows instead of a single one. Each
track renders as its own polyline with a distinct color. Add a track
picker on `/flight/[id]` (or a new `/flight/compare?ids=...` route).
No schema change.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No track diff / comparison across attempts"

## Checkride scheduling, endorsement signing, 8710 generation

Status: Follow-on WP

What was deferred:
DPE scheduling surfaces, endorsement-signing UX with PDF / e-signature,
FAA 8710 application generation from the student's logged hours +
endorsements.

Why:
These are the practical-test prep workflows -- a distinct product surface
that builds on top of `flight_attempt` + a future `endorsement` table.
Design.md "Forward compatibility" notes "endorsement / 8710 / FAA logbook
integration would extend on top of `flight_attempt` + a new `endorsement`
table. Future WP."

Trigger to revisit:
When the platform serves practical-test prep workflows -- a specific user
or product roadmap entry asks for "I'm ready for my checkride, generate
the 8710" or "sign this endorsement for solo cross-country."

Implementation pattern when triggered:
Author as a new WP. New `study.endorsement` table FK'd to
`bauth_user` (signer + signee) and optionally `flight_attempt`. PDF
generation via a server-side renderer. E-signature: either a simple
signed-timestamp record or full DocuSign-style flow depending on FAA
acceptance. 8710 generation reads `flight_attempt` hours + endorsements

+ student profile.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No checkride scheduling, endorsement signing, or 8710 generation."
- [design.md](./design.md) "Forward compatibility" section on endorsement / 8710

## Automatic role promotion beyond student / teacher

Status: Rejected

What was rejected:
Automatic promotion to roles other than `student` (auto-granted on first
sign-in) and `teacher` (auto-granted on first debrief acceptance). For
example: auto-promote to `admin` after N students, auto-promote to
`verified-cfi` after document upload, auto-promote to `mentor` after a
peer link is established.

Why:
Spec says "All other role transitions are explicit." Automatic role
escalation is a security and UX hazard: it surprises users with
capabilities they didn't ask for, complicates audit reasoning ("when did
they get admin?"), and invites the kind of "I didn't realize I could
sign that endorsement" mistakes that a learning platform especially
shouldn't enable. The two auto-grants in scope are deliberate and bounded.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No automatic role promotion beyond student and teacher"

## Certificate verification

Status: Follow-on WP

What was deferred:
Verification of a teacher's CFI / CFII / MEI certificate via FAA airman
cert lookup, document upload, admin review, or any combination. Flipping
`account_role.metadata.certificates_verified` from `false` to `true`.

Why:
`certificates_verified` always defaults to `false` in v1. The platform
doesn't depend on CFI legitimacy yet (invite-only, unpaid, single-user
reality). Verification is an investment that only earns its keep when
the platform monetizes around CFI legitimacy.

Trigger to revisit:
When the platform monetizes around CFI legitimacy -- marketplace launch,
paid tiers that require verified-CFI status, regulatory pressure to
demonstrate signer-was-actually-CFI for endorsements.

Implementation pattern when triggered:
Author as a new WP. Options at decision time: (a) integrate FAA airman
cert lookup API, (b) accept document upload + admin review, (c) third-party
verification service. Whichever the path, the flip lands as a
`setRoleMetadata(userId, 'teacher', { certificates_verified: true })`
call (already shipped in this WP) plus an audit row.

References:

- [spec.md](./spec.md) "Out of scope" list, item "No certificate verification."
- [design.md](./design.md) "Forward compatibility -> Certificate verification"

## Cloud GPS-track storage

Status: Deferred

What was deferred:
A cloud-storage adapter for `flight_track` bytes (S3 / R2 / Cloudflare
KV / equivalent) replacing the dev-local cache.

Why:
Dev-local cache for v1 per Decision 3. The user is the only uploader;
cloud storage has no audience yet. Design.md explicitly says the
cloud-storage adapter "is a single function swap behind
`flight_track.cache_path` resolution" -- forward compatibility is
designed in.

Trigger to revisit:
When the second uploader hits dev-local cache constraints. Per Decision
3: "Cloud-storage adapter follows when second user uploads."

Implementation pattern when triggered:
Implement a `flight-tracks/storage-adapter.ts` module with two
implementations -- `dev-cache` (current behavior, writes to
`AIRBOSS_HANDBOOK_CACHE`) and `cloud` (S3-style). Swap behind a config
flag. `flight_track.cache_path` becomes opaque storage key resolved by
the active adapter. No schema change.

References:

- [spec.md](./spec.md) Decisions table, row 3 "GPS track production storage"
- [spec.md](./spec.md) "Out of scope" list, item "No cloud GPS-track storage."
- [design.md](./design.md) "Forward compatibility -> Cloud-storage adapter"

## Sectional / IFR-chart overlay on track viewer

Status: Deferred

What was deferred:
Aeronautical chart base layers (VFR sectional, IFR low / high) on the
Leaflet track viewer in addition to the default OpenStreetMap tiles.

Why:
Out of scope per design.md decision 7 "Track viewer is Leaflet, not
Mapbox" -- "a sectional / IFR-chart overlay would be nice but is out of
scope." Sectional tiles cost money (or require self-hosting the FAA
GeoTIFFs and serving them) and the v1 audience renders against
OpenStreetMap fine.

Trigger to revisit:
When the user asks to overlay maneuvers on a sectional or IFR chart
during track review.

Implementation pattern when triggered:
Add a layer-selector control to `TrackViewer.svelte`. Source options: a
FAA sectional tile service (commercial or self-hosted from FAA GeoTIFFs),
or a mapping vendor (Mapbox aeronautical) if vendor cost is acceptable
at that time. Default stays OpenStreetMap; sectional / IFR are opt-in
layers.

References:

- [design.md](./design.md) decision 7 "Track viewer is Leaflet, not Mapbox" -> "a sectional / IFR-chart overlay would be nice but is out of scope."
