/**
 * State machine unit tests. Walk the active -> passive -> demoted ->
 * active loop with synthetic inputs.
 */

import {
	WX_PRACTICE_MASTERY_STATES,
	WX_PRACTICE_PROMOTION_STREAK,
	WX_PRACTICE_RECOVERY_STREAK,
} from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { applyAttempt, type MasterySnapshot } from '../state-machine';

function baseAttempt(prior: MasterySnapshot | null, correct: boolean, acrossSession = true) {
	return applyAttempt({
		prior,
		userId: 'usr_a',
		product: 'metar',
		family: 'altimeter',
		subFamily: '',
		correct,
		acrossSession,
	});
}

describe('state machine', () => {
	it('starts a new family in active state', () => {
		const out = baseAttempt(null, true);
		expect(out.mastery.state).toBe(WX_PRACTICE_MASTERY_STATES.ACTIVE);
		expect(out.mastery.attempts).toBe(1);
		expect(out.mastery.correct).toBe(1);
		expect(out.mastery.streakAcrossSessions).toBe(1);
	});

	it('promotes active -> passive after a full ring of correct + N cross-session streak', () => {
		let prior: MasterySnapshot | null = null;
		const transitions: ReturnType<typeof applyAttempt>['transition'][] = [];
		for (let i = 0; i < WX_PRACTICE_PROMOTION_STREAK + 10; i += 1) {
			const result = baseAttempt(prior, true, true);
			prior = result.mastery;
			transitions.push(result.transition);
		}
		expect(prior?.state).toBe(WX_PRACTICE_MASTERY_STATES.PASSIVE);
		// Exactly one promotion event should appear in the transition log.
		const promotions = transitions.filter((t) => t.kind === 'promoted');
		expect(promotions.length).toBe(1);
	});

	it('never promotes families on the never-promote list', () => {
		let prior: MasterySnapshot | null = null;
		for (let i = 0; i < WX_PRACTICE_PROMOTION_STREAK + 10; i += 1) {
			const result = applyAttempt({
				prior,
				userId: 'usr_a',
				product: 'metar',
				family: 'wx-phenomenon',
				subFamily: '',
				correct: true,
				acrossSession: true,
			});
			prior = result.mastery;
		}
		expect(prior?.state).toBe(WX_PRACTICE_MASTERY_STATES.ACTIVE);
	});

	it('demotes passive -> demoted on a wrong answer', () => {
		const passive: MasterySnapshot = {
			userId: 'usr_a',
			product: 'metar',
			family: 'altimeter',
			subFamily: '',
			attempts: 10,
			correct: 10,
			recentRing: Array.from({ length: 10 }, () => true),
			streakAcrossSessions: 10,
			state: WX_PRACTICE_MASTERY_STATES.PASSIVE,
			lastSeenAt: new Date(),
			lastUpdatedAt: new Date(),
		};
		const out = baseAttempt(passive, false);
		expect(out.mastery.state).toBe(WX_PRACTICE_MASTERY_STATES.DEMOTED);
		expect(out.transition.kind).toBe('demoted');
		expect(out.mastery.streakAcrossSessions).toBe(0);
	});

	it('recovers demoted -> active after N consecutive correct', () => {
		let prior: MasterySnapshot = {
			userId: 'usr_a',
			product: 'metar',
			family: 'altimeter',
			subFamily: '',
			attempts: 5,
			correct: 4,
			recentRing: [true, true, true, true, false],
			streakAcrossSessions: 0,
			state: WX_PRACTICE_MASTERY_STATES.DEMOTED,
			lastSeenAt: new Date(),
			lastUpdatedAt: new Date(),
		};
		let transition: ReturnType<typeof applyAttempt>['transition'] = { kind: 'none' };
		for (let i = 0; i < WX_PRACTICE_RECOVERY_STREAK; i += 1) {
			const result = baseAttempt(prior, true, false);
			prior = result.mastery;
			transition = result.transition;
		}
		expect(prior.state).toBe(WX_PRACTICE_MASTERY_STATES.ACTIVE);
		expect(transition.kind).toBe('recovered');
	});

	it('resets cross-session streak to 0 on any wrong answer', () => {
		const prior: MasterySnapshot = {
			userId: 'usr_a',
			product: 'metar',
			family: 'wind',
			subFamily: '',
			attempts: 8,
			correct: 8,
			recentRing: Array.from({ length: 8 }, () => true),
			streakAcrossSessions: 4,
			state: WX_PRACTICE_MASTERY_STATES.ACTIVE,
			lastSeenAt: new Date(),
			lastUpdatedAt: new Date(),
		};
		const out = baseAttempt(prior, false);
		expect(out.mastery.streakAcrossSessions).toBe(0);
		expect(out.mastery.state).toBe(WX_PRACTICE_MASTERY_STATES.ACTIVE);
	});

	it('does not increment streakAcrossSessions for within-session correct attempts', () => {
		const prior: MasterySnapshot = {
			userId: 'usr_a',
			product: 'metar',
			family: 'wind',
			subFamily: '',
			attempts: 3,
			correct: 3,
			recentRing: [true, true, true],
			streakAcrossSessions: 2,
			state: WX_PRACTICE_MASTERY_STATES.ACTIVE,
			lastSeenAt: new Date(),
			lastUpdatedAt: new Date(),
		};
		const out = baseAttempt(prior, true, false);
		expect(out.mastery.streakAcrossSessions).toBe(2);
	});
});
