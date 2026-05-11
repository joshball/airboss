---
title: 'wx-engine -- consumer contract for the `:::scenario` markdown directive'
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
---

# Consumer contract: the `:::scenario slug="..."` markdown directive

This WP authors the data contract; the **course-reader-and-editor** consumer
WP implements the resolver. This document is what the resolver reads.

## Scope

When a course-step body contains:

```text
:::scenario slug="frontal-xc-march"
:::
```

the consumer's markdown directive renderer mounts a **briefing pack panel**
that pulls from four files under
`data/wx-scenarios/<slug>/` and the chart-build mirror under
`data/charts/wx/wx-scenario-<slug>-<chart>/`. The wx-engine writes those
files; the consumer reads them; no API surface, no shared TypeScript, no
runtime coupling between the two libraries.

The directive is the only public touch-point. The engine library never
imports anything from the consumer, and the consumer never imports the
engine -- the contract is filesystem-backed.

## Data sources

The four files the resolver reads, one panel render:

| File                                            | Shape                  | Drives                                                        |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| `data/wx-scenarios/<slug>/truth.json`           | `TruthModel`           | Panel header narrative + scenario metadata                    |
| `data/wx-scenarios/<slug>/commentary.json`      | `CommentaryCallout[]`  | Socratic callouts beside each chart / product                 |
| `data/wx-scenarios/<slug>/products/*.json`      | Parser-shaped products | Per-product summary cards (METARs, TAFs, AIRMETs, FB, PIREPs) |
| `data/charts/wx/wx-scenario-<slug>-<chart>/...` | Chart spec + SVG       | Embedded chart renders                                        |

### `truth.json` -- panel header

The serialized `TruthModel`. The resolver pulls four fields for the header:

- `scenarioId` -- panel title
- `validAt` -- analysis-time stamp (ISO UTC)
- `primaryTimeZone` -- local-time conversion for the header
- `narrative` -- one-paragraph framing rendered above the panel grid

Every other field on `TruthModel` is engine-internal; the consumer should
treat the file as opaque beyond the four fields above. The full shape is
documented at `libs/wx-engine/src/truth/types.ts`.

### `commentary.json` -- Socratic callouts

An array of `CommentaryCallout` shapes (see
`libs/wx-engine/src/commentary/types.ts`):

```typescript
interface CommentaryCallout {
  id: string;
  target: {
    kind: 'metar' | 'taf-period' | 'chart-feature' | 'airmet' | 'pirep' | 'fb-row';
    chartSlug?: string;
    elementId?: string;
  };
  question: string;       // discovery-first prompt
  observation: string;    // the cue to look at
  reason: string;         // truth-model rationale
  knowledgeNodeIds: string[];
  mode: 'socratic' | 'glance';
}
```

Resolver responsibilities:

- Render each callout beside the chart / product its `target` field points
  to. `target.chartSlug` resolves to a `<CourseStepChart slug="..." />`
  embed; `target.elementId` is an in-chart identifier (e.g. a station ICAO
  on a METAR plot grid) the chart-feature linking can scroll to.
- Group callouts by `target.kind` so the Socratic prompts cluster with
  their referent. Within a group, preserve array order (the engine writes
  callouts in a deterministic per-product walk).
- Mount each `knowledgeNodeIds[*]` entry via the existing knowledge-node
  citation-chip pattern (the chip lib is `libs/sources` /
  `libs/library`). Every id resolves to a directory under
  `course/knowledge/weather/<id-without-wx-prefix>/`. The engine validates
  this contract before it writes `commentary.json`, so the resolver can
  treat the ids as guaranteed-resolvable.
- Respect `mode`: `socratic` renders the question prominently and the
  observation / reason / references as expandable disclosures; `glance`
  renders the observation as a one-line caption without the question
  prompt.

### `products/*.json` -- per-product summaries

The engine writes five files under `products/`:

| Filename           | Shape              | Notes                                                         |
| ------------------ | ------------------ | ------------------------------------------------------------- |
| `metars.json`      | `ParsedMetar[]`    | One per `truth.routeStations` entry                           |
| `tafs.json`        | `ParsedTaf[]`      | One per `truth.routeStations` entry                           |
| `airmets.json`     | `AirmetAdvisory[]` | Engine-internal shape (no parser); count matches hazard zones |
| `fb-bulletin.json` | `ParsedFbGrid`     | Single object; covers every `truth.fbStations` entry          |
| `pireps.json`      | `ParsedPirep[]`    | Sampled from hazard zone centroids + convective cells         |

Resolver responsibilities:

- The `*.txt` companion files (e.g. `metars.txt`) carry the raw emitted
  product strings. The resolver can read either: the `.json` carries the
  parsed shape for tabular rendering, the `.txt` carries the canonical
  string for "raw" tabs.
- The product types are re-exported by `@ab/wx-charts` (the parsers'
  output shape). The consumer takes a `type`-only dependency on
  `@ab/wx-charts` for the shapes; no runtime coupling.

### Chart embeds

The engine writes chart specs to two locations:

```text
data/wx-scenarios/<slug>/charts/<chart-slug>/spec.yaml + sources/*.json
data/charts/wx/<chart-slug>/spec.yaml                                 <-- mirror
```

where `<chart-slug>` follows the convention `wx-scenario-<scenario>-<chart>`.
Example slugs for `frontal-xc-march`:

```text
wx-scenario-frontal-xc-march-surface-analysis
wx-scenario-frontal-xc-march-prog-12hr
wx-scenario-frontal-xc-march-metar-plot
wx-scenario-frontal-xc-march-taf-kstl
wx-scenario-frontal-xc-march-taf-kord
wx-scenario-frontal-xc-march-airmet-sigmet
wx-scenario-frontal-xc-march-gfa
wx-scenario-frontal-xc-march-convective-outlook
wx-scenario-frontal-xc-march-cva
wx-scenario-frontal-xc-march-freezing-level
wx-scenario-frontal-xc-march-g-airmet-icing
wx-scenario-frontal-xc-march-g-airmet-turbulence
wx-scenario-frontal-xc-march-winds-aloft
wx-scenario-frontal-xc-march-pirep-plot
```

