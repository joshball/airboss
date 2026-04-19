---
title: Multi-Product Architecture Options
date: 2026-04-15
status: research
parent: ./PIVOT.md
triggered_by: "Research architecture options for ~10 pilot training products sharing engine/content/auth"
---

# Multi-Product Architecture Options

Six options for organizing ~10 pilot performance products that share auth, content, engine, and DB but differ in surface (web/mobile/audio), complexity, and design language.

## Current state

```text
airboss-firc/              (previously firc-boss)
  apps/       4 SvelteKit apps (sim, hangar, ops, runway)
  libs/       11 shared libs (engine, constants, types, db, auth, audit, themes, ui, utils, payment, bc/*)
  course/     Curriculum content (L01-L05 layers)
  docs/       Platform + product docs
```

Bun workspaces. `@firc/*` path aliases. One PostgreSQL DB with namespaced schemas. Libs are plain TS dirs, not published packages. Apps are thin SvelteKit shells over shared BC logic.

## Evaluation criteria

| Criterion                     | Why it matters                                                              |
| ----------------------------- | --------------------------------------------------------------------------- |
| Context-switching cost         | Solo dev jumps between products daily. Friction between codebases kills flow |
| Maintenance at 20 products    | Dependency updates, breaking changes, shared code upgrades                   |
| Deploy independence            | Can ship product A without touching product B?                               |
| Design system flexibility      | Products need different UIs (avionics sim vs. audio player vs. mobile cards) |
| Shared code ergonomics         | How painful is importing/using engine, auth, content from a product?         |
| Mobile/audio/offline story     | Not everything is a SvelteKit web app                                        |
| Onboarding a new product       | Minutes to scaffold? Hours? Days?                                            |

---

## Option 1: Extended monorepo

Keep current structure. Each product is a new `apps/` entry.

```text
apps/
  route-walkthrough/    SvelteKit
  decision-reps/        SvelteKit
  avionics-trainer/     SvelteKit
  spaced-memory/        SvelteKit
  ntsb-stories/         SvelteKit (or static)
  ...10+ more
  hangar/               Content authoring
  runway/               Public site
libs/
  engine/ auth/ db/ themes/ ui/ bc/* ...
```

| Aspect                    | Assessment                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Shared code               | Direct TS imports via `@firc/*`. Zero publish step. Refactor across all products in one commit |
| Auth/users                | Single `libs/auth/`, shared session, one DB                                                  |
| Content                   | `libs/bc/course/` serves all products. One content pipeline                                  |
| Deploy                    | Each app builds independently. Deploy one without the others                                 |
| Context-switching          | Lowest possible. One IDE window, one git log, one branch                                     |
| Design flexibility         | Each app has its own `src/` with routes/layouts/styles. Themes lib provides tokens            |
| At 20 products             | `apps/` directory gets long. CI builds everything on every push unless filtered. Bun workspace resolution slows |
| Mobile/audio               | SvelteKit can do PWA/static. Native mobile requires separate tooling outside the monorepo    |
| New product setup          | Copy an app skeleton, add to workspaces. Minutes                                             |

**Tradeoffs.** Simplest option. Lowest overhead. But: CI gets slow, git log becomes noisy across unrelated products, and non-web products (native mobile, audio generation) don't fit naturally. The 15th SvelteKit app will feel cluttered.

---

## Option 2: Monorepo with products-as-routes

Fewer apps. Products are route groups within thematic apps. Probably 3-5 apps total instead of 10+.

```text
apps/
  pilot/                The main pilot-facing app
    src/routes/
      (preflight)/      Route Walkthrough, Airport Cards, NOTAM Triage
      (daily)/          Decision Reps, Spaced Memory, WX Calls
      (events)/         BFR Sprint, IPC Sprint, Checkride Prep
      (reflect)/        Journal, Skill Heatmap, Calibration Tracker
  studio/               Audio generation + avionics authoring (replaces hangar)
  runway/               Public site
libs/
  engine/ auth/ db/ themes/ ui/ bc/* ...
```

