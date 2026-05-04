/**
 * Tone contract: the shared `Tone` enum powers Badge / StatTile / Banner.
 * Tones describe the *intent of a status indicator*, distinct from
 * `Button.variant` which describes the *role of an action*.
 *
 * Lives next to `tones.ts` in `@ab/themes` (the canonical home). Was
 * formerly under `libs/ui/__tests__/` because `@ab/ui` re-exported the
 * vocabulary; that re-export was dropped to keep the public surface
 * minimal (architecture review minor 2026-05-02).
 */

import { describe, expect, it } from 'vitest';

import { isTone, TONES, type Tone } from '../tones';

describe('tones', () => {
	it('exposes the full canonical set', () => {
		const expected: Tone[] = ['default', 'featured', 'muted', 'success', 'warning', 'danger', 'info', 'accent'];
		expect([...TONES].sort()).toEqual(expected.slice().sort());
	});

	it('isTone accepts every canonical tone', () => {
		for (const t of TONES) {
			expect(isTone(t)).toBe(true);
		}
	});

	it('isTone rejects retired aliases and unknown values', () => {
		// `primary` was renamed to `featured`; `neutral` was a legacy alias
		// for `default`. Both must now be type-rejected so call sites can't
		// silently regress.
		expect(isTone('primary')).toBe(false);
		expect(isTone('neutral')).toBe(false);
		expect(isTone('')).toBe(false);
		expect(isTone(undefined)).toBe(false);
		expect(isTone(null)).toBe(false);
		expect(isTone(42)).toBe(false);
	});
});
