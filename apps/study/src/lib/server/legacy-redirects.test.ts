/**
 * Unit tests for the IA-cleanup legacy redirect resolver. Pure-function
 * coverage of every legacy pattern; the e2e (`tests/e2e/ia-redirect.spec.ts`)
 * proves the wiring through the SvelteKit handle.
 */

import { describe, expect, it } from 'vitest';
import { LEGACY_REDIRECT_COUNT, resolveLegacyRedirect } from './legacy-redirects';

describe('resolveLegacyRedirect', () => {
	it('returns null for unknown paths', () => {
		expect(resolveLegacyRedirect('/study', '')).toBeNull();
		expect(resolveLegacyRedirect('/insights', '')).toBeNull();
		expect(resolveLegacyRedirect('/reference/glossary', '')).toBeNull();
		expect(resolveLegacyRedirect('/program/quals', '')).toBeNull();
	});

	it('redirects /dashboard to /insights', () => {
		expect(resolveLegacyRedirect('/dashboard', '')).toBe('/insights');
		expect(resolveLegacyRedirect('/dashboard/', '')).toBe('/insights');
	});

	it('redirects /calibration to /insights/calibration', () => {
		expect(resolveLegacyRedirect('/calibration', '')).toBe('/insights/calibration');
	});

	it('redirects the lens family under /insights/lens', () => {
		expect(resolveLegacyRedirect('/lens', '')).toBe('/insights/lens');
		expect(resolveLegacyRedirect('/lens/handbook', '')).toBe('/insights/lens/handbook');
		expect(resolveLegacyRedirect('/lens/handbook/phak', '')).toBe('/insights/lens/handbook/phak');
		expect(resolveLegacyRedirect('/lens/handbook/phak/3', '')).toBe('/insights/lens/handbook/phak/3');
		expect(resolveLegacyRedirect('/lens/weakness', '')).toBe('/insights/lens/weakness');
		expect(resolveLegacyRedirect('/lens/weakness/severe', '')).toBe('/insights/lens/weakness/severe');
	});

	it('redirects the knowledge family under /reference/knowledge', () => {
		expect(resolveLegacyRedirect('/knowledge', '')).toBe('/reference/knowledge');
		expect(resolveLegacyRedirect('/knowledge/vfr-weather-minimums', '')).toBe(
			'/reference/knowledge/vfr-weather-minimums',
		);
		expect(resolveLegacyRedirect('/knowledge/vfr-weather-minimums/learn', '')).toBe(
			'/reference/knowledge/vfr-weather-minimums/learn',
		);
	});

	it('redirects the glossary family under /reference/glossary', () => {
		expect(resolveLegacyRedirect('/glossary', '')).toBe('/reference/glossary');
		expect(resolveLegacyRedirect('/glossary/abc123', '')).toBe('/reference/glossary/abc123');
	});

	it('redirects the Phase 2 program family (credentials/goals/plans)', () => {
		expect(resolveLegacyRedirect('/credentials', '')).toBe('/program/quals');
		expect(resolveLegacyRedirect('/credentials/ppl', '')).toBe('/program/quals/ppl');
		expect(resolveLegacyRedirect('/credentials/ppl/areas/i', '')).toBe('/program/quals/ppl/areas/i');
		expect(resolveLegacyRedirect('/goals', '')).toBe('/program/goals');
		expect(resolveLegacyRedirect('/goals/g_abc', '')).toBe('/program/goals/g_abc');
		expect(resolveLegacyRedirect('/plans', '')).toBe('/program/plans');
		expect(resolveLegacyRedirect('/plans/p_abc', '')).toBe('/program/plans/p_abc');
	});

	it('preserves the query string', () => {
		expect(resolveLegacyRedirect('/dashboard', '?from=email')).toBe('/insights?from=email');
		expect(resolveLegacyRedirect('/knowledge/vfr', '?step=discover')).toBe('/reference/knowledge/vfr?step=discover');
		expect(resolveLegacyRedirect('/credentials', '?ref=nav')).toBe('/program/quals?ref=nav');
	});

	it('handles trailing slashes uniformly', () => {
		expect(resolveLegacyRedirect('/calibration/', '')).toBe('/insights/calibration');
		expect(resolveLegacyRedirect('/lens/', '')).toBe('/insights/lens');
		expect(resolveLegacyRedirect('/knowledge/', '')).toBe('/reference/knowledge');
		expect(resolveLegacyRedirect('/glossary/', '')).toBe('/reference/glossary');
	});

	it('decodes URL-encoded path segments before passing through the canonical builder', () => {
		// The legacy /knowledge slug was not encoded by the original
		// KNOWLEDGE_SLUG builder, and REFERENCE_KNOWLEDGE_SLUG matches
		// that. The resolver decodes incoming `%20` -> space so the
		// downstream builder receives the literal slug; if the builder
		// later re-encodes, the round-trip is preserved.
		expect(resolveLegacyRedirect('/knowledge/some%20slug', '')).toBe('/reference/knowledge/some slug');
	});

	it('keeps the rule list in sync with assertions', () => {
		// Sanity: the count exposed for visibility should be > 0 and
		// reasonably stable so a future refactor that drops a row trips
		// review.
		expect(LEGACY_REDIRECT_COUNT).toBeGreaterThanOrEqual(15);
	});
});
