# Products Dashboard

This is the daydreaming room. A collection of product ideas at various stages -- some just a sentence, some with full PRDs. Browse to get inspired, pick what to build next, or just let things marinate.

Every product lives at `products/{category}/{product-name}/PRD.md` with structured frontmatter. The index below is manually maintained, but the frontmatter in each PRD is the source of truth.

## Categories

| Folder           | Theme                                                                |
| ---------------- | -------------------------------------------------------------------- |
| `pre-flight`     | Before takeoff: route prep, airport familiarization, mental loading  |
| `proficiency`    | Between flights: daily practice, skill maintenance, deliberate drills |
| `event-prep`     | Milestone preparation: BFR, IPC, checkride, type rating, interview   |
| `in-flight`      | During flight: cockpit reference, prompts, debrief capture           |
| `audio`          | Passive/earbuds: commute-friendly scenarios, drills, stories         |
| `reflection`     | After flying: journals, heatmaps, trends, calibration                |
| `community`      | Social: buddies, shared scenarios, CFI pairing, anonymous sharing    |
| `specialty`      | Niche audiences: helicopter, glider, aerobatics, sim, returning pilots |
| `experimental`   | Wild ideas: smartwatch, augmented checklist, ghost flights            |

## PRD Frontmatter

Every PRD uses YAML frontmatter with these fields:

| Field            | Type                  | Description                                                              |
| ---------------- | --------------------- | ------------------------------------------------------------------------ |
| `name`           | string                | Product name                                                             |
| `id`             | string                | Short code (e.g., prd:pre:route-walkthrough, prd:prof:spaced-memory-items)                     |
| `tagline`        | string                | One-line pitch                                                           |
| `status`         | enum                  | `idea` / `exploring` / `speccing` / `building` / `mvp` / `launched`     |
| `priority`       | 1-5                   | 1 = build next, 5 = someday                                             |
| `prd_depth`      | enum                  | `full` / `light`                                                         |
| `category`       | string                | Which folder it lives in                                                 |
| `platform_mode`  | array                 | From: pre-flight, daily-desk, event-cram, in-flight, audio-passive, reflection, community |
| `audience`       | array                 | From: student-pilot, private-pilot, instrument-pilot, commercial-pilot, cfi, atp, career-track, returning-pilot, sim-community, aviation-curious |
| `complexity`     | enum                  | `low` / `medium` / `high`                                               |
| `personal_need`  | 1-5                   | How much the project owner needs this for his own learning journey       |
| `depends_on`     | array                 | Product IDs or infrastructure names                                      |
| `surfaces`       | array                 | From: web, mobile, audio, watch, print                                   |
| `content_reuse`  | array                 | Shared content this draws from (e.g., question-bank, ntsb-cases, approach-plates, regulations, memory-items) |
| `last_worked`    | date or null          | Last date someone touched this product                                   |

## Generating Views

A future script will read all `PRD.md` frontmatter and generate sorted/filtered views. Canonical sort order for the dashboard:

1. Personal preference/priority (`priority` field)
2. Last worked on (`last_worked` field)
3. Completion status (`status` field)

For now, the table below is manually maintained. The frontmatter in each PRD is the source of truth -- if they diverge, trust the PRDs.

## All Products

### Priority 1

| ID | Name                 | Category    | Status |
| -- | -------------------- | ----------- | ------ |
| prd:prof:spaced-memory-items | Spaced Memory Items  | proficiency | idea   |
| prd:prof:decision-reps | Decision Reps        | proficiency | idea   |
| prd:pre:route-walkthrough | Route Walkthrough    | pre-flight  | idea   |
| prd:prof:avionics-trainer | Avionics Trainer     | proficiency | idea   |
| prd:aud:ntsb-story | NTSB Story           | audio       | idea   |

### Priority 2

| ID | Name                 | Category    | Status |
| -- | -------------------- | ----------- | ------ |
| prd:evt:recency-recovery | Recency Recovery     | event-prep  | idea   |
| prd:prof:ten-minute-ticker | Ten-Minute Ticker    | proficiency | idea   |
| prd:pre:approach-rehearsal | Approach Rehearsal   | pre-flight  | idea   |
| prd:prof:wx-calls | WX Calls             | proficiency | idea   |
| prd:prof:calibration-tracker | Calibration Tracker  | proficiency | idea   |

