---
title: 'User Stories: Flight Dynamics Sim'
product: sim
feature: flight-dynamics-sim
type: user-stories
status: unread
review_status: pending
---

# User Stories: Flight Dynamics Sim

User stories for the flight sim MVP. Companion to [spec.md](spec.md), [design.md](design.md), [tasks.md](tasks.md), [test-plan.md](test-plan.md).

The single user is **a returning private pilot rebuilding scan, judgment, and instrument-failure response.** No instructor seat in MVP; the sim is the instructor through the debrief and the spaced-rep scheduler. The system reads the user's behavior off the replay tape and re-queues weak scenarios.

## Personas

| Persona | Profile | Why they reach for the sim |
| --- | --- | --- |
| **Returning PPL (primary)** | 100-500 hr lifetime time, lapsed 1-5 years, rebuilding currency | Wants short, debriefable practice on stalls, EFATO, partial panel without booking a CFI or aircraft |
| **Active CFI / IFR pilot (secondary)** | Current, recent, instrument-rated | Wants chair-flying for proficiency, especially partial-panel and unusual-attitude scans |
| **Student pilot (tertiary)** | Pre-solo through checkride prep | Wants to rehearse stall recovery, slow flight, departure-stall scenarios between lessons |

User-zero is the **returning PPL**. Every story is anchored to that persona unless otherwise marked.

## Story map

```text
Discover -> Brief -> Fly -> Debrief -> Re-queue -> Repeat
```

Each phase below has the stories for it. Stories are written `As a <persona>, I want <thing>, so that <outcome>.` Each story has its acceptance criteria and a link to the scenario / route that satisfies it.

## Discover

### S1. Pick a scenario quickly

**As** a returning PPL,
**I want** a scenario list with one-line summaries,
**so that** I pick what to fly in 10 seconds.

**Acceptance criteria:**

- Lands on `/` with a list of every shipped scenario.
- Each row shows: title, one-line summary, recommended order, "last attempted" / "best grade" if any.
- Clicking a row opens the briefing pane.
- Phase 0.5/0.6 already covers this; MVP requires the list to expand to 8-10 entries (Phase 6).

### S2. See what I am about to fly

**As** any user,
**I want** the briefing to tell me the initial conditions, the objective, and the failure modes,
**so that** I am not surprised when an instrument fails mid-scenario.

**Acceptance criteria:**

- `/[scenarioId]` shows briefing tagline + objective + initial conditions table (alt, airspeed, attitude, weather).
- Briefing **discloses** that instrument faults can occur, without spoiling which one or when.
- Phase 0.5 ships the basic shape; Phase 4 adds the fault-disclosure line.

### S3. Resume an attempt I was halfway through

**As** any user,
**I want** to come back to a scenario I started but did not finish,
**so that** I do not lose progress when life interrupts.

**Acceptance criteria:**

- If the user navigates away mid-scenario, on next visit the briefing offers Resume + Start Over.
- Resume restores the FDM at the last snapshot. Start Over discards the partial tape.
- Phase 4 work; not in MVP for v1 if scope-tight.

## Brief

### S4. Read help on any control without leaving the cockpit

**As** any user,
**I want** keyboard help reachable from the cockpit at any time,
**so that** I can look up "what does the comma key do" without losing the airplane.

**Acceptance criteria:**

- `?` toggles the keybindings overlay (shipped Phase 0.5).
- The cheatsheet at the bottom of the cockpit always shows the most-used keys (shipped Phase 0.6).
- Adding new cues in Phase 5 must update both surfaces.

### S5. Mute audio without losing the warning information

**As** a pilot in a quiet office,
**I want** to mute audio cues but still see the warnings,
**so that** I do not annoy people around me but still learn the cue meanings.

**Acceptance criteria:**

- `M` toggles mute. State persists in localStorage.
- Mute silences engine, stall horn, and every Phase 5 cue.
- Visible captions render in `aria-live="polite"` on every cue, regardless of mute. (Phase 5)

## Fly

### S6. Take off, climb, level off, turn, descend, land

