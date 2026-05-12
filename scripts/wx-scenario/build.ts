/**
 * `bun run wx-scenario build <slug> | --all`
 *
 * Generates the scenario bundle, writes it to
 * `data/wx-scenarios/<slug>/`, mirrors the chart specs into
 * `data/charts/wx/wx-scenario-<slug>-<chart>/spec.yaml`, and mirrors the
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

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WX_SCENARIO_VALUES, type WxScenario, wxScenarioBundleDir } from '@ab/constants';
import { generateScenario, writeScenarioBundle } from '@ab/wx-engine/server';
import { formatHumanDurationMs, REPO_ROOT, resolveScenarioSlug } from './lib';

interface BuildResult {
	slug: string;
	status: 'built' | 'unchanged' | 'failed';
	message?: string;
	durationMs: number;
}

export async function runBuild(args: readonly string[]): Promise<void> {
	if (args.length === 0) {
		console.error('wx-scenario build: missing slug. Usage: bun run wx-scenario build <slug> | --all');
		process.exit(2);
	}

	const all = args[0] === '--all';
	const slugs: WxScenario[] = all ? [...WX_SCENARIO_VALUES] : [resolveScenarioSlug(args[0])];

	let failures = 0;
	for (const slug of slugs) {
		const result = await buildOne(slug);
		printResult(result);
		if (result.status === 'failed') failures += 1;
	}
	if (failures > 0) process.exit(1);
}

async function buildOne(slug: WxScenario): Promise<BuildResult> {
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

		const postTruth = existsSync(truthPath) ? readFileSync(truthPath, 'utf8') : null;
		const postCommentary = existsSync(commentaryPath) ? readFileSync(commentaryPath, 'utf8') : null;
		const unchanged = priorTruth !== null && priorTruth === postTruth && priorCommentary === postCommentary;
		return {
			slug,
			status: unchanged ? 'unchanged' : 'built',
			message: `${bundle.products.metars.length} METARs, ${bundle.products.tafs.length} TAFs, ${bundle.products.airmets.length} AIRMETs, ${bundle.charts.length} charts, ${bundle.commentary.length} callouts`,
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
