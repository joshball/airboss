---
title: Platform Pivot -- From FIRC to Pilot Performance
date: 2026-04-14
status: proposal
author: Joshua Ball
supersedes_scope_of:
  - docs/platform/VISION.md (FIRC-specific framing)
  - docs/platform/ROADMAP.md (FIRC phasing)
triggered_by: Chief instructor requirement (SS 141.35(d)) + shift in motivation away from revenue toward contribution
---

# Pivot: From FIRC Platform to Pilot Performance Platform

## TL;DR

FIRC is no longer the product. It's at best one content module on a broader **pilot performance & rehearsal** platform. The engine, scenario model, pre-brief/debrief architecture, and content pipeline we've been building all transfer directly. What changes is the audience (every pilot, every flight, not CFIs every 24 months), the business posture (cover-costs / potentially open-source, not commercial), and the regulatory posture (no FAA submission required to ship v1).

## Why pivot

| Driver                            | What it means                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Chief instructor requirement      | FAA FIRC approval requires a chief instructor Joshua doesn't qualify as -- would require hiring/partnering -- kills the motivation |
| Motivation is craft, not revenue  | "Cover costs, make it available, maybe open-source" -- removes the business pressure that made FIRC attractive in the first place |
| The engine is the interesting part | Scenario + tick + scoring + pre-brief/debrief is the thing worth building. FIRC was the excuse to build it |
| Real underserved niche            | Nobody owns the 20 minutes *before* a flight -- the mental rehearsal / route walk-through / head-in-cockpit loop |
| Audience frequency                | FIRC = 1 purchase every 24 months per CFI. Performance platform = potentially daily use per pilot |

## What the new thing is

**A pilot performance platform centered on mental rehearsal and deliberate practice.** Not a course. Not a sim. Not a logbook. A *rehearsal and proficiency* tool that fits between planning (ForeFlight) and flying (the aircraft) and between flying and reflection (CloudAhoy).

Working name: TBD. "FIRC Boss" no longer fits.

### Core loops

```text
Before flight    ->   Load route -> rehearse scenario -> load decisions into working memory
Between flights  ->   Daily 10-min spaced scenario practice on weak areas
After flight     ->   Debrief with timeline, self-rating, note which decisions held up
Over time        ->   Track calibration, proficiency trends, where the pilot is drifting
```

### Product layers

| Layer                       | What it is                                                                                                      | Priority |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| **Route rehearsal**         | Import a route; get a tailored pre-brief: terrain/airspace/WX gotchas, likely ATC, go/no-go pressure points, diversion options | v1 hook  |
| **Proficiency maintenance** | Short daily scenarios; spaced + interleaved; targets the pilot's weak areas from prior performance              | v1 core  |
| **Event prep modules**      | IPC, flight review, BFR, checkride prep, type rating prep, airline interview prep                               | v2       |
| **Transition support**      | New type, new avionics (G1000->G3000, piston->turbine), new environment (mountain, IFR, international)          | v2       |
| **FIRC content module**     | The 503 questions + AC 61-83K scenarios, optional, *not* FAA-approved unless a partner instructor adopts it     | v3+      |

## What stays

- **`libs/engine/`** -- scenario tick engine, scoring, student model. Core IP.
- **Scenario content model** -- ticks, decisions, branches. Already general.
- **Pre-brief / debrief architecture** -- this is the valuable pedagogy. See [course/L04-Design/references/performance-pilot-integration.md](../../course/L04-Design/references/performance-pilot-integration.md).
- **BC structure** -- most BCs survive (see next section for mapping).
- **Published content versioning** -- still matters; "which version of a scenario did the pilot run" is still the right question.
- **Two-tier ID strategy** -- survives unchanged.
- **Design principles** -- most survive. "Two systems, layered" (FAA wrapper over real engine) collapses into just the real engine, which is a simplification.
- **Stack** -- Bun / SvelteKit / Svelte 5 / Drizzle / Postgres. No reason to change.

## What changes structurally

