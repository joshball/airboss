import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { SourceEntry, SourceId } from '../types.ts';
import { resetRegistry, withTestEntries } from './__test_helpers__.ts';
import { productionRegistry } from './index.ts';
import { recordPromotion } from './lifecycle.ts';

beforeEach(() => {
	resetRegistry();
});

afterEach(() => {
	resetRegistry();
});

function makeEntry(id: string, lifecycle: SourceEntry['lifecycle'] = 'pending'): SourceEntry {
	return {
		id: id as SourceId,
		corpus: id.split(':')[1]?.split('/')[0] ?? 'regs',
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: new Date('2026-01-01'),
		lifecycle,
	};
}

describe('productionRegistry integration', () => {
	test('PR-01: isCorpusKnown returns true for every enumerated corpus', () => {
		expect(productionRegistry.isCorpusKnown('regs')).toBe(true);
		expect(productionRegistry.isCorpusKnown('aim')).toBe(true);
		expect(productionRegistry.isCorpusKnown('handbooks')).toBe(true);
		// Phase 10 first slice: orders + ntsb resolvers register via side-effect
		// import from the lib root.
		expect(productionRegistry.isCorpusKnown('orders')).toBe(true);
		expect(productionRegistry.isCorpusKnown('ntsb')).toBe(true);
		// Phase 10 next slice: the 10 irregular-corpora resolvers also
		// register via side-effect import from the lib root.
		expect(productionRegistry.isCorpusKnown('interp')).toBe(true);
		expect(productionRegistry.isCorpusKnown('pohs')).toBe(true);
		expect(productionRegistry.isCorpusKnown('sectionals')).toBe(true);
		expect(productionRegistry.isCorpusKnown('plates')).toBe(true);
		expect(productionRegistry.isCorpusKnown('statutes')).toBe(true);
		expect(productionRegistry.isCorpusKnown('forms')).toBe(true);
		expect(productionRegistry.isCorpusKnown('info')).toBe(true);
		expect(productionRegistry.isCorpusKnown('safo')).toBe(true);
		expect(productionRegistry.isCorpusKnown('tcds')).toBe(true);
		expect(productionRegistry.isCorpusKnown('asrs')).toBe(true);
	});

	test('PR-02: isCorpusKnown returns false for non-enumerated', () => {
		expect(productionRegistry.isCorpusKnown('not-a-corpus')).toBe(false);
		expect(productionRegistry.isCorpusKnown('unknown')).toBe(false);
	});

	test('PR-03: hasEntry true with primed test entries', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			expect(productionRegistry.hasEntry(id as SourceId)).toBe(true);
			expect(productionRegistry.hasEntry('airboss-ref:regs/missing' as SourceId)).toBe(false);
		});
	});

	test('PR-04: getEntry strips ?at= from caller input', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			const a = productionRegistry.getEntry(id as SourceId);
			const b = productionRegistry.getEntry(`${id}?at=2026` as SourceId);
			expect(a?.id).toBe(id);
			expect(b?.id).toBe(id);
		});
	});

	test('PR-05: walkSupersessionChain matches the query.ts namespace', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			const chain = productionRegistry.walkSupersessionChain(id as SourceId);
			expect(chain.map((e) => e.id)).toEqual([id]);
		});
	});

	test('lifecycle overlay surfaces through getEntry', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id, 'pending') }, () => {
			// Initially pending.
			expect(productionRegistry.getEntry(id as SourceId)?.lifecycle).toBe('pending');
			// Promote to accepted; getEntry now reflects the overlay.
			recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			expect(productionRegistry.getEntry(id as SourceId)?.lifecycle).toBe('accepted');
		});
	});

	test('hasEdition returns false when no editions are populated (Phase 2)', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			expect(productionRegistry.hasEdition(id as SourceId, '2026')).toBe(false);
		});
	});

	test('getCurrentAcceptedEdition returns null for default resolver', () => {
		expect(productionRegistry.getCurrentAcceptedEdition('regs')).toBeNull();
	});
});
