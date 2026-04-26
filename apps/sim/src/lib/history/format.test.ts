import { SIM_SCENARIO_OUTCOMES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	asScenarioOutcome,
	formatAbsoluteDate,
	formatElapsed,
	formatGradePercent,
	formatGradingKind,
	formatOutcomeLabel,
	formatRelativeTime,
	outcomeTone,
} from './format';

describe('formatElapsed', () => {
	it('formats whole-second values as m:ss', () => {
		expect(formatElapsed(0)).toBe('0:00');
		expect(formatElapsed(5)).toBe('0:05');
		expect(formatElapsed(59)).toBe('0:59');
		expect(formatElapsed(60)).toBe('1:00');
		expect(formatElapsed(61)).toBe('1:01');
		expect(formatElapsed(599)).toBe('9:59');
		expect(formatElapsed(600)).toBe('10:00');
	});

	it('floors fractional seconds', () => {
		expect(formatElapsed(12.99)).toBe('0:12');
		expect(formatElapsed(60.25)).toBe('1:00');
	});

	it('clamps negative input to zero', () => {
		expect(formatElapsed(-1)).toBe('0:00');
		expect(formatElapsed(-99)).toBe('0:00');
	});
});

describe('formatGradePercent', () => {
	it('renders a fraction as a whole-number percentage', () => {
		expect(formatGradePercent(0)).toBe('0%');
		expect(formatGradePercent(0.5)).toBe('50%');
		expect(formatGradePercent(1)).toBe('100%');
	});

	it('rounds to the nearest integer', () => {
		expect(formatGradePercent(0.834)).toBe('83%');
		expect(formatGradePercent(0.835)).toBe('84%');
	});

	it('clamps out-of-range values', () => {
		expect(formatGradePercent(-0.5)).toBe('0%');
		expect(formatGradePercent(1.2)).toBe('100%');
	});

	it('renders null/undefined/NaN as a dash', () => {
		expect(formatGradePercent(null)).toBe('-');
		expect(formatGradePercent(undefined)).toBe('-');
		expect(formatGradePercent(Number.NaN)).toBe('-');
	});
});

describe('formatOutcomeLabel', () => {
	it('maps known outcomes to friendly labels', () => {
		expect(formatOutcomeLabel(SIM_SCENARIO_OUTCOMES.SUCCESS)).toBe('Pass');
		expect(formatOutcomeLabel(SIM_SCENARIO_OUTCOMES.FAILURE)).toBe('Fail');
		expect(formatOutcomeLabel(SIM_SCENARIO_OUTCOMES.ABORTED)).toBe('Aborted');
		expect(formatOutcomeLabel(SIM_SCENARIO_OUTCOMES.RUNNING)).toBe('In progress');
	});

	it('echoes unknown outcomes verbatim so legacy rows still render', () => {
		expect(formatOutcomeLabel('mystery-state')).toBe('mystery-state');
	});
});

describe('outcomeTone', () => {
	it('selects the conventional tone for each outcome', () => {
		expect(outcomeTone(SIM_SCENARIO_OUTCOMES.SUCCESS)).toBe('success');
		expect(outcomeTone(SIM_SCENARIO_OUTCOMES.FAILURE)).toBe('danger');
		expect(outcomeTone(SIM_SCENARIO_OUTCOMES.ABORTED)).toBe('warning');
		expect(outcomeTone(SIM_SCENARIO_OUTCOMES.RUNNING)).toBe('default');
		expect(outcomeTone('mystery-state')).toBe('default');
	});
});

describe('asScenarioOutcome', () => {
	it('narrows known string values to the enum', () => {
		expect(asScenarioOutcome(SIM_SCENARIO_OUTCOMES.SUCCESS)).toBe(SIM_SCENARIO_OUTCOMES.SUCCESS);
		expect(asScenarioOutcome(SIM_SCENARIO_OUTCOMES.FAILURE)).toBe(SIM_SCENARIO_OUTCOMES.FAILURE);
	});

	it('returns null for unknown values', () => {
		expect(asScenarioOutcome('mystery-state')).toBeNull();
		expect(asScenarioOutcome('')).toBeNull();
	});
});

describe('formatRelativeTime', () => {
	const NOW = new Date('2026-04-26T12:00:00Z');

	it('reports "just now" inside the 5s window', () => {
		expect(formatRelativeTime(new Date(NOW.getTime() - 1_000), NOW)).toBe('just now');
	});

	it('counts seconds, minutes, hours, days, months, years', () => {
		expect(formatRelativeTime(new Date(NOW.getTime() - 30_000), NOW)).toBe('30 seconds ago');
		expect(formatRelativeTime(new Date(NOW.getTime() - 60_000), NOW)).toBe('1 minute ago');
		expect(formatRelativeTime(new Date(NOW.getTime() - 5 * 60_000), NOW)).toBe('5 minutes ago');
		expect(formatRelativeTime(new Date(NOW.getTime() - 60 * 60_000), NOW)).toBe('1 hour ago');
		expect(formatRelativeTime(new Date(NOW.getTime() - 26 * 60 * 60_000), NOW)).toBe('1 day ago');
		expect(formatRelativeTime(new Date(NOW.getTime() - 40 * 24 * 60 * 60_000), NOW)).toBe('1 month ago');
		expect(formatRelativeTime(new Date(NOW.getTime() - 400 * 24 * 60 * 60_000), NOW)).toBe('1 year ago');
	});

	it('clamps future timestamps to "just now" rather than negative ages', () => {
		expect(formatRelativeTime(new Date(NOW.getTime() + 5_000), NOW)).toBe('just now');
	});
});

describe('formatGradingKind', () => {
	it('maps known component kinds to human labels', () => {
		expect(formatGradingKind('altitude_hold')).toBe('Altitude hold');
		expect(formatGradingKind('heading_hold')).toBe('Heading hold');
		expect(formatGradingKind('airspeed_hold')).toBe('Airspeed hold');
		expect(formatGradingKind('stall_margin')).toBe('Stall margin');
		expect(formatGradingKind('reaction_time')).toBe('Reaction time');
		expect(formatGradingKind('ideal_path_match')).toBe('Ideal path match');
	});

	it('sentence-cases unknown snake_case kinds', () => {
		expect(formatGradingKind('mystery_metric')).toBe('Mystery metric');
		expect(formatGradingKind('plain')).toBe('Plain');
	});
});

describe('formatAbsoluteDate', () => {
	it('returns a non-empty compact representation', () => {
		const out = formatAbsoluteDate(new Date('2026-04-26T14:03:00Z'));
		expect(out.length).toBeGreaterThan(0);
		expect(out.includes(',')).toBe(true);
	});
});
