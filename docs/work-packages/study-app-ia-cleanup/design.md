---
title: 'Design: Study App IA Cleanup'
product: study
feature: study-app-ia-cleanup
type: design
status: unread
review_status: pending
created: 2026-05-04
---

# Design: Study App IA Cleanup

Companion to [spec.md](./spec.md). Notes the route shape, the explanation-content model, the e2e selector contract, and the boundary against the underlying BCs.

## The most consequential decision -- separate BCs, single Program UI

[Goal](../../../libs/bc/study/src/goals.ts) and [Plan](../../../libs/bc/study/src/plans.ts) are two BCs with two aggregates and two distinct uniqueness invariants:

- Goal: at most one `is_primary=true` per user (partial UNIQUE index, transactional swap in `setPrimaryGoal`). Status `active | paused | completed | archived`. A user can have many goals.
- Plan: at most one `status='active'` per user (partial UNIQUE index, archive-on-create). Status `active | archived`. Cert intent has been removed from plan; the engine now reads cert intent from the user's primary goal via `getDerivedCertGoals`.

They model different things at different rates of change:

- A goal is a stable intent ("PPL by July"). A plan is a config you tweak ("today I want shorter sessions; focus weather"). Mixing them would mean every config tweak rewrites your intent.
- Both protect different invariants at the DB level.
- The engine signature stays clean by reading two separate things (cert intent from goal, session shape from plan).

**The user-facing surface does not have to mirror the BC structure.** This WP keeps the BCs intact and presents them on one Program page with sectioned, explained panels. Honors the model; gives the user one mental destination ("my program is here").

If a future product decision asks for "merge in the UI", the BCs survive: only the Program page swaps shape. If a future BC change wants to merge the aggregates, the UI stays valid. The boundary is intentional.

## Routes table

New canonical paths, the constants that back them, and the redirect rule for every old path.

### New routes

| Constant                          | Path                                                  | Replaces                                  |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| `ROUTES.STUDY` (kept)             | `/study`                                              | -- (renamed semantics: now the Home)      |
| `ROUTES.PROGRAM`                  | `/program`                                            | `ROUTES.PLANS` + `ROUTES.GOALS` + `ROUTES.CREDENTIALS` (index) |
| `ROUTES.PROGRAM_TAB(tab)`         | `/program?tab={tab}`                                  | n/a                                        |
| `ROUTES.PROGRAM_QUAL(slug)`       | `/program/quals/{slug}`                               | `ROUTES.CREDENTIAL(slug)`                 |
| `ROUTES.PROGRAM_QUAL_AREA(slug, areaCode)` | `/program/quals/{slug}/areas/{areaCode}`     | `ROUTES.CREDENTIAL_AREA(slug, areaCode)`  |
| `ROUTES.PROGRAM_GOAL(id)`         | `/program/goals/{id}`                                 | `ROUTES.GOAL(id)`                          |
| `ROUTES.PROGRAM_PLAN(id)`         | `/program/plans/{id}`                                 | `ROUTES.PLAN(id)`                          |
| `ROUTES.INSIGHTS`                 | `/insights`                                           | `ROUTES.DASHBOARD`                         |
| `ROUTES.INSIGHTS_CALIBRATION`     | `/insights/calibration`                               | `ROUTES.CALIBRATION`                       |
| `ROUTES.INSIGHTS_LENS_HANDBOOK`   | `/insights/lens/handbook`                             | `ROUTES.LENS_HANDBOOK`                     |
| `ROUTES.INSIGHTS_LENS_WEAKNESS`   | `/insights/lens/weakness`                             | `ROUTES.LENS_WEAKNESS`                     |
| `ROUTES.REFERENCE`                | `/reference`                                          | n/a (new index)                            |
| `ROUTES.REFERENCE_KNOWLEDGE`      | `/reference/knowledge`                                | `ROUTES.KNOWLEDGE`                         |
| `ROUTES.REFERENCE_GLOSSARY`       | `/reference/glossary`                                 | `ROUTES.GLOSSARY`                          |

Memory and Reps routes stay where they are -- their nav surface moves into Learn -> Cards / Reps, but the URLs do not change. Same for Flight (placeholder).

### Redirect rules

Implemented in `apps/study/src/hooks.server.ts` (or extended if exists). Every old route maps to a new route via 301. The hook runs before route resolution so the old paths never hit a 404.

