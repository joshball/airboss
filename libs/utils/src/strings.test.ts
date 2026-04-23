import { describe, expect, it } from 'vitest';
import { humanize } from './strings';

describe('humanize', () => {
	it('title-cases kebab-case slugs', () => {
		expect(humanize('emergency-procedures')).toBe('Emergency Procedures');
	});

	it('title-cases snake_case slugs', () => {
		expect(humanize('emergency_procedures')).toBe('Emergency Procedures');
	});

	it('splits camelCase on boundary', () => {
		expect(humanize('emergencyProcedures')).toBe('Emergency Procedures');
	});

	it('splits PascalCase on boundary', () => {
		expect(humanize('EmergencyProcedures')).toBe('Emergency Procedures');
	});

	it('preserves runs of caps as acronyms', () => {
		expect(humanize('ATCClearance')).toBe('ATC Clearance');
		expect(humanize('VFRFlight')).toBe('VFR Flight');
	});

	it('handles mixed separators', () => {
		expect(humanize('pre-flight_checklist')).toBe('Pre Flight Checklist');
	});

	it('leaves a single acronym intact', () => {
		expect(humanize('ATC')).toBe('ATC');
	});

	it('returns empty string for empty input', () => {
		expect(humanize('')).toBe('');
	});

	it('strips leading/trailing separators without emitting blank words', () => {
		expect(humanize('--foo-bar--')).toBe('Foo Bar');
	});
});