### Apps

| App        | FIRC role                             | Post-pivot role                                                                | Verdict      |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| **sim**    | Learner-facing course / game          | **The pilot app** -- rehearsal, proficiency, event prep. Primary surface.       | Keep, rename candidate |
| **hangar** | Content authoring + product tracking  | Content authoring for scenarios + route packs + modules. Community contribution surface if open-sourced | Keep         |
| **ops**    | FAA compliance, users, submissions    | Much smaller -- user admin, billing (if any), content moderation. Could fold into hangar | Downgrade / collapse |
| **runway** | Public-facing marketing               | Public site + free content + open-source landing                               | Keep, simpler |

Candidate simplification: **three apps (pilot / hangar / runway)** with ops-ish admin living inside hangar behind role gates. Decision deferred.

### Bounded contexts

| BC             | FIRC role                          | Post-pivot role                                                                 | Verdict        |
| -------------- | ---------------------------------- | ------------------------------------------------------------------------------- | -------------- |
| `course`       | Curriculum, content                 | Scenario packs, route packs, module content                                     | Keep, rename?  |
| `enrollment`   | Learner progress / completion       | Subscription / user progress / streaks                                          | Keep, rethink  |
| `evidence`     | Scenario runs, scores               | **More important than before** -- this is the core data product for the pilot  | Elevate        |
| `compliance`   | FAA traceability, submissions       | Only matters if someone runs a FIRC or Part 141 module on top; dormant by default | Dormant        |
| `platform`     | Tasks, boards                       | Same                                                                            | Keep           |
| `auth`         | Identity, sessions, permissions     | Same, simpler (fewer roles)                                                      | Keep, simpler  |
| `audit`        | Content version history             | Same                                                                            | Keep           |

### FAA compliance as data model

Currently a first-class concern baked into the schema. Post-pivot: **keep the audit/version rigor, drop the submission workflow.** If a content module later wants to be FAA-submittable (FIRC, Part 141 ground school, WINGS credit), the compliance BC wakes up for that module. For v1 it stays dormant.

This is actually a nice property -- the engineering rigor we built for FAA-readiness makes the platform trustworthy even when not pursuing approval.

## Open-source posture

The user is leaning open-source or partially open-source. Worth deciding early because it shapes architecture.

**Options:**

| Option                               | What                                                                                                 | Tradeoffs                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Fully open**                       | Everything in public repos, MIT/Apache                                                               | Max contribution, max transparency; no moat but there wasn't one anyway          |
| **Open core**                        | Engine + scenario format + content schemas open; hosted product closed                               | Lets others build; you run the canonical instance                                |
| **Open content, closed engine**      | Scenario packs + route packs open (CC-BY-SA); engine/platform closed                                 | Community authors contribute; tech stays proprietary                             |
| **Open engine, closed content**      | Engine open; curated scenario/route content is the hosted value                                      | Inverse of above; weaker since content is easier to reproduce than engine        |
| **All closed, cover-cost hosted**    | Just run it cheap                                                                                    | Simplest; least leverage; least durable                                          |

**Initial instinct:** open core -- engine, scenario format, content schemas in the open; hosted instance covers costs; scenario/route packs contributed by community *and* curated by us. But this deserves a proper ADR once we've lived with the pivot for a bit.

## What this un-blocks and what it breaks

### Un-blocks

- Chief instructor hiring / partnership conversation -- gone.
- TSA 5-year retention, 24-month FAA retention, TCO submission, Appendix A 90-day policy check -- all deferred to if/when a FIRC module ships.
- AC 61-83K interpretation pressure -- deferred similarly.
- 503-question bank -- still valuable content, but no longer critical-path.
- Chief instructor requirement as memory item -- can retire from active tracking.

### Breaks / needs rework

