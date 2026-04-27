import { describe, expect, it } from 'vitest';
import type { ParsedAcsLocator } from '../types.ts';
import { formatAcsLocator, parseAcsLocator } from './locator.ts';

describe('parseAcsLocator', () => {
	it('parses a whole-publication locator', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({ cert: 'ppl-asel', edition: 'faa-s-acs-25' });
	});

	it('parses an area locator', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({ cert: 'ppl-asel', edition: 'faa-s-acs-25', area: 'v' });
	});

	it('parses a task locator', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v/task-a');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({ cert: 'ppl-asel', edition: 'faa-s-acs-25', area: 'v', task: 'a' });
	});

	it('parses a knowledge element locator', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v/task-a/element-k1');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({
			cert: 'ppl-asel',
			edition: 'faa-s-acs-25',
			area: 'v',
			task: 'a',
			elementTriad: 'k',
			elementOrdinal: '1',
		});
	});

	it('parses a risk-management element locator', () => {
		const result = parseAcsLocator('cfi-asel/faa-s-acs-25/area-i/task-a/element-r2');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toMatchObject({ elementTriad: 'r', elementOrdinal: '2' });
	});

	it('parses a skill element locator', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v/task-a/element-s3');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toMatchObject({ elementTriad: 's', elementOrdinal: '3' });
	});

	it('parses two-digit element ordinals', () => {
		const result = parseAcsLocator('cfi-asel/faa-s-acs-25/area-ii/task-b/element-k12');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toMatchObject({ elementOrdinal: '12' });
	});

	it('rejects empty locator', () => {
		const result = parseAcsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown cert slug', () => {
		const result = parseAcsLocator('made-up-cert/faa-s-acs-25');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('cert');
	});

	it('rejects malformed edition slug', () => {
		const result = parseAcsLocator('ppl-asel/2024-09-private');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('edition');
	});

	it('rejects malformed area segment', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-5');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('area');
	});

	it('rejects malformed task segment', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v/task-AA');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('task');
	});

	it('rejects malformed element segment (unknown triad)', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v/task-a/element-x1');
		expect(result.kind).toBe('error');
	});

	it('rejects element segment without ordinal', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v/task-a/element-k');
		expect(result.kind).toBe('error');
	});

	it('rejects extra segments after element', () => {
		const result = parseAcsLocator('ppl-asel/faa-s-acs-25/area-v/task-a/element-k1/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected segments');
	});
});

describe('formatAcsLocator', () => {
	it('round-trips through parse', () => {
		const cases: ParsedAcsLocator[] = [
			{ cert: 'ppl-asel', edition: 'faa-s-acs-25' },
			{ cert: 'ppl-asel', edition: 'faa-s-acs-25', area: 'v' },
			{ cert: 'ppl-asel', edition: 'faa-s-acs-25', area: 'v', task: 'a' },
			{
				cert: 'ppl-asel',
				edition: 'faa-s-acs-25',
				area: 'v',
				task: 'a',
				elementTriad: 'k',
				elementOrdinal: '1',
			},
			{
				cert: 'cfi-asel',
				edition: 'faa-s-acs-25',
				area: 'iii',
				task: 'b',
				elementTriad: 'r',
				elementOrdinal: '7',
			},
		];
		for (const c of cases) {
			const formatted = formatAcsLocator(c);
			const parsed = parseAcsLocator(formatted);
			expect(parsed.kind).toBe('ok');
			if (parsed.kind !== 'ok') continue;
			expect(parsed.acs).toEqual(c);
		}
	});

	it('truncates output when intermediate fields are missing', () => {
		// area set but task missing -> stops at area
		const formatted = formatAcsLocator({
			cert: 'ppl-asel',
			edition: 'faa-s-acs-25',
			area: 'v',
			elementTriad: 'k',
			elementOrdinal: '1',
		});
		expect(formatted).toBe('ppl-asel/faa-s-acs-25/area-v');
	});
});
