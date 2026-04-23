/**
 * Alias-block coverage: every `--ab-{font,letter-spacing,line-height,
 * font-size,font-weight,control,sim}-*` name referenced by
 * apps/study/src or apps/sim/src must ship in the emitted alias block.
 * Wave 1 requirement; rg is called at test time so new unmigrated call
 * sites fail the suite rather than silently resolving to `initial`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGACY_ALIAS_NAMES } from '../index';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const STUDY_SRC = resolve(REPO_ROOT, 'apps/study/src');
const SIM_SRC = resolve(REPO_ROOT, 'apps/sim/src');

const TYPOGRAPHY_CONTROL_PATTERN = '--ab-(font|letter-spacing|line-height|font-size|font-weight|control)-[a-z0-9-]+';
const SIM_PATTERN = '--ab-sim-[a-z0-9-]+';

function rgUnique(pattern: string, ...dirs: string[]): string[] {
	const existing = dirs.filter((d) => existsSync(d));
	if (existing.length === 0) return [];
	const res = spawnSync('rg', ['-oNI', pattern, ...existing], { encoding: 'utf8' });
	if (res.status !== 0 && !res.stdout) return [];
	return Array.from(new Set(res.stdout.split('\n').filter(Boolean))).sort();
}

describe('legacy alias block coverage', () => {
	const aliasSet = new Set(LEGACY_ALIAS_NAMES);

	it('includes every --ab-{font,letter-spacing,line-height,font-size,font-weight,control}-* used in apps', () => {
		const names = rgUnique(TYPOGRAPHY_CONTROL_PATTERN, STUDY_SRC, SIM_SRC);
		const missing = names.filter((n) => !aliasSet.has(n));
		expect(missing, `legacy alias block missing: ${missing.join(', ')}`).toEqual([]);
	});

	it('includes every --ab-sim-* used in apps/sim/src (TODO sentinels allowed; package #7 fills)', () => {
		const names = rgUnique(SIM_PATTERN, SIM_SRC);
		const missing = names.filter((n) => !aliasSet.has(n));
		expect(missing, `sim alias block missing: ${missing.join(', ')}`).toEqual([]);
	});
});
