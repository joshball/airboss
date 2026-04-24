import { describe, expect, it } from 'vitest';
import { isHelpTargetMatch, readHelpParam, withHelpParam } from './page-help-url';

describe('readHelpParam', () => {
	it('returns null when the param is absent', () => {
		const url = new URL('https://example.test/dashboard');
		expect(readHelpParam(url)).toBeNull();
	});

	it('returns null when the param is empty string', () => {
		const url = new URL('https://example.test/dashboard?help=');
		expect(readHelpParam(url)).toBeNull();
	});

	it('returns the raw id when present', () => {
		const url = new URL('https://example.test/dashboard?help=dashboard');
		expect(readHelpParam(url)).toBe('dashboard');
	});

	it('decodes the param like any other search value', () => {
		const url = new URL('https://example.test/knowledge/stall?help=knowledge-graph&tab=overview');
		expect(readHelpParam(url)).toBe('knowledge-graph');
	});
});

describe('withHelpParam', () => {
	it('adds the param when setting an id on a clean URL', () => {
		const url = new URL('https://example.test/dashboard');
		const next = withHelpParam(url, 'dashboard');
		expect(next.searchParams.get('help')).toBe('dashboard');
	});

	it('leaves existing params untouched', () => {
		const url = new URL('https://example.test/plans?tab=archived');
		const next = withHelpParam(url, 'plans-overview');
		expect(next.searchParams.get('tab')).toBe('archived');
		expect(next.searchParams.get('help')).toBe('plans-overview');
	});

	it('replaces an existing help id', () => {
		const url = new URL('https://example.test/dashboard?help=old');
		const next = withHelpParam(url, 'new');
		expect(next.searchParams.get('help')).toBe('new');
	});

	it('removes the param when id is null', () => {
		const url = new URL('https://example.test/dashboard?help=dashboard&tab=active');
		const next = withHelpParam(url, null);
		expect(next.searchParams.has('help')).toBe(false);
		expect(next.searchParams.get('tab')).toBe('active');
	});

	it('does not mutate the source URL', () => {
		const url = new URL('https://example.test/dashboard');
		withHelpParam(url, 'dashboard');
		expect(url.searchParams.has('help')).toBe(false);
	});
});

describe('isHelpTargetMatch', () => {
	it('matches when the param equals the page id', () => {
		const url = new URL('https://example.test/dashboard?help=dashboard');
		expect(isHelpTargetMatch(url, 'dashboard')).toBe(true);
	});

	it('rejects when the param is a different id', () => {
		const url = new URL('https://example.test/dashboard?help=reps');
		expect(isHelpTargetMatch(url, 'dashboard')).toBe(false);
	});

	it('rejects when the param is absent', () => {
		const url = new URL('https://example.test/dashboard');
		expect(isHelpTargetMatch(url, 'dashboard')).toBe(false);
	});
});
