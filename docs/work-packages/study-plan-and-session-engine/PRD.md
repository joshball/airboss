---
title: 'PRD: Study Plan + Session Engine'
product: study
feature: study-plan-and-session-engine
type: prd
status: unread
---

# PRD: Study Plan + Session Engine

> "I want to study" -- and the system gives you 10 things. The right 10. Continuing what you started yesterday, strengthening where you're slipping, expanding into what you haven't touched, diversifying so you don't tunnel-vision. Your preferences (focus domains, skip lists, cert goals) shape the mix. Your history shapes the priorities.

## The Problem

After building the tools (Memory Items, Decision Reps, Calibration) and the graph (Knowledge Graph), you still have a daily problem: **what should I actually study right now?**

Without help, the user's defaults are bad:

- Review due cards -> reactive. Doesn't surface nodes you haven't started.
- Study your weakest area -> fatigues you; you burn out on the hard stuff.
- Pick a topic you feel like -> drifts to what you already know. Comfort zone.
- Follow a fixed curriculum -> too rigid. You need to bounce around (some weather this morning, reps tonight) and skip what doesn't serve you right now.

The need is **intelligent recommendation without rigid prescription**. The system should:

1. Remember what you were working on (continuity)
2. Know what's slipping (retention signals)
3. Know what's unstarted (coverage gaps)
4. Respect your goals (cert levels, focus domains)
5. Respect your constraints (skip this, come back later)
6. Propose a session -- but always let you override

That's the Session Engine. And it needs inputs: your goals, preferences, history. That's the Study Plan.

## The Product

Two tightly coupled pieces:

1. **Study Plan.** Per-user configuration: cert goals (PPL / IR / CPL / CFI -- any combination), focus domains (emphasis for the current period), skip domains (come back later), depth preference (how deep to go by default), session length preference (how many items per session).

2. **Session Engine.** A recommender that takes a request like "I want to study" or "I want to study weather" and returns a batch of N items (cards + reps + nodes to start) weighted by four criteria:
   - **Continue** (30%) -- items from domains studied in the last 2 sessions
   - **Strengthen** (30%) -- items with dropping mastery (SRS due, low accuracy)
   - **Expand** (20%) -- nodes unstarted, prerequisites met
   - **Diversify** (20%) -- items outside current focus, preventing tunnel vision

Weights are defaults. Users override by selecting a session mode: "Continue where I left off", "Hit my weak spots", "Try something new", or the default mix.

## Who It's For

**Primary: Joshua (user zero).** Returning CFI across four cert levels. Diversity-driven -- wants to work on different things different days. Needs the system to pick up mid-flow without losing context.

**Secondary: any pilot studying regularly.** Daily 10-minute sessions are more valuable than occasional 2-hour sessions -- spaced practice wins. The Session Engine makes daily sessions possible because the "what to study" question is already answered.

**Secondary: event-prep users.** BFR Sprint / IPC Sprint / Checkride Prep. A structured study plan with a deadline. The Session Engine shifts toward coverage + strengthen in the final weeks before the event.

## Core Experience

### Study Plan setup (first-run wizard)

```text
┌────────────────────────────────────────────────────────────┐
│  Let's set up your study plan                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  What are you working toward?                              │
│  (Pick all that apply. You can change this anytime.)       │
│                                                            │
│   ☑ Private Pilot (PPL)                                    │
│   ☑ Instrument Rating (IR)                                 │
│   ☐ Commercial Pilot (CPL)                                 │
│   ☑ Flight Instructor (CFI)                                │
│                                                            │
│  How much time do you want to study per session?           │
│   ○ 5 minutes (5 items)                                    │
│   ● 10 minutes (10 items)                                  │
│   ○ 20 minutes (20 items)                                  │
│                                                            │
│  Any domains to emphasize right now?                       │
│   [ Weather ✕ ] [ IFR Procedures ✕ ] [ + Add ]             │
│                                                            │
│  Anything to skip for now?                                 │
│   [ Nothing ]    [ + Add ]                                 │
│                                                            │
│  [ Save and start studying ]                               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Editable later from a Study Plan settings page.

### The "I want to study" entry point

```text
┌────────────────────────────────────────────────────────────┐
│  Ready to study?                                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   [ Start my 10-min session ]                              │
│                                                            │
│   Or pick a mode:                                          │
│    ○ Continue (where I left off)                           │
│    ○ Strengthen (my weak spots)                            │
│    ● Mixed (default)                                       │
│    ○ Expand (something new)                                │
│                                                            │
│   Or focus:                                                │
│    [ Weather ] [ Regulations ] [ IFR ] [ CFI ] [ All ▼ ]   │
│                                                            │
│                                                            │
│   Skip what?                                               │
│    [ Nothing today ]    [ + Add ]                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### A typical session preview

