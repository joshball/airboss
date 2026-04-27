---
title: 'User Stories: Cert, Syllabus, and Goal Composer'
product: study
feature: cert-syllabus-and-goal-composer
type: user-stories
status: unread
review_status: pending
amended:
  - 2026-04-27 -- amended to compose with merged WP #1 (PR #242) and accepted ADR 019 v3
---

# User Stories: Cert, Syllabus, and Goal Composer

## Tracking progress across multiple credentials

- As a returning CFI rebuilding seven credentials, I want to see all of them in one place so I can compare progress at a glance instead of mentally aggregating per-cert dashboards.
- As a learner working toward Private + Instrument + Commercial in parallel, I want each cert's mastery rolled up to the area level so I know which area is weak without drilling into every leaf.
- As a learner stalled on a single rating, I want to see which prerequisite credentials I've already cleared so I can focus on the gap, not the part I already finished.
- As a learner, I want endorsements (complex, high-perf, tailwheel, spin) to show up alongside certs so my "what credentials do I hold" picture is complete.

## ACS / PTS structure as a primary surface

- As a learner prepping for a checkride, I want to walk the FAA's actual Areas of Operation -> Tasks -> Elements so my mental model matches what the examiner will ask.
- As a learner who knows the textbook but bombs Area V Task A on every flight, I want a leaf-level rollup so I can target Steep Turns specifically without wading through Areas I-IV.
- As a CFI student, I want the K / R / S triad split into separate leaves so my book-knowledge progress doesn't mask my flying-skill weakness.
- As a learner, I want every leaf to carry the verbatim ACS text so I can read what the FAA actually wrote, not a paraphrase that drifts from the source.
- As a learner, I want every leaf's citations to be live links to the handbooks and CFRs that back it so research stays one click away.

## Goal-shaped study, not cert-shaped study

- As a returning CFI, I want a Goal that says "rebuild PPL knowledge + finish IR + add CPL/Multi/CFII/MEI" so the system targets my actual intent, not a single-cert template.
- As a learner doing BFR prep, I want a goal that doesn't tie to any cert so my study queue stays focused on currency, not regulatory scope.
- As a learner with multiple parallel tracks, I want exactly one goal marked "primary" so the engine has an unambiguous target without me having to pick a single cert.
- As a learner, I want to switch primary goals in one click so I can move from "PPL push this week" to "IR cleanup next week" without rebuilding the goal.
- As a learner, I want to add ad-hoc knowledge nodes to a goal (weak areas, personal interest) so the goal isn't constrained to whatever the FAA happened to put on a syllabus.
- As a learner, I want to weight the syllabi inside a goal so a goal of "PPL refresh (heavy) + IR (lighter)" actually emphasizes PPL in the engine's batches.

## The right kind of evidence per kind of knowledge

- As a learner, I want a `K`-triad leaf to require card evidence so I can read my way to mastering it.
- As a learner, I want an `S`-triad leaf to require demonstration evidence so I can't card my way to "I can fly steep turns."
- As a CFI student, I want teaching exercises to count toward CFI leaves so my evidence shape matches what a CFI is actually asked to do.

(Engine wiring of evidence-kind gating is a follow-on WP. This WP records the data shape so the rule can be enforced.)

## Citations as first-class objects

- As a learner, I want every authored claim to resolve to a real source so I can verify what the system told me.
- As a learner, I want the same source (PHAK Ch 12 §3, 14 CFR 61.103, AIM 5-1-7) referenced consistently across nodes, syllabus leaves, cards, and scenarios so my mental map stays coherent across surfaces.
- As a learner, I want every citation to carry a canonical identifier so the reference is unambiguous, future-proof against handbook editions, and resolvable to a live URL.
- As an author, I want the citation locator shape to match the source kind (chapter / section for handbooks, title / part / section for CFRs, paragraph for AIM) so I'm not jamming everything into one freeform text field.
- As an author, I want to optionally label a citation's framing (survey / operational / procedural / regulatory / examiner) so the same source can be cited with the right pedagogical lens per consumer.

## Authoring syllabi as YAML in repo