| Aspect                    | Assessment                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Shared code               | Same as Option 1 -- direct `@firc/*` imports                                                 |
| Auth/users                | Even simpler -- one app, one session, one cookie. No cross-app auth needed                   |
| Content                   | Same as Option 1                                                                             |
| Deploy                    | Deploy the pilot app = deploy all pilot-facing products. Can't ship one without the others   |
| Context-switching          | Lowest. Everything in one app. Shared layouts, shared nav, shared state                      |
| Design flexibility         | Route groups can have different layouts, but they share one app shell, one CSS bundle, one nav. Hard to make the avionics trainer feel radically different from the journal |
| At 20 products             | Route groups become a sprawling mess. The app becomes a monolith with one build, one bundle   |
| Mobile/audio               | Same limitation as Option 1                                                                  |
| New product setup          | Add a route group + layout. Minutes. But it's coupled to the app's build/deploy               |

**Tradeoffs.** Maximum code sharing, minimum overhead, but products can't diverge in look or deploy cadence. Works well if most products genuinely share a shell (dashboard + sidebar nav). Falls apart when products need distinct experiences (avionics trainer vs. audio player). The "one giant app" risk is real -- at 15 route groups the pilot app becomes hard to reason about.

---

## Option 3: Platform core + plugin products

One core app provides auth, content, engine, dashboard. Products are dynamically loaded modules/plugins.

```text
apps/
  platform/             Core shell: auth, nav, dashboard, content API
    src/lib/plugins/    Plugin loader
  runway/               Public site
plugins/
  route-walkthrough/    Svelte component tree + routes
  decision-reps/
  avionics-trainer/
  spaced-memory/
libs/
  engine/ auth/ db/ bc/* ...
```

| Aspect                    | Assessment                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Shared code               | Plugins import from platform. Platform exposes a plugin API (content, auth, progress, engine) |
| Auth/users                | Centralized in platform shell. Plugins inherit session                                       |
| Content                   | Platform provides content API. Plugins consume it                                            |
| Deploy                    | Depends on implementation. If plugins are dynamic imports: one deploy. If separate builds: complex |
| Context-switching          | Medium. Plugin boundaries are clear, but debugging crosses plugin/platform boundary           |
| Design flexibility         | Plugins can render anything, but they live inside the platform shell. Constrained viewport    |
| At 20 products             | Scales well conceptually. But plugin API becomes the bottleneck -- every new product need pushes the API surface |
| Mobile/audio               | Plugins are web components. Same mobile limitation                                           |
| New product setup          | Implement plugin interface. Moderate -- need to understand the plugin contract                |

**Tradeoffs.** Elegant in theory. In practice, building a plugin system is building a framework. The plugin API becomes the hardest code to maintain. SvelteKit doesn't have a natural plugin model -- you'd be inventing one. For a solo dev, the framework-building overhead likely exceeds the value until you have 10+ products that genuinely need runtime composition. If products are known at build time (they are), static imports are simpler.

---

## Option 4: Monorepo with independent deployables (Turborepo/Nx-style)

Current monorepo, but with a proper build orchestrator that caches, only rebuilds what changed, and treats each app as an independent deployable.

```text
apps/
  route-walkthrough/    SvelteKit
  decision-reps/        SvelteKit
  avionics-trainer/     SvelteKit
  hangar/               SvelteKit
  runway/               SvelteKit
  ntsb-audio/           Static site or Node script
libs/
  engine/ auth/ db/ themes/ ui/ bc/* ...
turbo.json / nx.json    Build graph + caching
```

| Aspect                    | Assessment                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Shared code               | Same as Option 1 -- direct imports. But Turborepo/Nx adds task graph awareness               |
| Auth/users                | Same as Option 1                                                                             |
| Content                   | Same as Option 1                                                                             |
| Deploy                    | Build only what changed. Deploy individual apps. CI is fast even at 20 apps                  |
| Context-switching          | Same as Option 1 -- one repo, one IDE                                                        |
| Design flexibility         | Same as Option 1 -- each app is independent                                                  |
| At 20 products             | This is where it shines. Nx/Turborepo caching makes CI viable at scale. Affected-only builds |
| Mobile/audio               | Can mix app types: SvelteKit apps, static generators, Node scripts, even React Native in the same monorepo |
| New product setup          | Scaffold app, register in build graph. Minutes                                               |

**Tradeoffs.** Option 1 with better CI. Adds a build tool dependency (Turborepo or Nx) and configuration overhead. Turborepo is lighter; Nx is more powerful but heavier. For Bun workspaces, Turborepo has better compatibility. The question is whether you need the caching now -- at 4-5 apps, plain Bun is fine. At 10+, you'll want it. Can migrate to this from Option 1 incrementally without restructuring.

---

## Option 5: Multi-repo with shared packages

