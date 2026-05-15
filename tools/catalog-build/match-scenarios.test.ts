import { describe, expect, it } from 'vitest';
import { normalizeRaw } from './match-scenarios';

describe('normalizeRaw', () => {
	it('strips leading + trailing whitespace', () => {
		expect(normalizeRaw('  KORD 121153Z 24008KT 10SM SKC 12/04 A3010\n')).toBe(
			'KORD 121153Z 24008KT 10SM SKC 12/04 A3010',
		);
	});

	it('collapses internal runs of whitespace to single spaces', () => {
		expect(normalizeRaw('KORD   121153Z\t24008KT\n10SM  SKC 12/04 A3010')).toBe(
			'KORD 121153Z 24008KT 10SM SKC 12/04 A3010',
		);
	});

	it('treats identical METARs with different whitespace as equal', () => {
		const a = 'KSTL 191953Z 20014KT 5SM -RA BKN045 OVC120 17/13 A2969';
		const b = '  KSTL\t191953Z\n20014KT  5SM -RA BKN045 OVC120 17/13 A2969\n';
		expect(normalizeRaw(a)).toBe(normalizeRaw(b));
	});

	it('keeps token boundaries -- different tokens stay non-equal', () => {
		expect(normalizeRaw('KORD 121153Z')).not.toBe(normalizeRaw('KORD121153Z'));
	});
});
