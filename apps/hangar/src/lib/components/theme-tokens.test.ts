/**
 * Theme-token guard for the libs/ui components wp-hangar-sources-v1 ports
 * from airboss-firc. The whole-repo theme-lint runs in `bun run check`;
 * this file is a local fast-fail for the specific files this WP owns so a
 * regression lights up during edit-save rather than at the check barrier.
 *
 * The hangar-side server-owned test in `lib/server/theme-tokens.test.ts`
 * covers `apps/hangar/src/**` already; this one fills in libs/ui.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..');

const FILES = [
	'libs/ui/src/components/DataTable.svelte',
	'libs/ui/src/components/FormStack.svelte',
	'libs/ui/src/components/ConfirmDialog.svelte',
	'libs/ui/src/components/ValidationReport.svelte',
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\s*\(/;
const HSL = /\bhsla?\s*\(/;

function extractStyle(source: string): string {
	const match = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);
	return match?.[1] ?? '';
}

describe('wp-hangar-sources-v1 libs/ui theme tokens', () => {
	for (const relative of FILES) {
		it(`${relative} <style> block has no hardcoded color`, () => {
			const raw = readFileSync(resolve(REPO_ROOT, relative), 'utf8');
			const style = extractStyle(raw);
			expect(style.match(HEX)).toBeNull();
			expect(style.match(RGB)).toBeNull();
			expect(style.match(HSL)).toBeNull();
		});
	}
});
