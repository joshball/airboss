/**
 * Every color value in every registered palette must parse as valid
 * sRGB-hex or OKLCH. Catches typos (`oklcch(...)`, `#xyz`) and
 * out-of-range values.
 */

import { listThemes } from '@ab/themes';
import { describe, expect, it } from 'vitest';
import type { Palette } from '../contract';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const HEX_SHORT_RE = /^#[0-9a-fA-F]{3}$/;
const OKLCH_RE = /^oklch\(\s*(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?\)$/;
const RGBA_RE = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/;

function isValidColor(value: string): boolean {
	if (HEX_RE.test(value) || HEX_SHORT_RE.test(value)) return true;
	const oklchMatch = value.match(OKLCH_RE);
	if (oklchMatch) {
		const lStr = oklchMatch[1];
		const cStr = oklchMatch[2];
		const hStr = oklchMatch[3];
		if (lStr === undefined || cStr === undefined || hStr === undefined) return false;
		const l = Number.parseFloat(lStr);
		const c = Number.parseFloat(cStr);
		const h = Number.parseFloat(hStr);
		if (!(l >= 0 && l <= 1)) return false;
		if (!(c >= 0 && c <= 0.5)) return false;
		if (!(h >= 0 && h <= 360)) return false;
		return true;
	}
	if (RGBA_RE.test(value)) return true;
	return false;
}

function flattenPalette(palette: Palette): ReadonlyArray<readonly [string, string]> {
	const out: Array<readonly [string, string]> = [];
	out.push(
		['ink.body', palette.ink.body],
		['ink.muted', palette.ink.muted],
		['ink.subtle', palette.ink.subtle],
		['ink.faint', palette.ink.faint],
		['ink.strong', palette.ink.strong],
		['ink.inverse', palette.ink.inverse],
		['surface.page', palette.surface.page],
		['surface.panel', palette.surface.panel],
		['surface.raised', palette.surface.raised],
		['surface.sunken', palette.surface.sunken],
		['surface.muted', palette.surface.muted],
		['surface.overlay', palette.surface.overlay],
		['edge.default', palette.edge.default],
		['edge.strong', palette.edge.strong],
		['edge.subtle', palette.edge.subtle],
		['action.default', palette.action.default],
		['action.hazard', palette.action.hazard],
		['action.caution', palette.action.caution],
		['action.neutral', palette.action.neutral],
		['action.link', palette.action.link],
		['signal.success', palette.signal.success],
		['signal.warning', palette.signal.warning],
		['signal.danger', palette.signal.danger],
		['signal.info', palette.signal.info],
		['focus', palette.focus],
		['accent.code', palette.accent.code],
		['accent.reference', palette.accent.reference],
		['accent.definition', palette.accent.definition],
	);
	return out;
}

const themes = listThemes();
for (const theme of themes) {
	for (const appearance of theme.appearances) {
		const palette = theme.palette[appearance];
		if (!palette) continue;
		describe(`palette parse: ${theme.id} / ${appearance}`, () => {
			for (const [path, value] of flattenPalette(palette)) {
				it(`${path}: ${value}`, () => {
					expect(isValidColor(value), `Invalid color at ${path}: ${value}`).toBe(true);
				});
			}
		});
	}
}

describe('isValidColor sanity', () => {
	it('accepts 6-digit hex', () => {
		expect(isValidColor('#ffffff')).toBe(true);
	});
	it('rejects malformed hex', () => {
		expect(isValidColor('#xyz123')).toBe(false);
	});
	it('rejects typo oklcch', () => {
		expect(isValidColor('oklcch(0.5 0.1 200)')).toBe(false);
	});
	it('accepts valid oklch', () => {
		expect(isValidColor('oklch(0.5 0.1 200)')).toBe(true);
	});
	it('rejects out-of-range oklch lightness', () => {
		expect(isValidColor('oklch(1.5 0.1 200)')).toBe(false);
	});
});

export { isValidColor };
