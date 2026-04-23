import { describe, expect, it } from 'vitest';
import { requireInt } from './form';

function makeForm(pairs: Array<[string, string]>): FormData {
	const fd = new FormData();
	for (const [k, v] of pairs) fd.append(k, v);
	return fd;
}

describe('requireInt', () => {
	it('accepts a non-negative integer string', () => {
		const r = requireInt(makeForm([['slotIndex', '0']]), 'slotIndex');
		expect(r).toEqual({ ok: true, value: 0 });
	});

	it('accepts a positive integer string', () => {
		const r = requireInt(makeForm([['n', '42']]), 'n');
		expect(r).toEqual({ ok: true, value: 42 });
	});

	it('accepts a signed integer string', () => {
		const r = requireInt(makeForm([['n', '-7']]), 'n');
		expect(r).toEqual({ ok: true, value: -7 });
	});

	it('rejects a missing field', () => {
		const r = requireInt(makeForm([]), 'slotIndex');
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error).toMatch(/required/);
	});

	it('rejects an empty string field (would have coerced to 0)', () => {
		const r = requireInt(makeForm([['slotIndex', '']]), 'slotIndex');
		expect(r.ok).toBe(false);
	});

	it('rejects whitespace-only values', () => {
		const r = requireInt(makeForm([['slotIndex', '   ']]), 'slotIndex');
		expect(r.ok).toBe(false);
	});

	it('rejects non-numeric strings', () => {
		const r = requireInt(makeForm([['n', 'foo']]), 'n');
		expect(r.ok).toBe(false);
	});

	it('rejects floats', () => {
		const r = requireInt(makeForm([['n', '3.14']]), 'n');
		expect(r.ok).toBe(false);
	});

	it('rejects NaN', () => {
		const r = requireInt(makeForm([['n', 'NaN']]), 'n');
		expect(r.ok).toBe(false);
	});

	it('rejects Infinity', () => {
		const r = requireInt(makeForm([['n', 'Infinity']]), 'n');
		expect(r.ok).toBe(false);
	});
});
