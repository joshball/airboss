/**
 * Phase 8 -- AC locator parser tests.
 *
 * Source of truth: ADR 019 §1.2 ("AC") + ParsedAcLocator in `../types.ts`.
 */

import { describe, expect, it } from 'vitest';
import { formatAcLocator, parseAcLocator } from './locator.ts';

describe('parseAcLocator', () => {
	it('parses doc + revision', () => {
		const r = parseAcLocator('61-65/j');
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.ac).toEqual({ docNumber: '61-65', revision: 'j' });
	});

	it('parses doc with dotted sub-number + revision', () => {
		const r = parseAcLocator('91-21.1/d');
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.ac).toEqual({ docNumber: '91-21.1', revision: 'd' });
	});

	it('parses section addressing', () => {
		const r = parseAcLocator('61-65/j/section-3');
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.ac).toEqual({ docNumber: '61-65', revision: 'j', section: '3' });
	});

	it('parses change addressing', () => {
		const r = parseAcLocator('61-65/j/change-2');
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.ac).toEqual({ docNumber: '61-65', revision: 'j', change: '2' });
	});

	it('rejects unrevisioned AC per ADR 019 §1.2', () => {
		const r = parseAcLocator('61-65');
		expect(r.kind).toBe('error');
		if (r.kind === 'error') {
			expect(r.message).toMatch(/missing revision/);
		}
	});

	it('rejects empty locator', () => {
		const r = parseAcLocator('');
		expect(r.kind).toBe('error');
	});

	it('rejects malformed doc number', () => {
		const r = parseAcLocator('abc/j');
		expect(r.kind).toBe('error');
	});

	it('rejects multi-letter revision', () => {
		const r = parseAcLocator('61-65/jj');
		expect(r.kind).toBe('error');
	});

	it('rejects unknown sub-segment', () => {
		const r = parseAcLocator('61-65/j/foo');
		expect(r.kind).toBe('error');
	});

	it('rejects extra segments', () => {
		const r = parseAcLocator('61-65/j/section-3/extra');
		expect(r.kind).toBe('error');
	});

	it('round-trips via formatAcLocator', () => {
		const cases = [
			{ docNumber: '61-65', revision: 'j' },
			{ docNumber: '61-65', revision: 'j', section: '3' },
			{ docNumber: '61-65', revision: 'j', change: '2' },
			{ docNumber: '91-21.1', revision: 'd' },
		];
		for (const ac of cases) {
			const formatted = formatAcLocator(ac);
			const parsed = parseAcLocator(formatted);
			expect(parsed.kind).toBe('ok');
			if (parsed.kind === 'ok') {
				expect(parsed.ac).toEqual(ac);
			}
		}
	});
});
