---
title: 'PRD: Learning Dashboard'
product: study
feature: learning-dashboard
type: prd
status: unread
---

# PRD: Learning Dashboard

> The bird's-eye view. Every domain, every cert level, every node -- where you are across the whole territory. "You've been working on weather a lot; airspace is solid; you haven't started teaching yet." A single page that tells you the truth about your learning.

## The Problem

Once you have the graph (500 nodes) and the tools (cards, reps, calibration) and a session engine picking 10 items a day, you still need **a view**. A place where you can step back and see the whole territory at once.

Without it:

- You don't know what you don't know. There's no way to see "I haven't started `nav-holding-pattern-entries`" unless you search for it.
- Progress is invisible. Streak counters are motivating but shallow. Real progress is "I've moved from 12% to 38% on weather in three weeks."
- Weak areas don't surface. Dashboard data exists in pieces across cards, reps, and calibration, but nothing combines them into "here's your honest picture."
- Cross-cert planning is impossible. If you're working toward IPC and CPL simultaneously, you need to see both arcs and understand the overlap.
- Study feels like a treadmill. Daily sessions are small. The dashboard is where the cumulative story lives.

## The Product

A single page, opened from the app's home, that shows:

1. **The map.** Domains (rows) by cert level (columns), each cell showing mastery percentage. "You're at 65% on weather for PPL, 40% for IR, haven't started CFI-level."

2. **Weak areas.** Top 3-5 nodes or domains with the biggest mastery gaps or most overdue cards. "Here's what to focus on."

3. **Recent activity.** Last 2 weeks of study -- what you worked on, when, how many items. Heatmap or sparkline.

4. **Calibration summary.** One-line: your calibration score + biggest overconfidence gap. Links to the full Calibration page.

5. **Cert progress.** Per-cert bars: "PPL: 62% of core nodes mastered. IR: 28%. CPL: 5%. CFI: 12%." Based on the user's study plan cert filters.

6. **What to study today.** A prominent "Start my session" button that invokes the Session Engine -- this is the dashboard's call-to-action.

Opinionated, information-dense, honest. No cheerleading. Not a gamification shell.

## Who It's For

**Primary: Joshua (user zero).** Needs the honest picture. The daily tool use answers "what's next?" but the dashboard answers "where am I?" These are different questions with different answers and different cadences.

**Secondary: pilots tracking long arcs.** BFR prep, checkride prep, returning-from-layoff. The dashboard is where the arc lives -- "where was I a month ago? Where am I now? Am I on track?"

**Secondary: CFIs tracking students (future).** If we ever let a CFI see their student's dashboard (opt-in), this becomes a teaching tool. Not MVP.

## Core Experience

### The dashboard itself

```text
┌────────────────────────────────────────────────────────────────────┐
│  Learning Dashboard                                  Joshua Ball    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   [ Start my 10-min session ]                                      │
│                                                                    │
│   ────────────────────────────────────────────────────────────     │
│                                                                    │
│   Cert progress:                                                   │
│                                                                    │
│     PPL   ████████████░░░░░░░░  62%  (47 / 76 nodes)               │
│     IR    ██████░░░░░░░░░░░░░░  28%  (21 / 75 nodes)               │
│     CPL   █░░░░░░░░░░░░░░░░░░░   5%  (3 / 58 nodes)                │
│     CFI   ██░░░░░░░░░░░░░░░░░░  12%  (9 / 73 nodes)                │
│                                                                    │
│   ────────────────────────────────────────────────────────────     │
│                                                                    │
│   The Map (mastery by domain × cert level):                        │
│                                                                    │
│                          PPL      IR      CPL     CFI              │
│   Regulations ........   89%     72%     45%     32%               │
│   Weather ............   62%     34%      -       -                │
│   Airspace ...........   84%     71%     60%     20%               │
│   Navigation .........   71%     38%     12%      -                │
│   Aerodynamics .......   58%     40%     18%      5%               │
│   Performance ........   55%     35%      8%      -                │
│   Flight Planning ....   60%     22%      -       -                │
│   Emergency Procs ....   42%     28%     15%     10%               │
│   IFR Procedures .....    -      31%      -       -                │
│   Aircraft Systems ...   65%     45%     20%      -                │
│   ADM/Human Factors ..   70%     52%     30%     18%               │
│   Teaching ...........    -       -       -       8%               │
│                                                                    │
│   (Cells show % of core + supporting nodes mastered)               │
│                                                                    │
│   ────────────────────────────────────────────────────────────     │
│                                                                    │
│   Weak areas (recommend spending time here):                       │
│                                                                    │
│     1. Emergency Procs (PPL)  --  42% mastered, 5 overdue cards    │
│     2. Navigation (IR)        --  38% mastered, 3 cards slipping   │
│     3. Performance (IR)       --  35%, you haven't touched in 9d   │
│     4. Teaching (CFI)         --   8%, mostly unstarted             │
│     5. Flight Planning (IR)   --  22%, prerequisites met            │
│                                                                    │
│   ────────────────────────────────────────────────────────────     │
│                                                                    │
│   Calibration score: 0.78     Biggest gap: Weather (overconfident) │
│                                           [ view calibration → ]   │
│                                                                    │
│   ────────────────────────────────────────────────────────────     │
│                                                                    │
│   Activity (last 30 days):                                         │
│                                                                    │
│    ▃ ▃ ▅ █ ▃ ▁ ▅    ▂ ▅ █ █ ▅ ▂ ▃    ▃ ▅ ▅ █ ▃ ▁ ▂    ▅ ▅ █ █ ▃ ▁   │
│    M T W T F S S    M T W T F S S    M T W T F S S    M T W T F S  │
│                                                                    │
│    Average: 12 items/day   Streak: 18 days   This week: 84 items   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Domain detail drill-down

Click a domain cell (e.g., "Weather, IR" at 34%):

```text
┌────────────────────────────────────────────────────────────────────┐
│  Weather at IR level                                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   You're at 34% -- 8 of 23 IR-relevant weather nodes mastered.     │
│                                                                    │
│   Nodes in this view:                                              │
│                                                                    │
│   ✓ Reading METARs/TAFs ...............  IR  apply  mastered       │
│   ✓ Thunderstorm hazards (IR depth) ...  IR  apply  mastered       │
│   ◐ Icing types and avoidance .........  IR  apply  60% mastered   │
│   ◐ Frontal systems analysis ..........  IR  analyze 45%           │
│   ○ Go/No-Go decision framework .......  IR  analyze 0% (unstrtd)  │
│   ○ Winds aloft interpretation ........  IR  apply  0%             │
│   ○ PIREPs strategic use ..............  IR  apply  0%             │
│   ○ IFR weather minimums ..............  IR  apply  0%             │
│   ... 15 more nodes ...                                            │
│                                                                    │
│   [ Study this domain now (10 items) ]                             │
│   [ Browse all 23 nodes → ]                                        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Node detail (click into a specific node)