**As** a returning PPL,
**I want** the airplane to fly like a C172 at every airspeed regime,
**so that** I rebuild correct stick-and-rudder muscle memory.

**Acceptance criteria:**

- 1G straight-and-level trim within 2% airspeed of POH at Vy and Vno (Phase 2).
- Stall break, recovery, and stall horn timing match POH "Vs1 + 5 to 10" feel (shipped Phase 0.5; verified again post-Phase 2).
- Coordinated turn at 30 deg bank tracks standard rate within 5% (shipped Phase 0.5).
- Crosswind correction works (Phase 6 -- proper crosswind component, not just static wind).

### S7. Spring-centered stick + hold-ramp throttle

**As** any user,
**I want** keyboard controls that feel like a yoke + throttle, not a tap-game,
**so that** I do not wrestle the keyboard while flying the airplane.

**Acceptance criteria:**

- Holding a primary-control key deflects the surface and releasing returns it to neutral (shipped Phase 0.8).
- Holding the throttle key ramps the throttle and releasing holds the position (shipped Phase 0.8).
- Trim and flaps stay tap-based (shipped Phase 0.5).

### S8. The instruments lie when they should

**As** an IFR pilot,
**I want** the AI to drift on a vacuum failure, not jump,
**so that** I practice the recognition the way I would in real life.

**Acceptance criteria:**

- Phase 3 fault model: AI drifts at `vacuumDriftDegPerSec` (default 1) once vacuum fault triggers.
- Pitot block: ASI reads like a second altimeter above the block altitude (climb -> increasing IAS even at constant attitude/power).
- Static block: altimeter freezes, VSI reads zero, ASI sense reverses on descent.
- Each fault is observable in the cockpit + recorded in the replay tape.

### S9. Crash and stop

**As** any user,
**I want** the sim to stop when I crash,
**so that** I do not keep flying a broken airplane and waste my time.

**Acceptance criteria:**