- `docs/platform/VISION.md` is FIRC-framed. Needs rewrite.
- `docs/platform/ROADMAP.md` is FIRC-phased. Needs rewrite.
- `course/L04-Design/ROADMAP.md` is FIRC-curriculum-phased (C0-C4). Most content work still has value but the C4 "FAA submission" phase is deferred indefinitely.
- Product PRDs under `docs/products/*/PRD.md` need re-scoping.
- Project name -- "FIRC Boss" no longer fits. The repo has since been renamed to `airboss-firc`; the pilot performance platform lives in `airboss`. Product name needs a new choice.
- CLAUDE.md FAA-specific rules -- downgrade from "critical rules" to "rules that apply when authoring FIRC-adjacent content."

## Risks & counter-arguments

| Risk                                                                                  | Response                                                                                                                |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Scope explosion -- "every pilot, every flight" is vastly bigger than FIRC             | Pick one v1 wedge (route rehearsal) and ship it alone. Everything else is v2+.                                          |
| No regulatory moat -- anyone can build this                                           | Regulatory moat isn't load-bearing when the goal isn't money. The contribution *is* the point.                           |
| Existing tools already cover parts of this (ForeFlight, CloudAhoy, Sporty's, PilotEdge) | Nobody owns pre-flight rehearsal specifically. Integrate with what exists rather than compete.                          |
| Engagement requires frequent use -- hard to build without marketing                   | Route rehearsal ties naturally to every flight. Pilots already do pre-flight prep; we make that prep dramatically better. |
| FIRC work already done is wasted                                                       | Engine, scenario model, pre-brief/debrief, BC structure, design principles, ADRs -- 90%+ transfers. Content research is reusable as module content. |
| "Nonprofit-ish" energy can stall -- no deadline, no pressure                          | Real. Need to set self-imposed milestones. A public v1 launch date does a lot of the work a business deadline would.     |

## Open questions (not commitments)

1. **Name.** What do we call the product? "Pilot Performance" is descriptive; we need something better. Candidates to brainstorm.
2. **v1 scope.** Route rehearsal alone? Or route rehearsal + a proficiency mode? My instinct: route rehearsal alone as the launchable wedge.
3. **Licensing.** MIT / Apache / AGPL for code. CC-BY-SA or CC-BY for content. Decide before first public commit.
4. **Hosting model.** Self-hostable from day one, or hosted-only with source available?
5. **Integration targets.** ForeFlight route import? Garmin Pilot? GPX? Foreflight is closed-API -- may need to start with manual entry + GPX.
6. **Monetization.** "Cover costs" = donations? $X/yr to keep the lights on? Free with optional paid tier for power features? Or purely free and pay out of pocket?
7. **What happens to the 503 questions and AC 61-83K research already done?** Probably: stays in the repo as a "FIRC content pack" that's dormant until someone wants to run a FIRC on top. Don't throw it away.
8. **Chief instructor / FAA work as optional module.** Is that real, or is it "we'll get to it never"? Honest answer probably affects whether we keep the compliance BC structure.

## Proposed next steps (if this lands)

1. **Decision call** -- does this feel right when you sleep on it? No rush.
2. **Name brainstorm** -- we need a working name before any public surface.
3. **Write new [docs/platform/VISION.md](VISION.md)** -- short, sharp, new-product framing.
4. **Write new [docs/platform/ROADMAP.md](ROADMAP.md)** -- v1 = route rehearsal, v2+ = everything else.
5. **Draft an ADR on licensing / open-source posture** -- 011-LICENSING or similar.
6. **Archive FIRC-specific planning** to `docs/.archive/firc-era/` preserving structure -- never delete.
7. **Decide on app collapse** -- 3 apps or 4? ADR-001 revisit.
8. **Pick a public v1 target** -- self-imposed deadline to replace the business pressure that's no longer there.

## References

- Book that catalyzed this: [course/L04-Design/references/performance-pilot-review.md](../../course/L04-Design/references/performance-pilot-review.md)
- Integration thinking: [course/L04-Design/references/performance-pilot-integration.md](../../course/L04-Design/references/performance-pilot-integration.md)
- Chief instructor blocker: see memory `project_chief_instructor`
