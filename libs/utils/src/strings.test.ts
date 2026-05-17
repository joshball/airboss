import { describe, expect, it } from 'vitest';
import { humanize, stripMarkdown, truncatePlainText } from './strings';

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

describe('stripMarkdown', () => {
	it('removes bold and italic markers', () => {
		expect(stripMarkdown('this is **bold** and _italic_ text')).toBe('this is bold and italic text');
	});

	it('keeps link labels, drops the URL', () => {
		expect(stripMarkdown('see [the docs](https://example.com/x) here')).toBe('see the docs here');
	});

	it('keeps image alt text, drops the URL', () => {
		expect(stripMarkdown('![a chart](chart.svg)')).toBe('a chart');
	});

	it('drops inline code backticks', () => {
		expect(stripMarkdown('run `bun test` now')).toBe('run bun test now');
	});

	it('strips heading hashes, list bullets, and blockquote markers', () => {
		expect(stripMarkdown('# Heading\n- one\n- two\n> quoted')).toBe('Heading one two quoted');
	});
});

describe('truncatePlainText', () => {
	it('returns the input unchanged when within the cap', () => {
		expect(truncatePlainText('short text', 50)).toBe('short text');
	});

	it('truncates at a word boundary and appends an ellipsis', () => {
		expect(truncatePlainText('the quick brown fox jumps', 12)).toBe('the quick...');
	});

	it('slices on a code-point boundary, never splitting a surrogate pair', () => {
		// Five emoji = 5 code points / 10 UTF-16 units. A cap of 3 must yield
		// exactly 3 whole emoji, not a lone surrogate.
		const out = truncatePlainText('😀😀😀😀😀', 3);
		expect(Array.from(out.replace(/\.\.\.$/, ''))).toHaveLength(3);
	});

	it('falls back to a hard cut when there is no word break', () => {
		expect(truncatePlainText('abcdefghij', 4)).toBe('abcd...');
	});
});
