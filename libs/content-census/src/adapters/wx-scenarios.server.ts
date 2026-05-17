// @browser-globals: server-only -- never imported by client .svelte
/**
 * The wx-scenarios census adapter -- a Phase-2 Layer-1 derived-state adapter.
 *
 * Inventories every authored wx-engine truth-model scenario and derives its
 * `contributing` / `dormant` state from the `scenario-matches.json` coverage
 * map: a scenario is contributing when it reproduced at least one catalog
 * example, dormant when its coverage list is empty.
 *
 * Layer 1 only -- the gap view, intent view, and next-list are deferred to
 * Phase 3. They are returned empty (no fabricated gaps); the Phase-3 task
 * pointer is carried in `docs` so the placeholder is honest and labelled.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES, WX_SCENARIO_LABELS, WX_SCENARIO_VALUES } from '@ab/constants';
import type { CensusGap, CensusItem, CensusMetric, CensusNextItem, CorpusCensus, DocLink } from '../types';
import { repoRoot } from './repo-root.server';

/** The on-disk `scenario-matches.json` shape (the slice this adapter reads). */
interface ScenarioMatches {
	generatedAt: string;
	/** Keyed by scenario id -> the catalog example slugs it reproduced. */
	coverage: Record<string, string[]>;
}

const SCENARIO_DIR = 'libs/wx-engine/src/truth/scenarios';
const MATCH_MANIFEST = 'course/knowledge/weather/encoded-text-catalog/scenario-matches.json';
const CENSUS_WP_TASKS = 'docs/work-packages/hangar-content-census/tasks.md';

/** Read + parse the scenario-match manifest, tolerating an absent file. */
function readCoverage(): Record<string, string[]> {
	const path = join(repoRoot(), MATCH_MANIFEST);
	if (!existsSync(path)) return {};
	const parsed = JSON.parse(readFileSync(path, 'utf8')) as ScenarioMatches;
	return parsed.coverage ?? {};
}

/** The governing documents for the wx-engine scenario corpus. */
const WX_SCENARIOS_DOCS: DocLink[] = [
	{
		label: 'wx-engine work package',
		href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
		role: 'The truth-aware generator. Scenarios are its authored input -- one truth model per scenario.',
	},
	{
		label: 'Weather scenario engine -- design',
		href: ROUTES.HANGAR_DOCS_PATH('docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md'),
		role: 'Defines the truth-model schema every scenario literal must validate against.',
	},
	{
		label: 'scenario-matches.json -- the coverage manifest',
		href: ROUTES.HANGAR_DOCS_PATH(MATCH_MANIFEST),
		role: 'Maps each scenario to the catalog examples it reproduced -- the source of the contributing / dormant state.',
	},
	{
		label: 'Content census -- Phase 3 tasks (gap view + intent)',
		href: ROUTES.HANGAR_DOCS_PATH(CENSUS_WP_TASKS),
		role: 'Tracks the Layer-2 intent block and the gap / next-list views still to be authored for this corpus.',
	},
];

/**
 * Build the wx-scenarios census. Reads `scenario-matches.json`; derives a
 * contributing / dormant state per scenario from its coverage list.
 */
