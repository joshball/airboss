# Reference: Scenario Engine Patterns

Implementation patterns for the tick-based scenario engine, command system, scoring, replay, and game definitions.
Originally extracted from airboss-game (2026-03-24). firc-boss's `libs/engine/` is directly inspired by this architecture.

---

## 1. Monorepo Structure

```
apps/
  cli/              CLI tools (replay, benchmark, campaign)
  tui/              Terminal UI (live sim, replay, watch)
  web/              SvelteKit frontend
  ws-sim/           WebSocket simulation server
packages/
  constants/        All magic strings, numbers, versions, events, errors
  core/             Engine, validation, scenario loading, campaign, narrative
  sdk/              Public types, command helpers, game definitions
  protocol/         Message types (client-server)
libs/
  themes/           CSS design system (dark.css, light.css, fonts.css)
games/
  [game-id]/        Scenario sets, players, campaigns, definition.ts
```

**For firc-boss:** Our `libs/` maps to their `packages/`. Our `libs/engine/` maps to their `packages/core/`. Games as content packages is a pattern we should adopt -- scenarios live in a content directory, not in the engine.

### Path Aliases

```typescript
"@airboss/constants": ["packages/constants/src/index.ts"],
"@airboss/sdk": ["packages/sdk/src/index.ts"],
"@airboss/core": ["packages/core/src/index.ts"]
```

**For firc-boss:** Use `@firc/constants`, `@firc/types`, `@firc/engine`, `@firc/bc/*`, `@firc/auth`.

### Subpath Exports

Each package declares selective exports for browser vs server:

```json
"exports": {
  ".": "./src/index.ts",
  "./campaign": "./src/campaign.ts",
  "./scenario-loader": "./src/scenario-loader.ts"
}
```

Enables `@airboss/core/campaign` (Node-only, filesystem) vs `@airboss/core` (browser-safe). **Critical for firc-boss** where engine types need to be importable by the sim app (browser) but DB access stays server-only.

---

## 2. Engine Architecture -- The Core Pattern

### Invariant: Engine is Pure

The engine is the primary API. WebSocket/HTTP are transport layers wrapping it. The engine has:

- No I/O
- No randomness during tick processing
- No side effects
- Deterministic: same scenario + commands = identical result

**For firc-boss:** `libs/engine/` should be pure TypeScript. SvelteKit apps import it directly. No network calls inside the engine.

### Tick Loop

```
1. Build public WorldState from InternalWorld
2. Call player function with WorldState
3. Player returns Command[]
4. validateCommands() -> accepted + rejected
5. applyCommands(world, accepted)
6. advanceWorld(world) -> tick++, process arrivals/timers
7. Record tick in tickLog
8. If not complete, goto 1
```

**Key:** Player sees state BEFORE commands are applied. State snapshots AFTER `advanceWorld()`.

### Core Functions

```typescript
// Pure functions -- the entire engine API
function validateCommands(world, commands, submittedTick): ValidationResult;
function applyCommands(world, acceptedCommands): void; // mutates world in-place
function advanceWorld(world): void; // tick++, process timers
function buildPublicWorldState(internal): WorldState; // firewall
```

### State Layers: Internal vs Public

**InternalWorld** (server-only) -- full simulation state, all fields readable by engine. Players never see this.

**WorldState** (player-facing) -- projected view via `buildPublicWorldState()`. Type-branded IDs. This is the firewall preventing internal types from leaking.

**For firc-boss:** The student model, adaptive algorithm, and scoring internals are `InternalWorld`. The learner sees a projected view: scenario briefing, current situation, available choices, feedback. The FAA-facing layer sees an even more restricted view: time, topics, pass/fail.

### Run Scenario

```typescript
interface RunScenarioOptions {
  scenario: ScenarioData;
  player: PlayerFn; // (state: WorldState, debug: DebugContext) -> Command[]
  seed?: number;
  maxTicks?: number;
}

interface RunResult {
  scenarioId: string;
  endedAtTick: number;
  metrics: MetricsSnapshot;
  richMetrics: RichMetrics;
  grade?: Grade;
  challengeResults?: ChallengeResult[];
  tickLog: TickRecord[];
  finalState: WorldState;
}
```

---

## 3. Command System

### Declarative Intent

Commands express intent, not mechanics:

- `moveTo(vehicleId, targetNodeId)` not `setStatus('moving')`
- Engine figures out path finding, energy, multi-hop
- Easier to reason about, validate, and audit