Separate git repos per product. Shared code published as packages to a private registry (or git-based imports).

```text
repo: pilot-platform-core     (engine, auth, db, bc/*, constants, types)
repo: route-walkthrough        imports @pilot/engine, @pilot/auth, etc.
repo: decision-reps            imports @pilot/engine, @pilot/auth, etc.
repo: avionics-trainer         imports @pilot/engine, @pilot/auth, etc.
repo: hangar                   imports @pilot/engine, @pilot/auth, etc.
repo: runway                   imports @pilot/engine, @pilot/auth, etc.
```

| Aspect                    | Assessment                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Shared code               | Published packages. Version pinned. Upgrade is explicit per-product                          |
| Auth/users                | Auth is a package. Each product configures it. Shared DB, shared session domain              |
| Content                   | Content BC is a package. Products consume published content via package API                   |
| Deploy                    | Fully independent. Each repo has its own CI/CD                                               |
| Context-switching          | Highest cost. Different repo, different git state, different IDE window. Lose flow constantly |
| Design flexibility         | Maximum. Each repo is fully independent                                                      |
| At 20 products             | 20 repos. 20 CI configs. Shared package upgrades require 20 PRs. Version drift is inevitable |
| Mobile/audio               | Each repo picks its own stack. React Native, static generator, whatever                      |
| New product setup          | Clone template, configure packages, set up CI. Hours                                         |

**Tradeoffs.** Maximum isolation, maximum overhead. For a solo dev, the publish/version/upgrade cycle for shared packages is a tax on every change. When you fix a bug in the engine, you publish the package, then update it in every product that uses it. At 10 products, this is miserable. Multi-repo makes sense for teams with different release cadences and ownership boundaries. For one person, it's all cost and no benefit.

---

## Option 6: Hybrid -- core monorepo + satellite repos

Core platform (auth, engine, content, DB, dashboard, content authoring) in the main monorepo. Individual products that need radically different stacks (native mobile, audio pipeline) live in satellite repos that import from core via published packages or git submodules.

```text
repo: pilot-platform (monorepo)
  apps/
    pilot/              Main web app (hosts most web products as route groups)
    hangar/             Content authoring
    runway/             Public site
  libs/
    engine/ auth/ db/ bc/* themes/ ui/ ...

repo: pilot-audio-pipeline        (Node/Bun scripts, generates audio content)
repo: pilot-mobile                 (React Native or Capacitor, imports @pilot/engine)
```

| Aspect                    | Assessment                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Shared code               | Monorepo products: direct imports. Satellite products: published packages from core          |
| Auth/users                | Monorepo: shared directly. Satellites: API-based auth or shared session domain               |
| Content                   | Monorepo: direct BC access. Satellites: content API or published package                     |
| Deploy                    | Monorepo apps deploy together or independently. Satellites are fully independent             |
| Context-switching          | Low for web products (all in monorepo). Higher when jumping to a satellite                   |
| Design flexibility         | Web products share what they want. Satellites are unconstrained                               |
| At 20 products             | If 15 are web: monorepo handles them. 5 satellites is manageable                             |
| Mobile/audio               | Satellites handle non-web naturally. This is the main advantage over pure monorepo           |
| New product setup          | Web product: add to monorepo (minutes). Satellite: new repo + package setup (hours)          |

**Tradeoffs.** Pragmatic split: keep most things in the monorepo, only exile what truly can't live there. But you now maintain two integration patterns (direct imports vs. published packages). The satellite repos still suffer from the package-upgrade tax of Option 5, just for fewer repos. The decision boundary ("when does a product become a satellite?") is fuzzy and will cause friction.

---

## Option 7: Capability-surface apps (products-as-routes within surface-typed hosts)

Group products not by theme (preflight, proficiency, events) but by **what they need from the platform** -- their technical surface. Each surface type becomes an app. Products are routes inside the app that matches their needs. Combine with Option 4 (Turborepo) for independent builds/deploys.

The insight: a product's category (pre-flight, proficiency, event-prep) is a content distinction. Its surface requirements (needs avionics rendering? needs audio pipeline? needs offline/mobile? is static content only?) are an engineering distinction. Organize code by the latter.

### Identifying the surfaces

Looking at all 53 products and their `surfaces` + `complexity` + `depends_on` metadata:

