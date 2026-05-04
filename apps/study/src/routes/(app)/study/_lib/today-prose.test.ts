/**
 * Today prose helper -- pure-string assertions against the worked-examples
 * table in `docs/work-packages/study-home/design.md`. Each describe block
 * pins one `kind`. Day-count handling lives in its own block; the worked
 * examples in design.md don't carry day-count, so the body strings here
 * mirror them and a separate test asserts the day-clause prefix is added
 * when `dayCount` is non-null.
 */

import { describe, expect, it } from 'vitest';
import { renderTodayProse } from './today-prose';
import type { TodayBriefing } from './today-types';

const PHAK_CITE = { kind: 'handbook' as const, label: 'PHAK chapter 10', href: '/library/handbook/phak/10' };

const ZERO_GATES = {
	recall: 'insufficient_data' as const,
	calculation: 'insufficient_data' as const,
	scenario: 'insufficient_data' as const,
	demonstration: 'not_applicable' as const,
	teaching: 'not_applicable' as const,
};

describe('renderTodayProse', () => {
	describe("kind: 'no-goal'", () => {
		it('returns empty strings (banner replaces the panel)', () => {
			const out = renderTodayProse({ kind: 'no-goal' });
			expect(out).toEqual({ headline: '', body: '', cta: null });
		});
	});

	describe("kind: 'caught_up'", () => {
		it('returns the caught-up nudge', () => {
			const out = renderTodayProse({ kind: 'caught_up' });
			expect(out.body).toBe("You're caught up. Pick a topic from the map to dig in.");
			expect(out.headline).toBe('');
			expect(out.cta).toBeNull();
		});
	});

	describe("kind: 'focus'", () => {
		it('all reasons never_attempted, primary cite PHAK ch. 10', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance-arm-moment',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance -- arm and moment',
				areaTitle: 'Performance and Limitations',
				pillState: { nodeId: 'node-1', ...ZERO_GATES },
				methodPercentages: { recall: null, calculation: null, scenario: null },
				reasons: [{ kind: 'never_attempted' }],
				primaryCitation: PHAK_CITE,
				dayCount: null,
			};
			const out = renderTodayProse(briefing);
			expect(out.headline).toBe('Weight & balance -- arm and moment');
			expect(out.body).toBe("You haven't started this yet. PHAK chapter 10 covers it.");
			expect(out.cta).not.toBeNull();
			expect(out.cta?.href).toBe('/knowledge/weight-balance-arm-moment');
		});

		it('low_accuracy on cards, recall 4/10, primary cite PHAK ch. 10', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance-arm-moment',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance -- arm and moment',
				areaTitle: 'Performance and Limitations',
				pillState: { nodeId: 'node-1', ...ZERO_GATES, recall: 'fail' },
				methodPercentages: { recall: 60, calculation: null, scenario: null },
				reasons: [{ kind: 'low_accuracy', accuracy: 0.6, dataPoints: 10, method: 'recall' }],
				primaryCitation: PHAK_CITE,
				dayCount: null,
			};
			const out = renderTodayProse(briefing);
			expect(out.body).toBe('You miss this 4 out of 10 times on the cards. Try reviewing PHAK chapter 10.');
		});

		it('overdue, 12 due, recall 8/10', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance',
				areaTitle: 'Performance and Limitations',
				pillState: { nodeId: 'node-1', ...ZERO_GATES, recall: 'pass' },
				methodPercentages: { recall: 80, calculation: null, scenario: null },
				reasons: [
					{ kind: 'overdue', dueCards: 12 },
					{ kind: 'low_accuracy', accuracy: 0.8, dataPoints: 10, method: 'recall' },
				],
				primaryCitation: null,
				dayCount: null,
			};
			const out = renderTodayProse(briefing);
			expect(out.headline).toBe('Weight & balance');
			expect(out.body).toBe('12 cards due on this. Review them when you have a few minutes.');
		});

		it('mixed: recall mastered, scenario zero attempts -> "Try a scenario."', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance-arm-moment',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance -- arm and moment',
				areaTitle: 'Performance and Limitations',
				pillState: {
					nodeId: 'node-1',
					...ZERO_GATES,
					recall: 'pass',
					scenario: 'insufficient_data',
				},
				methodPercentages: { recall: 100, calculation: null, scenario: 0 },
				reasons: [{ kind: 'partial' }],
				primaryCitation: null,
				dayCount: null,
			};
			const out = renderTodayProse(briefing);
			expect(out.body).toBe("You're 100% understood. No practice yet. Try a scenario.");
		});

		it('mixed: recall 60%, calculation 25%, scenario zero, low_accuracy on calculation', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance-arm-moment',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance -- arm and moment',
				areaTitle: 'Performance and Limitations',
				pillState: {
					nodeId: 'node-1',
					...ZERO_GATES,
					recall: 'fail',
					calculation: 'fail',
					scenario: 'insufficient_data',
				},
				methodPercentages: { recall: 60, calculation: 25, scenario: 0 },
				reasons: [{ kind: 'low_accuracy', accuracy: 0.6, dataPoints: 10, method: 'calculation' }],
				primaryCitation: null,
				dayCount: null,
			};
			const out = renderTodayProse(briefing);
			expect(out.body).toBe(
				"You're 60% understood, 25% memorized. No practice yet. The next gap is the arm-and-moment formula -- you miss it 4 out of 10 times.",
			);
		});
	});

	describe('day-count clause (Decision Q6 / SH-3a)', () => {
		it('prepends "You\'ve been working on this for N days." when dayCount > 1', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance',
				areaTitle: 'Performance and Limitations',
				pillState: { nodeId: 'node-1', ...ZERO_GATES, recall: 'pass' },
				methodPercentages: { recall: 80, calculation: null, scenario: null },
				reasons: [{ kind: 'overdue', dueCards: 12 }],
				primaryCitation: null,
				dayCount: 3,
			};
			const out = renderTodayProse(briefing);
			expect(out.body).toBe(
				"You've been working on this for 3 days. 12 cards due on this. Review them when you have a few minutes.",
			);
		});

		it('uses singular "1 day" when dayCount === 1', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance',
				areaTitle: 'Performance and Limitations',
				pillState: { nodeId: 'node-1', ...ZERO_GATES },
				methodPercentages: { recall: null, calculation: null, scenario: null },
				reasons: [{ kind: 'never_attempted' }],
				primaryCitation: PHAK_CITE,
				dayCount: 1,
			};
			const out = renderTodayProse(briefing);
			expect(out.body).toBe(
				"You've been working on this for 1 day. You haven't started this yet. PHAK chapter 10 covers it.",
			);
		});

		it('omits the day clause when dayCount is null (never touched)', () => {
			const briefing: TodayBriefing = {
				kind: 'focus',
				focusNodeId: 'node-1',
				focusNodeSlug: 'weight-balance',
				focusAreaId: 'area-1',
				leafTitle: 'Weight & balance',
				areaTitle: 'Performance and Limitations',
				pillState: { nodeId: 'node-1', ...ZERO_GATES },
				methodPercentages: { recall: null, calculation: null, scenario: null },
				reasons: [{ kind: 'never_attempted' }],
				primaryCitation: PHAK_CITE,
				dayCount: null,
			};
			const out = renderTodayProse(briefing);
			expect(out.body).toBe("You haven't started this yet. PHAK chapter 10 covers it.");
		});
	});
});
