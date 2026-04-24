#!/usr/bin/env bun
/**
 * One-shot helper for WP #8: convert hex strings to OKLCH strings with
 * the same rounding the palette files adopt. Usage:
 *
 *   bun scripts/themes/hex-to-oklch.ts '#2563eb' '#dc2626'
 *
 * With no arguments, dumps the conversion of every hex string from
 * the current palette files for human review before the palette
 * rewrite is committed.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { contrastRatio, hexToOklch } from '../../libs/themes/contrast';

const PALETTE_DIRS = [
	'libs/themes/core/defaults/airboss-default',
	'libs/themes/study/sectional',
	'libs/themes/study/flightdeck',
	'libs/themes/sim/glass',
];

const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function expandShortHex(hex: string): string {
	if (hex.length !== 4) return hex;
	const r = hex[1];
	const g = hex[2];
	const b = hex[3];
	return `#${r}${r}${g}${g}${b}${b}`;
}

function convertAndReport(hex: string): void {
	const long = hex.length === 4 ? expandShortHex(hex) : hex;
	const oklch = hexToOklch(long);
	if (!oklch) {
		console.log(`  ${hex}  <unparseable>`);
		return;
	}
	const ratio = contrastRatio(long, oklch);
	const drift = Math.abs(ratio - 1);
	console.log(`  ${hex} -> ${oklch}  (drift ${drift.toFixed(4)})`);
}

async function dumpPaletteFile(path: string): Promise<void> {
	const content = readFileSync(path, 'utf8');
	const hits = content.match(HEX_RE);
	if (!hits) return;
	const unique = Array.from(new Set(hits));
	console.log(`\n${path}`);
	for (const hex of unique) convertAndReport(hex);
}

function walkDir(dir: string, out: string[]): void {
	const entries = readdirSync(dir);
	for (const entry of entries) {
		const full = join(dir, entry);
		const s = statSync(full);
		if (s.isDirectory()) walkDir(full, out);
		else if (/palette\.(light|dark)\.ts$/.test(entry)) out.push(full);
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.length > 0) {
		for (const hex of args) convertAndReport(hex);
		return;
	}
	const files: string[] = [];
	for (const dir of PALETTE_DIRS) {
		const absolute = resolve(dir);
		try {
			walkDir(absolute, files);
		} catch {
			// dir may not exist yet; skip silently.
		}
	}
	for (const file of files.sort()) {
		await dumpPaletteFile(file);
	}
}

await main();
