/**
 * `bun run xc-scenario build <slug> | --all`
 *
 * Composes the scenario bundle from the four layers and writes it to
 * `data/xc-scenarios/<slug>/{bundle.json, route.geojson, performance.json}`.
 *
 * Idempotency: the composition is deterministic -- the same scenario
 * literal + the same geography + the same wx-engine output produce a
 * byte-identical bundle. The subcommand snapshots `bundle.json` before
 * writing and reports `unchanged` when the post-write version matches.
 *
 * Failure modes surface as `failed` lines and yield a non-zero exit.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { XC_SCENARIO_BUNDLE, XC_SCENARIO_VALUES, type XcScenario } from '@ab/constants';
import { composeScenario, runConsistency, writeScenarioBundle } from '@ab/spatial-engine/server';
import { formatHumanDurationMs, REPO_ROOT, resolveXcScenarioSlug } from './lib';

/** Build one scenario; returns true on success. */
async function buildOne(slug: XcScenario): Promise<boolean> {
	const started = performance.now();
	const bundleFile = join(REPO_ROOT, 'data', 'xc-scenarios', slug, XC_SCENARIO_BUNDLE.BUNDLE);
	const before = existsSync(bundleFile) ? readFileSync(bundleFile, 'utf-8') : null;

	try {
		const bundle = composeScenario(slug);
		const report = runConsistency(bundle);
		if (!report.ok) {
			console.error(`  [failed] ${slug} -- consistency failed:`);
			for (const issue of report.issues.filter((i) => i.rule !== 'altitude-near-ceiling')) {
				console.error(`    - ${issue.rule}: ${issue.message}`);
			}
			return false;
		}
		await writeScenarioBundle(bundle);
		const after = readFileSync(bundleFile, 'utf-8');
		const status = before === after ? 'unchanged' : before === null ? 'created' : 'updated';
		console.log(`  [${status}] ${slug} (${formatHumanDurationMs(performance.now() - started)})`);
		return true;
	} catch (err) {
		console.error(`  [failed] ${slug} -- ${err instanceof Error ? err.message : String(err)}`);
		return false;
	}
}

export async function runBuild(args: readonly string[]): Promise<void> {
	const slugs: XcScenario[] = args.includes('--all') ? [...XC_SCENARIO_VALUES] : [resolveXcScenarioSlug(args[0])];

	console.log(`xc-scenario build: ${slugs.length} scenario(s)`);
	let failures = 0;
	for (const slug of slugs) {
		const ok = await buildOne(slug);
		if (!ok) failures++;
	}
	if (failures > 0) {
		console.error(`xc-scenario build: ${failures} of ${slugs.length} failed`);
		process.exit(1);
	}
	console.log(`xc-scenario build: ${slugs.length} scenario(s) built`);
}
