/**
 * Shared helpers for `bun run wx-scenario` subcommands.
 *
 * Owns:
 *   - `REPO_ROOT` -- absolute repo root resolved via `import.meta.url`
 *   - `resolveScenarioSlug` -- map a user-supplied positional arg to a
 *     `WxScenario` slug, with a helpful error if the slug is unknown
 *   - `formatHumanDurationMs` -- millisecond -> "1.3s" / "180 ms" formatter
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WX_SCENARIO_VALUES, type WxScenario } from '@ab/constants';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * Validate a positional slug argument. Throws with the full set of legal
 * slugs in the error message when the lookup fails so the CLI surfaces a
 * useful diagnostic.
 */
export function resolveScenarioSlug(arg: string | undefined): WxScenario {
	if (arg === undefined || arg.length === 0) {
		throw new Error(`missing scenario slug. Legal slugs: ${WX_SCENARIO_VALUES.join(', ')}`);
	}
	if (!(WX_SCENARIO_VALUES as readonly string[]).includes(arg)) {
		throw new Error(`unknown scenario slug "${arg}". Legal slugs: ${WX_SCENARIO_VALUES.join(', ')}`);
	}
	return arg as WxScenario;
}

export function formatHumanDurationMs(ms: number): string {
	if (ms < 1000) return `${ms.toFixed(0)} ms`;
	return `${(ms / 1000).toFixed(1)} s`;
}