```text
┌────────────────────────────────────────────────────────────┐
│  Your session (10 items, ~10 min)                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Continue where you left off (3 items)                     │
│   1. Card: "Class B transition clearance phrasing"         │
│   2. Card: "Class B equipment requirements"                │
│   3. Rep: "Class B transition request denied -- now what?" │
│                                                            │
│  Strengthen (3 items)                                      │
│   4. Card: "VFR weather minimums Class E above 10K"        │
│      (you rated Again yesterday -- let's nail it)           │
│   5. Rep: "Icing encountered -- continue, divert, descend" │
│      (last 3 attempts: 2 wrong)                            │
│   6. Card: "VOR check tolerances"                          │
│      (you're slipping on this)                             │
│                                                            │
│  Expand (2 items)                                          │
│   7. NODE: Holding Pattern Entries (IR, unstarted)         │
│      (prerequisites met -- airspace, VOR nav)               │
│   8. Card: "MEA vs MOCA"                                   │
│                                                            │
│  Diversify (2 items)                                       │
│   9. Rep: "Student freezes on solo landing -- what do you  │
│      do as their CFI?" (Teaching domain)                   │
│  10. Card: "Signs of student overconfidence"               │
│                                                            │
│  [ Start ]       [ Shuffle ]       [ Replace an item ]     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

The preview tells the user WHY each item is there. "You rated Again yesterday" explains the strengthen pick. "Prerequisites met" explains why this expand node was ready to show up.

### Quick focus overrides

```text
┌────────────────────────────────────────────────────────────┐
│  Focus your session                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   Today I want to work on:                                 │
│    ● Weather (all subtopics)                               │
│    ○ Instrument approaches                                 │
│    ○ Teaching / CFI material                               │
│    ○ Emergency procedures                                  │
│                                                            │
│   Or a specific node:                                      │
│    [ Search: holding pattern _____________ ]               │
│                                                            │
│   Cert level for this session:                             │
│    ● Match my plan   ○ PPL   ○ IR   ○ CPL   ○ CFI         │
│                                                            │
│   [ Start focused session ]                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Mid-session adjustments

If the user wants to skip an item during the session:

```text
┌────────────────────────────────────────────────────────────┐
│  Item 3 of 10                                              │
│                                                            │
│   Card: "Compass errors -- UNOS"                           │
│                                                            │
│   [ Skip this today -- show later ]                        │
│   [ Skip permanently -- too advanced ]                     │
│   [ Skip -- topic I don't need ]                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Three different skip behaviors with different effects:
- "Skip today" -- don't show in this session, normal scheduling otherwise
- "Skip permanently" -- mark the node as excluded from user's plan
- "Skip topic" -- excludes the node AND its dependents

### End of session summary

```text
┌────────────────────────────────────────────────────────────┐
│  Session complete                                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   10 items    8 correct    avg confidence: 3.2             │
│                                                            │
│   New today:                                               │
│    • Started "Holding Pattern Entries" node                │
│    • 4 cards moved from learning -> review state           │
│                                                            │
│   Streak: 12 days                                          │
│                                                            │
│   Suggested next:                                          │
│    • Finish Holding Pattern Entries node (~30 min)         │
│    • Come back tomorrow for 6 cards due                    │
│                                                            │
│   [ Another session ]      [ Done for today ]              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Design Principles

### The user is always in charge

