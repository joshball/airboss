// Unit tests for the de-duplication shim used by `hooks.client.ts` and
// the global `window.onerror` listener in `+layout.svelte`. Without this,
// a hydration crash that surfaces through SvelteKit's `handleError` AND
// re-throws onto `window` produces two POSTs to `/api/client-error` --
// noisy logs, twice the rate-limit consumption, no extra signal.

import { CLIENT_ERROR_DEDUPE_WINDOW_MS } from '@ab/constants';
import { afterEach, describe, expect, it } from 'vitest';
import { _resetForTests, shouldSkipDuplicate } from './client-error-reporter';

afterEach(() => {
	_resetForTests();
});

describe('shouldSkipDuplicate', () => {
	it('returns false for the first occurrence of a (message, stack) pair', () => {
		expect(shouldSkipDuplicate('Buffer is not defined', 'at bytes.js:2', 1000)).toBe(false);
	});

	it('returns true for the same pair within the dedupe window', () => {
		shouldSkipDuplicate('Buffer is not defined', 'at bytes.js:2', 1000);
		expect(shouldSkipDuplicate('Buffer is not defined', 'at bytes.js:2', 1500)).toBe(true);
	});

	it('returns false for the same pair after the dedupe window expires', () => {
		shouldSkipDuplicate('Buffer is not defined', 'at bytes.js:2', 1000);
		const after = 1000 + CLIENT_ERROR_DEDUPE_WINDOW_MS + 1;
		expect(shouldSkipDuplicate('Buffer is not defined', 'at bytes.js:2', after)).toBe(false);
	});

	it('treats different messages as distinct fingerprints', () => {
		shouldSkipDuplicate('Buffer is not defined', 'at bytes.js:2', 1000);
		expect(shouldSkipDuplicate('process is not defined', 'at bytes.js:2', 1500)).toBe(false);
	});

	it('treats different stacks as distinct fingerprints', () => {
		shouldSkipDuplicate('TypeError', 'at line A', 1000);
		expect(shouldSkipDuplicate('TypeError', 'at line B', 1500)).toBe(false);
	});

	it('handles undefined stacks (collapses to empty-stack fingerprint)', () => {
		expect(shouldSkipDuplicate('boom', undefined, 1000)).toBe(false);
		expect(shouldSkipDuplicate('boom', undefined, 1500)).toBe(true);
	});

	it('only fingerprints the leading 200 chars of the stack', () => {
		const longA = `${'x'.repeat(199)}A${'tail-A'.repeat(50)}`;
		const longB = `${'x'.repeat(199)}A${'tail-B'.repeat(50)}`;
		shouldSkipDuplicate('same', longA, 1000);
		// First 200 chars match exactly -> dedupe even though tails differ.
		expect(shouldSkipDuplicate('same', longB, 1500)).toBe(true);
	});
});
