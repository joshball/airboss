/**
 * `bun run xc-scenario list` -- enumerate registered XC scenarios.
 *
 * Reads `XC_SCENARIO_VALUES` + `XC_SCENARIO_LABELS` and prints
 * `<slug> -- <human label>` one per line.
 */

import { XC_SCENARIO_LABELS, XC_SCENARIO_VALUES } from '@ab/constants';

export function runList(_args: readonly string[]): void {
	for (const slug of XC_SCENARIO_VALUES) {
		console.log(`${slug} -- ${XC_SCENARIO_LABELS[slug]}`);
	}
}
