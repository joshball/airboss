/**
 * `bun run wx-scenario build <slug> | --all`
 *
 * Generates the scenario bundle, writes it to
 * `data/wx-scenarios/<slug>/`, mirrors the chart specs into
 * `data/charts/wx/wx-scenarios/<slug>/<chart>/<slug>-<chart>-spec.yaml`
 * (ADR 027 PR 3 nested layout), and mirrors the
 * source bytes into the wx cache subtree (per ADR 018).
 *
 * Idempotency:
 *   - The engine's derivation is deterministic: same scenario literal -> same
 *     bundle, byte-identical.
 *   - This subcommand snapshots the on-disk truth.json + commentary.json
 *     before writing and reports `unchanged` when the post-write versions
 *     match (covers the canonical idempotency contract for the dispatcher).
 *
 * Failure modes surface as `failed` lines and yield a non-zero exit code.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	WX_SCENARIO_BUILD_TIMELINE_FLAG,
	WX_SCENARIO_VALUES,
	type WxScenario,
	wxScenarioBundleDir,
} from '@ab/constants';
import {
	buildTimelineBundle,
	generateScenario,
	loadScenario,
	writeScenarioBundle,
	writeTimelineBundle,
} from '@ab/wx-engine/server';
import { formatHumanDurationMs, REPO_ROOT, resolveScenarioSlug } from './lib';

const SCENARIO_MATCHES_PATH = resolve(REPO_ROOT, 'course/knowledge/weather/encoded-text-catalog/scenario-matches.json');

interface ScenarioMatchesFile {
	generatedAt: string;
	coverage?: Record<string, string[]>;
}

/**
 * Read the matcher-generated coverage map for a single scenario. Falls
 * back to an empty list when the sidecar is absent (first run, or before
 * `bun tools/catalog-build/match-scenarios.ts` has ever been run).
 */
function readCoverageForScenario(slug: WxScenario): string[] {
	if (!existsSync(SCENARIO_MATCHES_PATH)) return [];
	try {
		const parsed = JSON.parse(readFileSync(SCENARIO_MATCHES_PATH, 'utf8')) as ScenarioMatchesFile;
		const covered = parsed.coverage?.[slug];
		return Array.isArray(covered) ? [...covered].sort() : [];
	} catch {
		return [];
	}
}

/**
 * Write `data/wx-scenarios/<slug>/coverage.json` -- the per-scenario view
 * of "which catalog examples this scenario produces verbatim." Sourced
 * from `course/knowledge/weather/encoded-text-catalog/scenario-matches.json`,
 * which the matcher tool regenerates whenever scenarios or catalog change.
 */
