/**
 * Spike 01 -- Engine entrypoint.
 *
 * `generateScenario(seed)` returns a complete ScenarioBundle with all
 * four layers populated. `writeScenarioBundle(bundle, opts)` lands the
 * artifacts on disk in the layout described in DESIGN.md.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { stringify as yamlStringify } from 'yaml';
import type { ParsedFbGrid, ParsedMetar, ParsedPirep, ParsedTaf } from '@ab/wx-charts';
import type { TruthModel } from './truth/types';
import { FRONTAL_XC_MARCH } from './truth/scenarios/frontal-xc-march';
import { deriveMetar, type DerivedMetar } from './products/metar';
import { deriveTaf, type DerivedTaf } from './products/taf';
import { deriveAirmets, type AirmetAdvisory } from './products/airmet';
import { deriveFbGrid, type DerivedFbGrid } from './products/winds-aloft';
import { derivePireps, type DerivedPirep } from './products/pirep';
import { deriveSurfaceAnalysisChart } from './charts/surface-analysis';
import { deriveProgChart } from './charts/prog-chart';
import { deriveAirmetChart } from './charts/airmet-overlay';
import {
	deriveMetarPlotChart,
	derivePirepPlotChart,
	deriveTafTimelineChart,
	deriveWindsAloftChart,
} from './charts/product-charts';
import type { ChartArtifact } from './charts/types';
import { deriveCommentary, type CommentaryCallout } from './commentary/socratic';

export type ScenarioSeed = { kind: 'frontal-xc-march' };

export interface ScenarioProducts {
	metars: DerivedMetar[];
	tafs: DerivedTaf[];
	airmets: AirmetAdvisory[];
	fbGrid: DerivedFbGrid;
	pireps: DerivedPirep[];
}

export interface ScenarioBundle {
	scenarioId: string;
	truth: TruthModel;
	products: ScenarioProducts;
	charts: ChartArtifact[];
	commentary: CommentaryCallout[];
}

const ROUTE_STATIONS = ['KSTL', 'KCPS', 'KSPI', 'KMLI', 'KORD'] as const;
const FB_STATIONS = ['KSTL', 'KORD', 'KMSP', 'KIND', 'KDSM'] as const;

export function generateScenario(seed: ScenarioSeed): ScenarioBundle {
	const truth = loadTruth(seed);
	const scenarioId = truth.scenarioId;

	const metars = ROUTE_STATIONS.map((s) => deriveMetar(truth, s));
	const tafs = ROUTE_STATIONS.map((s) => deriveTaf(truth, s, { validHours: 12 }));
	const airmets = deriveAirmets(truth);
	const fbGrid = deriveFbGrid(truth, FB_STATIONS as unknown as string[]);
	const pireps = derivePireps(truth);

	const products: ScenarioProducts = { metars, tafs, airmets, fbGrid, pireps };

	const charts: ChartArtifact[] = [
		deriveSurfaceAnalysisChart(truth, metars, scenarioId),
		deriveProgChart(truth, 12, scenarioId),
		deriveAirmetChart(truth, airmets, scenarioId),
		deriveMetarPlotChart(truth, metars, scenarioId),
		derivePirepPlotChart(truth, pireps, scenarioId),
		deriveWindsAloftChart(truth, fbGrid, FB_STATIONS as unknown as string[], scenarioId),
		// One TAF timeline chart per route station:
		...ROUTE_STATIONS.map((s, i) => {
			const taf = tafs[i];
			if (taf === undefined) throw new Error(`generateScenario: missing TAF for ${s}`);
			return deriveTafTimelineChart(truth, taf, s, scenarioId);
		}),
	];

	const commentary = deriveCommentary(truth, products, charts);

	return { scenarioId, truth, products, charts, commentary };
}

function loadTruth(seed: ScenarioSeed): TruthModel {
	switch (seed.kind) {
		case 'frontal-xc-march':
			return FRONTAL_XC_MARCH;
	}
}

// ----------------------------------------------------------------------
// Bundle writer
// ----------------------------------------------------------------------

export interface ScenarioRunOptions {
	repoRoot: string;
	cacheRoot?: string;
	mirrorIntoChartsDir?: boolean;
}

const DEFAULT_CACHE_ROOT = resolve(homedir(), 'Documents', 'airboss-handbook-cache');

export function writeScenarioBundle(bundle: ScenarioBundle, options: ScenarioRunOptions): void {
	const { repoRoot } = options;
	const cacheRoot = options.cacheRoot ?? DEFAULT_CACHE_ROOT;
	const cacheWxRoot = resolve(cacheRoot, 'wx');
	const scenarioOut = resolve(repoRoot, 'data', 'wx-scenarios', bundle.scenarioId);
	const productsOut = resolve(scenarioOut, 'products');
	const chartsOut = resolve(scenarioOut, 'charts');

	ensureDir(scenarioOut);
	ensureDir(productsOut);
	ensureDir(chartsOut);

	// Truth.
	writeFile(resolve(scenarioOut, 'truth.json'), JSON.stringify(bundle.truth, null, 2));

	// Products: METARs.
	writeFile(resolve(productsOut, 'metars.txt'), bundle.products.metars.map((m) => m.raw).join('\n'));
	writeFile(
		resolve(productsOut, 'metars.json'),
		JSON.stringify(bundle.products.metars.map((m) => parsedMetarPlain(m.parsed)), null, 2),
	);

	// Products: TAFs.
	writeFile(resolve(productsOut, 'tafs.txt'), bundle.products.tafs.map((t) => t.raw).join('\n\n'));
	writeFile(
		resolve(productsOut, 'tafs.json'),
		JSON.stringify(bundle.products.tafs.map((t) => parsedTafPlain(t.parsed)), null, 2),
	);

	// Products: FB.
	writeFile(resolve(productsOut, 'fb-bulletin.txt'), bundle.products.fbGrid.raw);
	writeFile(resolve(productsOut, 'fb-bulletin.json'), JSON.stringify(parsedFbPlain(bundle.products.fbGrid.parsed), null, 2));

	// Products: PIREPs.
	writeFile(resolve(productsOut, 'pireps.txt'), bundle.products.pireps.map((p) => p.raw).join('\n'));
	writeFile(
		resolve(productsOut, 'pireps.json'),
		JSON.stringify(bundle.products.pireps.map((p) => parsedPirepPlain(p.parsed)), null, 2),
	);

	// Products: AIRMETs.
	writeFile(resolve(productsOut, 'airmets.json'), JSON.stringify(bundle.products.airmets, null, 2));

	// Charts: spec + sources.
	for (const chart of bundle.charts) {
		const chartDir = resolve(chartsOut, chart.slug);
		ensureDir(chartDir);
		const sourcesDir = resolve(chartDir, 'sources');
		ensureDir(sourcesDir);

		const specYaml = yamlStringify(chart.spec);
		writeFile(resolve(chartDir, 'spec.yaml'), specYaml);

		for (const src of chart.sources) {
			const filename = src.cacheRelPath.split('/').pop() ?? 'source.json';
			writeFile(resolve(sourcesDir, filename), src.content);

			// Mirror the source into the cache so `bun run charts build` can resolve cache://...
			const cacheTarget = resolve(cacheWxRoot, src.cacheRelPath);
			ensureDir(dirname(cacheTarget));
			writeFile(cacheTarget, src.content);
		}

		// Mirror chart into the canonical data/charts/wx/<slug>/ dir for the build CLI.
		if (options.mirrorIntoChartsDir !== false) {
			const mirrorDir = resolve(repoRoot, 'data', 'charts', 'wx', chart.slug);
			ensureDir(mirrorDir);
			writeFile(resolve(mirrorDir, 'spec.yaml'), specYaml);
		}
	}

	// Commentary.
	writeFile(resolve(scenarioOut, 'commentary.json'), JSON.stringify(bundle.commentary, null, 2));
	writeFile(resolve(scenarioOut, 'commentary.md'), formatCommentaryMarkdown(bundle));
}

function ensureDir(p: string): void {
	if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function writeFile(p: string, content: string): void {
	ensureDir(dirname(p));
	writeFileSync(p, content);
}

function formatCommentaryMarkdown(bundle: ScenarioBundle): string {
	const lines: string[] = [];
	lines.push(`# ${bundle.scenarioId} -- truth-aware commentary`);
	lines.push('');
	lines.push(`Truth valid at: \`${bundle.truth.validAt}\``);
	lines.push('');
	lines.push(bundle.truth.narrative);
	lines.push('');
	lines.push(`## Callouts (${bundle.commentary.length})`);
	lines.push('');
	for (const c of bundle.commentary) {
		lines.push(`### ${c.id} -- ${c.target.kind}${c.target.elementId !== undefined ? ` (${c.target.elementId})` : ''}`);
		lines.push('');
		if (c.target.chartSlug !== undefined) {
			lines.push(`Pinned to chart \`${c.target.chartSlug}\`.`);
			lines.push('');
		}
		lines.push(`**Mode:** ${c.mode}`);
		lines.push('');
		lines.push(`**Question:** ${c.question}`);
		lines.push('');
		lines.push(`**Observation:** ${c.observation}`);
		lines.push('');
		lines.push(`**Reason:** ${c.reason}`);
		lines.push('');
		lines.push(`**References:** ${c.knowledgeNodeIds.map((id) => `\`${id}\``).join(', ')}`);
		lines.push('');
	}
	return lines.join('\n');
}

// Plain serializers strip the `raw` field where verbose, keep types JSON-safe.
function parsedMetarPlain(p: ParsedMetar): unknown {
	return p;
}
function parsedTafPlain(p: ParsedTaf): unknown {
	return p;
}
function parsedFbPlain(p: ParsedFbGrid): unknown {
	return p;
}
function parsedPirepPlain(p: ParsedPirep): unknown {
	return p;
}
