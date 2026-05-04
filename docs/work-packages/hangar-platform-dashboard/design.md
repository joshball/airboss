---
title: Hangar Platform Dashboard -- Design
product: hangar
feature: hangar-platform-dashboard
type: design
status: ready-for-review
review_status: pending
---

# Hangar Platform Dashboard -- Design

UI shapes, data flows, and skill internals. Read [spec.md](./spec.md) first.

## Information architecture

```text
hangar
├── /docs                          (from hangar-review-queue)
├── /review                        (from hangar-review-queue)
└── /platform                      <-- this WP
    ├── /platform                  Main dashboard (all panes)
    ├── /platform/wp               WP status board (full table)
    ├── /platform/roadmap          Roadmap pane (full)
    ├── /platform/adr              ADR index (full)
    ├── /platform/coverage         Coverage scan results
    └── /platform/drift            Drift detail (full triage)
```

Sidebar nav gets a third top-level entry: **Platform** alongside Docs and Review.

## Dashboard layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Platform Dashboard         [App: All ▼] [Status: All ▼] [Search]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ NOW BAR ──────────────────────────────────────────────────────┐  │
│  │  In flight (3)        Just shipped (8 last 60d)   Refresh: ... │  │
│  │  • hangar-review-queue   • rename-generic-content-files (#490) │  │
│  │  • hangar-platform-dash  • wp-cfr (#491)                       │  │
│  │  • evidence-kind-data    • ...                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ DRIFT (3) ─────────┐  ┌─ DOC HEALTH (1) ───────────────────────┐ │
│  │ • evidence-... [Fix]│  │ NOW.md  542 lines  [Suggested: archive]│ │
│  │ • cert-syll... [Tri]│  │                                        │ │
│  └─────────────────────┘  └────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ WP STATUS BOARD ──────────────────────────────────────────────┐  │
│  │  [Active] [Shipped] [Drafts] [In NOW.md]                       │  │
│  │  Name                  Product   Status    Review   Last       │  │
│  │  hangar-review-queue   hangar    ready-r.. pending  2026-05-03 │  │
│  │  hangar-platform-...   hangar    ready-r.. pending  2026-05-03 │  │
│  │  ...                                                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ ROADMAP ──────────────────────────────────────────────────────┐  │
│  │  [Per-app columns] [Timeline (soon)]                           │  │
│  │  ┌─Study──────┐ ┌─Sim───────┐ ┌─Hangar─────┐ ┌─Runway─────┐   │  │
│  │  │ ▣ Wave 1   │ │ ▢ Wave 1  │ │ ▣ Wave 1   │ │ ▢ Wave 1   │   │  │
│  │  │ ▣ Wave 2   │ │ ▢ Wave 2  │ │ ▣ Wave 2   │ │            │   │  │
│  │  │ ▤ Wave 3   │ │           │ │ ▤ Wave 3   │ │            │   │  │
│  │  │ ▢ Wave 4   │ │           │ │ ▤ Wave 4   │ │            │   │  │
│  │  └────────────┘ └───────────┘ └────────────┘ └────────────┘   │  │
│  │   ▣ shipped  ▤ in_flight  ▢ planned  ✗ blocked                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ ADR INDEX ────────────────────┐  ┌─ IDEAS FUNNEL ──────────────┐ │
│  │ 011 Knowledge graph    accept. │  │ Technical Approaches  12    │ │
│  │ 014 Engine scoring     accept. │  │  reviewed 2026-04-30 (3d)   │ │
│  │ 016 Cert syllabus      accept. │  │ Product Ideas         18    │ │
│  │ ...                            │  │  reviewed 2026-04-30 (3d)   │ │
│  └────────────────────────────────┘  └─────────────────────────────┘ │
│                                                                      │
│  ┌─ COVERAGE GAPS ────────────────────────────────────────────────┐  │
│  │  Last run: never           [Run scan]                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ RECENT ACTIVITY ──────────────────────────────────────────────┐  │
│  │  a652cab1  fix(seed): run references YAML phase before ...     │  │
│  │  b3fde750  chore(test-lint): add no-toBeTruthy-on-existence    │  │
│  │  ...                                                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Pane components

Each pane is a Svelte component with a single prop (the typed data shape). The `/platform` page composes them.

| Component               | Lib path                            | Notes                                              |
| ----------------------- | ----------------------------------- | -------------------------------------------------- |
| `NowBar.svelte`         | `libs/ui/src/platform/`             | In-flight + just-shipped lists                     |
| `DriftPane.svelte`      | `libs/ui/src/platform/`             | List of drift items + fix/triage actions           |
| `DocHealthPane.svelte`  | `libs/ui/src/platform/`             | List of size violators + split suggestions         |
| `WpStatusBoard.svelte`  | `libs/ui/src/platform/`             | Sortable, filterable table                         |
| `RoadmapPanes.svelte`   | `libs/ui/src/platform/`             | Per-app columns + timeline toggle stub             |
| `AdrIndex.svelte`       | `libs/ui/src/platform/`             | Sortable table                                     |
| `IdeasFunnel.svelte`    | `libs/ui/src/platform/`             | Section list + counts + freshness                  |
| `CoverageGaps.svelte`   | `libs/ui/src/platform/`             | Button + results region                            |
| `RecentActivity.svelte` | `libs/ui/src/platform/`             | Commit list                                        |

Each component imports only from `@ab/types` for its prop shape and `@ab/themes` for tokens. No direct DB imports.

## BC primitives

`libs/bc/hangar/src/platform.ts`:

- `getPlatformDashboard()` -> aggregates everything; calls the per-pane functions below
- `getNowBarData()` -> reads NOW.md frontmatter
- `getWpStatusList(filters)` -> reads `review_item` rows where `kind = 'wp_spec'`
- `getRoadmapData(app?)` -> reads ROADMAP frontmatter per app
- `getAdrIndex()` -> reads ADR frontmatter
- `getIdeasFunnelData()` -> reads IDEAS.md frontmatter + per-section counts
- `getCoverageScanResult()` -> reads cached scan result; null if never run
- `runCoverageScan()` -> spawns the coverage check, persists the result
- `getRecentActivity(limit)` -> shells out to `git log` (read-only)
- `getDriftSummary()` -> reads `.claude/skills-state/wp-drift/last-run.json`
- `getDocHealthSummary()` -> reads same checkpoint's `size_violations`

All read-only. No writes from the dashboard except `runCoverageScan`.

## Constants

```typescript
// libs/constants/src/platform.ts
export const ROADMAP_ITEM_STATUSES = ['shipped', 'in_flight', 'planned', 'blocked', 'dropped'] as const;
export type RoadmapItemStatus = (typeof ROADMAP_ITEM_STATUSES)[number];

export const ADR_STATUSES = ['proposed', 'accepted', 'superseded', 'deprecated'] as const;
export type AdrStatus = (typeof ADR_STATUSES)[number];

export const DOC_SIZE_HARD_LIMIT = 500;
export const DOC_SIZE_WARN_THRESHOLD = 400;

export const NOW_MD_ARCHIVE_AGE_DAYS = 60;
export const IDEAS_REVIEW_STALE_DAYS = 14;

export const PLATFORM_APPS = ['study', 'sim', 'hangar', 'runway', 'flightbag', 'avionics'] as const;
export type PlatformApp = (typeof PLATFORM_APPS)[number];
```

```typescript
// libs/constants/src/routes.ts (additions)
PLATFORM: '/platform',
PLATFORM_WP: '/platform/wp',
PLATFORM_ROADMAP: '/platform/roadmap',
PLATFORM_ADR: '/platform/adr',
PLATFORM_COVERAGE: '/platform/coverage',
PLATFORM_DRIFT: '/platform/drift',
```

## /wp-drift skill internals

### File layout

```text
~/src/_me/ai/agent-skills/skills/wp-drift/
├── SKILL.md              <- meta + invocation
├── lib/
│   ├── checkpoint.ts     <- load/save/migrate the checkpoint
│   ├── fingerprint.ts    <- SHA256 of file content
│   ├── scan.ts           <- the sources to scan + parsers
│   ├── validate.ts       <- per-source validators
│   ├── autofix.ts        <- safe-fix implementations
│   └── triage.ts         <- print human-judgement list
└── tests/
    └── fixtures/
```

### Run flow

```text
                  ┌─────────────┐
                  │ load        │
                  │ checkpoint  │
                  └──────┬──────┘
                         │
                         v
                  ┌─────────────┐    no
                  │ exists?     │────────> create empty checkpoint
                  └──────┬──────┘
                    yes  │
                         v
                  ┌─────────────┐
                  │ enumerate   │
                  │ sources     │  WPs, NOW.md, ROADMAPs, ADRs, IDEAS.md
                  └──────┬──────┘
                         │
                         v
                  ┌─────────────┐    fingerprint  ┌──────────┐
                  │ for each:   │───── matches ──>│ skip     │
                  │ fingerprint │      checkpoint │          │
                  └──────┬──────┘                 └──────────┘
                         │ fingerprint differs / not in checkpoint
                         v
                  ┌─────────────┐
                  │ validate    │
                  └──────┬──────┘
                         │
                         v
                  ┌─────────────┐    auto-fixable
                  │ classify    │──── + --fix ──> apply fix, mark validated
                  └──────┬──────┘
                         │ unsafe / no --fix
                         v
                  ┌─────────────┐
                  │ append to   │
                  │ drift list  │
                  └──────┬──────┘
                         │
                         v
                  ┌─────────────┐
                  │ save        │
                  │ checkpoint  │
                  │ + report    │
                  └─────────────┘
```

### Validators (one per source)

| Validator           | Checks                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `validateWpFrontmatter` | spec.md has `status`, `review_status`; status value is in known set                      |
| `validateNowMdSync`     | every WP `status: shipped` appears in `just_shipped` (within 60 days); every `in_flight:` entry has a real WP folder; no in_flight item is also in just_shipped; no in_flight item has `status: shipped` in its WP frontmatter |
| `validateRoadmapSync`   | every roadmap item with `wp:` and `status: shipped` has matching WP `status: shipped`; every shipped item has `shipped_at`; no `wp:` referencing a missing folder |
| `validateAdrFrontmatter` | has `adr`, `title`, `status`; status in known set; if `superseded` then `superseded_by` is set |
| `validateIdeasFreshness` | section `last_reviewed` exists; flag if older than 30 days                              |
| `validateDocSize`       | file lines <= 500; warn at 400                                                            |

Each validator returns `{ ok: true } | { ok: false, issue: string, autoFixable: boolean }`.

### Auto-fix implementations

```typescript
// pseudo
const autoFixers: Record<DriftKind, AutoFixer> = {
  'wp-shipped-missing-from-now-md': async (item) => {
    const pr = await findRecentPrForWp(item.id);
    await addToNowMdJustShipped({ wp: item.id, pr, date: today() });
  },
  'wp-in-flight-but-shipped': async (item) => {
    await removeFromNowMdInFlight(item.id);
  },
  'roadmap-item-shipped-wp-not-marked': async (item) => {
    await setRoadmapItemStatus(item.app, item.title, 'shipped', shippedAt);
  },
  // ...
};
```

Each auto-fixer is a small function that touches one file. On error, leaves state unchanged and adds to the triage list with the error message.

### Output format

```text
$ /wp-drift

Scanning 89 WPs, 4 ROADMAPs, 18 ADRs, 1 IDEAS.md, 1 NOW.md
Skipped 87 WPs (fingerprint unchanged)
Validated 2 WPs, 1 ROADMAP, 0 ADRs, 0 IDEAS, 1 NOW.md (5 files re-checked)

Auto-fixable drift: 2 items
  - wp/evidence-kind-data-layer: spec status=read but NOW.md not updated
  - roadmap/hangar:Wave 2 -- sources v1: wp shipped but item status=in_flight

Triage: 1 item (needs human judgement)
  - adr/007: missing status: field; body says "Status: superseded by 011" -- confirm

Doc size violations: 1 file
  - docs/work/NOW.md: 542 lines (suggested: archive entries older than 60d)

Run /wp-drift --fix to apply auto-fixes.
Run /wp-drift --triage for triage detail.
```

## Coverage scan

Backend: a `coverage.ts` BC function that walks:

- `apps/{app}/src/routes/**/+page.svelte` -> derive feature name from path
- For each feature, look for matching `docs/work-packages/{...}/spec.md` or `docs/products/{app}/features/{...}/`
- Output: `{ uncovered: [{ feature, app, suggestion }], covered: [...] }`

V1 implementation = a script that emits JSON; the BC function shells out and parses. V2 could be a pure TS implementation. Either way the dashboard pane consumes the JSON.

The result persists in `hangar.coverage_scan_result` (single row, last-run-wins): `{ runAt, summary, uncoveredJson }`.

## Schema

```typescript
// libs/bc/hangar/src/schema.ts (additions)
export const coverageScanResult = hangarSchema.table('coverage_scan_result', {
  id: text('id').primaryKey().default(sql`'singleton'`),
  runAt: timestamp('run_at', { withTimezone: true }).notNull(),
  summary: jsonb('summary').notNull(),
  uncovered: jsonb('uncovered').notNull(),
});
```

Singleton table -- one row, overwritten each run.

## Theming

Reuse existing tokens. Status colors:

- `--status-shipped` -- semantic success
- `--status-in-flight` -- semantic accent
- `--status-planned` -- semantic neutral
- `--status-blocked` -- semantic danger
- `--status-dropped` -- semantic muted

Drift severity:

- `--drift-auto-fixable` -- accent (gentle)
- `--drift-needs-triage` -- warning

Add to `libs/themes` if not present. No hex literals in components.

## Filters and global state

The top filter bar (App / Status / Search) updates a `$state` object that each pane reacts to via `$derived`. No round-trip to server per filter change. URL state for deep-linking: `/platform?app=hangar&status=active`.

## Loader extensions

Extend [hangar-review-queue's loader](../hangar-review-queue/spec.md#discovery--loader) with three new discovery rules:

```typescript
const NEW_RULES = {
  roadmap_item: {
    glob: 'docs/products/*/ROADMAP.md',
    extract: (file) => parseFrontmatter(file).items.map(item => ({
      kind: 'roadmap_item',
      ref: `${file}#${item.title}`,
      title: item.title,
      cachedStatus: { roadmapStatus: item.status, wp: item.wp, app: parseAppFromPath(file) },
    })),
  },
  adr: {
    glob: 'docs/decisions/*.md|docs/decisions/*/decision.md',
    extract: (file) => {
      const fm = parseFrontmatter(file);
      return [{ kind: 'adr', ref: file, title: fm.title, cachedStatus: { adrStatus: fm.status } }];
    },
  },
  // ideas funnel doesn't need item-level rows; the BC reads sections directly
};
```

These items appear in `review_item` and can be reviewed via the review-queue surface (an ADR review is a real action). The dashboard reads them for the index panes.

## Open questions

- **PR detection for auto-fixer.** Finding "the PR that shipped this WP" requires either a convention (PR title contains WP slug) or scanning recent commits for the WP folder. Initial implementation: scan `git log --oneline --since="60 days" -- docs/work-packages/{wp}/` and grep PR numbers. If ambiguous, leave PR field null and let the human fill it.
- **Multi-WP sequenced shipping.** A wave-shipped feature like "library-completeness sequence steps 1-12" is many WPs; NOW.md tracks them individually but ROADMAP might track them as one item. Linking 1 ROADMAP item to N WPs needs an array `wps: [...]` instead of `wp: ...`. **Decision:** support both; `wp:` is sugar for `wps: [wp]`. Validators handle both shapes.
