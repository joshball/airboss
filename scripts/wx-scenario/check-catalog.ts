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
 * AIRMET / SIGMET examples skip the round-trip (no parser in v1).
 *
 * Wired into `bun run check`. Failing examples block the gate.
 */

import { $ } from 'bun';

export async function runCheckCatalog(_args: readonly string[]): Promise<void> {
	// Delegate to the catalog-build tool in --check mode. Keep the gate
	// thin: tool owns the logic, this script owns the dispatcher binding.
	const result = await $`bun tools/catalog-build/bin.ts --check`.nothrow();
	if (result.exitCode !== 0) {
		process.exit(result.exitCode);
	}
}