**For firc-boss:** Student choices should be declarative: "diagnose engine vibration", "check weather briefing", "recommend go-around" -- not state mutations.

### Command Types

```typescript
interface BaseCommand {
  id?: string;          // For rejection correlation
  vehicleId: VehicleId;
  type: CommandType;
}

type Command = AssignOrderCommand | MoveToCommand | ChargeCommand | IdleCommand;

// Factory helpers
const Commands = {
  assignOrder(vehicleId, orderId): AssignOrderCommand,
  moveTo(vehicleId, targetNodeId): MoveToCommand,
  charge(vehicleId): ChargeCommand,
  idle(vehicleId): IdleCommand,
};
```

### Validation Pipeline

1. Shape check -- valid command object?
2. Entity exists -- is the referenced entity in the world?
3. Ownership check -- does this player own this entity?
4. Command-specific checks (route exists, sufficient resources, valid state transition)

Validation returns `{ accepted, rejected }` -- never throws. Rejected commands include reason codes from constants.

### Error Codes

All validation failures use constant error codes:

```typescript
ERR_STALE_TICK_SUBMISSION;
ERR_VEHICLE_NOT_FOUND;
ERR_VEHICLE_UNAVAILABLE;
ERR_ORDER_NOT_PENDING;
ERR_NO_ROUTE_TO_TARGET;
ERR_INSUFFICIENT_BATTERY;
```

**For firc-boss:** Define error codes for scenario engine: `ERR_CHOICE_NOT_AVAILABLE`, `ERR_TIME_EXPIRED`, `ERR_PREREQUISITE_NOT_MET`, etc.

---

## 4. Constants Organization

```
packages/constants/src/
  index.ts           (main export barrel)
  simulation.ts      (tick defaults, statuses, priorities)
  events.ts          (event type constants)
  errors.ts          (error codes)
  routes.ts          (server routes)
  server.ts          (ports, URLs, timeouts)
  versions.ts        (protocol, SDK versions)
```

### Pattern: Flat String Constants

```typescript
// Command types
export const CMD_ASSIGN_ORDER = "assign_order";
export const CMD_MOVE_TO = "move_to";

// Event types (dot-namespaced)
export const EVENT_ORDER_ASSIGNED = "order.assigned";
export const EVENT_ORDER_DELIVERED = "order.delivered";
export const EVENT_VEHICLE_ARRIVED = "vehicle.arrived";

// Defaults
export const DEFAULT_CHARGE_RATE_PER_TICK = 2;
export const DEFAULT_TURN_TIMEOUT_MS = 30_000;
```

**For firc-boss:** Same pattern for `libs/constants/`:

- `faa-topics.ts` -- topic codes from AC 61-83K
- `competencies.ts` -- 8 domains, 22 competencies
- `events.ts` -- `EVENT_SCENARIO_STARTED`, `EVENT_CHOICE_MADE`, etc.
- `errors.ts` -- engine error codes
- `routes.ts` -- app routes
- `ports.ts` -- dev server ports

---

## 5. Scenario Format

### JSON Schema

```json
{
  "id": "scenario-01-first-dispatch",
  "name": "First Dispatch",
  "description": "One drone, one order, simple routing.",
  "briefing": "Optional narrative text",
  "seed": 42,
  "maxTicks": 100,
  "parScore": 50,
  "gradeThresholds": { "S": 50, "A": 45, "B": 30, "C": 20, "D": 10 },
  "challenges": [
    { "id": "zero-penalties", "name": "Zero Penalties", "description": "..." }
  ],
  "nodes": [ ... ],
  "edges": [ ... ],
  "drones": [ ... ],
  "orders": [ ... ],
  "orderSpawnSchedule": [ { "spawnAtTick": 10, "order": { ... } } ],
  "disruptionSchedule": [ { "tick": 15, "edgeFrom": "A", "edgeTo": "B", "available": false } ]
}
```

### Key Features

- **Spawn schedules** -- entities appear at specific ticks (orders, events)
- **Disruption schedules** -- world changes mid-scenario (routes close, weather)
- **Grade thresholds** -- per-scenario scoring criteria
- **Challenges** -- boolean conditions evaluated post-run (achievements)
- **Scenario defaults** -- per-game config that scenarios can override

**For firc-boss:** Adapt for training scenarios:

```json
{
  "id": "scenario-weather-diversion",
  "faaTopics": ["61.109(b)(1)"],
  "competencies": ["wx-1", "dm-3"],
  "scenarioType": "learning",
  "briefing": "Your student is on a cross-country...",
  "situation": { ... },
  "decisionPoints": [ ... ],
  "eventSchedule": [ { "atTick": 5, "event": "weather_deteriorates" } ],
  "scoringCriteria": { ... }
}
```

