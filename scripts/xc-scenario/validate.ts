/**
 * `bun run xc-scenario validate <slug> | --all`
 *
 * Composes each scenario in memory (schema-validating every literal as a
 * side effect), runs the cross-layer consistency rules, and reports
 * per-scenario PASS / FAIL. NO disk writes.
 *
 * `validate --all` is wired into `bun run check`. Exits non-zero on any
 * failure.
 */

import { XC_SCENARIO_VALUES, type XcScenario } from '@ab/constants';
import { validateScenario } from '@ab/spatial-engine/server';
import { resolveXcScenarioSlug } from './lib';

export async function runValidate(args: readonly string[]): Promise<void> {
	const slugs: XcScenario[] = args.includes('--all') ? [...XC_SCENARIO_VALUES] : [resolveXcScenarioSlug(args[0])];

	console.log(`xc-scenario validate: ${slugs.length} scenario(s)`);
	let failures = 0;

	for (const slug of slugs) {
		const result = validateScenario(slug);
		if (result.ok) {
			console.log(`  [PASS] ${slug}`);
			// Surface non-fatal warnings (e.g. altitude-near-ceiling).
			for (const issue of result.report.issues) {
				console.log(`    warn: ${issue.rule} -- ${issue.message}`);
			}
		} else {
			failures++;
			console.error(`  [FAIL] ${slug}`);
			if (result.error) {
				console.error(`    error: ${result.error}`);
			}
			for (const issue of result.report.issues) {
				console.error(`    - ${issue.rule}: ${issue.message}`);
			}
		}
	}

	if (failures > 0) {
		console.error(`xc-scenario validate: ${failures} of ${slugs.length} failed`);
		process.exit(1);
	}
	console.log(`xc-scenario validate: all ${slugs.length} scenario(s) passed`);
}
