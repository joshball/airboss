// @browser-globals: server-only -- never imported by client .svelte
/**
 * The wx-catalog census adapter -- the FULL reference adapter.
 *
 * This is the Phase-1 reference implementation every other corpus adapter
 * follows. It reads the encoded-text catalog and the scenario-match manifest
 * off disk and produces a real `CorpusCensus`: a 155-example inventory with
 * derived matched / unmatched state, real explained metrics, a real gap view
 * covering the three known gaps, and a value-ranked next-list.
 *
 * Every metric and every gap carries the what-it-measures / why-it-matters /
 * what-to-do triad -- the explanatory-surface requirement. The
 * explanatory-rule guard test fails the build if any of them ship empty.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES } from '@ab/constants';
import type { CensusGap, CensusItem, CensusMetric, CensusNextItem, CorpusCensus, DocLink } from '../types';
import { repoRoot } from './repo-root.server';

/** One example as it appears in `catalog.json`. */
interface CatalogExample {
	slug: string;
	raw: string;
	tokenFamilies: string[];
	synoptic: string;
	triageDrivers: string[];
}

/** One token family as it appears in `catalog.json`. */
interface CatalogTokenFamily {
	slug: string;
	label: string;
	decode: string;
	examples: string[];
}

/** One product block as it appears in `catalog.json`. */
interface ProductCatalog {
	product: string;
	tokenFamilies: CatalogTokenFamily[];
	examples: CatalogExample[];
}

/** The on-disk `catalog.json` shape. */
interface EncodedTextCatalog {
	generatedAt: string;
	products: Record<string, ProductCatalog>;
}

/** The on-disk `scenario-matches.json` shape. */
interface ScenarioMatches {
	generatedAt: string;
	/** Keyed by example slug -> the scenario / station that reproduced it. */
	matches: Record<string, { scenario: string; station: string; observationTime: string }>;
	/** Keyed by scenario id -> the example slugs it contributes. */
	coverage: Record<string, string[]>;
}

const CATALOG_DIR = 'course/knowledge/weather/encoded-text-catalog';

function readJson<T>(relativePath: string): T {
	return JSON.parse(readFileSync(join(repoRoot(), relativePath), 'utf8')) as T;
}

/** The governing documents for the wx catalog -- ADR, plan, source, matcher. */
const WX_CATALOG_DOCS: DocLink[] = [
	{
		label: 'ADR 018 -- Source artifact storage policy',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/018-source-artifact-storage-policy/decision.md'),
		role: 'Governs where source bytes vs extracted derivatives live; the catalog is an extracted derivative.',
	},
	{
		label: 'Catalog README -- structure + build',
		href: ROUTES.HANGAR_DOCS_PATH(`${CATALOG_DIR}/README.md`),
		role: 'Explains the yaml-catalog manifest format and the three downstream surfaces the catalog feeds.',
	},
	{
		label: 'catalog.json -- the coverage matrix',
		href: ROUTES.HANGAR_DOCS_PATH(`${CATALOG_DIR}/catalog.json`),
		role: 'The machine-readable source of truth: every example, its token families, its references.',
	},
	{
		label: 'wx-engine work package',
		href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
		role: 'The truth-aware generator. Generator coverage measures how much of the catalog it can reproduce.',
	},
];

/**
 * Build the full wx-catalog census. Reads `catalog.json` and
 * `scenario-matches.json`; derives matched / unmatched state per example;
 * computes the explained metrics, gaps, and next-list.
 */