The chart-build CLI (`bun run charts build <slug>`) renders the SVG +
`meta.json` at the mirror location. The consumer mounts each chart via the
existing `<CourseStepChart slug="..." />` component, which already knows
how to look up `data/charts/wx/<slug>/chart.svg`.

The directive resolver does **not** need a chart slug allow-list. The set
is enumerable from `data/wx-scenarios/<slug>/charts/`:

```typescript
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function chartSlugsFor(scenario: string): string[] {
  const dir = resolve('data', 'wx-scenarios', scenario, 'charts');
  return readdirSync(dir).filter((s) => s.startsWith(`wx-scenario-${scenario}-`));
}
```

## Resolver shape (illustrative)

The consumer-WP implementer would write something like the following inside
the markdown directive renderer. The shape is illustrative; the consumer
chooses its own props / component split.

```typescript
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

interface ScenarioDirectiveData {
  truth: {
    scenarioId: string;
    validAt: string;
    primaryTimeZone: string;
    narrative: string;
  };
  commentary: CommentaryCallout[];
  metars: ParsedMetar[];
  tafs: ParsedTaf[];
  airmets: AirmetAdvisory[];
  fbGrid: ParsedFbGrid | null;
  pireps: ParsedPirep[];
  chartSlugs: string[];
}

function loadScenarioDirective(scenarioSlug: string, repoRoot: string): ScenarioDirectiveData {
  const base = resolve(repoRoot, 'data', 'wx-scenarios', scenarioSlug);
  const truth = JSON.parse(readFileSync(resolve(base, 'truth.json'), 'utf8'));
  const commentary = JSON.parse(readFileSync(resolve(base, 'commentary.json'), 'utf8'));
  const metars = JSON.parse(readFileSync(resolve(base, 'products', 'metars.json'), 'utf8'));
  const tafs = JSON.parse(readFileSync(resolve(base, 'products', 'tafs.json'), 'utf8'));
  const airmets = JSON.parse(readFileSync(resolve(base, 'products', 'airmets.json'), 'utf8'));
  const pireps = JSON.parse(readFileSync(resolve(base, 'products', 'pireps.json'), 'utf8'));
  const fbPath = resolve(base, 'products', 'fb-bulletin.json');
  const fbGrid = JSON.parse(readFileSync(fbPath, 'utf8'));
  const chartSlugs = readdirSync(resolve(base, 'charts'));
  return {
    truth: {
      scenarioId: truth.scenarioId,
      validAt: truth.validAt,
      primaryTimeZone: truth.primaryTimeZone,
      narrative: truth.narrative,
    },
    commentary,
    metars,
    tafs,
    airmets,
    fbGrid,
    pireps,
    chartSlugs,
  };
}
```

The data lives on the filesystem at fixed paths; the resolver loads it at
render time (or at build time if the consumer pre-bakes the directive into
the course step HTML). Either approach is supported by the contract; the
files are immutable between `bun run wx-scenario build <slug>` invocations.

## Lifecycle guarantees

1. **`bun run wx-scenario build <slug>`** is deterministic. Re-running
   produces byte-identical files when the scenario literal and the engine
   library are unchanged.
2. **`bun run check`** (the `wx-scenario-round-trip` step) walks every
   scenario in-memory on every commit and fails the pipeline if any product
   fails round-trip, any consistency invariant breaks, or any knowledge-node
   id fails to resolve. The consumer can rely on the on-disk files being
   internally consistent: a `commentary.json` callout whose `target.chartSlug`
   points to `wx-scenario-<slug>-foo` is guaranteed to have a matching
   chart artifact in the bundle, and every `knowledgeNodeIds[*]` is
   guaranteed to resolve.
3. **Chart slugs are stable**. Slug shape is
   `wx-scenario-<scenarioId>-<chartId>`; the chart-id half is fixed by the
   engine's per-chart derivation (e.g., `surface-analysis`, `prog-12hr`,
   `metar-plot`). New chart kinds appear with new chart-ids; existing slugs
   never rename.
4. **Knowledge-node ids are corpus-stable**. When a knowledge node renames
   under `course/knowledge/weather/`, the round-trip check fails loud; the
   fix is a one-pass sed in the commentary derivation file before the next
   build. The consumer never sees an unresolved id.

## Example course-step usage

A minimal course-step body referencing this scenario:

```text
Pull up the surface analysis. A cold front is sweeping east through
the route from KSTL to KORD, with the warm sector ahead and post-frontal
cP behind. Read the chart before reading the products -- where is the
front, where are the airmasses, where are the gradients tight?

:::scenario slug="frontal-xc-march"
:::

What did the products confirm that the chart already told you? What
surprised you?
```

The course-step example landing in this WP at
`course/courses/weather-comprehensive/sections/s2-airmasses-fronts-stability.yaml`
demonstrates the directive in context. Until the consumer renderer ships,
the directive is rendered verbatim (a no-op text block). The example
documents intent and serves as the regression target for the future
consumer-WP.

## Follow-on

The consumer renderer is a follow-on landing in the
course-reader-and-editor consumer WP. The renderer:

- Parses `:::scenario slug="..."` from the markdown body
- Calls `loadScenarioDirective(slug, repoRoot)` at build or render time
- Mounts a `<ScenarioBriefingPanel>` component carrying the four data
  sources

Nothing about this WP needs to change when the consumer ships; the data
contract is forward-compatible.
