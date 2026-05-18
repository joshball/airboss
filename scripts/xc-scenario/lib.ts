/**
 * Shared helpers for `bun run xc-scenario` subcommands.
 *
 * Mirrors `scripts/wx-scenario/lib.ts`.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XC_SCENARIO_VALUES, type XcScenario } from '@ab/constants';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * Validate a positional slug argument against `XC_SCENARIO_VALUES`. Throws
 * with the full legal-slug set when the lookup fails.
 */
export function resolveXcScenarioSlug(arg: string | undefined): XcScenario {
	if (arg === undefined || arg.length === 0) {
		throw new Error(`missing scenario slug. Legal slugs: ${XC_SCENARIO_VALUES.join(', ')}`);
	}
	if (!(XC_SCENARIO_VALUES as readonly string[]).includes(arg)) {
		throw new Error(`unknown scenario slug "${arg}". Legal slugs: ${XC_SCENARIO_VALUES.join(', ')}`);
	}
	return arg as XcScenario;
}

/** Millisecond -> "1.3 s" / "180 ms" formatter. */
export function formatHumanDurationMs(ms: number): string {
	if (ms < 1000) return `${ms.toFixed(0)} ms`;
	return `${(ms / 1000).toFixed(1)} s`;
}
