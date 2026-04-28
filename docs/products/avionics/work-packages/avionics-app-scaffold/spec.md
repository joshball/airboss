---
title: 'Spec: Avionics App Scaffold'
product: avionics
feature: avionics-app-scaffold
type: spec
status: unread
review_status: done
---

# Spec: Avionics App Scaffold

Stand up `apps/avionics/` as the airboss glass-cockpit surface, provision `libs/bc/avionics/` as its bounded context, and ship the surface's first set of routes: a home page that lists every demo, a Primary Flight Display (PFD) demo (the headline feature), and polished placeholder pages for the next two products (MFD, instrument scan trainer) plus an aircraft selector. The PFD is driven by interactive controls (sliders, keyboard) and reads V-speeds from the currently selected aircraft's FDM. The point is to prove the surface is alive, the navigation is real, and the gestural feel of a tape-style glass display is right. It is not a flight simulator.

This is the formal birth of the `avionics` surface per [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md). It does not block any downstream feature; it is platform groundwork so the next avionics feature (real PFD attached to an aircraft model, EFIS scan trainer, partial-panel drills) lands on shaped infrastructure.

## In scope

### App workspace

- `apps/avionics/` -- `@ab/avionics`, port `9630`, host `avionics.airboss.test`
- SvelteKit 2 + Svelte 5 runes, mirroring `apps/sim/` exactly:
  - `svelte.config.js` with the same CSP block (defense-in-depth, auto-nonce, hashed pre-hydration script via `@ab/themes`)
  - `vite.config.ts` binding to `127.0.0.1` with `allowedHosts = [HOSTS.AVIONICS]`
  - `tsconfig.json` extending `.svelte-kit/tsconfig.json`
  - `app.html` with `data-app-id="avionics"`. The default `data-theme` and `data-appearance` are hydrated by the same `@ab/themes` pre-hydration script every other app uses; avionics participates in the full light/dark theme system (see [Theme](#theme) below).
  - `static/favicon.svg`
- `src/app.d.ts` -- `App.Locals` mirrors sim's exactly (`session`, `user`, `requestId`, `appearance`, `theme`)
- `src/hooks.server.ts` -- copy of sim's: request-id, session hydration from cross-subdomain `bauth_session_token` cookie, theme-pre-hydration `transformPageChunk`. Anonymous visits remain functional.
- `src/lib/server/auth.ts` and `src/lib/server/cookies.ts` -- mirror sim
- Root `+layout.server.ts` -- mirror sim: hydrate appearance/theme/auth, expose `studyLoginUrl` for the unauthenticated banner
- Root `+layout.svelte` -- mirror sim: load `@ab/themes/generated/tokens.css`, render the chrome strip with `airboss / avionics` brand label and a fully functional theme picker (light + dark, no surface-level lock), render the auth banner for anonymous visits
- Home page (`/`) -- index of every avionics demo (see [Routes](#routes) and [Home page](#home-page-content) below)

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
- `libs/constants/src/routes.ts`: avionics block (alphabetical with the existing app blocks)
  - `AVIONICS_HOME: '/'` -- the surface index
  - `AVIONICS_PFD: '/pfd'` -- the headline demo
  - `AVIONICS_MFD: '/mfd'` -- the Multi-Function Display placeholder (shipping with this WP as a polished "coming soon" page so the home link is real, not dead)
  - `AVIONICS_SCAN: '/scan'` -- the instrument scan trainer placeholder (same shape as MFD)
  - `AVIONICS_AIRCRAFT: '/aircraft'` -- aircraft selector (currently lists C172 only; the route exists so the affordance is real and the second aircraft drops in cleanly)
- `libs/constants/src/schemas.ts`: `AVIONICS: 'avionics'`
- No new `AUDIT_TARGETS` -- the demo writes nothing

### Dev wiring

- `scripts/dev.ts`: add `avionics` to `DEV_URLS` so `bun run dev` multi-spawns it and `bun run dev avionics` works
- `scripts/check.ts`: add an `svelte-check` run for `apps/avionics/`
- `scripts/setup.ts`: picks up the new host automatically (it iterates `HOSTS.values`); developer adds `127.0.0.1 avionics.airboss.test` to `/etc/hosts` once
- Workspace `package.json` -- `apps/avionics` and `libs/bc/avionics` discovered automatically via the existing `apps/*` and `libs/bc/*` workspace globs (no edit required, but verify)
- Biome / `tsconfig.json` -- inherit project config, no per-app override

### Home page content

`/` is the surface index, not a redirect. It lists every avionics demo as a card with a one-line description and a `href` to the demo's route. The card grid is the affordance that makes the avionics surface feel like a product line, not a single page. Cards are constructed from `ROUTES.AVIONICS_*` constants. The home page is anonymous-OK and dark-or-light correct (token-driven).

| Card                   | Route                      | Description shown on the card                                                          |
| ---------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| Primary Flight Display | `ROUTES.AVIONICS_PFD`      | Glass PFD demo: attitude, airspeed tape, altitude tape, heading, VSI. Drives by slider |
| Multi-Function Display | `ROUTES.AVIONICS_MFD`      | Coming soon. Map page, traffic, weather, system pages -- the right side of the panel   |
| Instrument Scan        | `ROUTES.AVIONICS_SCAN`     | Coming soon. Drill the cross-check sweep across the six instruments                    |
| Aircraft               | `ROUTES.AVIONICS_AIRCRAFT` | Pick the aircraft the avionics surface is configured for. Currently: C172              |

### Placeholder pages (`/mfd`, `/scan`)

Each placeholder ships as a real, polished page -- not a stub. Layout matches the rest of the surface (chrome, theme picker, auth banner). The body explains what an MFD or scan trainer is, why it lives on the avionics surface, and why it isn't built yet. Prose is final-draft, not lorem ipsum. A small "back to avionics" link returns to `/`.

The point is that a learner clicking through the home page never lands on a 404 or a half-finished page; the surface looks like a product line that has more coming, not a half-built scaffold.

### Aircraft selector (`/aircraft`)

`/aircraft` lists every aircraft `@ab/bc-sim` exposes via `getAircraftConfig()` / `AIRCRAFT_REGISTRY`. Today that is C172 (and PA28 as a sibling FDM, but only C172 is a *user-selectable* avionics aircraft for this WP -- the affordance exists; the second aircraft is plumbing for the next WP). The page shows the currently selected aircraft, lists the alternatives (disabled, with "coming soon"), and writes the selection to a cookie / preference key the layout reads.

The selected aircraft is exposed as `data.selectedAircraftId: SimAircraftId` from the root `+layout.server.ts` (default `SIM_AIRCRAFT_IDS.C172` when nothing is set). Every avionics page reads it; the PFD reads V-speeds against it. The cookie is set by a small `POST /aircraft` form action (mirroring how `POST /theme` works today).

This is a real, narrow piece of state. It exists so the second aircraft -- when it is added to the avionics surface -- drops in cleanly without restructuring routes or the PFD's data flow.

### V-speeds: source from the selected aircraft's FDM

V-speed values for the airspeed tape's arc bands (white, green, yellow, red) come from the currently selected aircraft's FDM config in `@ab/bc-sim`. The FDM stores them in m/s; the avionics layer converts to knots at the boundary.

| V-speed | Source field on `AircraftConfig` | Tape role                                                  |
| ------- | -------------------------------- | ---------------------------------------------------------- |
| Vs0     | `vS0` (m/s)                      | Bottom of white arc (flap-extended stall, full flaps)      |
| Vs1     | `vS1` (m/s)                      | Bottom of green arc (clean stall)                          |
| Vfe     | `vFe` (m/s)                      | Top of white arc (max flap-extended speed)                 |
| Vno     | `vNo` (m/s)                      | Bottom of yellow arc (max structural cruising)             |
| Vne     | `vNe` (m/s)                      | Red line (never-exceed)                                    |

The PFD reads the config via `getAircraftConfig(selectedAircraftId)` exported from `@ab/bc-sim`. A small helper inside `apps/avionics/src/lib/pfd/airspeed-arcs.ts` derives the arc bands (in knots) from the config:

```typescript
import type { AircraftConfig } from '@ab/bc-sim';

export interface AirspeedArcBands {
  whiteStartKt: number;  // Vs0
  whiteEndKt: number;    // Vfe
  greenStartKt: number;  // Vs1
  greenEndKt: number;    // Vno
  yellowEndKt: number;   // Vne
  redLineKt: number;     // Vne
}

export function arcBandsFromConfig(cfg: AircraftConfig): AirspeedArcBands { /* ... */ }
```

The metres-per-second to knots conversion factor lives in `libs/constants/src/units.ts` (or wherever existing unit constants live -- if there is no shared module, this WP adds one entry: `MPS_TO_KNOTS`). No magic numbers in `airspeed-arcs.ts`.

Future-aircraft note: when the second aircraft (PA28 or other) is wired into the avionics surface, no PFD code changes. Each FDM exports its own V-speed set; the PFD reads from whichever aircraft is currently selected. The C172 today, PA28 next, others later -- the data flow is already set up for it.

### PFD demo

`/pfd` renders a full-bleed PFD plus a small input-control strip below it. No persistence, no auth-gating beyond what every avionics page inherits.

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
| Real MFD content (map, traffic, weather, system pages)            | The MFD route exists as a polished placeholder so the home page link is real. Real content lands with the MFD WP once a product feature drives it. The placeholder is in scope; the MFD product is not.                                                                                                                                                                |
| Real scan trainer drill (graded cross-check sequences)            | The `/scan` route exists as a polished placeholder. The graded drill -- with timing, target dwell, and scoring -- is its own WP, triggered by the first scan-trainer product feature.                                                                                                                                                                                  |
| Multi-aircraft selection (PA28 enabled, others)                   | The `/aircraft` route exists and reads the registry. PA28 is shown as "coming soon" because the avionics surface needs UX validation against one aircraft first. Enabling a second aircraft is a follow-on task that adds no new route, only an entry to the selectable list.                                                                                          |
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

### Theme: avionics participates in the full light + dark theme system

Avionics does not lock the theme picker. The picker on `/avionics/*` is fully functional, the same as on `/study/*` and `/hangar/*`. A learner who prefers light, gets light; a learner who prefers dark, gets dark; a learner on auto, follows the system.

This reverses the earlier surface-locked-dark idea. The PFD must look correct in both appearances. Glass-cockpit aesthetics typically assume dark, but a light variant is a real design constraint of this WP -- not a future concern. The PFD never ships hex colors; every color comes through theme tokens, and the light theme uses the same instrument structure with token-driven recoloring. [Design](design.md#pfd-rendering-light-and-dark) covers the token map.

### BC scaffold now, not later

User confirmed BC layer is provisioned in this WP. Reasons:

- Path-alias proliferation is cheap to do once and expensive to retrofit (every app config has to be edited).
- Schema namespace reservation prevents collisions when the first table lands.
- Type contracts (`Attitude`, `AirData`, `NavData`) are the contract the demo reads, so they earn their place.
- A BC with one types file is not "stub code" -- it's a named, locatable, importable contract surface.

### PFD components live in the app, not a lib

Per the user's note and the project's "create when needed, not before" rule, the PFD components live in `apps/avionics/src/lib/pfd/` for this WP. Promotion to `libs/activities/pfd/` happens when a second consumer appears (sim glass-cockpit overlay; an MFD page in avionics). That move is one named follow-on WP, not a TODO.

## Routes

| Route         | Method | Auth            | Purpose                                                                                              |
| ------------- | ------ | --------------- | ---------------------------------------------------------------------------------------------------- |
| `/`           | GET    | Anonymous OK    | Surface index. Cards link to every demo route                                                        |
| `/pfd`        | GET    | Anonymous OK    | The PFD demo (headline)                                                                              |
| `/mfd`        | GET    | Anonymous OK    | Polished placeholder explaining what an MFD is and what is coming                                    |
| `/scan`       | GET    | Anonymous OK    | Polished placeholder explaining what the instrument scan trainer is and what is coming               |
| `/aircraft`   | GET    | Anonymous OK    | Aircraft selector (currently lists C172; PA28 disabled with "coming soon")                           |
| `/aircraft`   | POST   | Anonymous OK    | Form action: write `selectedAircraftId` cookie                                                       |
| `/api/auth/*` | any    | per better-auth | Cross-subdomain session bridge (mirrors sim)                                                         |
| `/theme`      | POST   | Anonymous OK    | Theme-preference cookie endpoint (mirrors sim)                                                       |
| `/appearance` | POST   | Anonymous OK    | Appearance-preference endpoint (mirrors sim)                                                         |

All paths constructed via `ROUTES.AVIONICS_*`. No inline path strings in any file.

## Auth

Mirror `apps/sim/`: anonymous visits work, the sign-in banner offers a cross-subdomain link to study, the role gate is absent (no role-restricted features yet). Every avionics route is freely viewable so the user can show the surface without setting up a dev account.

### Cookie scope (cross-subdomain)

Session cookies are read with `Domain=.airboss.test` so the same `bauth_session_token` issued at `study.airboss.test` is recognised at `avionics.airboss.test`. This is the same cookie scope sim and hangar already use. The WP does not introduce new auth -- it copies sim's cookie helpers (`apps/sim/src/lib/server/cookies.ts`) verbatim, which already encode the cross-subdomain `Domain` value. Avionics does not host login; users sign in once on study and the session bridges to every other airboss subdomain.

## Data model

No tables. Schema namespace `avionics` reserved.

## Theme

Avionics participates in the full airboss light + dark theme system. The theme picker on `/avionics/*` is fully functional -- not locked. The PFD's instruments must look correct in both appearances; this is a real design constraint of the WP, covered in [Design](design.md#pfd-rendering-light-and-dark). All colors flow through theme tokens; no hex anywhere in the PFD components.

For the demo, `sim/glass` is one option among the regular set. A future `avionics/*` theme variant may ship if avionics develops divergence pressure from sim's design tokens, but it is not part of this WP.

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
| PFD looks bad in the light theme                     | The light variant is part of acceptance. Token-driven recoloring is required; the test plan exercises both appearances explicitly.                                                   |
| SVG performance on lower-end laptops at 60fps        | SVG is fast enough for 5 instruments at 60fps. If a profile shows otherwise, fallback to Canvas is a one-component rewrite per instrument; the design doc covers the migration path. |
| Placeholder pages feel unfinished                    | Placeholder prose is final-draft, not lorem ipsum. The page describes what is coming and why. The acceptance walks each placeholder for tone.                                        |
| Schema-namespace `avionics` reserved but never used  | Acceptable. Reservation is cheap; collision-avoidance pays for itself the first time a table lands.                                                                                  |

## References

- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../../../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- avionics positioning
- [docs/work-packages/hangar-scaffold/spec.md](../../../../work-packages/hangar-scaffold/spec.md) -- the prior surface-app scaffold WP this one mirrors
- [docs/work-packages/extract-sim-instruments/spec.md](../../../../work-packages/extract-sim-instruments/spec.md) -- the deferred WP whose trigger is "avionics app created"; resolved in [design.md](design.md#deferred-extract-sim-instruments-resolution)
- [apps/sim/svelte.config.js](../../../../../apps/sim/svelte.config.js) -- the canonical surface-app shell
- [libs/bc/sim/src/fdm/c172.ts](../../../../../libs/bc/sim/src/fdm/c172.ts) -- the C172 `AircraftConfig` the PFD reads V-speeds from
- [libs/bc/sim/src/fdm/aircraft-registry.ts](../../../../../libs/bc/sim/src/fdm/aircraft-registry.ts) -- `getAircraftConfig()` / `AIRCRAFT_REGISTRY`
