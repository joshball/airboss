/**
 * Phase 8 -- AC resolver smoke test.
 *
 * Confirms registration via side-effect import and that locator parsing flows
 * through the registered corpus resolver.
 */

import { describe, expect, it } from 'vitest';
import { getCorpusResolver } from '../registry/corpus-resolver.ts';
import { AC_CORPUS, AC_RESOLVER } from './resolver.ts';
// Side-effect import to ensure the resolver is registered.
import './index.ts';

describe('AC_RESOLVER', () => {
	it('is registered under the ac corpus', () => {
		expect(getCorpusResolver(AC_CORPUS)).toBe(AC_RESOLVER);
	});

	it('parseLocator round-trips through the registered resolver', () => {
		const r = AC_RESOLVER.parseLocator('61-65/j');
		expect(r.kind).toBe('ok');
		if (r.kind === 'ok') {
			expect(r.ac?.docNumber).toBe('61-65');
			expect(r.ac?.revision).toBe('j');
		}
	});

	it('parseLocator rejects unrevisioned ACs', () => {
		const r = AC_RESOLVER.parseLocator('61-65');
		expect(r.kind).toBe('error');
	});
});
