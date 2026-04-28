import { describe, expect, it } from 'vitest';
import type { ParsedPlatesLocator } from '../types.ts';
import { formatPlatesLocator, parsePlatesLocator } from './locator.ts';

describe('parsePlatesLocator', () => {
	it('parses an ILS approach plate', () => {
		const result = parsePlatesLocator('KAPA/ils-rwy-35R');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.plates).toEqual({ airportId: 'KAPA', procedureSlug: 'ils-rwy-35R' });
	});

	it('parses an airport-diagram plate', () => {
		const result = parsePlatesLocator('KSFO/airport-diagram');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.plates).toEqual({ airportId: 'KSFO', procedureSlug: 'airport-diagram' });
	});

	it('parses a 3-char airport id', () => {
		const result = parsePlatesLocator('SFO/ils-rwy-28L');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.plates?.airportId).toBe('SFO');
	});

	it('preserves the runway suffix case (35R)', () => {
		const result = parsePlatesLocator('KAPA/ils-rwy-35R');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.plates?.procedureSlug).toBe('ils-rwy-35R');
	});

	it('rejects empty locator', () => {
		const result = parsePlatesLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects single-segment locator', () => {
		const result = parsePlatesLocator('KAPA');
		expect(result.kind).toBe('error');
	});

	it('rejects too many segments', () => {
		const result = parsePlatesLocator('KAPA/ils-rwy-35R/extra');
		expect(result.kind).toBe('error');
	});

	it('rejects lowercase airport id', () => {
		const result = parsePlatesLocator('kapa/ils-rwy-35R');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects 2-char airport id', () => {
		const result = parsePlatesLocator('KS/ils-rwy-28L');
		expect(result.kind).toBe('error');
	});

	it('rejects 5-char airport id', () => {
		const result = parsePlatesLocator('KKAPA/ils-rwy-35R');
		expect(result.kind).toBe('error');
	});

	it('rejects procedure slug starting with uppercase', () => {
		const result = parsePlatesLocator('KAPA/ILS-RWY-35R');
		expect(result.kind).toBe('error');
	});

	it('rejects procedure slug with whitespace', () => {
		const result = parsePlatesLocator('KAPA/ils rwy 35');
		expect(result.kind).toBe('error');
	});

	it('rejects empty procedure slug', () => {
		const result = parsePlatesLocator('KAPA/');
		expect(result.kind).toBe('error');
	});
});

describe('formatPlatesLocator round-trip', () => {
	it('round-trips an ILS plate locator', () => {
		const parsed: ParsedPlatesLocator = { airportId: 'KAPA', procedureSlug: 'ils-rwy-35R' };
		expect(formatPlatesLocator(parsed)).toBe('KAPA/ils-rwy-35R');
	});

	it('round-trips an airport-diagram locator', () => {
		const parsed: ParsedPlatesLocator = { airportId: 'KSFO', procedureSlug: 'airport-diagram' };
		expect(formatPlatesLocator(parsed)).toBe('KSFO/airport-diagram');
	});
});