This is the same Node Detail page described in the Knowledge Graph PRD -- the dashboard drill-down lands there.

### Mobile-compact variant

```text
┌──────────────────────────────┐
│ Learning                      │
├──────────────────────────────┤
│                              │
│ [ Start 10-min session ]      │
│                              │
│ Cert progress:                │
│  PPL  62%  ▓▓▓▓▓▓░░░░         │
│  IR   28%  ▓▓▓░░░░░░░         │
│  CPL   5%  ▓░░░░░░░░░         │
│  CFI  12%  ▓▓░░░░░░░░         │
│                              │
│ Weak areas:                   │
│  • Emergency Procs (PPL)      │
│  • Navigation (IR)            │
│  • Performance (IR)           │
│  • Teaching (CFI)             │
│                              │
│ Calibration: 0.78             │
│   overconfident: Weather      │
│   [ view → ]                  │
│                              │
│ Streak: 18 days               │
│                              │
│ [ Full map → ]                │
│                              │
└──────────────────────────────┘
```

The map (domain × cert grid) works best on wide screens. Mobile collapses to a cert-progress stack + weak-area list + streak.

## Design Principles

### Tell the truth

No sugarcoating. If the user is at 12% on a cert, show 12%. No "you're making great progress!" cheerleading. Joshua specifically wants the honest read. The dashboard's job is calibration between self-perception and reality -- it's a metacognitive tool, not a motivation tool.

### One page, no tabs

Everything fits on one scroll. No navigation into "Progress Tab" and "Map Tab" and "Activity Tab." The value is seeing it all at once. Tabs hide things; the dashboard reveals.

### Information density over whitespace

Pilots read dense charts (approach plates, weather charts, W&B tables). The dashboard respects that. Compact tables, small numbers, many data points per screen. This isn't a consumer app; it's a professional instrument.

### Action-oriented

Every visible data point leads to an action. Click a weak area -> study it. Click a domain cell -> drill into nodes. Click calibration -> go to the calibration page. Click a node -> node detail. No data that doesn't go somewhere.

### Honest emptiness

If a cert level has no activity, show dashes or zeros -- not hidden cells, not "locked" indicators. An IR column with 0% everywhere is valid data. It tells the user where to work. Hiding it would be dishonest.

### The map is the metaphor

Aviation training is navigation. The dashboard presents learning as a map -- territory, waypoints (nodes), your current position (mastery), and what's ahead. This metaphor is native to the audience and persists through all visual decisions.

## What Goes Where (Information Hierarchy)

1. **Call to action at the top** -- "Start my 10-min session." The dashboard is a launchpad; the primary button is prominent.
2. **Cert progress next** -- quick answer to "how far along am I?"
3. **The map** -- the most information-dense part, answers "where across the territory?"
4. **Weak areas** -- answers "what should I focus on?"
5. **Calibration** -- one-line summary, link to full view
6. **Activity** -- historical view, answers "have I been consistent?"

The order matches user intent: want to study (CTA), orient myself (cert + map), decide focus (weak areas), check calibration (quality), reflect on habit (activity).

