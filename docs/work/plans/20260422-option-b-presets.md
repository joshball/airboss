# Option B: initial preset catalogue

Date: 2026-04-22. For ADR 012 execution.

The preset gallery that replaces the "create-a-plan-first" gate. One click from any session entry point to first scenario, regardless of whether the user has ever authored a plan.

## Design

Each preset is a typed record matching the plan shape:

```typescript
interface Preset {
  id: string;           // stable slug, url-safe
  label: string;        // short display name (sentence-case)
  description: string;  // one-line sell ("what you'll work on")
  certGoals: Cert[];    // subset of CERTS (can be empty)
  focusDomains: Domain[]; // subset of DOMAINS (can be empty = all)
  skipDomains: Domain[];  // subset of DOMAINS (usually empty)
  depthPreference: DepthPreference;
  defaultMode: SessionMode;
  sessionLength: number; // minutes
  icon?: string;        // optional emoji/icon hint for UI
}
```

Presets live in `libs/constants/src/presets.ts` as a typed const array. The agent should derive `Preset` from the existing plan types rather than duplicating field definitions.

## Initial catalogue

### 1. `reps-only`

- **Label**: "Quick reps"
- **Description**: "Fast decision scenarios across all domains. No cert focus, just practice."
- **Cert goals**: `[]`
- **Focus domains**: `[]` (empty = all)
- **Skip domains**: `[]`
- **Depth**: `working`
- **Mode**: `mixed`
- **Session length**: default (30 min)
- **Rationale**: direct replacement for today's `/reps/session` one-click experience. A user who just wants to practice with no commitment picks this.

### 2. `private-pilot-overview`

- **Label**: "Private Pilot overview"
- **Description**: "PPL-breadth review across regs, weather, airspace, VFR ops, aerodynamics, and ADM."
- **Cert goals**: `['PPL']`
- **Focus domains**: `['regulations', 'weather', 'airspace', 'vfr-operations', 'aerodynamics', 'adm-human-factors', 'flight-planning', 'aircraft-systems']`
- **Skip domains**: `[]`
- **Depth**: `working`
- **Mode**: `mixed`
- **Session length**: default (30 min)
- **Rationale**: the broad "I'm learning for my private" ask. Excludes CFI-specific domains (teaching methodology, FAA practical standards).

### 3. `safety-overview`

- **Label**: "Safety procedures"
- **Description**: "Emergency procedures, ADM, human factors, and accident analysis. High-stakes focus."
- **Cert goals**: `[]`
- **Focus domains**: `['safety-accident-analysis', 'emergency-procedures', 'adm-human-factors']`
- **Skip domains**: `[]`
- **Depth**: `deep`
- **Mode**: `strengthen`
- **Session length**: default (30 min)
- **Rationale**: cert-agnostic safety refresher. Depth=deep + mode=strengthen because "teach it to someone else" is the right posture for safety topics -- you want to hit weak spots, not surf.

### 4. `bfr-prep`

- **Label**: "BFR prep"
- **Description**: "Flight review refresher -- regs, airspace, maneuvers, emergency ops, weather."
- **Cert goals**: `['PPL']`
- **Focus domains**: `['regulations', 'airspace', 'weather', 'vfr-operations', 'emergency-procedures', 'adm-human-factors']`
- **Skip domains**: `[]`
- **Depth**: `working`
- **Mode**: `mixed`
- **Session length**: default (30 min)
- **Rationale**: narrower than the PPL overview -- emphasizes operational and decision-making topics a BFR will actually probe. Excludes pure-knowledge domains (aerodynamics, flight-planning) to keep sessions BFR-relevant.

### 5. `firc`

- **Label**: "FIRC"
- **Description**: "CFI refresher -- teaching methodology, regs, human factors, FAA standards."
- **Cert goals**: `['CFI']`
- **Focus domains**: `['regulations', 'teaching-methodology', 'adm-human-factors', 'safety-accident-analysis', 'faa-practical-standards']`
- **Skip domains**: `[]`
- **Depth**: `deep`
- **Mode**: `strengthen`
- **Session length**: default (30 min)
- **Rationale**: instructor renewal focus. Depth=deep because the CFI cert standard is "teach it to someone else." Mode=strengthen to hit under-practiced areas.

### 6. `custom`

- **Label**: "Create your own study plan"
- **Description**: "Pick your own cert goals, focus domains, depth, and session length."
- **No preset record** -- this is a UI tile in the gallery that links to `/plans/new`. Not a plan that gets created.

## UI shape

```text
+-----------------------------------------------+
| /session/start  (no active plan)              |
+-----------------------------------------------+
|                                               |
|  Pick a plan to get started:                  |
|                                               |
|  [Quick reps]  [Private Pilot]  [Safety]     |
|  [BFR prep]    [FIRC]           [Custom]     |
|                                               |
|  (clicking a preset creates a plan and       |
|   starts a session -- one click to first     |
|   scenario)                                   |
|                                               |
+-----------------------------------------------+
```

Each tile shows the label + description. Picking a tile posts to a new action `?/startFromPreset` with `presetId` in the form data. The action creates a `studyPlan` row with preset values, marks it active (archiving any existing active plan), then continues to the normal `startSession` flow. Lands on `/sessions/[id]`.

## What's not in this catalogue (yet)

Explicitly deferred presets; add as PRs if/when needed:

- IFR prep
- Commercial prep
- CFI checkride prep (different from FIRC -- initial CFI vs renewal)
- Type-rating prep
- Glass cockpit specific
- Mountain flying / high-DA
- Night flying

Adding a preset is a PR that appends to the const array in `libs/constants/src/presets.ts`. No schema changes.

## Open questions answered

- **Should the "Quick reps" preset always be first?** Yes -- it's the direct replacement for today's zero-friction experience. Anyone bouncing off the preset gallery wants to tap-and-go; make that the first tile.
- **Do presets expire or evolve?** No. Presets are authored content. A user who picked "Private Pilot overview" six months ago has a plan that was created from the preset at the time; if the preset catalogue changes later, their plan doesn't change. They can edit their plan or create a new one from the new preset.
- **Can multiple presets be active?** No. Plans are still "one active at a time." Picking a preset archives any existing active plan. The gallery is empty-state behavior; once a plan exists, `/session/start` shows the current plan's controls (existing behavior).

## Next

Execute the 7-phase plan in ADR 012. Phase 1 = author this catalogue as code. Phase 2 = the gallery UI.
