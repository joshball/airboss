/**
 * Theme-token guard. Greps every new hangar Svelte file for hardcoded hex /
 * rgb / rgba / hsl colors in `<style>` blocks. Theme-lint already runs
 * whole-repo via `bun run check`, but this test keeps the bar in the
 * vitest suite too so a single-file regression during edits lights up fast.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const HANGAR_SRC = resolve(process.cwd(), 'apps/hangar/src');

function* walk(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			yield* walk(full);
		} else if (entry.endsWith('.svelte')) {
			yield full;
		}
	}
}

function extractStyle(source: string): string {
	const match = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);
	return match?.[1] ?? '';
}

/**
 * Hex, rgb(), rgba(), hsl(), hsla() -- these are the patterns theme-lint
 * considers raw-color violations. We don't duplicate the full ruleset
 * here; we just prove zero occurrences in hangar's styles.
 */
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\s*\(/;
const HSL = /\bhsla?\s*\(/;

describe('hangar theme tokens', () => {
	it('contains zero hardcoded hex / rgb / hsl colors in any Svelte <style> block', () => {
		const offenders: { file: string; match: string }[] = [];
		for (const file of walk(HANGAR_SRC)) {
			const source = readFileSync(file, 'utf8');
			const style = extractStyle(source);
			if (!style) continue;
			const hex = style.match(HEX);
			if (hex) offenders.push({ file, match: hex[0] });
			const rgb = style.match(RGB);
			if (rgb) offenders.push({ file, match: rgb[0] });
			const hsl = style.match(HSL);
			if (hsl) offenders.push({ file, match: hsl[0] });
		}
		expect(offenders, `theme-token violations: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);
	});
});