| Surface type                   | What it needs                                                         | Products                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Study / quiz / rep**         | Spaced rep engine, card UI, quiz flow, progress tracking, mobile      | prd:prof:spaced-memory-items Spaced Memory, prd:prof:decision-reps Decision Reps, prd:prof:ten-minute-ticker Ticker, prd:prof:situational-replay Replay, prd:prof:plate-reading-drills Plates, prd:prof:wx-calls WX, prd:prof:calibration-tracker Calibration, all event prep products (prd:evt:bfr-sprint through prd:evt:recency-recovery), prd:com:scenario-of-the-week Scenario of the Week |
| **Nav / glass cockpit**        | Avionics state machine, instrument rendering, schematic panels        | prd:prof:avionics-trainer Avionics Trainer                                                                                                                                                                                                                                                                                                                                                      |
| **Route / spatial**            | Airport data, airspace data, terrain, weather APIs, map rendering     | prd:pre:route-walkthrough Route Walkthrough, prd:pre:airport-cards Airport Cards, prd:pre:approach-rehearsal Approach Rehearsal, prd:pre:diversion-drill Diversion, prd:pre:what-could-go-wrong WCGW, prd:pre:notam-triage NOTAM, prd:fly:pre-departure-card Pre-Departure Card                                                                                                                 |
| **Audio / narrative**          | Audio generation or playback, TTS, speech recognition, podcast format | prd:aud:daily-decision Daily Decision, prd:aud:atc-comms-drill ATC Comms, prd:aud:memory-items-audio Memory Audio, prd:aud:ntsb-story NTSB Story                                                                                                                                                                                                                                                |
| **Journal / reflect**          | Free-text input, tagging, search, heatmaps, charts, export           | prd:ref:per-flight-journal Journal, prd:ref:skill-heatmap Heatmap, prd:ref:currency-proficiency-tracker Currency Tracker, prd:ref:decision-diary Decision Diary, prd:fly:voice-debrief Voice Debrief                                                                                                                                                                                             |
| **Community / social**         | User profiles, pairing, voting, leaderboards, moderation              | prd:com:route-buddy Route Buddy, prd:com:cfi-pairing CFI Pairing, prd:com:anonymous-mistakes Anon Mistakes, prd:com:local-pilot-map Pilot Map                                                                                                                                                                                                                                                   |
| **Lightweight / mobile-first** | Minimal UI, glanceable, works offline, quick input                    | prd:pre:pre-flight-imsafe IMSAFE, prd:pre:passenger-brief Passenger Brief, prd:pre:cold-start-recall Cold-Start, prd:fly:single-tap-pirep PIREP, prd:exp:smartwatch-ritual Smartwatch                                                                                                                                                                                                           |
| **Sim-connected**              | X-Plane/MSFS bridge, websocket, real-time state                      | prd:exp:replay-your-flight Replay Flight, prd:exp:ghost-flight Ghost Flight, prd:exp:anti-startle-trainer Anti-Startle (v2+)                                                                                                                                                                                                                                                                     |

Some products span surfaces (Route Walkthrough needs spatial + quiz elements), but every product has a *primary* surface.

### What this looks like

```text
apps/
  study/                 Quiz, reps, spaced rep, event prep, calibration
    src/routes/
      memory/            prd:prof:spaced-memory-items Spaced Memory Items
      reps/              prd:prof:decision-reps Decision Reps
      ticker/            prd:prof:ten-minute-ticker Ten-Minute Ticker
      wx/                prd:prof:wx-calls WX Calls
      plates/            prd:prof:plate-reading-drills Plate Reading, prd:pre:approach-rehearsal Approach Rehearsal
      events/            BFR Sprint, IPC Sprint, Checkride Prep, Recency Recovery
      calibration/       prd:prof:calibration-tracker Calibration Tracker
      replay/            prd:prof:situational-replay Situational Replay
  spatial/               Route, airport, airspace, map-based products
    src/routes/
      route/             prd:pre:route-walkthrough Route Walkthrough
      airports/          prd:pre:airport-cards Airport Cards
      diversion/         prd:pre:diversion-drill Diversion Drill
      notams/            prd:pre:notam-triage NOTAM Triage
      wcgw/              prd:pre:what-could-go-wrong What-Could-Go-Wrong
      departure-card/    prd:fly:pre-departure-card Pre-Departure Card
  avionics/              Glass cockpit trainer (standalone -- unique rendering needs)
    src/routes/
      trainer/           prd:prof:avionics-trainer Avionics Trainer
  audio/                 Audio content -- narrative, drills, TTS
    src/routes/
      ntsb/              prd:aud:ntsb-story NTSB Story
      daily/             prd:aud:daily-decision Daily Decision
      comms/             prd:aud:atc-comms-drill ATC Comms Drill
      memory-audio/      prd:aud:memory-items-audio Memory Items Audio
  reflect/               Journals, heatmaps, tracking, charts
    src/routes/
      journal/           prd:ref:per-flight-journal Per-Flight Journal
      heatmap/           prd:ref:skill-heatmap Skill Heatmap
      currency/          prd:ref:currency-proficiency-tracker Currency & Proficiency Tracker
      diary/             prd:ref:decision-diary Decision Diary
      debrief/           prd:fly:voice-debrief Voice Debrief
  hangar/                Content authoring + admin (unchanged)
  runway/                Public site (unchanged)
libs/
  engine/                Scenario engine
  learning/              Spaced rep, progress, streaks
  spatial/               Airport/airspace/terrain data layer (new -- shared by spatial + study)
  audio/                 TTS, audio generation utils (new)
  auth/ audit/ db/ bc/* constants/ types/ themes/ ui/
turbo.json               Build graph for independent app builds
```

