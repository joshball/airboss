// @browser-globals: server-only -- never imported by client .svelte
/**
 * The sim-content census adapter -- a Phase-2 Layer-1 derived-state adapter.
 *
 * Inventories every sim scenario the constants enumerate
 * (`SIM_SCENARIO_ID_VALUES`) and derives a `graded` / `playground` state:
 *
 *   derived-state rule
 *   ------------------
 *   `graded`     -- the scenario appears in `SIM_SCENARIO_NODE_MAPPINGS`,
 *                   meaning it has authored grading criteria and is linked
 *                   to the knowledge nodes it exercises. A graded scenario
 *                   feeds the spaced-rep scheduler and the debrief.
 *   `playground` -- a free-flight scenario with no grading and no node
 *                   linkage. Useful for exploration, invisible to the
 *                   scheduler.
 *
 * This is the spec's "scenario / model count" question answered with a fact
 * computable today: a scenario that does pedagogical work is one wired into
 * the node mapping; the count of those vs free-flight playgrounds is the
 * real signal.
 *
 * It also reports the FDM aircraft-model count as a metric, since the spec
 * scopes the corpus as "sim scenarios / models".
 *
 * Gap view / intent view are Phase-3 placeholders (`census` mode):
 * the `layerTwoPending` block carries the labelled message, `gaps` and
 * `next` stay genuinely empty.
 *
 * Server-only by convention with its sibling adapters: it is wired through
 * the `/server` barrel and never imported by a `.svelte` file.
 */

import { ROUTES, SIM_AIRCRAFT_IDS, SIM_SCENARIO_ID_VALUES, SIM_SCENARIO_NODE_MAPPINGS } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';

const SIM_BC_DIR = 'libs/bc/sim';

/** The set of scenario ids that carry a node mapping -- the graded scenarios. */
const GRADED_SCENARIO_IDS = new Set<string>(Object.keys(SIM_SCENARIO_NODE_MAPPINGS));

