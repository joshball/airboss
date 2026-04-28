import { describe, expect, it } from 'vitest';
import type { ParsedPohsLocator } from '../types.ts';
import { formatPohsLocator, parsePohsLocator } from './locator.ts';

describe('parsePohsLocator', () => {
	it('parses an aircraft-only locator', () => {
		const result = parsePohsLocator('c172s');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pohs).toEqual({ aircraftSlug: 'c172s' });
	});

	it('parses a multi-part aircraft slug', () => {
		const result = parsePohsLocator('pa-28-181');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pohs?.aircraftSlug).toBe('pa-28-181');
	});

	it('parses aircraft + section', () => {
		const result = parsePohsLocator('c172s/section-2');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pohs).toEqual({ aircraftSlug: 'c172s', section: 'section-2' });
	});

	it('parses aircraft + section + subsection', () => {
		const result = parsePohsLocator('c172s/section-2/vne');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pohs).toEqual({
			aircraftSlug: 'c172s',
			section: 'section-2',
			subsection: 'vne',
		});
	});

	it('parses an emergency-section-only locator', () => {
		const result = parsePohsLocator('c172s/emergency');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pohs).toEqual({ aircraftSlug: 'c172s', section: 'emergency' });
	});

	it('parses an emergency procedure locator', () => {
		const result = parsePohsLocator('pa-28-181/emergency/engine-fire');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pohs).toEqual({
			aircraftSlug: 'pa-28-181',
			section: 'emergency',
			emergencyProcedure: 'engine-fire',
		});
	});

	it('parses a two-digit section', () => {
		const result = parsePohsLocator('sr22/section-10');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pohs?.section).toBe('section-10');
	});

	it('rejects empty locator', () => {
		const result = parsePohsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed aircraft slug (uppercase)', () => {
		const result = parsePohsLocator('C172S');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects malformed aircraft slug (starts with digit)', () => {
		const result = parsePohsLocator('172-skyhawk');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed section (zero)', () => {
		const result = parsePohsLocator('c172s/section-0');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed section (not "section-N")', () => {
		const result = parsePohsLocator('c172s/sec-2');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('section-');
	});

	it('rejects malformed subsection (uppercase)', () => {
		const result = parsePohsLocator('c172s/section-2/VNE');
		expect(result.kind).toBe('error');
	});

	it('rejects extra segments past subsection', () => {
		const result = parsePohsLocator('c172s/section-2/vne/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects extra segments past emergency procedure', () => {
		const result = parsePohsLocator('c172s/emergency/engine-fire/extra');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed emergency procedure', () => {
		const result = parsePohsLocator('c172s/emergency/Engine Fire');
		expect(result.kind).toBe('error');
	});
});

describe('formatPohsLocator round-trip', () => {
	it('round-trips a whole-POH locator', () => {
		const parsed: ParsedPohsLocator = { aircraftSlug: 'c172s' };
		expect(formatPohsLocator(parsed)).toBe('c172s');
	});

	it('round-trips a section locator', () => {
		const parsed: ParsedPohsLocator = { aircraftSlug: 'c172s', section: 'section-2' };
		expect(formatPohsLocator(parsed)).toBe('c172s/section-2');
	});

	it('round-trips a subsection locator', () => {
		const parsed: ParsedPohsLocator = {
			aircraftSlug: 'c172s',
			section: 'section-2',
			subsection: 'vne',
		};
		expect(formatPohsLocator(parsed)).toBe('c172s/section-2/vne');
	});

	it('round-trips an emergency procedure locator', () => {
		const parsed: ParsedPohsLocator = {
			aircraftSlug: 'pa-28-181',
			section: 'emergency',
			emergencyProcedure: 'engine-fire',
		};
		expect(formatPohsLocator(parsed)).toBe('pa-28-181/emergency/engine-fire');
	});
});