### Assessment

| Aspect             | Assessment                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Shared code        | Direct `@firc/*` imports. Same as Options 1/4. Monorepo, no publish step                                                    |
| Auth/users         | Shared `libs/auth/`, shared DB. Cross-app session via shared cookie domain                                                  |
| Content            | Same content BCs, consumed by all apps                                                                                      |
| Deploy             | Each surface-app deploys independently (Turborepo). Ship a study fix without touching avionics                              |
| Context-switching  | Low -- one repo, one IDE. Clear which app to open based on what surface you are working on                                  |
| Design flexibility | Key advantage. Each app owns its design system. Study = card/quiz. Spatial = maps. Avionics = panels. Audio = player chrome |
| At 20 products     | Products land in the app matching their surface. New products rarely create new apps -- they extend existing surfaces       |
| Mobile/audio       | Audio app can be static site or podcast generator. Lightweight/mobile products live in study app as PWA                     |
| New product setup  | Add routes to the matching surface app. Minutes. Only create a new app if the surface is genuinely new                      |

### Tradeoffs

**Advantages over Option 2 (theme-grouped routes in one app):**

- Products with different rendering needs don't fight over one app shell. The avionics trainer doesn't share a layout with the flight journal.
- Each app's dependency tree is right-sized. Study app doesn't bundle map rendering. Spatial app doesn't bundle audio processing.
- Deploy independently -- fix the spaced rep algorithm without redeploying the map app.
- Design systems can diverge meaningfully per surface. Study app can be mobile-first card UI. Avionics app can be desktop-only fullscreen.

**Advantages over Option 1 (one app per product):**

- 5-7 apps instead of 15+. Much less build/deploy/config overhead.
- Products within a surface share layouts, nav, and state naturally.
- Clear organizing principle for "where does a new product go?" -- match the surface, not the theme.

**Risks and costs:**

- **Surface boundaries are a judgment call.** Approach Rehearsal (prd:pre:approach-rehearsal) needs plate rendering (spatial?) but is primarily a quiz (study?). Route Walkthrough (prd:pre:route-walkthrough) is spatial but ends with quiz questions. You'll have products that straddle surfaces, and the placement decision can feel arbitrary.
- **Cross-surface features require coordination.** When the Ten-Minute Ticker (prd:prof:ten-minute-ticker) wants to pull in a WX Calls (prd:prof:wx-calls) scenario AND an approach plate drill (prd:prof:plate-reading-drills), it's orchestrating across the study app's own content -- fine. But if it wants to embed a map from the spatial app, that's cross-app component sharing, which is harder.
- **More apps = more deploy configs, more port management, more dev-server processes.** 5-7 is manageable; it's still more than 2-3.
- **The "surface" taxonomy may not be stable.** If audio evolves from static content to interactive (speech recognition for ATC comms), it may need the quiz infrastructure from study. Surfaces blur over time.
- **Turborepo dependency becomes load-bearing earlier** than in Options 1/2 because you have more apps from day one.

### When Option 7 beats the others

This option is strongest when:

- Products within a surface genuinely share rendering infrastructure (maps, instruments, audio players) that other surfaces don't need.
- Design systems per surface are meaningfully different, not just color-scheme variations.
- You want independent deploy cadence per surface (ship study improvements without touching spatial).
- You're willing to accept the overhead of 5-7 apps in exchange for cleaner separation.

