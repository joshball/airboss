#!/usr/bin/env bun
/**
 * Emit `libs/themes/generated/tokens.css` from the TypeScript theme
 * registry.
 *
 * Import side-effect is what registers the themes; `@ab/themes` does the
 * imports for us. After that, `emitAllThemes()` walks every registered
 * theme and concatenates the CSS.
 *
 * The output is deterministic (sorted keys, rounded numbers). A CI check
 * (wired in package #3) fails if this script's output drifts from the
 * committed file -- proof that the CSS was regenerated whenever TS
 * changed.
 *
 * Usage: `bun run themes:emit`
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { emitAllThemes } from '@ab/themes';

const HEADER = [
	'/*',
	' * GENERATED FILE -- do not edit by hand.',
	' *',
	' * Produced by `bun run themes:emit` from the TS theme definitions in',
	' * `libs/themes/**`. Edit a theme there, then re-run the emitter.',
	' * CI fails if this file drifts from the TS source (see package #3).',
	' */',
	'',
].join('\n');

function main(): void {
	const check = process.argv.includes('--check');
	const css = `${HEADER}${emitAllThemes()}`;
	const outPath = resolve(import.meta.dir, '../../libs/themes/generated/tokens.css');

	if (check) {
		if (!existsSync(outPath)) {
			console.error(`[themes:emit --check] missing ${outPath}. Run \`bun run themes:emit\`.`);
			process.exit(1);
		}
		const onDisk = readFileSync(outPath, 'utf8');
		if (onDisk !== css) {
			console.error(
				`[themes:emit --check] generated/tokens.css is stale. Run \`bun run themes:emit\` and commit the diff.`,
			);
			process.exit(1);
		}
		console.log('[themes:emit --check] OK');
		return;
	}

	const dir = dirname(outPath);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(outPath, css);
	console.log(`[themes:emit] wrote ${outPath} (${css.length} bytes)`);
}

main();