/** Turn a scenario id slug into a human label ("efato" -> "Efato"). */
function scenarioLabel(id: string): string {
	return id
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

/** The governing documents for the sim-content corpus. */
const SIM_CONTENT_DOCS: DocLink[] = [
	{
		label: 'Sim card-mapping -- design',
		href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/sim-card-mapping/design.md'),
		role: 'Defines the scenario-to-knowledge-node mapping that makes a sim scenario feed the spaced-rep scheduler.',
	},
	{
		label: 'Engine + scenario patterns reference',
		href: ROUTES.HANGAR_DOCS_PATH('docs/agents/reference-engine-patterns.md'),
		role: 'Documents the sim tick loop, scenario definition shape, grading, and replay.',
	},
];

/**
 * Build the sim-content census. Inventories every sim scenario; derives a
 * graded / playground state from membership in SIM_SCENARIO_NODE_MAPPINGS.
 */
export function simContentCensus(): CorpusCensus {
	const items: CensusItem[] = SIM_SCENARIO_ID_VALUES.map((id) => {
		const isGraded = GRADED_SCENARIO_IDS.has(id);
		const nodeLinks = isGraded ? SIM_SCENARIO_NODE_MAPPINGS[id as keyof typeof SIM_SCENARIO_NODE_MAPPINGS] : [];
		return {
			id,
			label: scenarioLabel(id),
			derivedState: isGraded ? 'graded' : 'playground',
			detail: isGraded
				? `Graded; exercises ${nodeLinks.length} knowledge node${nodeLinks.length === 1 ? '' : 's'} and feeds the spaced-rep scheduler.`
				: 'Free-flight playground -- no grading, no node linkage, invisible to the scheduler.',
		};
	});

	const scenarioCount = items.length;
	const gradedCount = items.filter((item) => item.derivedState === 'graded').length;
	const playgroundCount = scenarioCount - gradedCount;
	const aircraftModelCount = Object.keys(SIM_AIRCRAFT_IDS).length;
	const totalNodeLinks = Object.values(SIM_SCENARIO_NODE_MAPPINGS).reduce((sum, links) => sum + links.length, 0);

	const metrics: CensusMetric[] = [
		{
			key: 'sim-scenarios',
			label: 'Sim scenarios',
			value: scenarioCount,
			whatItMeasures:
				'The number of decision-rep micro-scenarios the sim defines -- engine failure after takeoff, partial panel, crosswind landing, the unusual-attitude recoveries, and the rest.',
			whyItMatters:
				'Sim scenarios are the platform’s motor-skill and decision-rep surface. Each one is a rehearsable situation; the count is the breadth of in-cockpit moments a learner can practise before meeting them for real.',
			whatToDo: {
				text: 'Add a scenario by authoring a ScenarioDefinition literal and registering it -- see the engine + scenario patterns reference.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/agents/reference-engine-patterns.md'),
			},
		},
		{
			key: 'graded-scenarios',
			label: 'Graded scenarios',
			value: `${gradedCount} / ${scenarioCount}`,
			whatItMeasures:
				'How many sim scenarios are graded -- they have scoring criteria and are mapped to the knowledge nodes they exercise. A "playground" scenario is free flight with no grading and no node linkage.',
			whyItMatters:
				playgroundCount === 0
					? 'Every sim scenario is graded and node-linked -- each one feeds the spaced-rep scheduler and produces a scored debrief.'
					: `${playgroundCount} scenario${playgroundCount === 1 ? ' is' : 's are'} a free-flight playground. A playground is useful for exploration but produces no score and no node linkage, so the scheduler cannot use it to drive review or measure proficiency.`,
			whatToDo: {
				text: 'A playground graduates to graded by authoring its grading definition and a SIM_SCENARIO_NODE_MAPPINGS row -- see the sim card-mapping design.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/sim-card-mapping/design.md'),
			},
		},
		{
			key: 'scenario-node-links',
			label: 'Scenario-to-node links',
			value: totalNodeLinks,
			whatItMeasures:
				'The total count of authored edges from graded sim scenarios to the knowledge nodes they exercise, summed across every scenario. Each edge carries a weight in (0, 1].',
			whyItMatters:
				'These edges are how a sim run feeds the spaced-rep scheduler: completing a scenario lifts the linked nodes. A scenario with few links influences little of the learner’s study schedule.',
			whatToDo: {
				text: 'Enrich the mapping by authoring additional node links per scenario where the run genuinely exercises a concept; the rationale per row is in the sim card-mapping design.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/work-packages/sim-card-mapping/design.md'),
			},
		},
		{
			key: 'aircraft-models',
			label: 'FDM aircraft models',
			value: aircraftModelCount,
			whatItMeasures:
				'The number of flight-dynamics-model aircraft profiles the sim defines -- the airframes (a Cessna 172, a Piper PA-28) whose physics the scenarios fly.',
			whyItMatters:
				'Every scenario flies one FDM aircraft. The model set bounds the airframe variety a learner can train across; a scenario can only be authored for an aircraft the FDM models.',
			whatToDo: {
				text: 'Add an aircraft by authoring an FDM config under libs/bc/sim/src/fdm and registering it in the aircraft registry.',
				href: ROUTES.HANGAR_DOCS_PATH(`${SIM_BC_DIR}/src/fdm/`),
			},
		},
	];

	return {
		id: 'sim-content',
		label: 'Sim scenarios / models',
		whatItIs:
			'The sim’s authored content -- decision-rep micro-scenarios (EFATO, partial panel, crosswind landing, unusual attitudes) and the flight-dynamics-model aircraft profiles those scenarios fly.',
		whyItExists:
			'The sim is the platform’s motor-skill and decision-rehearsal surface. Scenarios are its rehearsable situations; FDM models are the airframes those situations fly. Together they are what a learner practises in the cockpit.',
		location: 'libs/bc/sim/, apps/sim/',
		mode: 'census',
		stateRule:
			'A sim scenario is "graded" when it appears in SIM_SCENARIO_NODE_MAPPINGS -- it has scoring criteria and is linked to the knowledge nodes it exercises, so it feeds the spaced-rep scheduler; "playground" when it is free flight with no grading and no node linkage.',
		docs: SIM_CONTENT_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Sim scenarios / models'),
	};
}