export function wxCatalogCensus(): CorpusCensus {
	const catalog = readJson<EncodedTextCatalog>(`${CATALOG_DIR}/catalog.json`);
	const matchManifest = readJson<ScenarioMatches>(`${CATALOG_DIR}/scenario-matches.json`);

	const matchedSlugs = new Set(Object.keys(matchManifest.matches));

	// Flatten every product's example array into one inventory.
	const items: CensusItem[] = [];
	let tokenFamilyCount = 0;
	const coveredFamilyKeys = new Set<string>();
	let airmetExampleCount = 0;
	let airmetMatchedCount = 0;

	for (const product of Object.values(catalog.products)) {
		tokenFamilyCount += product.tokenFamilies.length;
		for (const example of product.examples) {
			const isMatched = matchedSlugs.has(example.slug);
			if (product.product === 'airmetSigmet') {
				airmetExampleCount += 1;
				if (isMatched) airmetMatchedCount += 1;
			}
			if (isMatched) {
				// A matched example exercises -- and therefore "covers" --
				// every token family it touches.
				for (const family of example.tokenFamilies) {
					coveredFamilyKeys.add(`${product.product}:${family}`);
				}
			}
			items.push({
				id: example.slug,
				label: example.slug,
				derivedState: isMatched ? 'matched' : 'unmatched',
				detail: example.raw,
			});
		}
	}

	const exampleCount = items.length;
	const matchedCount = items.filter((item) => item.derivedState === 'matched').length;
	const coveredFamilyCount = coveredFamilyKeys.size;
	const uncoveredFamilyCount = tokenFamilyCount - coveredFamilyCount;

	const scenarioIds = Object.keys(matchManifest.coverage);
	const scenarioCount = scenarioIds.length;
	const contributingScenarios = scenarioIds.filter((id) => matchManifest.coverage[id].length > 0);
	const dormantScenarios = scenarioIds.filter((id) => matchManifest.coverage[id].length === 0);

	const metrics: CensusMetric[] = [
		{
			key: 'examples',
			label: 'Catalog examples',
			value: exampleCount,
			whatItMeasures:
				'The number of distinct realistic encoded-text shapes the catalog catalogues, across METAR, TAF, PIREP, FB, and AIRMET / SIGMET.',
			whyItMatters:
				'This is the breadth of the reference. A pilot can only be drilled on a shape the catalog has captured; an absent shape is an invisible blind spot in the encoded-text ladder.',
			whatToDo: {
				text: 'Add new shapes by editing the product markdown files, then rebuild with bun tools/catalog-build/bin.ts.',
				href: ROUTES.HANGAR_DOCS_PATH(`${CATALOG_DIR}/README.md`),
			},
		},
		{
			key: 'generator-coverage',
			label: 'Generator coverage',
			value: `${matchedCount} / ${exampleCount}`,
			whatItMeasures:
				'How many catalog examples the wx-engine can reproduce from a truth model. It is NOT a measure of catalog quality -- an unmatched example is still a valid, well-authored shape.',
			whyItMatters:
				'A matched example can be drilled with infinitely many generated variations; an unmatched one can only be drilled as a static card. Low coverage means the truth-aware drill has a narrow reproducible core.',
			whatToDo: {
				text: 'Raise coverage by authoring wx-engine scenarios and emitters for the uncovered shapes -- see the wx-engine work package.',
				href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			},
		},
		{
			key: 'token-families',
			label: 'Token families',
			value: tokenFamilyCount,
			whatItMeasures:
				'The number of distinct token groups the catalog tracks -- gust groups, RVR, VV, CB, +TSRA, BECMG, and so on. Each family is one decodable element of an encoded product.',
			whyItMatters:
				'Token families are the unit of decode-skill. A family with no covered example cannot be drilled with generated content, so the learner only ever sees it in static form.',
			whatToDo: {
				text: 'Token families are defined per product in the yaml-catalog manifest; see the catalog README.',
				href: ROUTES.HANGAR_DOCS_PATH(`${CATALOG_DIR}/README.md`),
			},
		},
		{
			key: 'covered-families',
			label: 'Generator-covered token families',
			value: `${coveredFamilyCount} / ${tokenFamilyCount}`,
			whatItMeasures:
				'How many token families are exercised by at least one example the wx-engine can reproduce. The remaining families are reachable only through static catalog examples.',
			whyItMatters: `${uncoveredFamilyCount} families are uncovered -- the truth-aware drill cannot generate practice for them, so a learner drilling those tokens gets a thinner, repetition-limited experience.`,
			whatToDo: {
				text: `Close the gap by adding wx-engine emitters / scenarios for the ${uncoveredFamilyCount} uncovered families (+FC, VA, SQ, WS, BECMG, and the AIRMET set).`,
				href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			},
		},
		{
			key: 'scenarios',
			label: 'Contributing scenarios',
			value: `${contributingScenarios.length} / ${scenarioCount}`,
			whatItMeasures:
				'How many authored wx-engine scenarios contribute at least one matched catalog example. A scenario that contributes zero examples does no catalog work.',
			whyItMatters: `${dormantScenarios.length} scenario contributes nothing. Authoring effort spent on it is currently invisible to the catalog -- the scenario exists but no drill or reference draws on it.`,
			whatToDo: {
				text: `Author catalog products for the ${dormantScenarios.length} zero-contribution scenario so its authoring effort reaches a learner.`,
				href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			},
		},
	];

	const gaps: CensusGap[] = [
		{
			title: `${uncoveredFamilyCount} token families have no generator coverage`,
			whatItMeasures: `Of ${tokenFamilyCount} token families, ${uncoveredFamilyCount} are not exercised by any wx-engine-reproducible example. They include +FC (funnel cloud), VA (volcanic ash), SQ (squall), WS (wind shear), and BECMG (becoming) groups.`,
			whyItMatters:
				'The truth-aware drill generates practice only for covered families. For an uncovered family the learner sees the same static catalog example every time -- no variation, no synoptic re-framing, a measurably weaker decode-skill build.',
			whatToDo: {
				text: 'Add wx-engine emitters and scenarios for the uncovered families. Tracked as a next-item on the wx-engine roadmap.',
				href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			},
			severity: 'thin',
		},
		{
			title: `AIRMET / SIGMET examples cannot match the catalog (${airmetMatchedCount} of ${airmetExampleCount} matched)`,
			whatItMeasures: `All ${airmetExampleCount} AIRMET / SIGMET examples are unmatched. This is structural, not thin: the wx-engine has no AIRMET text emitter, and the catalog builder skips the round-trip parse for AIRMET / SIGMET bulletins (no parser in v1).`,
			whyItMatters:
				'In-flight advisories are checkride-critical and the most operationally consequential encoded products. Until an emitter exists, the entire AIRMET / SIGMET family is reference-only -- no generated drills at all.',
			whatToDo: {
				text: 'Build the wx-engine AIRMET text emitter so AIRMET / SIGMET examples can round-trip and match. This is the highest-value next-item from the 2026-05-16 coverage work.',
				href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			},
			severity: 'structural',
		},
		{
			title: 'The frontal-pressure-march scenario contributes zero catalog examples',
			whatItMeasures:
				'The temporal scenario frontal-pressure-march is authored in the wx-engine but appears in scenario-matches.json with an empty coverage list -- it produces no matched catalog example.',
			whyItMatters:
				'Authoring effort was spent on the scenario but no catalog reference or generated drill draws on it. The scenario is invisible to every learner-facing surface until products are authored against it.',
			whatToDo: {
				text: 'Author frontal-pressure-march catalog products (METAR / TAF / PIREP sequences) so the temporal scenario contributes coverage.',
				href: ROUTES.HANGAR_DOCS_PATH(`${CATALOG_DIR}/README.md`),
			},
			severity: 'thin',
		},
	];

	const next: CensusNextItem[] = [
		{
			text: 'Build the wx-engine AIRMET / SIGMET text emitter',
			rationale: `Closes the single structural gap -- all ${airmetExampleCount} in-flight-advisory examples are currently reference-only. Highest operational value of the encoded-text family.`,
			href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			value: 'high',
		},
		{
			text: `Add emitters for the ${uncoveredFamilyCount} uncovered token families`,
			rationale:
				'Each newly covered family unlocks generated, variation-rich drilling for one decodable element. Incremental, shippable family-by-family.',
			href: ROUTES.HANGAR_ROADMAP_DETAIL('wx-engine'),
			value: 'standard',
		},
		{
			text: 'Author frontal-pressure-march catalog products',
			rationale:
				'Turns an already-authored but zero-contribution temporal scenario into real catalog coverage -- low effort, recovers sunk authoring work.',
			href: ROUTES.HANGAR_DOCS_PATH(`${CATALOG_DIR}/README.md`),
			value: 'standard',
		},
	];

	return {
		id: 'wx-catalog',
		label: 'Encoded-text catalog',
		whatItIs:
			'A browsable, machine-readable coverage matrix of every realistic METAR, TAF, PIREP, FB, and AIRMET / SIGMET shape a pilot can encounter.',
		whyItExists:
			'The teaching nodes explain how to read each product; the catalog answers "show me what this looks like in the wild" and gives the drill generator a coverage checklist of every shape it should be able to produce.',
		location: `${CATALOG_DIR}/`,
		mode: 'full',
		stateRule:
			'An example is "matched" when scenario-matches.json records a wx-engine scenario that reproduced it; otherwise "unmatched". Matched examples can be drilled with generated variation; unmatched examples are static-only.',
		docs: WX_CATALOG_DOCS,
		items,
		metrics,
		gaps,
		next,
	};
}
