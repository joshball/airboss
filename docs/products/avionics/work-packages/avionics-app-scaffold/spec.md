---
title: 'Spec: Avionics App Scaffold'
product: avionics
feature: avionics-app-scaffold
type: spec
status: unread
review_status: pending
---

# Spec: Avionics App Scaffold

Stand up `apps/avionics/` as the airboss glass-cockpit surface, provision `libs/bc/avionics/` as its bounded context, and ship a single demo feature -- a Primary Flight Display (PFD) with attitude, airspeed tape, altitude tape, heading bug, and VSI -- driven by interactive controls (sliders / keyboard). The point is to prove the surface is alive and that the gestural feel of a tape-style glass display is right. It is not a flight simulator.

This is the formal birth of the `avionics` surface per [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md). It does not block any downstream feature; it is platform groundwork so the next avionics feature (real PFD attached to an aircraft model, EFIS scan trainer, partial-panel drills) lands on shaped infrastructure.

## In scope

### App workspace

- `apps/avionics/` -- `@ab/avionics`, port `9630`, host `avionics.airboss.test`
- SvelteKit 2 + Svelte 5 runes, mirroring `apps/sim/` exactly:
  - `svelte.config.js` with the same CSP block (defense-in-depth, auto-nonce, hashed pre-hydration script via `@ab/themes`)
  - `vite.config.ts` binding to `127.0.0.1` with `allowedHosts = [HOSTS.AVIONICS]`
  - `tsconfig.json` extending `.svelte-kit/tsconfig.json`
  - `app.html` with `data-app-id="avionics"`, `data-theme="sim/glass"`, `data-appearance="dark"` (avionics is dark-only per [Design](design.md#why-reuse-simglass-not-fork-it))
  - `static/favicon.svg`
- `src/app.d.ts` -- `App.Locals` mirrors sim's exactly (`session`, `user`, `requestId`, `appearance`, `theme`)
- `src/hooks.server.ts` -- copy of sim's: request-id, session hydration from cross-subdomain `bauth_session_token` cookie, theme-pre-hydration `transformPageChunk`. Anonymous visits remain functional.
- `src/lib/server/auth.ts` and `src/lib/server/cookies.ts` -- mirror sim
- Root `+layout.server.ts` -- mirror sim: hydrate appearance/theme/auth, expose `studyLoginUrl` for the unauthenticated banner
- Root `+layout.svelte` -- mirror sim: load `@ab/themes/generated/tokens.css`, render the chrome strip with `airboss / avionics` brand label and the theme picker (will be locked-dark by the `sim/glass` theme rules), render the auth banner for anonymous visits
- Home page (`/`) -- the PFD demo (see PFD section below)

### BC layer

- `libs/bc/avionics/` -- `@ab/bc-avionics`, package layout matches `libs/bc/sim/`:
  - `package.json` -- `private: true`, `type: 'module'`, exports `.`, `./*`, `./package.json`; deps on `@ab/auth`, `@ab/constants`, `@ab/db`, `@ab/utils`
  - `src/index.ts` -- barrel for the BC's public types
  - `src/types.ts` -- pure data types (see [Types](#bc-types) below)
- Path aliases registered:
  - Root `tsconfig.json`: `@ab/bc-avionics` + `@ab/bc-avionics/*`
  - `apps/avionics/svelte.config.js`: same alias entries
  - `apps/study/svelte.config.js` and `apps/sim/svelte.config.js` and `apps/hangar/svelte.config.js`: alias added so any sibling app can read avionics types if it ever needs to (matches the existing pattern of every app aliasing every BC -- see `apps/sim/svelte.config.js` aliasing `@ab/bc-sim`)
- Schema namespace reservation: add `AVIONICS: 'avionics'` to `libs/constants/src/schemas.ts`. No tables yet -- the WP defines the namespace so the first migration can land cleanly when the first table is needed.

### Constants

- `libs/constants/src/ports.ts`: `AVIONICS: 9630`
- `libs/constants/src/hosts.ts`: `HOSTS.AVIONICS = 'avionics.airboss.test'`, `HOST_PREFIXES.AVIONICS = 'avionics'`
- `libs/constants/src/routes.ts`: avionics block
  - `AVIONICS_HOME: '/'`
  - `AVIONICS_PFD: '/pfd'` -- the PFD demo lives here; `/` redirects to it via `+page.ts` so the home URL reads naturally and the demo gets a stable named route
- `libs/constants/src/schemas.ts`: `AVIONICS: 'avionics'`
- No new `AUDIT_TARGETS` -- the demo writes nothing

### Dev wiring

- `scripts/dev.ts`: add `avionics` to `DEV_URLS` so `bun run dev` multi-spawns it and `bun run dev avionics` works
- `scripts/check.ts`: add an `svelte-check` run for `apps/avionics/`
- `scripts/setup.ts`: picks up the new host automatically (it iterates `HOSTS.values`); developer adds `127.0.0.1 avionics.airboss.test` to `/etc/hosts` once
- Workspace `package.json` -- `apps/avionics` and `libs/bc/avionics` discovered automatically via the existing `apps/*` and `libs/bc/*` workspace globs (no edit required, but verify)
- Biome / `tsconfig.json` -- inherit project config, no per-app override

### PFD demo

The home page (`/pfd`, with `/` redirecting) renders a single full-bleed PFD and a small input-control strip below it. No persistence, no auth-gating beyond what every avionics page inherits.

#### Instruments on screen

| Component             | Renders                                                                                                          | Driven by       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------- |
| `<AttitudeIndicator>` | Synthetic horizon -- pitch ladder (every 5 deg, labels every 10), bank pointer with sky-blue/ground-brown halves | `pitch`, `bank` |
| `<AirspeedTape>`      | Vertical tape, current value boxed at center, white/green/yellow/red arc bands shown on the tape edge            | `airspeed`      |
| `<AltitudeTape>`      | Vertical tape, current value boxed at center, hundreds at the digits, thousands rolled-counter style             | `altitude`      |
| `<HeadingIndicator>`  | Horizontal compass strip across the bottom, current heading boxed at center, cardinal labels at N/E/S/W          | `heading`       |
| `<VsiIndicator>`      | Vertical strip on the right edge of the altitude tape, pointer travels +/-2000 fpm                               | `verticalSpeed` |

Layout follows the conventional G1000-style PFD:

```text
+--------------------------------------------+
|  [ASI]   [   AttitudeIndicator   ]   [ALT] |
|  tape    [   pitch ladder        ]  [tape] |
|          [   bank pointer        ]   [VSI] |
|                                            |
|  [---------- Heading strip ----------]     |
+--------------------------------------------+
```

#### Inputs

A control strip below the PFD (or collapsible) exposes the six driven values as sliders, each with sensible bounds and labelled units:

| Input          | Range                | Step | Default |
| -------------- | -------------------- | ---- | ------- |
| Pitch          | -25 .. +25 deg       | 0.5  | 0       |
| Bank           | -60 .. +60 deg       | 1    | 0       |
| Airspeed       | 0 .. 200 KIAS        | 1    | 100     |
| Altitude       | 0 .. 18,000 ft       | 10   | 3,000   |
| Heading        | 0 .. 359 deg         | 1    | 360 (N) |
| Vertical Speed | -2,000 .. +2,000 fpm | 50   | 0       |

Keyboard shortcuts (mirroring `apps/sim/`'s keyboard cheatsheet pattern -- see `apps/sim/src/lib/panels/KeyboardCheatsheet.svelte`):

| Key       | Effect                      |
| --------- | --------------------------- |
| W / S     | Pitch up / down             |
| A / D     | Bank left / right           |
| Q / E     | Yaw / heading -10 / +10 deg |
| Shift +/- | Airspeed -10 / +10 KIAS     |
| , / .     | Altitude -100 / +100 ft     |
| [ / ]     | VSI -100 / +100 fpm         |
| 0         | Reset all to defaults       |

A short on-screen legend reveals these on `?`. The legend itself is a stripped-down copy of the sim's `KeyboardCheatsheet.svelte` pattern -- avionics owns its own copy in `apps/avionics/src/lib/pfd/PfdKeyboardLegend.svelte` rather than promoting that primitive yet.

#### Animation

- `requestAnimationFrame` loop in a `.svelte.ts` module owned by the PFD (`apps/avionics/src/lib/pfd/pfd-tick.svelte.ts`). Each frame it eases the rendered values toward target (commanded) values with a critically-damped low-pass per channel. Targets come from the input bindings; rendered values feed the SVG transforms.
- Easing time constants live in a constants object inside that module (no magic numbers in component code). The constants block is documented as the "feel" tuning surface; revisions go through a constants-only commit, not a component edit.
- The loop pauses when the tab is hidden (`document.visibilityState === 'hidden'`).
- No tick clock from `libs/bc/sim/`'s FDM engine -- the PFD doesn't simulate physics. It just renders what it's told.

### BC types

`libs/bc/avionics/src/types.ts` defines the data the surface speaks today and reserves the shape of what later features will produce. Plain data only -- no classes, no behaviour, structured-clone-safe.

| Type       | Fields                                                                                                                          | Why now                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Attitude` | `pitchDeg: number`, `rollDeg: number`, `slipBall: number` (-1..+1, reserved -- not rendered yet)                                | The PFD already needs pitch + bank; slip arrives with an FDM coupling later     |
| `AirData`  | `indicatedAirspeedKnots: number`, `pressureAltitudeFeet: number`, `verticalSpeedFpm: number`, `outsideAirTempC?: number`        | The PFD reads three of these today; OAT lands when the PFD shows a temp readout |
| `NavData`  | `headingDegMag: number` (0..359, magnetic), `headingDegTrue?: number`, `courseSelectDeg?: number`, `crossTrackErrorNm?: number` | Heading today; CDI / course-deviation lands when nav widgets do                 |

The PFD demo wires the slider state into a single `AvionicsTelemetry` aggregate (`{ attitude, airData, navData }`) and the components read it. No streaming, no FDM, no persistence.

## Out of scope

Everything below is explicitly NOT part of this WP. None of these items are TODOs or deferred items inside this WP -- they are listed here so reviewers can confirm the scope.

| Item                                                              | Why deferred                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real flight model coupling                                        | Coupling the PFD to the sim FDM is a separate WP. The PFD's "feel" needs to be locked-in against arbitrary inputs first; otherwise FDM debugging and PFD-feel debugging tangle.                                                                                                                                                                                        |
| Multiplayer / shared-cockpit                                      | No data path defined; surface-typed apps don't share state today                                                                                                                                                                                                                                                                                                       |
| Scenario engine for avionics drills                               | A drill engine is a real BC feature with grading, persistence, and replay. The Phase-0 scaffold doesn't try to invent it; it lands as its own WP after the PFD's component shapes settle.                                                                                                                                                                              |
| Persistence (sessions, attempts, scoring tables)                  | No avionics drill exists yet to score                                                                                                                                                                                                                                                                                                                                  |
| MFD (Multi-Function Display) sibling page                         | One demo surface is the minimum to prove the avionics app is alive. MFD is its own WP whenever the first MFD-driving product ships.                                                                                                                                                                                                                                    |
| Failure-mode rendering (red X over instruments, comparator flags) | The fault model belongs to the sim BC and would couple sim faults into avionics. Lands when avionics consumes sim's `DisplayState` (which already exists in `libs/bc/sim/src/faults/`).                                                                                                                                                                                |
| Promote PFD components to `libs/activities/pfd/`                  | The right move once the components are stable across two consumers (avionics MFD, or sim glass-cockpit overlay), per "create when needed, not before". Not an action now; not a TODO.                                                                                                                                                                                  |
| Accessibility-grade screen-reader semantics for synthetic vision  | Documented limitation. A glass-PFD has no meaningful text-equivalent representation. Keyboard control is in scope; alternate audio/haptic representations are a research WP of their own.                                                                                                                                                                              |
| Decision on the deferred `extract-sim-instruments` WP             | That WP triggers on "avionics app created". Resolution recorded in [Design](design.md#deferred-extract-sim-instruments-resolution): keep it deferred -- the PFD ships its own tape components rather than extracting the sim's round-dial set, and the extract-WP is rewritten as "promote PFD components to `libs/activities/pfd/`" once they have a second consumer. |

## Architecture

### Why a separate `apps/avionics/` instead of folding into `apps/sim/`

[MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) Step 6 calls for an avionics surface app. Three reasons it doesn't fold into sim:

1. **Different design language.** Sim renders round-dial steam-gauge instruments. Avionics renders tape-style glass. Mixing them inside one app forces every shell decision (chrome, theme picker, layout) to negotiate two visual identities.
2. **Different product surface.** Sim is "fly the plane through scenarios"; avionics is "learn the panel". The home page, navigation, and content shape diverge.
3. **Surface-typed monorepo principle.** Apps group by rendering surface, not by content. A glass cockpit is its own surface.

### Why reuse `sim/glass` theme rather than fork

The `sim/glass` theme already encodes the dark-only, deep-black-panel, indicator-yellow-pointer aesthetic an avionics surface wants. Forking now means duplicating tokens with no concrete divergence pressure. When avionics needs a divergent token (e.g., G1000 cyan vs. Garmin G3000 white pointer), we fork to `avionics/g1000` (or similar) at that point. Until then, one theme keeps both surfaces in tune.

The theme resolver's existing route-safety lock for `/sim/*` will need to know about `/avionics/*` too, or `sim/glass` needs to be permitted as a free choice for avionics routes. [Design](design.md#theme-resolver-route-lock) covers the chosen path.

### BC scaffold now, not later

User confirmed BC layer is provisioned in this WP. Reasons:

- Path-alias proliferation is cheap to do once and expensive to retrofit (every app config has to be edited).
- Schema namespace reservation prevents collisions when the first table lands.
- Type contracts (`Attitude`, `AirData`, `NavData`) are the contract the demo reads, so they earn their place.
- A BC with one types file is not "stub code" -- it's a named, locatable, importable contract surface.

### PFD components live in the app, not a lib

Per the user's note and the project's "create when needed, not before" rule, the PFD components live in `apps/avionics/src/lib/pfd/` for this WP. Promotion to `libs/activities/pfd/` happens when a second consumer appears (sim glass-cockpit overlay; an MFD page in avionics). That move is one named follow-on WP, not a TODO.

## Routes

| Route         | Method | Auth            | Purpose                                        |
| ------------- | ------ | --------------- | ---------------------------------------------- |
| `/`           | GET    | Anonymous OK    | Redirects to `/pfd`                            |
| `/pfd`        | GET    | Anonymous OK    | The PFD demo                                   |
| `/api/auth/*` | any    | per better-auth | Cross-subdomain session bridge (mirrors sim)   |
| `/theme`      | POST   | Anonymous OK    | Theme-preference cookie endpoint (mirrors sim) |
| `/appearance` | POST   | Anonymous OK    | Appearance-preference endpoint (mirrors sim)   |

All paths constructed via `ROUTES.AVIONICS_*`. No inline path strings in any file.

## Auth

Mirror `apps/sim/`: anonymous visits work, the sign-in banner offers a cross-subdomain link to study, the role gate is absent (no role-restricted features yet). The PFD demo is freely viewable so the user can show it without setting up a dev account.

## Data model

No tables. Schema namespace `avionics` reserved.

## Theme

`sim/glass` (dark, deep black panel). The theme picker on the chrome appears locked because the resolver forces dark on `/avionics/*`. The lock messaging is the same one the picker already shows on `/sim/*`.

## Developer setup

One-time:

- Add `127.0.0.1 avionics.airboss.test` to `/etc/hosts`. `bun run setup` prints the missing line.

Daily:

```bash
bun install                 # picks up apps/avionics + libs/bc/avionics
bun run dev avionics        # spawn just avionics
bun run dev                 # multi-spawn study + sim + hangar + avionics
```

## Risks

| Risk                                                 | Mitigation                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `requestAnimationFrame` loop leaks across navigation | The loop is owned by a `.svelte.ts` module that registers a `$effect` cleanup; navigating off `/pfd` cancels the rAF                                                                 |
| Theme picker confuses the user when it's locked      | The locked variant already renders an explanatory chip; sim does this today. Reuse without modification.                                                                             |
| SVG performance on lower-end laptops at 60fps        | SVG is fast enough for 5 instruments at 60fps. If a profile shows otherwise, fallback to Canvas is a one-component rewrite per instrument; the design doc covers the migration path. |
| Avionics + sim accidentally fork the dark theme      | One theme today (`sim/glass`); fork only on concrete divergence pressure                                                                                                             |
| Schema-namespace `avionics` reserved but never used  | Acceptable. Reservation is cheap; collision-avoidance pays for itself the first time a table lands.                                                                                  |

## References

- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- avionics positioning
- [docs/work-packages/hangar-scaffold/spec.md](../../../../work-packages/hangar-scaffold/spec.md) -- the prior surface-app scaffold WP this one mirrors
- [docs/work-packages/extract-sim-instruments/spec.md](../../../../work-packages/extract-sim-instruments/spec.md) -- the deferred WP whose trigger is "avionics app created"; resolved in [design.md](design.md#deferred-extract-sim-instruments-resolution)
- [apps/sim/svelte.config.js](../../../../../apps/sim/svelte.config.js) -- the canonical surface-app shell
- [libs/themes/sim/glass/index.ts](../../../../../libs/themes/sim/glass/index.ts) -- the theme this WP reuses