The Session Engine suggests; the user chooses. Every recommendation is overrideable. Every filter is user-specified. "Here are 10 things" is a proposal, not a mandate. If the user wants to do 30 weather cards straight, the engine gets out of the way.

### Show the reasoning

"You rated Again yesterday" under a card pick. "Prerequisites met" under an expand pick. Reasoning is shown next to recommendations. This teaches the user how the engine works, builds trust, and makes the engine auditable. If a recommendation is bad, the reasoning exposes why.

### Diversity is not optional

Without diversify (20%), users tunnel. Regulations for a week, then weather for a week, then burn out. The diversify slice forces occasional cross-domain items. It can be reduced (user preference) but never zero by default. Some friction is valuable.

### Skip has three meanings

"Skip this today" (normal scheduling continues). "Skip this topic" (exclude from plan). "Skip this permanently" (mark as known / not-needed). Conflating them is a UX trap. Users who skip one thing don't necessarily want to skip its whole area.

### Respect the study plan but don't be rigid

The Study Plan sets defaults. A plan with cert_filter: [PPL] still allows the user to select "CFI material today" ad hoc. The plan shapes long-run behavior, not every session. Users change, days change, moods change.

### Prerequisites are prerequisites

The Expand slice requires prerequisites met. If you haven't mastered VFR minimums, the engine doesn't suggest "Instrument Approaches." Exception: user explicitly overrides ("I know I'm weak on VFR mins but I want to study approaches anyway"). The system warns, then complies.

### Match the session length to the time available

Sessions are sized by user preference (5 / 10 / 20 items). No "finish this 45-minute session or lose progress." A 5-item session that gets completed is worth more than a 50-item session that gets abandoned.

## Core Logic

### The weighted picker

```text
Input: user_id, session_length, optional focus/skip overrides

1. Fetch study plan for user
2. Compute candidate pool:
    a. Continue candidates: nodes touched in last 2 sessions
    b. Strengthen candidates: cards due + low-accuracy reps + slipping nodes
    c. Expand candidates: unstarted nodes, prerequisites met, matching cert filter
    d. Diversify candidates: items outside current week's domains
3. Allocate session slots by weight:
    - 30% continue, 30% strengthen, 20% expand, 20% diversify (default)
    - Apply user mode overrides (Continue / Strengthen / Mixed / Expand)
4. Within each slice:
    - Prefer items matching focus domains
    - Exclude items matching skip domains
    - Respect cert filter
5. Assemble batch, add reasoning label per item
6. Return ordered list (interleave slice types to avoid "all continue first")
```

### Signals used

- Cards: SRS state (due_at, state, stability), review history (accuracy, confidence)
- Reps: attempt history (accuracy by scenario, domain accuracy)
- Nodes: mastery score (derived from attached cards/reps), last touched date
- User: study plan (goals, focus, skip), session history (domains by session)
- Graph: prerequisites, cert relevance, bloom levels, priority

### Modes

- **Continue** (mode override): 70% continue, 20% strengthen, 10% diversify. "Keep me on my current track."
- **Strengthen**: 10% continue, 70% strengthen, 20% diversify. "Fix what's slipping."
- **Mixed** (default): 30/30/20/20.
- **Expand**: 10% continue, 10% strengthen, 70% expand, 10% diversify. "Show me new things."
- **Focused**: 100% of chosen domain (user-specified), mixed within.

## Integration With Other Products

### Knowledge Graph (primary input)

The engine reads node metadata for cert relevance, prerequisites, mastery state. It writes nothing to the graph. Graph is source of truth; engine is a consumer.

### Memory Items (primary input + output)

Engine reads card SRS state to pick Strengthen and Continue items. Engine returns card IDs as part of session batches. Memory Items review flow runs the actual review; engine doesn't wrap it.

### Decision Reps (primary input + output)

Same as Memory Items -- engine reads rep history, returns rep IDs in batches, Decision Reps handles the session flow.

### Calibration Tracker (secondary input)

Calibration data is a tiebreaker for Strengthen selection: when two items have similar mastery dropoff, the one in a domain where the user is overconfident takes priority. Overconfidence is a learning opportunity.