It's weakest when:

- Most products are simple enough that a shared study/quiz UI covers 80% of them (which may be true for v1).
- The cross-surface features (Ticker pulling from multiple product types) become the norm rather than the exception.
- You're pre-v1 and the overhead of multiple apps slows you down vs. just building in one app and splitting later.

---

## Cross-cutting questions

### Where does the learning system live?

The learning system (spaced repetition, progress tracking, quiz engine, streak tracking) is **platform infrastructure, not a product.** It belongs in `libs/` -- probably `libs/bc/learning/` or `libs/bc/progress/`. Every product that involves study/practice consumes it. It's the equivalent of `libs/auth/` -- invisible to users, critical to every product.

If there's a standalone "study mode" product, that's a thin app over the learning BC, not the BC itself.

### Where do dashboards live?

Two dashboards, two locations:

| Dashboard               | What it shows                                        | Where it lives               |
| ----------------------- | ---------------------------------------------------- | ---------------------------- |
| Product dev progress    | What's built, what's next, task status               | `hangar` (content/product authoring app) |
| Personal pilot progress | Skill heatmap, streaks, calibration, proficiency     | `pilot` app (or `sim`)       |

### Where does content authoring live?

`hangar` stays. It's the authoring surface for scenarios, questions, route packs, audio scripts -- all content across all products. One authoring tool, many consumer products. This is already the design.

### What happens to the existing 4 apps?

| Current app | Post-pivot fate                                                                    |
| ----------- | ---------------------------------------------------------------------------------- |
| `sim`       | Becomes `pilot` -- the main pilot-facing app. Hosts most web products              |
| `hangar`    | Stays. Content authoring + product tracking for all products                       |
| `ops`       | Folds into `hangar` as admin routes. Not enough standalone surface to justify an app |
| `runway`    | Stays. Public site, marketing, free content, open-source landing                   |

---

## Recommendation

**Option 7 (capability-surface apps) is the target architecture. Start there from the beginning with Turborepo (Option 4) for independent builds. Keep everything in one monorepo.**

The key insight is to organize apps by *what they render*, not by content theme. A quiz about weather and a quiz about regulations both need the same card/quiz UI infrastructure. A route map and an airport card both need the same spatial/map rendering. Let the surface requirements -- not the subject matter -- determine which app a product lands in.

### Target structure

```text
apps/
  study/                Quiz, reps, spaced rep, event prep, calibration
    src/routes/
      memory/           prd:prof:spaced-memory-items Spaced Memory Items
      reps/             prd:prof:decision-reps Decision Reps
      ticker/           prd:prof:ten-minute-ticker Ten-Minute Ticker
      wx/               prd:prof:wx-calls WX Calls
      plates/           prd:prof:plate-reading-drills Plate Reading, prd:pre:approach-rehearsal Approach Rehearsal
      events/           BFR Sprint, IPC Sprint, Checkride Prep, Recency Recovery
      calibration/      prd:prof:calibration-tracker Calibration Tracker
      replay/           prd:prof:situational-replay Situational Replay
  spatial/              Route, airport, airspace, map-based products
    src/routes/
      route/            prd:pre:route-walkthrough Route Walkthrough
      airports/         prd:pre:airport-cards Airport Cards
      diversion/        prd:pre:diversion-drill Diversion Drill
      notams/           prd:pre:notam-triage NOTAM Triage
      wcgw/             prd:pre:what-could-go-wrong What-Could-Go-Wrong
      departure-card/   prd:fly:pre-departure-card Pre-Departure Card
  avionics/             Glass cockpit trainer (unique rendering needs)
    src/routes/
      trainer/          prd:prof:avionics-trainer Avionics Trainer
  audio/                Narrative, drills, TTS
    src/routes/
      ntsb/             prd:aud:ntsb-story NTSB Story
      daily/            prd:aud:daily-decision Daily Decision
      comms/            prd:aud:atc-comms-drill ATC Comms Drill
      memory-audio/     prd:aud:memory-items-audio Memory Items Audio
  reflect/              Journals, heatmaps, tracking, charts
    src/routes/
      journal/          prd:ref:per-flight-journal Per-Flight Journal
      heatmap/          prd:ref:skill-heatmap Skill Heatmap
      currency/         prd:ref:currency-proficiency-tracker Currency & Proficiency Tracker
      diary/            prd:ref:decision-diary Decision Diary
      debrief/          prd:fly:voice-debrief Voice Debrief
  hangar/               Content authoring + admin (ops folded in)
  runway/               Public site
libs/
  engine/               Scenario tick engine, scoring
  learning/             Spaced repetition, progress, streaks (new)
  spatial/              Airport/airspace/terrain data layer (new)
  audio/                TTS, audio generation utils (new)
  auth/ audit/ db/ bc/* constants/ types/ themes/ ui/ utils/ payment/
turbo.json              Build graph for independent app builds
```

