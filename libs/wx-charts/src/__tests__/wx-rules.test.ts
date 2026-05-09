/**
 * Unit tests for the wx-rules helpers (flight category, ceiling, summarize cover).
 *
 * Per WP test plan WXC-31 / WXC-32 indirectly: these rules feed every
 * point-glyph chart's category coloring + ceiling teaching ring.
 */

import { describe, expect, it } from 'vitest';
import { ceilingFtAgl, celsiusToFahrenheit, computeFlightCategory, flightCategory, summarizeCover } from '../wx/rules';

describe('ceilingFtAgl', () => {
	it('returns null for clear skies', () => {
		expect(ceilingFtAgl([{ cover: 'CLR', heightFtAgl: null }])).toBeNull();
	});

	it('returns null when only FEW/SCT layers reported', () => {
		expect(
			ceilingFtAgl([
				{ cover: 'FEW', heightFtAgl: 500 },
				{ cover: 'SCT', heightFtAgl: 2000 },
			]),
		).toBeNull();
	});

	it('returns the lowest BKN/OVC layer height', () => {
		expect(
			ceilingFtAgl([
				{ cover: 'SCT', heightFtAgl: 500 },
				{ cover: 'BKN', heightFtAgl: 1200 },
				{ cover: 'OVC', heightFtAgl: 800 },
			]),
		).toBe(800);
	});

	it('treats VV (vertical visibility) as a ceiling', () => {
		expect(ceilingFtAgl([{ cover: 'VV', heightFtAgl: 200 }])).toBe(200);
	});

	it('skips layers with null heightFtAgl', () => {
		expect(
			ceilingFtAgl([
				{ cover: 'BKN', heightFtAgl: null },
				{ cover: 'OVC', heightFtAgl: 1500 },
			]),
		).toBe(1500);
	});
});

describe('summarizeCover', () => {
	it('returns SKC for empty layers', () => {
		expect(summarizeCover([])).toBe('SKC');
	});

	it('returns highest-cover summary across layers', () => {
		expect(
			summarizeCover([
				{ cover: 'FEW', heightFtAgl: 500 },
				{ cover: 'BKN', heightFtAgl: 1500 },
				{ cover: 'SCT', heightFtAgl: 1000 },
			]),
		).toBe('BKN');
	});

	it('VV ranks above OVC', () => {
		expect(
			summarizeCover([
				{ cover: 'OVC', heightFtAgl: 1000 },
				{ cover: 'VV', heightFtAgl: 200 },
			]),
		).toBe('VV');
	});
});

describe('flightCategory', () => {
	it('returns LIFR when ceiling < 500', () => {
		expect(flightCategory(400, 10)).toBe('LIFR');
	});

	it('returns LIFR when visibility < 1', () => {
		expect(flightCategory(5000, 0.5)).toBe('LIFR');
	});

	it('returns IFR when ceiling 500-1000 with good visibility', () => {
		expect(flightCategory(800, 10)).toBe('IFR');
	});

	it('returns IFR when visibility 1-3 with high ceiling', () => {
		expect(flightCategory(5000, 2)).toBe('IFR');
	});

	it('returns MVFR when ceiling 1000-3000', () => {
		expect(flightCategory(2000, 10)).toBe('MVFR');
		expect(flightCategory(3000, 10)).toBe('MVFR');
	});

	it('returns MVFR when visibility 3-5', () => {
		expect(flightCategory(5000, 4)).toBe('MVFR');
		expect(flightCategory(5000, 5)).toBe('MVFR');
	});

	it('returns VFR when ceiling > 3000 and visibility > 5', () => {
		expect(flightCategory(5000, 10)).toBe('VFR');
		expect(flightCategory(3500, 6)).toBe('VFR');
	});

	it('treats null ceiling as unlimited', () => {
		expect(flightCategory(null, 10)).toBe('VFR');
	});

	it('treats null visibility as unlimited', () => {
		expect(flightCategory(5000, null)).toBe('VFR');
	});
});

describe('computeFlightCategory', () => {
	it('derives category from a parsed METAR shape', () => {
		const cat = computeFlightCategory({
			clouds: [{ cover: 'OVC', heightFtAgl: 600 }],
			visibilitySM: 4,
		});
		expect(cat).toBe('IFR');
	});
});

describe('celsiusToFahrenheit', () => {
	it('converts known reference points', () => {
		expect(celsiusToFahrenheit(0)).toBe(32);
		expect(celsiusToFahrenheit(100)).toBe(212);
		expect(celsiusToFahrenheit(-40)).toBe(-40);
	});

	it('rounds to nearest integer', () => {
		expect(celsiusToFahrenheit(20)).toBe(68);
		expect(celsiusToFahrenheit(20.4)).toBe(69);
	});
});
