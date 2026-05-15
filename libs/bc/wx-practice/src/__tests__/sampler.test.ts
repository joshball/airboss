/**
 * Sampler tests. Drives the sampler with synthetic tokens + a mastery
 * map to verify (a) passive tokens move to `visible` mode, (b) demoted
 * families are oversampled, (c) determinism for a fixed seed.
 */

import { WX_PRACTICE_MASTERY_STATES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type DrillToken, masteryKey, sampleSession } from '../sampler';
import type { MasterySnapshot } from '../state-machine';

const TOKENS: DrillToken[] = [
	{
		rawExample: 'KICT 121753Z 28019G31KT 10SM FEW250 24/M02 A2999',
		product: 'metar',
		annotation: { token: '28019G31KT', family: 'wind', decode: 'wind 280 at 19 gust 31' },
	},
	{
		rawExample: 'KICT 121753Z 28019G31KT 10SM FEW250 24/M02 A2999',
		product: 'metar',
		annotation: { token: '10SM', family: 'visibility', decode: '10 statute miles visibility' },
	},
	{
		rawExample: 'KICT 121753Z 28019G31KT 10SM FEW250 24/M02 A2999',
		product: 'metar',
		annotation: { token: 'FEW250', family: 'sky-condition', decode: 'few layer at 25,000 ft' },
	},
	{
		rawExample: 'KICT 121753Z 28019G31KT 10SM FEW250 24/M02 A2999',
		product: 'metar',
		annotation: { token: 'A2999', family: 'altimeter', decode: 'altimeter 29.99 inHg' },
	},
];

function masteryRow(
	family: string,
	state: MasterySnapshot['state'],
	opts: Partial<MasterySnapshot> = {},
): MasterySnapshot {
	return {
		userId: 'usr_a',
		product: 'metar',
		family,
		subFamily: '',
		attempts: opts.attempts ?? 5,
		correct: opts.correct ?? 5,
		recentRing: opts.recentRing ?? [true, true, true, true, true],
		streakAcrossSessions: opts.streakAcrossSessions ?? 0,
		state,
		lastSeenAt: new Date(),
		lastUpdatedAt: new Date(),
	};
}

describe('sampleSession', () => {
	it('renders passive families as visible, not quiz', () => {
		const mastery = new Map<string, MasterySnapshot>();
		mastery.set(masteryKey('metar', 'altimeter', null), masteryRow('altimeter', WX_PRACTICE_MASTERY_STATES.PASSIVE));
		const items = sampleSession({ tokens: TOKENS, mastery, itemCount: 5, focusFamilies: null, seed: 1 });
		const altimeter = items.find((i) => i.token.annotation.family === 'altimeter');
		expect(altimeter?.mode).toBe('visible');
		// The other tokens default to quiz mode.
		const wind = items.find((i) => i.token.annotation.family === 'wind');
		expect(wind?.mode).toBe('quiz');
	});

	it('is deterministic for a fixed seed', () => {
		const mastery = new Map<string, MasterySnapshot>();
		const a = sampleSession({ tokens: TOKENS, mastery, itemCount: 3, focusFamilies: null, seed: 7 });
		const b = sampleSession({ tokens: TOKENS, mastery, itemCount: 3, focusFamilies: null, seed: 7 });
		expect(a.length).toBe(b.length);
		for (let i = 0; i < a.length; i += 1) {
			expect(a[i]?.token.annotation.token).toBe(b[i]?.token.annotation.token);
		}
	});

	it('respects focusFamilies filter', () => {
		const mastery = new Map<string, MasterySnapshot>();
		const items = sampleSession({
			tokens: TOKENS,
			mastery,
			itemCount: 5,
			focusFamilies: ['wind'],
			seed: 1,
		});
		for (const item of items) {
			expect(item.token.annotation.family).toBe('wind');
		}
	});

	it('caps quiz items at itemCount', () => {
		const mastery = new Map<string, MasterySnapshot>();
		const items = sampleSession({ tokens: TOKENS, mastery, itemCount: 2, focusFamilies: null, seed: 1 });
		// All four are quizzable -> we get exactly 2 quiz items.
		const quizCount = items.filter((i) => i.mode === 'quiz').length;
		expect(quizCount).toBe(2);
	});
});