```typescript
// apps/study/src/hooks.server.ts (sketch)
const REDIRECTS: ReadonlyArray<{ from: RegExp; to: (m: RegExpMatchArray) => string }> = [
  { from: /^\/dashboard\/?$/, to: () => '/insights' },
  { from: /^\/credentials\/?$/, to: () => '/program?tab=quals' },
  { from: /^\/credentials\/([^/]+)\/?$/, to: (m) => `/program/quals/${m[1]}` },
  { from: /^\/credentials\/([^/]+)\/areas\/([^/]+)\/?$/, to: (m) => `/program/quals/${m[1]}/areas/${m[2]}` },
  { from: /^\/goals\/?$/, to: () => '/program?tab=goal' },
  { from: /^\/goals\/([^/]+)\/?$/, to: (m) => `/program/goals/${m[1]}` },
  { from: /^\/plans\/?$/, to: () => '/program?tab=plan' },
  { from: /^\/plans\/([^/]+)\/?$/, to: (m) => `/program/plans/${m[1]}` },
  { from: /^\/calibration\/?$/, to: () => '/insights/calibration' },
  { from: /^\/lens\/handbook(.*)$/, to: (m) => `/insights/lens/handbook${m[1]}` },
  { from: /^\/lens\/weakness(.*)$/, to: (m) => `/insights/lens/weakness${m[1]}` },
  { from: /^\/knowledge(.*)$/, to: (m) => `/reference/knowledge${m[1]}` },
  { from: /^\/glossary(.*)$/, to: (m) => `/reference/glossary${m[1]}` },
];
```

Schedule for removal: 6 months after Phase 3 ships, behind a calendar reminder. Do not silently keep redirects forever. If a redirect still has traffic at the 6-month mark, decide -- delete + accept the breakage, or formalize the alias.

## Content model -- `libs/help/`

Single source of truth for tooltip copy, page-explainer copy, glossary entries, and number `?` popovers.

### Typed entry map (tooltips + drawer index)

```typescript
// libs/help/src/glossary/entries.ts
export interface GlossaryEntry {
  key: string;            // 'qual', 'goal', 'plan', ...
  term: string;           // 'Qual', 'Goal', 'Plan', ...
  short: string;          // one-line definition (for tooltips)
  longRef: string;        // path to the long-form .md under content/
  related: ReadonlyArray<string>;  // other keys
}

export const GLOSSARY_ENTRIES: ReadonlyArray<GlossaryEntry> = [
  {
    key: 'qual',
    term: 'Qual',
    short: 'Qualifications -- the certificates you\'re working toward (PPL, IR, CPL, CFI).',
    longRef: 'glossary/content/qual.md',
    related: ['syllabus', 'goal'],
  },
  // ... one entry per term in the spec glossary
];
```

### Long-form markdown corpus

`libs/help/src/glossary/content/{key}.md`. Frontmatter:

```yaml
---
key: qual
term: Qual
related: [syllabus, goal]
---
```

Body is markdown -- explanation, examples, links to ADRs. Loaded lazily by the drawer / glossary page; the typed map is what the tooltip primitive uses.

### Loader API

```typescript
import { getGlossaryEntry, listGlossaryEntries } from '@ab/help/glossary';

const qual = getGlossaryEntry('qual');     // returns merged short + long
const all = listGlossaryEntries();         // for the drawer search index
```

## Tooltip primitive

```typescript
// libs/ui/src/components/Tooltip.svelte
interface TooltipProps {
  for: string;                // glossary key
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: Snippet;          // the trigger element
}
```

Behavior:

- Hover, focus, and tap-to-show all reveal the tooltip.
- Tap outside, blur, or Esc dismisses.
- `aria-describedby` on the trigger; tooltip is `role="tooltip"` with a generated id.
- Reads `short` from `getGlossaryEntry(for)`. If the key is missing, dev-mode warning + no tooltip.

## Glossary drawer

Right-cluster `?` button mounts in [libs/ui/src/components/AppHeader.svelte](../../../libs/ui/src/components/AppHeader.svelte) next to the existing Flightbag link.

```typescript
// libs/ui/src/components/GlossaryDrawer.svelte
interface DrawerState {
  open: boolean;
  query: string;
  selected: string | null;     // key of expanded entry
}
```

