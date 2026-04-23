/**
 * Tone contract: the shared `Tone` enum powers Badge / StatTile / Banner.
 * `resolveTone` collapses the legacy `neutral` alias onto `default` so
 * migrated primitives keep a uniform switch shape.
 */

import { resolveTone, TONES, type Tone } from '@ab/ui';
import { describe, expect, it } from 'vitest';

describe('tones', () => {
	it('exposes the full spec set', () => {
		const expected: Tone[] = ['default', 'primary', 'success', 'warning', 'danger', 'info', 'muted', 'accent'];
		const got = Object.values(TONES).sort();
		expect(got).toEqual(expected.slice().sort());
	});

	it('resolveTone collapses legacy neutral to default', () => {
		expect(resolveTone('neutral')).toBe('default');
	});

	it('resolveTone is identity on canonical tones', () => {
		for (const t of Object.values(TONES)) {
			expect(resolveTone(t)).toBe(t);
		}
	});

	it('resolveTone handles undefined safely', () => {
		expect(resolveTone(undefined)).toBe('default');
	});
});
