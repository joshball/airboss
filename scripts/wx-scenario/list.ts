/**
 * `bun run wx-scenario list` -- enumerate registered scenarios.
 *
 * Reads `WX_SCENARIO_VALUES` + `WX_SCENARIO_LABELS` from `@ab/constants`
 * and prints `<slug>: <human label>` one per line. The set is closed at
 * the six production scenarios; new scenarios extend the constants module.
 */

import { WX_SCENARIO_LABELS, WX_SCENARIO_VALUES } from '@ab/constants';

export function runList(_args: readonly string[]): void {
	for (const slug of WX_SCENARIO_VALUES) {
		const label = WX_SCENARIO_LABELS[slug];
		console.log(`${slug}: ${label}`);
	}
}