export function wxScenariosCensus(): CorpusCensus {
	const coverage = readCoverage();

	const items: CensusItem[] = WX_SCENARIO_VALUES.map((id) => {
		const contributedExamples = coverage[id] ?? [];
		const isContributing = contributedExamples.length > 0;
		return {
			id,
			label: WX_SCENARIO_LABELS[id],
			derivedState: isContributing ? 'contributing' : 'dormant',
			detail: isContributing
				? `Reproduces ${contributedExamples.length} catalog example${contributedExamples.length === 1 ? '' : 's'}.`
				: 'Reproduces no catalog example -- no drill or reference currently draws on it.',
			href: ROUTES.CONTENT_CENSUS_CORPUS('wx-catalog'),
		};
	});

	const scenarioCount = items.length;
	const contributingCount = items.filter((item) => item.derivedState === 'contributing').length;
	const dormantCount = scenarioCount - contributingCount;
	const totalExamplesReproduced = Object.values(coverage).reduce((sum, list) => sum + list.length, 0);

	const metrics: CensusMetric[] = [
		{
			key: 'scenarios',
			label: 'Authored scenarios',
			value: scenarioCount,
			whatItMeasures:
				'The number of hand-authored truth-model scenarios in the wx-engine -- each is a synoptic situation (a frontal passage, mountain wave, marine stratus) with internally consistent stations, fronts, and hazard polygons.',
			whyItMatters:
				'Scenarios are the wx-engine’s entire input surface. The generator can only produce weather products for a synoptic situation a scenario has captured; the count is the ceiling on situational variety the truth-aware drill can offer.',
			whatToDo: {
				text: 'Add a scenario by dropping one validated truth-model literal under the scenario directory and registering it -- see the wx-engine work package.',
				href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			},
		},
		{
			key: 'contributing-scenarios',
			label: 'Contributing scenarios',
			value: `${contributingCount} / ${scenarioCount}`,
			whatItMeasures:
				'How many scenarios reproduced at least one encoded-text catalog example. A contributing scenario reaches a learner; a dormant one is authored work that no surface currently draws on.',
			whyItMatters:
				dormantCount === 0
					? 'Every authored scenario is reaching a learner-facing surface -- no authoring effort is currently stranded.'
					: `${dormantCount} scenario${dormantCount === 1 ? '' : 's'} contribute${dormantCount === 1 ? 's' : ''} nothing to the catalog. The truth model exists and validates, but no generated drill or catalog reference is built against it, so the authoring effort is invisible to every learner.`,
			whatToDo: {
				text: 'Author catalog products (METAR / TAF / PIREP sequences) against each dormant scenario so the engine can round-trip and match them.',
				href: ROUTES.HANGAR_DOCS_PATH('course/knowledge/weather/encoded-text-catalog/README.md'),
			},
		},
		{
			key: 'examples-reproduced',
			label: 'Catalog examples reproduced',
			value: totalExamplesReproduced,
			whatItMeasures:
				'The total count of distinct encoded-text catalog examples the scenario set reproduces, summed across every scenario. It is the catalog footprint of the entire scenario corpus.',
			whyItMatters:
				'Each reproduced example is one shape a learner can drill with infinite generated variation rather than a single static card. A small footprint means the truth-aware drill has a narrow reproducible core regardless of how many scenarios exist.',
			whatToDo: {
				text: 'Grow the footprint by authoring more catalog products per scenario, or by adding scenarios that exercise under-covered token families -- see the encoded-text catalog drill-down.',
				href: ROUTES.CONTENT_CENSUS_CORPUS('wx-catalog'),
			},
		},
	];

	// Layer 1 only. The gap view, intent view, and next-list are deferred to
	// Phase 3 -- returned empty (no fabricated gaps); the Phase-3 task pointer
	// is carried in `docs` so the placeholder is honest and labelled.
	const gaps: CensusGap[] = [];
	const next: CensusNextItem[] = [];

	return {
		id: 'wx-scenarios',
		label: 'wx-engine scenarios',
		whatItIs:
			'The set of hand-authored truth-model scenarios that drive the wx-engine -- each one a synoptic weather situation with mutually consistent stations, fronts, air masses, and hazard polygons.',
		whyItExists:
			'The truth-aware generator authors weather products (METARs, TAFs, PIREPs, charts) and their Socratic commentary from a known truth state. A scenario IS that truth state; without scenarios the generator has nothing to render.',
		location: `${SCENARIO_DIR}/`,
		mode: 'full',
		stateRule:
			'A scenario is "contributing" when scenario-matches.json records at least one catalog example it reproduced; otherwise "dormant" -- the truth model is authored and validates, but no catalog reference or generated drill is built against it.',
		docs: WX_SCENARIOS_DOCS,
		items,
		metrics,
		gaps,
		next,
	};
}