- As a content author, I want to author the PPL ACS as YAML files committed to git so a syllabus update is reviewable in a PR.
- As a content author, I want one file per Area of Operation so my edits stay local and concurrent authors don't conflict.
- As a content author, I want the build pipeline to fail loudly on a dangling knowledge_node link so I never silently ship a leaf with no nodes.
- As a content author, I want to point a leaf at multiple knowledge nodes with weights so a task spanning several concepts isn't forced to pick one.
- As a content author, I want the build pipeline to be idempotent so re-running with no YAML changes is a no-op.

## Credentials as a DAG, not a line

- As a CFII candidate, I want CFII to require both CFI and Instrument so the prereq picture matches 14 CFR 61.183 instead of an arbitrary linearization.
- As a future MEI/MEII candidate, I want the prereq DAG to honor the multi-engine class rating + CFI + (for MEII) instrument requirements so the model maps to FAA practice.
- As a learner, I want endorsements (complex, high-perf, tailwheel, etc.) to be peer credentials, not buried in a flag column on private.
- As a content author, I want a credential's regulatory basis cited as a CFR section so the dashboard can link "where does this credential come from?" to the actual rule.

## Lenses on the same content

- As a learner, I want to browse my goal by ACS area so I can prep checkride-style.
- As a learner, I want to browse my goal by domain (Aerodynamics, Weather, Airspace) so I can study by topic when the ACS structure isn't how my brain is firing today.
- As a future user, I want to browse by phase of flight (Takeoff, Cruise, Approach, Landing) so I can prep operationally.
- As a future user, I want to browse by handbook chapter so my reading and my study queue line up.
- As a future user, I want a weakness lens that surfaces what's slipping so the next session has a clear target.

(ACS lens and Domain lens ship in this WP. The rest are typed-but-not-implemented; follow-on WPs replace them.)

## Migration off authored relevance

- As a content author, I want to stop authoring `relevance:` per node so cert/bloom/priority claims live in one place (the syllabus) instead of two.
- As an existing-content owner, I want the relevance cache rebuild to surface diffs before it writes so I can review what's about to change without surprises.
- As an existing-content owner, I want the YAML cleanup to be a separate, reviewable script so the git diff makes the change obvious.
- As an existing-content owner, I want re-running the build to be a no-op once the cache is stable so I don't accumulate spurious diffs.

## Migration of existing study plans

- As an existing user, I want my current plan's cert_goals to convert to a goal automatically so I don't have to recreate my study setup.
- As an existing user, I want the session engine to behave the same after migration so my running streaks and queues don't break.
- As an existing user, I want a clear note if a cert in my old plan didn't resolve to a credential row so I know what got dropped.

## What we are not building (so users don't ask)

- As a learner, I do **not** expect the cert dashboard pages in this WP -- they ship in a follow-on (`cert-dashboard`). This WP delivers the data layer.
- As a learner, I do **not** expect the personal goal composer pages in this WP -- they ship in a follow-on (`goal-composer-ui`). This WP delivers the BC functions.
- As a learner, I do **not** expect every ACS / PTS / endorsement to be transcribed in this WP. Area V of PPL ACS ships as the model-validation pilot; the rest is iterative content sweeps after merge.
- As a learner, I do **not** expect handbook lens, weakness lens, bloom lens, phase-of-flight lens, or custom lens to work in this WP. Only ACS lens and Domain lens are implemented; the others have type signatures but no implementation.
- As a learner, I do **not** expect the engine to read goal-derived filters directly in this WP. The engine continues reading `study_plan.cert_goals` (now derived) for backwards compatibility; a follow-on WP cuts the engine over.
- As a learner, I do **not** expect a UI surface that diffs ACS editions when the FAA publishes a new one. The data shape supports it; the surface is a follow-on triggered when a real second edition publishes.
- As a learner, I do **not** expect to share my goals with another learner. Goals are per-user.

## For Joshua-as-user-zero

- As Joshua, I want my returning-CFI rebuild expressed as a single goal with multiple syllabi so the platform models my actual study, not a CFI template.
- As Joshua, I want the cert dashboard data layer ready in this WP so the follow-on cert-dashboard pages have nothing to invent.
- As Joshua, I want Area V of PPL ACS authored end-to-end so the WP demonstrates the full round-trip (YAML -> seed -> BC -> rollup) before it merges.
- As Joshua, I want every existing 30 knowledge nodes' references migrated from the legacy `{ source, detail, note }` shape to the structured citation shape that WP #1 introduced, so the schema is uniform.
- As Joshua, I want my existing study plan's cert_goals converted to a goal automatically so my running setup carries forward.
