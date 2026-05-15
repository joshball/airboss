/**
 * `bun run wx-scenario check-catalog`
 *
 * Validates the encoded-text catalog without writing anything:
 *
 *   - Every product manifest parses (5 markdown files, trailing
 *     `yaml-catalog` fence in each).
 *   - Every METAR / TAF / PIREP / FB example round-trips through the
 *     `@ab/wx-charts` parsers with zero warnings.
 *   - The on-disk `catalog.json` matches what would be regenerated now
 *     (modulo `generatedAt`, which changes every run).
 *
 * Also emits a non-blocking warning when the scenario cross-reference
 * sidecar (`course/knowledge/weather/encoded-text-catalog/scenario-matches.json`)
 * is older than the most-recently-built scenario bundle. Stale matches
 * are not a hard failure -- they just mean the coverage report is
 * potentially out of date, and a `bun tools/catalog-build/match-scenarios.ts`
 * run will refresh them.
 *
 * AIRMET / SIGMET examples skip the round-trip (no parser in v1).
 *
 * Wired into `bun run check`. Failing examples block the gate.
 */

import { $ } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { WX_SCENARIO_VALUES, wxScenarioBundleDir } from '@ab/constants';
import { REPO_ROOT } from './lib';

const SCENARIO_MATCHES_PATH = resolve(REPO_ROOT, 'course/knowledge/weather/encoded-text-catalog/scenario-matches.json');

function warnIfMatchesStale(): void {
	if (!existsSync(SCENARIO_MATCHES_PATH)) {
		// First-time / not-yet-generated sidecar. Print the suggestion
		// inline; do not fail (the sidecar is optional metadata).
		console.warn(
			'wx-scenario check-catalog: no scenario-matches.json yet. Run `bun tools/catalog-build/match-scenarios.ts` to populate scenario <-> catalog cross-references.',
		);
		return;
	}
	const matchesMtimeMs = statSync(SCENARIO_MATCHES_PATH).mtimeMs;
	for (const slug of WX_SCENARIO_VALUES) {
		const truthPath = resolve(wxScenarioBundleDir(REPO_ROOT, slug), 'truth.json');
		if (!existsSync(truthPath)) continue;
		const truthMtimeMs = statSync(truthPath).mtimeMs;
		if (truthMtimeMs > matchesMtimeMs) {
			console.warn(
				`wx-scenario check-catalog: scenario "${slug}" was rebuilt after scenario-matches.json. Run \`bun tools/catalog-build/match-scenarios.ts\` to refresh catalog cross-references.`,
			);
			return;
		}
	}
}

export async function runCheckCatalog(_args: readonly string[]): Promise<void> {
	// Delegate to the catalog-build tool in --check mode. Keep the gate
	// thin: tool owns the logic, this script owns the dispatcher binding.
	const result = await $`bun tools/catalog-build/bin.ts --check`.nothrow();
	if (result.exitCode !== 0) {
		process.exit(result.exitCode);
	}
	warnIfMatchesStale();
}