### Why this combination

- **Apps organized by rendering surface, not content theme.** Weather quizzes and regulation quizzes both live in `study/` because they share card UI, quiz flow, and spaced rep infrastructure. Route maps and airport cards both live in `spatial/` because they share map rendering and aeronautical data. This keeps dependencies right-sized per app.
- **Design systems diverge where they should.** Study app is mobile-first card UI. Spatial app has maps and aeronautical charts. Avionics app has instrument panels and knob interactions. Audio app has player chrome. They don't fight over one layout.
- **Independent deploys via Turborepo.** Fix the spaced rep algorithm without redeploying the map app. Ship a new audio story without rebuilding avionics. Each surface-app builds and deploys on its own.
- **Solo dev stays in one repo.** One IDE, one git log, one branch. Context-switching between surfaces is a tab switch, not a repo switch.
- **Clear "where does this go?" rule.** New product? Match its primary rendering surface to an existing app. Add routes. Only create a new app if the surface is genuinely novel (community/social might earn one eventually; sim-connected will if it happens).
- **5-7 apps, not 15+.** Manageable number of build configs, dev servers, and deploy targets. Much less overhead than one-app-per-product, much more flexibility than one-giant-app.

### What to start with (not all at once)

Build the apps as you need them, not all 7 on day one:

1. **`study/`** first -- this is where Spaced Memory Items (prd:prof:spaced-memory-items), Decision Reps (prd:prof:decision-reps), and the daily Ticker (prd:prof:ten-minute-ticker) live. It's the foundational product AND the personal learning tool.
2. **`hangar/`** already exists -- content authoring for all products.
3. **`runway/`** already exists -- public site.
4. **`reflect/`** when you start flying again and need journaling/tracking.
5. **`spatial/`** when Route Walkthrough (prd:pre:route-walkthrough) is ready to build (needs aeronautical data layer).
6. **`audio/`** when NTSB Stories (prd:aud:ntsb-story) or Daily Decision (prd:aud:daily-decision) are ready.
7. **`avionics/`** when the schematic trainer (prd:prof:avionics-trainer) is ready.

### What to resist

- **Organizing by content theme.** "Pre-flight app" and "proficiency app" sound intuitive but don't match engineering reality. A pre-flight IMSAFE check and a pre-flight approach rehearsal have nothing in common technically.
- **One giant pilot app.** Option 2 (products-as-routes in one app) is simpler but forces everything into one shell, one CSS bundle, one design system. When the avionics trainer needs fullscreen instrument panels and the journal needs a simple text editor, they fight.
- **Premature satellite repos.** Keep everything in the monorepo. Direct `@firc/*` imports, one refactor across all apps. Only spin out a satellite if something truly can't be a SvelteKit app (native mobile, if that ever happens).
- **Plugin systems.** All products are known at build time. Static imports beat runtime discovery.

### Open questions for this architecture

- **Community products (prd:com:*):** do they earn their own app, or are they features within study/reflect? Probably features until the social surface is complex enough to justify its own app.
- **Lightweight/mobile products (prd:pre:pre-flight-imsafe, prd:pre:passenger-brief, prd:pre:cold-start-recall, prd:fly:single-tap-pirep, prd:exp:smartwatch-ritual):** these are tiny. Do they live in study? In a dedicated `quick/` app? Or as PWA features of whichever app is closest?
- **Cross-surface features:** the Ten-Minute Ticker (prd:prof:ten-minute-ticker) orchestrates content from study + spatial + audio. How does it pull from sibling apps? Shared libs are the answer (content comes from BCs in libs, not from other apps), but the UX integration needs thought.
- **Shared navigation:** does the pilot see 5 separate apps or one unified experience? Probably a shared header/nav component from `libs/ui/` that all pilot-facing apps render, with cross-app links. Feels like one product even though it's multiple apps.