function writeCoverageForScenario(slug: WxScenario): void {
	const coversCatalogExamples = readCoverageForScenario(slug);
	const payload = {
		scenario: slug,
		coversCatalogExamples,
	};
	const path = resolve(wxScenarioBundleDir(REPO_ROOT, slug), 'coverage.json');
	writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

interface BuildResult {
	slug: string;
	status: 'built' | 'unchanged' | 'failed';
	message?: string;
	durationMs: number;
}

export async function runBuild(args: readonly string[]): Promise<void> {
	const timeline = args.includes(WX_SCENARIO_BUILD_TIMELINE_FLAG);
	const positional = args.filter((a) => a !== WX_SCENARIO_BUILD_TIMELINE_FLAG);

	if (positional.length === 0) {
		console.error(
			`wx-scenario build: missing slug. Usage: bun run wx-scenario build <slug> | --all [${WX_SCENARIO_BUILD_TIMELINE_FLAG}]`,
		);
		process.exit(2);
	}

	const all = positional[0] === '--all';
	const slugs: WxScenario[] = all ? [...WX_SCENARIO_VALUES] : [resolveScenarioSlug(positional[0])];

	let failures = 0;
	for (const slug of slugs) {
		const result = await buildOne(slug, timeline);
		printResult(result);
		if (result.status === 'failed') failures += 1;
	}
	if (failures > 0) process.exit(1);
}

async function buildOne(slug: WxScenario, timeline: boolean): Promise<BuildResult> {
	const start = performance.now();
	try {
		// Snapshot prior state for the idempotency check. We pick a single
		// representative artifact -- truth.json -- because it carries the
		// scenarioId, the analysis time, every truth literal, and is regenerated
		// on every build. A byte-equal truth.json + chart count + commentary
		// count is a tight proxy for the full bundle being unchanged.
		const bundleDir = wxScenarioBundleDir(REPO_ROOT, slug);
		const truthPath = resolve(bundleDir, 'truth.json');
		const commentaryPath = resolve(bundleDir, 'commentary.json');
		const priorTruth = existsSync(truthPath) ? readFileSync(truthPath, 'utf8') : null;
		const priorCommentary = existsSync(commentaryPath) ? readFileSync(commentaryPath, 'utf8') : null;

		const bundle = generateScenario({ kind: slug });
		await writeScenarioBundle(bundle, { repoRoot: REPO_ROOT });

		// Per-scenario coverage view, sourced from the catalog matcher's
		// sidecar. Empty until `bun tools/catalog-build/match-scenarios.ts`
		// runs after a catalog or scenario change.
		writeCoverageForScenario(slug);

		const postTruth = existsSync(truthPath) ? readFileSync(truthPath, 'utf8') : null;
		const postCommentary = existsSync(commentaryPath) ? readFileSync(commentaryPath, 'utf8') : null;
		const unchanged = priorTruth !== null && priorTruth === postTruth && priorCommentary === postCommentary;

		let message = `${bundle.products.metars.length} METARs, ${bundle.products.tafs.length} TAFs, ${bundle.products.airmets.length} AIRMETs, ${bundle.charts.length} charts, ${bundle.commentary.length} callouts`;

		// `--timeline`: additively emit the full v2 evolution bundle. The v1
		// artifacts above are untouched; the timeline bundle adds timeline.json,
		// the product sequences, and per-hour chart specs (NOT rendered SVGs --
		// the replay surface renders the spec on demand, per ADR 018).
		if (timeline) {
			const truth = loadScenario(slug);
			if (truth.evolution === undefined) {
				return {
					slug,
					status: 'failed',
					message: `${WX_SCENARIO_BUILD_TIMELINE_FLAG} requires a v2 scenario with an \`evolution\` block; "${slug}" is v1-only`,
					durationMs: performance.now() - start,
				};
			}
			const timelineBundle = await buildTimelineBundle(truth);
			writeTimelineBundle(timelineBundle, bundleDir);
			message +=
				` | timeline: ${timelineBundle.snapshots.length} snapshots, ` +
				`${timelineBundle.metarSequence.length} METAR samples, ${timelineBundle.tafSequence.length} TAF samples, ` +
				`${timelineBundle.pirepEvents.length} PIREP events, ${timelineBundle.charts.length} hourly chart specs`;
		}

		return {
			slug,
			// A `--timeline` build always writes fresh timeline artifacts, so the
			// idempotency proxy (truth.json) does not represent the full output;
			// report `built` whenever the timeline bundle was emitted.
			status: timeline ? 'built' : unchanged ? 'unchanged' : 'built',
			message,
			durationMs: performance.now() - start,
		};
	} catch (err) {
		return {
			slug,
			status: 'failed',
			message: err instanceof Error ? err.message : String(err),
			durationMs: performance.now() - start,
		};
	}
}

function printResult(r: BuildResult): void {
	const tag = r.status.padEnd(9);
	const ms = formatHumanDurationMs(r.durationMs);
	const trailer = r.message !== undefined ? `  -- ${r.message}` : '';
	console.log(`[${tag}] ${r.slug}  (${ms})${trailer}`);
}