---

## 6. Game Definition System

### Domain Vocabulary

The engine is domain-neutral. Each game provides vocabulary:

```typescript
interface DomainVocabulary {
  vehicleSingular: string; // 'drone', 'aircraft', 'robot'
  vehiclePlural: string;
  resourceName: string; // 'battery', 'fuel'
  replenishVerb: string; // 'recharge', 'refuel'
  stationName: string; // 'charging station', 'fuel depot'
}
```

UI, narrative, CLI all use `game.vocabulary.vehicleSingular` instead of hardcoding.

### Game -> Campaign -> Mission Hierarchy

```
GameDefinition
  id, name, complexity, vocabulary, scenarioDefaults
  campaigns: CampaignDefinition[]
    id, name, type ('learning' | 'puzzle' | 'scenario' | 'sandbox')
    missions: MissionMeta[]
      id, file (scenario JSON path), parScore, gradeThresholds, challenges, hints
      unlockRequirement?
```

**For firc-boss:** Maps to course structure:

```
CourseDefinition (the FIRC)
  modules: ModuleDefinition[] (6 modules from COURSE_STRUCTURE.md)
    scenarios: ScenarioMeta[]
      id, file, faaTopics[], competencies[], type, difficulty
```

---

## 7. Metrics and Scoring

### Metrics Snapshot (per-tick)

```typescript
interface MetricsSnapshot {
  score: number;
  profit: number;
  revenue: number;
  penalties: number;
  operatingCost: number;
  completedOrders: number;
  failedOrders: number;
  activeOrders: number;
}
```

### Rich Metrics (post-run analysis)

Computed after the run completes: utilization rates, on-time percentages, empty movement ratio, throughput, waiting times.

### Grading

```typescript
function computeGrade(score: number, thresholds: GradeThresholds): Grade;
// S >= thresholds.S, A >= thresholds.A, etc.
```

Per-scenario thresholds. Par score is optional but recommended.

**For firc-boss:** Rich metrics become competency evidence. Grade thresholds map to pass/fail for FAA requirements. The scoring formula stays internal (never exposed to FAA).

---

## 8. Replay System

### JSONL Format (one JSON per line)

```
{"type": "header", "data": { version, simulationId, scenarioId }}
{"type": "tick", "data": { tick, commands, validation, events }}
...
{"type": "summary", "data": { endedAtTick, metrics }}
```

### Serialize/Deserialize

```typescript
function serializeReplay(result: RunResult): string;
function deserializeReplay(content: string): ReplayData;
```

### Replay as Evidence

Replays can be re-simulated for verification (deterministic). Same commands + same scenario = same result.

**For firc-boss:** Every student scenario attempt becomes a replay. Compliance audits require: who, when, what score, which topics, pass/fail. The replay JSONL is the raw evidence. Analysis is computed post-run and stored in the database.

---

## 9. Design System

### OKLCH Color Tokens

All colors use OKLCH for perceptual uniformity. Token naming: `--t-*`

```css
/* Core palette */
--t-bg: oklch(0.13 0.012 240);
--t-surface: oklch(0.17 0.01 240);
--t-surface-raised: oklch(0.21 0.012 240);
--t-border: oklch(0.27 0.012 220);

/* Text */
--t-text: oklch(0.92 0.01 220);
--t-text-dim: oklch(0.62 0.01 220);
--t-text-muted: oklch(0.45 0.01 220);

/* Semantic */
--t-accent: oklch(0.76 0.16 75);
--t-success: oklch(0.72 0.17 155);
--t-danger: oklch(0.67 0.2 25);
--t-warning: oklch(0.74 0.16 70);

/* Domain-specific */
--t-node-depot: oklch(0.76 0.16 75);
--t-status-moving: oklch(0.7 0.12 250);
--t-battery-high: oklch(0.72 0.17 155);
```

### Theme Files

```
libs/themes/src/
  dark.css      dark mode colors + typography
  light.css     light mode overrides
  fonts.css     font definitions
  types.ts      ThemeDefinition type
  theme.ts      useTheme composable
```

**For firc-boss:** Use same OKLCH approach. Define training-specific tokens:

```css
--t-competency-met: oklch(...);
--t-competency-gap: oklch(...);
--t-scenario-active: oklch(...);
--t-faa-topic: oklch(...);
```

---

## 10. Scripts and Tooling

### Script Organization