- Search field auto-focused on open. Filter is case-insensitive substring on `term`, `short`, and `long`.
- Click an entry to expand its long-form inline.
- Esc / overlay click / `?` re-click closes. Focus returns to the trigger.
- Source: same `listGlossaryEntries()` + lazy long-form load.

## Page explainer dismissal model

```typescript
// User pref schema (one new boolean)
interface UserPrefs {
  hidePageExplainers: boolean;   // global toggle in Settings
  // ... existing prefs
}

// Per-page dismissal -- separate table or JSON column
interface PageExplainerDismissal {
  userId: string;
  pageKey: string;       // 'home', 'program-goal', 'insights-calibration', ...
  dismissedAt: Date;
}
```

Behavior:

- Default: explainer expanded.
- User clicks collapse -> insert `PageExplainerDismissal(userId, pageKey)`. Subsequent visits to that page open with explainer collapsed.
- Per-page `?` button always visible, opens the explainer (does not delete the dismissal -- next visit still collapsed).
- Global "Hide page explainers" -> all pages default-collapsed regardless of dismissal rows.

Storage choice: if `user_pref` already exists, add the boolean column + a separate `page_explainer_dismissal` table. If neither exists yet, prefer local storage for both (single-device persistence) and migrate to DB when user prefs land. Decision deferred to the Phase 1 implementer; both shapes are valid.

## First-run gating

Per Q4 -> Option B. Soft gate: nav visible but disabled, with hover tooltips explaining how to unlock.

| Section   | Gating                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Home      | Always available. The CTA tells the user what to do.                                                  |
| Learn     | Soft-disabled until a goal exists. Tooltip on hover: "Set a goal to unlock."                         |
| Program   | Always available. This is where you set the goal.                                                     |
| Insights  | Soft-disabled until a goal exists. Tooltip: "Set a goal to unlock."                                  |
| Reference | Always available. Read-only, useful pre-goal.                                                         |

A "soft-disabled" link:

- Renders with a muted color + cursor-not-allowed.
- `aria-disabled="true"`. Click is intercepted (no navigation).
- Tooltip exposes the unlock condition.

## Page anchor convention

Every top-level route's `<h1>` (or its primary section header if the page has no `<h1>`) gets `data-testid="page-anchor"`. The flow test uses the anchor as proof that the page rendered.

A Phase 4 CI guard fails the build if any route under `apps/study/src/routes/(app)/**` ships without it. Implementation: walk the FLOW const in `ia-flow.spec.ts` and assert visibility on each step.

## E2E strategy

This section is the canonical e2e contract for the study app's IA. Carry it forward into [docs/agents/best-practices.md](../../agents/best-practices.md) under a new "E2E selectors" section so future agents do not reach for CSS class selectors.

### Pushback (kept for the record)

A single fast flow that hits every page is **not** the standard "best practice" line, which prefers small isolated tests. The standard worry: when the flow fails on page 3, you don't get clean signal on pages 4-10; the failure cascades; the report says "checkout broke" when the actual fault was a header link.

Why it's fine here, with caveats:

- The goal of this suite is **existence + 200 + key element rendered**, not deep behavior. That's exactly what flow tests are good at -- "every page is reachable and not blank."
- Playwright reports the exact step that fails, so a flow test isn't a black box. You get the line number, screenshot, trace.
- Coverage gain per minute is high. Ten focused tests with auth/seed/load each cost more in fixture setup time than they save in isolation value.

Caveats:

- Keep the flow narrow -- just navigate, assert one anchor element per page, move on. No form fills, no state mutation. A flow that reads is fine. A flow that writes will turn into a bug magnet.
- Where a page has load-bearing state (`/memory/review` after a session start, the goal-create POST), keep a dedicated focused test alongside the flow. The flow proves the door opens; the focused test proves the room works.
- The flow gets one error budget: fail on the first 4xx/5xx, do not let later steps mask earlier failures.

Net: ship the flow as the wide-coverage net; keep ~3 focused tests (auth, goal-create, session start) as the safety harness for the load-bearing transitions.

### Selector strategy

