# Lessons from eight theme-system iterations

This document captures what eight sibling projects (FIRC, airboss-game, airboss-mini, airboss-ng, airboss-v1, overwatch-core, peepfood-launchpad, peepfood-mono, redbook-codex, plus airboss 2026-04) taught us about building a theme system. Same author, multiple years. The value isn't in what got built - it's in what kept getting *abandoned*, and why.

Read this before designing any new theme system.

## 8th iteration: airboss, 2026-04 (Option A)

First iteration to ship end-to-end across a multi-app monorepo with every acceptance criterion met. See [05-OVERHAUL-2026-04.md](05-OVERHAUL-2026-04.md) for the wave-by-wave story. What this iteration added to the TL;DR below:

1. **Compat-alias bridges make two-wave migrations safe.** The original "migrate 2,614 call sites atomically" plan failed (PR #69 drifted on main). Splitting into "land the foundation behind a compat-alias shim, then sweep call sites, then delete the shim" turned an atomic bomb into five clean landings. Takeaway: if the sweep is bigger than one PR can land without drift, ship a shim first.
2. **File-ownership scoping makes multi-agent parallel safe.** Three parallel agents (typography packs, enforcement, primitives) shipped without collisions because each owned disjoint files. When two agents share a file, they share a block - and blocks collide. The rule "parallel agents scope by file, not by block" became non-negotiable after one pair of agents did collide on `contract.ts` during Wave 1 scouting.
3. **Deterministic committed `generated/tokens.css` is worth the diff noise.** Every PR that touched a role token produced a visible CSS delta. Reviewers saw the cascade land at call-site resolution, not just at the contract. Zero silent emissions reached main.
4. **The `appearance` axis survives a real user toggle.** First iteration where users can pick system/light/dark via a cookie and have it carry across refresh + matchMedia live-update + pre-hydration + resolver + per-route forced-dark (sim). The three-axis composition held under this load without needing a fourth axis. This is load-bearing proof that density/chrome staying inside themes was the right call.

What didn't survive from prior iterations:

- The temptation to ship "legacy name aliases" as a permanent bridge. The aliases worked as scaffolding and got deleted in the last PR (#85). Rule reinforced: compat layers are either temporary or a smell.

## The TL;DR

1. **Role-based token naming is the right answer.** Every iteration that tried it survived. Every iteration that used rank words (`primary`, `secondary`) or raw colors (`color-blue-500`) ended up migrating away.
2. **Three axes max. Ever.** `theme`, `appearance` (light/dark), `layout`. A fourth axis (chrome, density-as-separate, etc.) has stalled every time.
3. **Derive, don't enumerate.** Declaring 6 interactive states per role by hand is where systems die. Declare the base color; derive hover/active/wash/edge/ink by math.
4. **TypeScript is the source of truth; emit CSS from it.** Hand-syncing two lists of names (TS catalog + CSS vars) has failed in every iteration that tried it.
5. **Ship enforcement tools, not roadmap docs.** airboss-v1 left eleven deleted "rollout plan" documents behind. A lint rule is worth more than all of them.
6. **Contrast tests are not optional.** Zero prior iterations had them. Every prior iteration *meant* to add them. Break this cycle.
7. **FOUC/hydration is a real problem.** Plan for it from day one with a pre-hydration script, not a hotfix later.

## What kept working

### Role-based token names

The vocabulary that survived across iterations:

- `surface` — fills (`surface-page`, `surface-panel`, `surface-raised`, `surface-sunken`, `surface-overlay`)
- `ink` / `content` / `text` — text color (`ink-body`, `ink-muted`, `ink-subtle`, `ink-faint`, `ink-inverse`, `ink-strong`)
- `edge` / `border` — borders (`edge-default`, `edge-strong`, `edge-subtle`, `edge-focus`)
- `action` / `interactive` — interactive intent (`action-default`, `action-hazard`, `action-caution`, `action-neutral`, `action-link`)
- `signal` / `feedback` — status (`signal-success`, `signal-warning`, `signal-danger`, `signal-info`)
- `focus` — focus rings (`focus-ring`, `focus-ring-strong`)
- `overlay`, `selection`, `disabled`, `accent` — secondary roles

Every serious iteration converged on this shape. Minor renames (`ink` vs `content` vs `text`, `action` vs `interactive`) don't matter; **the role-based grouping does**.

### Layered architecture (peepfood-mono)

- **Layer 0**: universal, immutable — spacing scale, z-index, breakpoints, motion durations, the token name vocabulary itself. *Never changes.*
- **Layer 1**: theme-specific — palette, typography, chrome. This is where divergence lives.
- **Layer 2**: app profile — which theme an app picks, which layouts it exposes.

The discipline of Layer 0 never changing is what keeps the system coherent across teams and time.

### Light/dark as a separate axis

Every serious iteration baked light/dark pairs into each theme. Applied via `data-appearance="dark"` or similar attribute, composable with `data-theme`. Don't invent new appearances; support `light` and `dark`, honor `prefers-color-scheme`.

### Layout templates separated from palette (FIRC)

FIRC's `families/` (workbench/focus/brand) was the brightest idea in the set: theme = palette + typography identity; layout = page shape (grid, container, spacing density), applied as a class on the container. A palette shouldn't own container width.

### Domain-specific tokens live with the app (airboss-game)

Game shipped `node-depot`, `status-moving`, `grade-s` etc. in its own theme layer. Components didn't have to translate game concepts into generic tokens. For aviation: sim's `instrument-horizon`, `instrument-caution-arc`, `instrument-warning-arc` belong in sim's theme vocab, not in shared libs. Shared libs care about generic roles only.

### Registry pattern with safe getters (redbook-codex)

```ts
getTheme(id: ThemeId): Theme          // throws on unknown
getThemeSafe(id: string): Theme | undefined
isValidThemeId(id: string): id is ThemeId
```

A theme can't be orphaned. Lookups can't fail silently. Adding a theme is a one-file operation.

### Per-theme font assignment (overwatch)

A theme doesn't just set font values — it *assigns which font role gets which family*. `airboss` assigns Space Mono to UI, JetBrains Mono to data. Swapping themes can't accidentally mix a display sans with a UI mono, because the assignments are theme-level decisions, not component-level.

### Typography packs (redbook-codex)

Themes pick a typography *pack* ("Inter + JetBrains Mono, 1× base") rather than setting 30 font tokens individually. Packs ship per-font size adjustments: serif pack scales text 0.9×, mono 1.1×, so visual weight stays consistent across pack swaps.

### Semantic typography bundles (peepfood-mono, game)

Not atomic `font-size-lg`; bundles like `type-reading-body` = family + size + weight + leading + tracking. The relationship between those five values is the thing themes override, not individual axes.

### Derivation utilities (peepfood-mono)

```ts
alpha(color, opacity): string
adjustBrightness(color, amount): string
getContrastingTextColor(bg): string
deriveInteractiveStates(base, isDark): { default, hover, active, wash, edge, ink }
deriveFeedbackVariants(base, isDark): { solid, wash, edge, ink }
```

One base color per role; five variants derived by math. Halves the token surface, eliminates the "I forgot to update the hover value" class of bug. 98 unit tests kept the math locked down.

### OKLCH over HSL/HEX

OKLCH (perceptually uniform) makes `adjustBrightness` predictable — shifting lightness by 0.1 looks the same whether you start from blue or yellow. HSL doesn't give you that. HEX gives you nothing.

### Runtime CSS variables, not CSS-in-JS, not build-time emission

Every iteration eventually landed here. `<html data-theme="sectional" data-appearance="dark">`. Theme swaps are attribute changes; no re-render, no JS cost. Pre-hydration script in `app.html` sets the attributes before first paint.

## What kept failing

### Over-semantic vocabularies (airboss-v1)

100+ `InformationType` enum values (`PERSON_NAME`, `TECHNICAL_CODE`, `STATUS_STATE`, etc.). 5-dimensional taxonomy (WHAT + HOW + WHERE + INTERACTION + FEEDBACK). 50+ adoption commits. 11 deleted roadmap docs. Ended at "50% Complete." **Abandoned.**

Why it fails: the vocabulary outruns adoption. Every new component has to decide its information type from a menu of 100. Nobody wants to. Half-adoption = inconsistency = system feels broken.

**Rule**: cap role families at ~12. Use modifiers (`-strong`, `-muted`, `-hover`, `-wash`, `-edge`, `-ink`) to express variation. If you need more than 12, you're probably inventing domain semantics that belong in an app-specific vocab extension, not in the shared base.

### Axis multiplication (airboss-ng, peepfood-launchpad)

- airboss-ng added a fourth "chrome" axis. Unfinished branch `ball/theme-chrome` abandoned.
- peepfood-launchpad had 5 axes (family × palette × font × density × elevation) = 243 potential combos. 6 shipped. The rest were theoretical.

Why it fails: testing surface doubles per axis. Nobody can mentally hold more than three composing dimensions. Users see six presets and ignore the rest.

**Rule**: three axes max — `theme`, `appearance`, `layout`. Density is part of theme (or part of layout), not a separate axis. Chrome is a theme concern, not an axis. If you want more variation, ship more themes.

### Hand-synced TS + CSS token lists (every iteration)

Every iteration that maintained a TypeScript catalog *and* a CSS variable list in two separate places eventually had drift. FIRC has it. Overwatch has it. Airboss-mini solved it by emitting CSS from the TS object. That's the answer.

**Rule**: one source of truth. TypeScript declares themes as typed objects. A generator emits CSS. Never edit the emitted CSS directly.

### Adoption-by-documentation (airboss-v1)

Eleven deleted files: `design-system-adoption-plan.md` (1,219 lines!), `design-system-roadmap.md`, `design-system-status-summary.md`, `completion-plan.md`, etc. Adoption didn't happen because nothing *forced* it. Every new component had a choice to use tokens or hardcode values; developers chose hardcoded values because tokens were slower to look up.

**Rule**: ship the lint rule, the codemod, and the CI failure *before* asking anyone to migrate. Tools force the decision. Docs let people defer it.

### No contrast testing (every iteration)

Zero prior iterations have WCAG AA contrast tests. Every iteration has a "we should add this" comment somewhere. None did.

**Rule**: write the contrast test before you ship the second theme. It's cheap, it's catastrophic when missing, and the pattern repeats.

### Deferred FOUC handling (peepfood-mono)

Peepfood-mono has a commit called "Fix hydration mismatch." Every CSS-variables-at-runtime system hits first-paint theme flicker when the user's preference doesn't match the default. Fixed with a pre-hydration script that reads the cookie/localStorage and sets `data-theme` on `<html>` before paint.

**Rule**: plan for FOUC in day one. Pre-hydration script in `app.html` is two dozen lines. Bolting it on later means debugging hydration mismatches.

### Layout templates bundled into themes (FIRC)

FIRC's families were separate, which was good — but FIRC still had 2 themes × 2 modes × 3 families = 12 combinations to keep coherent. You could see in the commits that some combinations were never actually tested.

**Rule**: layouts are composable with themes; don't let every theme ship its own layout. Default to one layout per app; add layouts only when a page actually needs a distinct shape.

## The meta-lesson

**The systems that shipped were the ones that stayed narrow and had teeth.**

- Narrow: fewer tokens, fewer axes, fewer themes. Airboss-game shipped with one theme, thirteen domain tokens, and a DESIGN_SYSTEM.md that said "pages have NO visual CSS." It worked.
- Teeth: lint rules, codemods, CI failures, tests. Peepfood-mono had 98 tests on color derivation. Its system outlived the others.

Every system that tried to be *both rich and adoption-by-trust* (airboss-v1 being the worst) failed at 50% and left behind a graveyard of rollout docs.

## Questions to ask before designing a new theme system

1. Can I name every token I'll ship today? If not, I'm over-designing.
2. How many axes does the user see? If >3, I'm over-designing.
3. Where's the lint rule that fails CI on hardcoded values? If I don't know yet, I'm behind.
4. Where's the contrast test? If I don't know yet, I'll regret it.
5. How does dark mode not flash on first paint? If I don't know yet, I'll bolt it on painfully.
6. Which layer owns this token — universal, theme, or app profile? If unclear, the layering isn't real yet.
7. What's the one source of truth for token names — TS or CSS? If both, I have drift waiting to happen.