- Hard impact, wing strike, tail strike, nose strike, G overstress all halt the sim (shipped Phase 0.7 / PR #125).
- Outcome banner names the failure with values ("Hard impact at 950 fpm").
- Reset key returns to scenario initial conditions.

## Debrief

### S10. See what I did vs what was supposed to happen

**As** any user,
**I want** a scrubbable timeline showing my trajectory and inputs,
**so that** I can see exactly where the recovery went wrong.

**Acceptance criteria:**

- After scenario end, `/[scenarioId]/debrief` opens automatically.
- Timeline scrubber spans 0 to scenario end. Keyboard navigable (`<-`/`->`, page-up/page-down for 5-sec jumps).
- Trajectory traces: altitude, airspeed, alpha, pitch, roll, throttle. Time-aligned.
- "Compare to ideal" overlays a ghosted trajectory when `def.idealPath` is set.
- Phase 4.

### S11. See what the instruments showed me vs what was true

**As** an IFR pilot recovering from instrument failures,
**I want** a side-by-side of truth-state vs display-state across the timeline,
**so that** I see exactly when the fault deceived me and how long it took to catch it.

**Acceptance criteria:**

- Debrief renders truth panel + display panel synchronized to scrubber position.
- A timeline track marks fault activations.
- Phase 4 (display panel) + Phase 3 (fault model) co-dependent.

### S12. Re-fly with one click

**As** any user,
**I want** a Run Again button on the debrief,
**so that** I do not navigate three pages to start over.

**Acceptance criteria:**

- Button visible on debrief.
- Click resets scenario to initial conditions and returns to the cockpit.
- Phase 4.

## Re-queue

### S13. The system pushes me toward weak scenarios

**As** a returning PPL,
**I want** the sim to suggest what to fly next based on what I struggled with,
**so that** I do not waste time on things I already do well.

**Acceptance criteria:**

- Each completed scenario emits a `RepAttempt` with grade (0.0-1.0).
- Grade < 0.60 -> "Again" -- scenario re-queued for short-interval review.
- Grade 0.60-0.85 -> "Okay" -- queued at a longer interval.
- Grade >= 0.85 -> "Good" -- de-prioritized for weeks.
- The sim home page surfaces "Suggested next" pulled from study's reps engine (Phase 4).

### S14. See my progress over time

**As** any user,
**I want** a per-scenario history (date, grade, notable events),
**so that** I see whether I am improving on partial-panel scans.

**Acceptance criteria:**

- Each scenario row in the home list shows last 5 attempts as sparkline of grades.
- Click-through opens a per-scenario history page (Phase 4 stretch / post-MVP).

## Cross-cutting

### S15. Accessibility: every audible cue has a visible caption

**As** a user with hearing loss or a muted device,
**I want** every audio cue mirrored as text,
**so that** I get the same information.

**Acceptance criteria:**

- Phase 5: `<AudioCaptions>` panel with `aria-live="polite"` lists active cues.
- Each cue's caption shows "STALL", "GEAR", "FLAP MOTOR", etc.
- Captions persist for ~3 seconds after cue ends (linger).

### S16. Accessibility: every instrument is keyboard-readable

**As** a screen-reader user,
**I want** to read instrument values without seeing the SVG,
**so that** I can train scan sequencing without sight.

**Acceptance criteria:**

- Phase 3: each instrument has `aria-label` with current indicated value + units.
- A 1-Hz off-screen live region narrates: "Airspeed 65 knots. Altitude 1100 feet. Heading 090."
- The narration cadence is configurable (off / on / verbose).

### S17. Reduced motion preference is respected

**As** a user with motion sensitivity,
**I want** the horizon scene and instrument needles to throttle when I have `prefers-reduced-motion`,
**so that** the sim does not nauseate me.

**Acceptance criteria:**

- Instrument needles use the existing reduced-motion token paths.
- Horizon (Phase 7) renders at 30 fps and skips parallax / sun-bloom effects when reduce-motion set.

### S18. Mobile: the sim does not pretend to support touch in MVP

**As** a mobile user,
**I want** a clear "use a desktop with a keyboard" message,
**so that** I do not waste 10 minutes trying to fly on my phone.

**Acceptance criteria:**

- Below `breakpoint-md`, the cockpit shows a friendly banner: "Flight sim needs a keyboard. Use a desktop or laptop."
- Briefing + debrief still legible on mobile (read-only).
- Touch flying is post-MVP.

## Coverage matrix (story -> phase)

| Story | Phase landing | Notes |
| ----- | ------------- | ----- |
| S1 | 0.5 -> 6 | List exists; expands as scenarios land |
| S2 | 0.5 -> 4 | Briefing exists; fault disclosure Phase 4 |
| S3 | 4 (post-MVP if scope-tight) | Resume |
| S4 | 0.5 / 0.6 | Help + cheatsheet shipped |
| S5 | 0.6 -> 5 | Mute exists; captions Phase 5 |
| S6 | 0.5 -> 2 -> 6 | Trim quality improves with JSBSim + PA28 |
| S7 | 0.8 | Shipped |
| S8 | 3 | Fault model |
| S9 | 0.7 / PR #125 | Shipped |
| S10 | 4 | Debrief |
| S11 | 4 + 3 | Co-dependent |
| S12 | 4 | Run again |
| S13 | 4 | Rep substrate |
| S14 | 4 (post-MVP) | History page |
| S15 | 5 | Captions |
| S16 | 3 | a11y |
| S17 | 0.6 (motion tokens) -> 7 (horizon) | |
| S18 | 4 (banner) | Trivial |

## Out-of-scope user behavior

The following are real user desires that explicitly do not ship in MVP. Captured here so a future spec can pick them up:

- Fly with a yoke / throttle quadrant. (HID; post-MVP per spec decision 3.)
- Watch a friend's replay tape. (Multiplayer / shared tapes; post-MVP.)
- Author a custom scenario via UI. (Authoring surface; hangar work, post-MVP.)
- Fly real-world weather. (Live wx integration; out of scope.)
- Log time toward FAA currency. (FAA approval not pursued.)
- Fly an SR22, J3 Cub, glider, twin. (Aircraft scope locked to C172 + PA28.)