- **`data-testid`** (Playwright's `getByTestId`). Not CSS classes, not text-only, not aria roles for nav anchors. Survives copy churn and the IA reorg without rewriting tests every phase.
- All testids lowercase, kebab-case.

### Naming convention

| Pattern                            | Example                                     | Meaning                                                  |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| `data-testid="page-anchor"`        | (one per route)                              | Single sentinel on the page's `<h1>`. Flow test checks visibility. |
| `data-testid="nav-{section}"`      | `nav-home`, `nav-program`, `nav-insights`   | Top-level nav links.                                     |
| `data-testid="{section}-tab-{name}"` | `program-tab-quals`, `program-tab-goal`   | Sub-tabs / sub-anchors within a section.                 |
| `data-testid="{page}-cta-primary"` | `home-cta-primary`, `goal-detail-start-cta` | Primary CTA on a page.                                   |
| `data-testid="{page}-cta-secondary"` | `home-cta-secondary`                       | Secondary CTAs (can repeat).                             |
| `data-testid="first-run-set-goal-cta"` | (Home, no goal)                          | Specific to the first-run state on Home.                 |

Never repurpose a testid. If meaning changes, rename it.

### Files to add

| File                            | Purpose                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `tests/e2e/ia-flow.spec.ts`     | Wide-coverage flow. Walks every top-level route + every section sub-tab. Asserts page-anchor.    |
| `tests/e2e/ia-first-run.spec.ts` | Focused: brand-new user (no goal) sees only "Set your first goal" CTA.                          |
| `tests/e2e/ia-goal-to-session.spec.ts` | Focused: from a populated goal, "Start studying" reaches the session entry.                |
| `tests/e2e/ia-redirect.spec.ts` | Asserts every old path 301s to its new home (Phase 3+).                                          |

### Sketch -- `ia-flow.spec.ts`

```typescript
import { expect, test, type Page } from '@playwright/test';
import { ROUTES } from '../../libs/constants/src';

interface Stop {
  label: string;
  path: string;
  // Optional sub-anchors to verify on the same page (e.g., Program sub-tabs).
  subAnchors?: ReadonlyArray<string>;
}

const FLOW: ReadonlyArray<Stop> = [
  { label: 'home', path: ROUTES.STUDY },
  { label: 'learn-cards', path: ROUTES.MEMORY },
  { label: 'learn-cards-browse', path: ROUTES.MEMORY_BROWSE },
  { label: 'learn-cards-new', path: ROUTES.MEMORY_NEW },
  { label: 'learn-reps', path: ROUTES.REPS },
  { label: 'learn-reps-browse', path: ROUTES.REPS_BROWSE },
  { label: 'learn-read', path: ROUTES.LIBRARY },
  // Program sub-tabs share the /program route + ?tab= query.
  // Assert each tab anchor is reachable.
  { label: 'program', path: ROUTES.PROGRAM,
    subAnchors: ['program-tab-quals', 'program-tab-goal', 'program-tab-plan', 'program-tab-coverage'] },
  { label: 'insights', path: ROUTES.INSIGHTS },
  { label: 'insights-calibration', path: ROUTES.INSIGHTS_CALIBRATION },
  { label: 'insights-lens', path: ROUTES.INSIGHTS_LENS_HANDBOOK },
  { label: 'reference-knowledge', path: ROUTES.REFERENCE_KNOWLEDGE },
  { label: 'reference-glossary', path: ROUTES.REFERENCE_GLOSSARY },
];

function attachErrorTrap(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return { errors };
}

test.describe('IA flow -- existence sweep', () => {
  test('every top-level route renders without errors', async ({ page }) => {
    const { errors } = attachErrorTrap(page);
    for (const stop of FLOW) {
      const res = await page.goto(stop.path);
      expect(res?.status(), `expected 2xx for ${stop.path}`).toBeLessThan(400);
      await expect(page.getByTestId('page-anchor'), `page-anchor missing on ${stop.label}`).toBeVisible();
      for (const sub of stop.subAnchors ?? []) {
        await expect(page.getByTestId(sub), `sub-anchor ${sub} missing on ${stop.label}`).toBeVisible();
      }
    }
    expect(errors, `runtime errors during flow:\n${errors.join('\n')}`).toEqual([]);
  });
});
```

That's the entire wide-coverage net: one test, one loop, one assertion shape. Adds ~12 routes of coverage in ~5s.

### Focused tests

`ia-first-run.spec.ts`:

```typescript
test('first-run: home shows only "Set your first goal" CTA', async ({ page }) => {
  // Sign in as a user with no goal / no plan.
  await page.goto(ROUTES.STUDY);
  await expect(page.getByTestId('first-run-set-goal-cta')).toBeVisible();
  // Learn + Insights nav links are aria-disabled.
  await expect(page.getByTestId('nav-learn')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('nav-insights')).toHaveAttribute('aria-disabled', 'true');
  // Reference + Program are reachable.
  await expect(page.getByTestId('nav-reference')).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('nav-program')).not.toHaveAttribute('aria-disabled', 'true');
});
```

`ia-goal-to-session.spec.ts`:

```typescript
test('goal-detail "Start studying" reaches session entry', async ({ page }) => {
  // Abby (seeded goal + plan).
  await page.goto(ROUTES.PROGRAM_GOAL(SEEDED_GOAL_ID));
  await expect(page.getByTestId('goal-detail-start-cta')).toHaveText(/start studying/i);
  await page.getByTestId('goal-detail-start-cta').click();
  // Lands on session entry. Path varies; check the page anchor.
  await expect(page.getByTestId('page-anchor')).toBeVisible();
  expect(page.url()).toMatch(/\/session\/start|\/memory\/review/);
});
```

### Phasing of e2e expansion

| Phase   | Adds                                                                                |
| ------- | ----------------------------------------------------------------------------------- |
| Phase 1 | `ia-first-run.spec.ts`. Stub `ia-flow.spec.ts` with just `STUDY`.                    |
| Phase 2 | Expand FLOW with Program + sub-tabs. Add `ia-goal-to-session.spec.ts`.              |
| Phase 3 | Expand FLOW with Insights + Reference + their children. Add `ia-redirect.spec.ts`. |
| Phase 4 | Lock the FLOW as the canonical existence proof. CI fails if any route ships without `page-anchor`. |

### Convention to write down (best-practices.md)

Add a new "E2E selectors" section to [docs/agents/best-practices.md](../../agents/best-practices.md):

- Top-level route: `data-testid="page-anchor"` on the page's `<h1>`.
- Sub-tab / sub-section: `data-testid="{section}-tab-{name}"` on the tab / sub-anchor.
- Primary CTA: `data-testid="{page}-cta-primary"`.
- Nav: `data-testid="nav-{section}"`.
- Never repurpose a testid. If meaning changes, rename it.

## Key decisions table

One row per Q1-Q11, with chosen option + one-line rationale. The spec's "Decisions to confirm" mirrors this; this version is the implementer's reference card.

| #   | Question                                          | Chosen          | Rationale                                                                              |
| --- | ------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------- |
| Q1  | Goal vs Plan -- merge or keep separate?            | C (separate BCs, single Program UI) | Honors model. Engine signature stays clean. UI gives one mental destination. |
| Q2  | Five sections grouping                             | A (five sections) | Fits in working memory. Maps to the three audience modes.                              |
| Q3  | Hard rename, alias, or rename + redirect?         | C (rename + 301) | Clean URL space; old links keep working.                                               |
| Q4  | First-run gating                                   | B (soft gate, Learn + Insights only) | Reference + Program stay reachable; nav structure visible.                       |
| Q5  | Home framing                                       | A v1, C fast-follow | Ship the simplest thing; add the horizon rail once usage tells us what to put on it. |
| Q6  | Dropdown rule                                      | B (no dropdowns) | Five top sections leave plenty of room. Mobile-friendly.                               |
| Q7  | Section names                                      | C (Training/Progress/Reference) | Pilot word; plain; unambiguous. Falls back to A if "Training" collides with apps/firc. |
| Q8  | Glossary placement                                 | C (drawer + page) | Daily access via drawer; canonical home is the page.                                   |
| Q9  | Page explainer expiry                              | C (settings + per-page `?`) | One toggle, one re-open affordance. No magic numbers.                                  |
| Q10 | Number explainers                                  | B (tooltip + `?` popover) | Progressive disclosure; one pattern app-wide.                                          |
| Q11 | Explainer content location                         | B (`libs/help/`, typed map + markdown corpus) | Single source of truth. Existing `libs/help/` already handles markdown.        |

If Joshua flips any of these before `/ball-wp-build`, update this table first; the implementer reads it to decide what to build.