## Integration With Other Products

### Knowledge Graph (primary data source)

Dashboard reads node metadata (cert relevance, priority, domain) and mastery state (computed from attached cards/reps). The graph is queried heavily on dashboard load -- needs efficient indexes.

### Memory Items + Decision Reps (data source)

Mastery state per node is derived from card + rep performance. Dashboard reads aggregated data via the BC's read interfaces (`getCardMastery`, `getRepAccuracy`, etc.).

### Calibration Tracker (data source)

One-line calibration summary pulls from `getCalibration()`. Dashboard doesn't render the full calibration chart -- that's the Calibration page's job. Dashboard links to it.

### Session Engine (CTA consumer)

The "Start my session" button invokes the Session Engine. The weak areas list is computed partly from the same signals the engine uses for Strengthen slice picks.

### Study Plan (filter source)

Cert progress bars show only the certs in the user's study plan. If the user hasn't selected CPL as a goal, the CPL column shows data but doesn't get highlighted as "on your plan."

### Future products

A "Dashboard for other products" pattern emerges -- a Route Walkthrough dashboard, an NTSB Story progress view, etc. This Learning Dashboard is study-specific; other products will have their own. Nothing to share yet.

### Hangar Product Dashboard (separate, in hangar app)

The separate "Product Progress Dashboard" mentioned in earlier conversations (status of 53 products) lives in hangar when hangar exists. Different audience, different data, different purpose. This Learning Dashboard is the learner view.

## Success Criteria

### MVP (first ship)

- [ ] Dashboard loads in < 500ms with ~100 nodes
- [ ] Cert progress bars render for all 4 certs (even if empty)
- [ ] The map (domain × cert) renders and is readable
- [ ] Empty cells show dashes, not hidden
- [ ] Weak areas surface top 3-5 with reasoning
- [ ] Calibration one-liner renders with current score
- [ ] Activity heatmap/sparkline covers last 30 days
- [ ] "Start my session" invokes session engine
- [ ] Click-through works: domain cell -> domain detail, node -> node detail
- [ ] Mobile layout gracefully degrades
- [ ] Works correctly with < 5 nodes (empty-state dashboard is useful)

### Beyond MVP

- [ ] Compare-over-time view ("you a month ago vs. now")
- [ ] Export dashboard as image / PDF (for a training log)
- [ ] CFI view (student's dashboard, with permission)
- [ ] Course-specific dashboards ("your FIRC progress", "your BFR Sprint progress")
- [ ] Filterable by time window ("last 7 days", "since I started IR prep")
- [ ] Drill-down animations (map cell -> domain view -> node view) for visual continuity

## What This Is NOT

- **Not the Session Engine.** The engine picks items. The dashboard shows state. They share data; they're different UIs.
- **Not a gradebook.** No pass/fail. Mastery percentages are informational, not evaluative.
- **Not a productivity tool.** No "you should study 2 hours a day" nags. The data is there; interpretation is the user's.
- **Not the Product Progress Dashboard.** That's the builder view (what am I building?) in hangar. This is the learner view (what do I know?) in study.
- **Not a social dashboard.** No friend comparisons, no public leaderboards. Your data is yours.

## Open Questions

1. **What defines "mastered" for a node?** Dashboard shows mastery %. Needs a canonical formula. Proposal: `(card_accuracy * card_weight + rep_accuracy * rep_weight + content_phase_completion * phase_weight)` with weights per node in metadata. See [Knowledge Graph PRD](../knowledge-graph/PRD.md) open question on mastery model.
2. **Priority of nodes in weak-areas list.** Is it "biggest gap"? "Most overdue"? "Most impactful (prerequisites many dependents)"? Probably a blend; needs tuning with real data.
3. **Cert progress denominator.** "62% of 76 nodes" -- which 76? Core + supporting? Core only? Plan-specified only? Needs definition.
4. **Domain grouping.** 14 domains in the learning index. Is 14 rows too many? Should some group (e.g., "Regulations" + "Procedures" into one row)? Fits on desktop, may be tight on smaller screens.
5. **Real-time refresh.** If the user completes a session then returns to the dashboard, does it reflect new state immediately? Cache invalidation strategy. Probably fine with a manual refresh for MVP.
6. **Inactive certs.** User has PPL + IR in their plan; CPL isn't selected. Show CPL column anyway? Hide it? Gray it? Probably show with "Not on your plan" hint.

## References

- [Knowledge Graph PRD](../knowledge-graph/PRD.md) -- primary data source
- [Spaced Memory Items PRD](../spaced-memory-items/PRD.md) -- mastery input
- [Decision Reps PRD](../decision-reps/PRD.md) -- mastery input
- [Calibration Tracker PRD](../calibration-tracker/PRD.md) -- calibration summary
- [Study Plan + Session Engine PRD](../study-plan-and-session-engine/PRD.md) -- CTA consumer
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- parent architectural decision
- [Learning INDEX](../../vision/learning/INDEX.md) -- the 14 domains