### Learning Dashboard (sibling UI)

The dashboard shows state. The engine picks items. They read the same data but render different views. Dashboard is "where am I overall?" Engine is "what's next right now?" See [Learning Dashboard PRD](../learning-dashboard/PRD.md).

### Courses (future: FIRC, BFR Sprint)

Courses override the engine's default weights. A BFR Sprint plan with 4 weeks to go might run 60% strengthen / 20% expand / 20% verify (assessment), because coverage is fixed. The engine accepts mode overrides from the active course.

## Success Criteria

### MVP (first ship)

- [ ] Study Plan can be created, edited, and saved (cert goals, session length, focus, skip)
- [ ] "Start my session" returns 10 items within 500ms
- [ ] Reasoning labels appear next to each item ("due today", "unstarted prerequisites met", etc.)
- [ ] Session preview is overrideable (shuffle, replace an item, cancel)
- [ ] Focus override (by domain) works
- [ ] Skip overrides work (today / permanent / topic) with correct downstream effects
- [ ] Session mode selection (Continue / Strengthen / Mixed / Expand) produces visibly different batches
- [ ] Prerequisites are respected in Expand slice (no "Instrument Approaches" picked if VFR minimums unmastered)
- [ ] Session summary shows meaningful metrics (correct/incorrect, confidence avg, streak)
- [ ] Streak calculation survives day-boundary edge cases (timezone)

### Beyond MVP

- [ ] Smart session length (engine suggests longer session when many items are due)
- [ ] Time-aware recommendations ("you have 5 minutes -- here are 5 quick items")
- [ ] Mood-aware mode suggestions ("you've been strengthening for 3 days -- want to expand?")
- [ ] Calendar-like view ("cards due this week, projected load")
- [ ] Goal deadlines ("studying toward IPC in 4 weeks -- here's the plan")
- [ ] Paired-session suggestions (card session -> rep session in the same domain)
- [ ] Natural-language focus ("study holding patterns" -> engine matches)

## What This Is NOT

- **Not a fixed curriculum.** No "Week 1: Airspace, Week 2: Weather." Plans are soft guidance, not hard schedules.
- **Not a gradebook.** Session outcomes don't roll up to grades. They feed the recommender's next picks.
- **Not a timer.** No forced session length. 10 items is a target; user can stop at 5 or go to 15.
- **Not a clone of Anki's scheduler.** Anki schedules cards. This schedules SESSIONS (containing cards + reps + node starts). Different abstraction level.
- **Not compliance tracking.** FAA time tracking (for FIRC, BFR, etc.) lives in courses, not here.

## Open Questions

1. **Default weights.** 30/30/20/20 is a guess. Needs real-usage data. Should this be exposed as a user setting?
2. **"Keep me on track" implicit mode.** If user hasn't specified a mode and plan shows focus domains, should engine auto-shift to focused? Or stay mixed?
3. **Session recovery.** User starts a 10-item session, completes 6, closes the tab. Come back next day -- do the remaining 4 resume, or does the engine pick fresh? Probably fresh, but worth deciding.
4. **Cross-product sessions.** Can a session include an Interactive Activity (like the wind triangle visualization)? Currently batch items are card/rep/node-start. Activities blur this. Might need a fifth item type.
5. **Repeatable recommendations.** If I run "Strengthen" three times in a day, do I see the same items? Or does the engine remember what it just suggested and avoid? (Probably avoid within a short window.)
6. **Prerequisites-met logic.** "Mastered" is the trigger -- but mastery is a soft signal. Is there a minimum threshold (e.g., 70% accuracy across attached cards) or a boolean? Needs definition.

## References

- [Knowledge Graph PRD](../knowledge-graph/PRD.md) -- the graph this engine queries
- [Spaced Memory Items PRD](../spaced-memory-items/PRD.md) -- card session consumer
- [Decision Reps PRD](../decision-reps/PRD.md) -- rep session consumer
- [Calibration Tracker PRD](../calibration-tracker/PRD.md) -- secondary input
- [Learning Dashboard PRD](../learning-dashboard/PRD.md) -- sibling UI
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- parent architectural decision
