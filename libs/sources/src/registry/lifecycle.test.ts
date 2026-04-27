import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { SourceEntry, SourceId } from '../types.ts';
import { resetRegistry, withTestEntries } from './__test_helpers__.ts';
import {
	getBatch,
	getEntryLifecycle,
	getValidTransitions,
	isValidTransition,
	listBatches,
	recordDePromotion,
	recordPromotion,
} from './lifecycle.ts';

beforeEach(() => {
	resetRegistry();
});

afterEach(() => {
	resetRegistry();
});

function makeEntry(id: string): SourceEntry {
	return {
		id: id as SourceId,
		corpus: 'regs',
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: new Date('2026-01-01'),
		lifecycle: 'pending',
	};
}

describe('lifecycle state machine', () => {
	test('LC-01: draft can only transition to pending', () => {
		expect(getValidTransitions('draft')).toEqual(['pending']);
	});

	test('LC-02: pending transitions to accepted or retired', () => {
		expect(getValidTransitions('pending')).toEqual(['accepted', 'retired']);
	});

	test('LC-03: accepted transitions to retired, superseded, or pending (de-promote)', () => {
		expect(getValidTransitions('accepted')).toEqual(['retired', 'superseded', 'pending']);
	});

	test('LC-04: retired is terminal', () => {
		expect(getValidTransitions('retired')).toEqual([]);
	});

	test('LC-05: superseded is terminal', () => {
		expect(getValidTransitions('superseded')).toEqual([]);
	});

	test('isValidTransition matches getValidTransitions', () => {
		expect(isValidTransition('pending', 'accepted')).toBe(true);
		expect(isValidTransition('accepted', 'draft')).toBe(false);
		expect(isValidTransition('retired', 'pending')).toBe(false);
	});
});

describe('recordPromotion / recordDePromotion', () => {
	test('LC-06: 3-entry batch promoted pending -> accepted', () => {
		const ids = ['airboss-ref:regs/cfr-14/91/103', 'airboss-ref:regs/cfr-14/91/107', 'airboss-ref:regs/cfr-14/91/113'];
		const entries = Object.fromEntries(ids.map((id) => [id, makeEntry(id)]));
		withTestEntries(entries, () => {
			const result = recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: ids as readonly SourceId[],
				inputSource: 'ecfr-2026',
				targetLifecycle: 'accepted',
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.batch.scope).toEqual(ids);
				expect(result.batch.state).toBe('promoted');
			}
			for (const id of ids) {
				expect(getEntryLifecycle(id as SourceId)).toBe('accepted');
			}
		});
	});

	test('LC-07: batch fails atomically when one entry blocks the transition', () => {
		const ids = ['airboss-ref:regs/cfr-14/91/103', 'airboss-ref:regs/cfr-14/91/107'];
		const entries: Record<string, SourceEntry> = {
			[ids[0]]: { ...makeEntry(ids[0]), lifecycle: 'retired' }, // terminal
			[ids[1]]: makeEntry(ids[1]),
		};
		withTestEntries(entries, () => {
			const result = recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: ids as readonly SourceId[],
				inputSource: 'ecfr-2026',
				targetLifecycle: 'accepted',
			});
			expect(result.ok).toBe(false);
			// No partial mutation: the still-pending entry remains pending.
			expect(getEntryLifecycle(ids[1] as SourceId)).toBe('pending');
			expect(getEntryLifecycle(ids[0] as SourceId)).toBe('retired');
		});
	});

	test('LC-08: de-promote walks accepted back to pending', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		withTestEntries(entries, () => {
			const promotion = recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'ecfr-2026',
				targetLifecycle: 'accepted',
			});
			expect(promotion.ok).toBe(true);
			if (!promotion.ok) return;

			const dePromotion = recordDePromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'manual-review',
				targetLifecycle: 'pending',
				previousBatchId: promotion.batch.id,
			});
			expect(dePromotion.ok).toBe(true);
			if (dePromotion.ok) {
				expect(dePromotion.batch.state).toBe('de-promoted');
				expect(dePromotion.batch.previousBatchId).toBe(promotion.batch.id);
			}
			expect(getEntryLifecycle(id as SourceId)).toBe('pending');
		});
	});

	test('LC-09: getBatch returns recorded batch', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		withTestEntries(entries, () => {
			const result = recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			if (!result.ok) throw new Error('promotion failed');
			expect(getBatch(result.batch.id)).toEqual(result.batch);
			expect(getBatch('does-not-exist')).toBeNull();
		});
	});

	test('LC-10: listBatches returns all batches', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		withTestEntries(entries, () => {
			recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			expect(listBatches()).toHaveLength(1);
		});
	});

	test('LC-11: cannot transition to draft from any non-draft state', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		withTestEntries(entries, () => {
			const result = recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				// biome-ignore lint/suspicious/noExplicitAny: we want to test runtime guard
				targetLifecycle: 'draft' as any,
			});
			expect(result.ok).toBe(false);
		});
	});

	test('LC-12: empty scope rejected', () => {
		const result = recordPromotion({
			corpus: 'regs',
			reviewerId: 'jball',
			scope: [],
			inputSource: 'x',
			targetLifecycle: 'accepted',
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/empty scope/);
		}
	});

	test('mixed-lifecycle batch rejected', () => {
		const ids = ['airboss-ref:regs/cfr-14/91/103', 'airboss-ref:regs/cfr-14/91/107'];
		const entries: Record<string, SourceEntry> = {
			[ids[0]]: makeEntry(ids[0]),
			[ids[1]]: { ...makeEntry(ids[1]), lifecycle: 'accepted' },
		};
		withTestEntries(entries, () => {
			const result = recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: ids as readonly SourceId[],
				inputSource: 'x',
				targetLifecycle: 'retired',
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toMatch(/mixed lifecycles/);
			}
		});
	});

	test('unknown entry rejected', () => {
		const result = recordPromotion({
			corpus: 'regs',
			reviewerId: 'jball',
			scope: ['airboss-ref:regs/does-not-exist' as SourceId],
			inputSource: 'x',
			targetLifecycle: 'accepted',
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/not in the registry/);
		}
	});

	test('de-promotion requires existing previousBatchId', () => {
		const result = recordDePromotion({
			corpus: 'regs',
			reviewerId: 'jball',
			scope: ['airboss-ref:regs/foo' as SourceId],
			inputSource: 'x',
			targetLifecycle: 'pending',
			previousBatchId: 'does-not-exist',
		});
		expect(result.ok).toBe(false);
	});
});

describe('getEntryLifecycle', () => {
	test('returns null for unknown entry', () => {
		expect(getEntryLifecycle('airboss-ref:regs/unknown' as SourceId)).toBeNull();
	});

	test('falls back to SOURCES[id].lifecycle when no overlay', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: { ...makeEntry(id), lifecycle: 'accepted' as const } };
		withTestEntries(entries, () => {
			expect(getEntryLifecycle(id as SourceId)).toBe('accepted');
		});
	});

	test('overlay wins over static lifecycle', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) }; // pending
		withTestEntries(entries, () => {
			recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			expect(getEntryLifecycle(id as SourceId)).toBe('accepted');
		});
	});
});
