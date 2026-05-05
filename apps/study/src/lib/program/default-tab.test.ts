import { PROGRAM_TABS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { parseProgramTab, resolveDefaultProgramTab } from './default-tab';

describe('resolveDefaultProgramTab', () => {
	it('returns Goal when the user has a primary goal', () => {
		expect(resolveDefaultProgramTab({ hasGoal: true })).toBe(PROGRAM_TABS.GOAL);
	});

	it('returns Quals when the user has no primary goal', () => {
		expect(resolveDefaultProgramTab({ hasGoal: false })).toBe(PROGRAM_TABS.QUALS);
	});
});

describe('parseProgramTab', () => {
	it('returns the canonical tab for each known value', () => {
		for (const tab of Object.values(PROGRAM_TABS)) {
			expect(parseProgramTab(tab)).toBe(tab);
		}
	});

	it('returns null for missing input', () => {
		expect(parseProgramTab(null)).toBe(null);
		expect(parseProgramTab(undefined)).toBe(null);
	});

	it('returns null for unknown values', () => {
		expect(parseProgramTab('insights')).toBe(null);
		expect(parseProgramTab('')).toBe(null);
		expect(parseProgramTab('GOAL')).toBe(null);
	});

	it('does not coerce arbitrary strings into tabs', () => {
		expect(parseProgramTab('quals; drop table')).toBe(null);
	});
});