```
scripts/
  lib/args.ts       argument parsing dispatcher
  game.ts           game review, scoring, score-check
  check.ts          types, lint, tests, scenarios
  dev.ts            test watch, build, format
  start.ts          start services (web, ws-sim)
  serve.ts          interactive scenario server
  status.ts         what's running
  clean.ts          remove caches
  wtf.ts            help and workflow docs
```

### Custom Dispatcher (no commander.js)

```typescript
await dispatch('game', 'Game scenario tools.', {
  review: {
    description: 'Run all scenarios with all players',
    async run(args) { ... }
  },
  'score-check': {
    description: 'Quick playtest validation',
    async run(args) { ... }
  },
});
```

### Invocation

```bash
bun start web           # SvelteKit dev server
bun check types         # Type-check
bun check lint          # Lint
bun dev test --watch    # Tests in watch mode
bun game review         # Run all scenarios
bun game score-check    # Quick playtest
```

**For firc-boss:** Adapt for our needs:

```bash
bun start sim           # Sim app dev server
bun start hangar        # Hangar app dev server
bun start ops           # Ops app dev server
bun check               # Types + lint + tests
bun scenario review     # Run all scenarios with test models
bun scenario validate   # Validate scenario JSON files
```

---

## 11. Testing Patterns

### Philosophy: Test Pure Functions Directly

```typescript
import { advanceWorld, applyCommands } from "../engine";
import { Commands } from "@airboss/sdk";

function createTestWorld(overrides?: Partial<InternalWorld>): InternalWorld {
  return { ...baseWorld, ...overrides };
}

describe("engine", () => {
  it("should move a vehicle from A to B", () => {
    const world = createTestWorld();
    const cmd = Commands.moveTo("drone-1", "node-b");
    applyCommands(world, [cmd]);
    advanceWorld(world);
    expect(world.vehicles["drone-1"].status).toBe("moving");
  });
});
```

- No mocking. Engine is pure -> test it directly.
- `createTestWorld()` helper for minimal scenarios.
- Test validation independently from application.
- Test state building independently from tick processing.

**For firc-boss:** Same approach. Test `libs/engine/` with pure function calls. No DB, no HTTP, no mocking.

---

## 12. Architectural Invariants

1. **Server is authoritative** -- players send intent (commands), never state mutations
2. **Engine is pure** -- no I/O, deterministic, testable in isolation
3. **Internal types never leak** -- `buildPublicWorldState()` is the firewall
4. **All state transitions go through validation** -- no command bypasses `validateCommands()`
5. **Declarative commands** -- express intent, not mechanics

### WeakMap Caching

```typescript
const edgeIndexCache = new WeakMap<Edges, Map<string, Edge>>();
function getEdgeIndex(edges: Edges): Map<string, Edge> {
  let index = edgeIndexCache.get(edges);
  if (!index) {
    index = buildIndex(edges);
    edgeIndexCache.set(edges, index);
  }
  return index;
}
```

Used for O(1) lookup tables. Invalidated automatically when the key object is garbage collected.

---

## 13. Key Adaptations for firc-boss

### FAA Compliance = Data Modeling

The engine doesn't need to "know" about FAA rules. Instead:

- Scenarios map to FAA topics (metadata)
- Competencies map to scenario challenges (evidence)
- Audit trails are database records (not engine logic)
- Compliance is "did we capture enough evidence?" not "is this flight legal?"

### Adaptive = Deterministic Rules

Choosing which scenario to show next is based on:

- Competency gaps (did they pass the assessment?)
- Difficulty progression (ready for next level?)
- Time budget (can they finish in one session?)

This is deterministic rules, not ML. The engine is deterministic replay.

### Two-Layer Architecture

- **Real system:** scenario engine + competency tracking + adaptive routing
- **FAA-facing system:** "Students complete scenarios, we track evidence"

Both are true. The engine doesn't lie. But FAA doesn't see adaptive logic -- they see evidence (time, score, topics covered).

### Content Authoring

Unlike airboss where scenarios are engineer-designed, firc-boss scenarios are authored by CFIs. Hangar app needs:

- Simple JSON format (no TypeScript needed)
- Drag-drop authoring UI
- Instant preview
- Version control UI (not git CLI)
- Scenario templates

### Replay = Compliance Evidence

Every student attempt = a replay. Compliance audits need:

- Who completed which scenario
- When (timestamp)
- What score
- Which competencies covered
- Pass/fail determination

The JSONL replay stores raw data. Analysis is computed post-run and stored in PostgreSQL.