### Priority 3

| ID | Name                 | Category    | Status |
| -- | -------------------- | ----------- | ------ |
| prd:pre:airport-cards | Airport Cards        | pre-flight  | idea   |
| prd:pre:what-could-go-wrong | What-Could-Go-Wrong  | pre-flight  | idea   |
| prd:prof:situational-replay | Situational Replay   | proficiency | idea   |
| prd:prof:plate-reading-drills | Plate Reading Drills | proficiency | idea   |
| prd:evt:bfr-sprint | BFR Sprint           | event-prep  | idea   |
| prd:evt:ipc-sprint | IPC Sprint           | event-prep  | idea   |
| prd:aud:daily-decision | Daily Decision       | audio       | idea   |
| prd:ref:per-flight-journal | Per-Flight Journal   | reflection  | idea   |
| prd:ref:skill-heatmap | Skill Heatmap        | reflection  | idea   |
| prd:fly:voice-debrief | Voice Debrief        | in-flight   | idea   |

### Priority 4

| ID | Name                            | Category     | Status |
| -- | ------------------------------- | ------------ | ------ |
| prd:pre:diversion-drill | Diversion Drill                 | pre-flight   | idea   |
| prd:pre:notam-triage | NOTAM Triage                    | pre-flight   | idea   |
| prd:pre:pre-flight-imsafe | Pre-flight IMSAFE               | pre-flight   | idea   |
| prd:pre:passenger-brief | Passenger Brief Script          | pre-flight   | idea   |
| prd:pre:cold-start-recall | Cold-Start Recall               | pre-flight   | idea   |
| prd:evt:checkride-prep | Checkride Prep                  | event-prep   | idea   |
| prd:evt:written-test-prep | Written Test Prep               | event-prep   | idea   |
| prd:fly:pre-departure-card | Pre-Departure Card              | in-flight    | idea   |
| prd:aud:atc-comms-drill | ATC Comms Drill                 | audio        | idea   |
| prd:aud:memory-items-audio | Memory Items Audio              | audio        | idea   |
| prd:ref:currency-proficiency-tracker | Currency & Proficiency Tracker  | reflection   | idea   |
| prd:ref:decision-diary | Decision Diary                  | reflection   | idea   |
| prd:com:scenario-of-the-week | Scenario of the Week            | community    | idea   |
| prd:com:anonymous-mistakes | Anonymous Mistakes              | community    | idea   |
| prd:spec:returning-pilots | Returning Pilots                | specialty    | idea   |

### Priority 5

| ID | Name                 | Category     | Status |
| -- | -------------------- | ------------ | ------ |
| prd:evt:type-rating-prep | Type Rating Prep     | event-prep   | idea   |
| prd:evt:interview-prep | Interview Prep       | event-prep   | idea   |
| prd:fly:quiet-co-pilot | Quiet Co-Pilot       | in-flight    | idea   |
| prd:fly:single-tap-pirep | Single-Tap PIREP     | in-flight    | idea   |
| prd:com:route-buddy | Route Buddy          | community    | idea   |
| prd:com:cfi-pairing | CFI Pairing          | community    | idea   |
| prd:com:local-pilot-map | Local Pilot Map      | community    | idea   |
| prd:spec:helicopter | Helicopter Mode      | specialty    | idea   |
| prd:spec:glider | Glider Mode          | specialty    | idea   |
| prd:spec:aerobatics | Aerobatics           | specialty    | idea   |
| prd:spec:sim-community | Sim Community        | specialty    | idea   |
| prd:spec:aviation-curious | Aviation-Curious     | specialty    | idea   |
| prd:spec:passenger-pilots | Passenger-Pilots     | specialty    | idea   |
| prd:exp:smartwatch-ritual | Smartwatch Ritual    | experimental | idea   |
| prd:exp:augmented-checklist | Augmented Checklist  | experimental | idea   |
| prd:exp:replay-your-flight | Replay Your Flight   | experimental | idea   |
| prd:exp:ghost-flight | Ghost Flight         | experimental | idea   |
| prd:exp:anti-startle-trainer | Anti-Startle Trainer | experimental | idea   |
