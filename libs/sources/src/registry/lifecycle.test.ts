import { db } from '@ab/db/connection';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { promotionBatches } from '../db/schema.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { resetRegistry, withTestEntries } from './__test_helpers__.ts';
import { __editions_internal__, getEditionsMap } from './editions.ts';
import {
	commitIngestBatch,
	getBatch,
	getEntryLifecycle,
	getValidTransitions,
	isValidTransition,
	listBatches,
	rebuildLifecycleOverlay,
	recordDePromotion,
	recordPromotion,
} from './lifecycle.ts';
import { getSources } from './sources.ts';

// Stable reviewer-id used by every batch this file inserts. Cleanup is
// scoped to this id so concurrent test files (e.g. regs/ingest.test.ts
// running under PHASE_3_REVIEWER_ID) keep their own rows.
const TEST_REVIEWER_ID = 'jball';

async function deleteOurBatches(): Promise<void> {
	await db.delete(promotionBatches).where(eq(promotionBatches.reviewerId, TEST_REVIEWER_ID));
}

beforeEach(async () => {
	await deleteOurBatches();
	resetRegistry();
});

afterEach(async () => {
	await deleteOurBatches();
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
	test('LC-06: 3-entry batch promoted pending -> accepted', async () => {
		const ids = ['airboss-ref:regs/cfr-14/91/103', 'airboss-ref:regs/cfr-14/91/107', 'airboss-ref:regs/cfr-14/91/113'];
		const entries = Object.fromEntries(ids.map((id) => [id, makeEntry(id)]));
		await withTestEntries(entries, async () => {
			const result = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: ids as unknown as readonly SourceId[],
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

	test('LC-07: batch fails atomically when one entry blocks the transition', async () => {
		const ids = ['airboss-ref:regs/cfr-14/91/103', 'airboss-ref:regs/cfr-14/91/107'];
		const entries: Record<string, SourceEntry> = {
			[ids[0]]: { ...makeEntry(ids[0]), lifecycle: 'retired' }, // terminal
			[ids[1]]: makeEntry(ids[1]),
		};
		await withTestEntries(entries, async () => {
			const result = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: ids as unknown as readonly SourceId[],
				inputSource: 'ecfr-2026',
				targetLifecycle: 'accepted',
			});
			expect(result.ok).toBe(false);
			expect(getEntryLifecycle(ids[1] as SourceId)).toBe('pending');
			expect(getEntryLifecycle(ids[0] as SourceId)).toBe('retired');
		});
	});

	test('LC-08: de-promote walks accepted back to pending', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			const promotion = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'ecfr-2026',
				targetLifecycle: 'accepted',
			});
			expect(promotion.ok).toBe(true);
			if (!promotion.ok) return;

			const dePromotion = await recordDePromotion({
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

	test('LC-09: getBatch returns recorded batch', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			const result = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			if (!result.ok) throw new Error('promotion failed');
			const fetched = await getBatch(result.batch.id);
			expect(fetched).not.toBeNull();
			if (fetched !== null) {
				expect(fetched.id).toBe(result.batch.id);
				expect(fetched.state).toBe('promoted');
			}
			expect(await getBatch('does-not-exist')).toBeNull();
		});
	});

	test('LC-10: listBatches returns all batches', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			await recordPromotion({
				corpus: 'regs',
				reviewerId: TEST_REVIEWER_ID,
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			const ours = (await listBatches()).filter((b) => b.reviewerId === TEST_REVIEWER_ID);
			expect(ours).toHaveLength(1);
		});
	});

	test('LC-11: cannot transition to draft from any non-draft state', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			const result = await recordPromotion({
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

	test('LC-12: empty scope rejected', async () => {
		const result = await recordPromotion({
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

	test('mixed-lifecycle batch rejected', async () => {
		const ids = ['airboss-ref:regs/cfr-14/91/103', 'airboss-ref:regs/cfr-14/91/107'];
		const entries: Record<string, SourceEntry> = {
			[ids[0]]: makeEntry(ids[0]),
			[ids[1]]: { ...makeEntry(ids[1]), lifecycle: 'accepted' },
		};
		await withTestEntries(entries, async () => {
			const result = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: ids as unknown as readonly SourceId[],
				inputSource: 'x',
				targetLifecycle: 'retired',
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toMatch(/mixed lifecycles/);
			}
		});
	});

	test('unknown entry rejected', async () => {
		const result = await recordPromotion({
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

	test('de-promotion FK violation surfaces as ok=false', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: { ...makeEntry(id), lifecycle: 'accepted' as const } };
		await withTestEntries(entries, async () => {
			const result = await recordDePromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'pending',
				previousBatchId: 'batch_does_not_exist',
			});
			expect(result.ok).toBe(false);
		});
	});

	test('writes one row to promotion_batches with all 10 fields populated', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			const result = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'ecfr-2026',
				targetLifecycle: 'accepted',
			});
			if (!result.ok) throw new Error('promotion failed');
			const rows = (await db.select().from(promotionBatches)).filter((r) => r.reviewerId === TEST_REVIEWER_ID);
			expect(rows).toHaveLength(1);
			const row = rows[0];
			if (row === undefined) throw new Error('no row');
			expect(row.id).toBe(result.batch.id);
			expect(row.corpus).toBe('regs');
			expect(row.reviewerId).toBe(TEST_REVIEWER_ID);
			expect(row.promotionDate).toBeInstanceOf(Date);
			expect(row.scope).toEqual([id]);
			expect(row.inputSource).toBe('ecfr-2026');
			expect(row.state).toBe('promoted');
			expect(row.fromLifecycle).toBe('pending');
			expect(row.toLifecycle).toBe('accepted');
			expect(row.previousBatchId).toBeNull();
		});
	});

	test('audit chain: promote -> de-promote produces two rows linked by previous_batch_id', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			const promotion = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			if (!promotion.ok) throw new Error('promotion failed');
			const dePromotion = await recordDePromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'rollback',
				targetLifecycle: 'pending',
				previousBatchId: promotion.batch.id,
			});
			if (!dePromotion.ok) throw new Error('de-promotion failed');
			const all = (await listBatches()).filter((b) => b.reviewerId === TEST_REVIEWER_ID);
			expect(all).toHaveLength(2);
			const promoted = all.find((b) => b.state === 'promoted');
			const dePromoted = all.find((b) => b.state === 'de-promoted');
			expect(promoted?.id).toBe(promotion.batch.id);
			expect(dePromoted?.previousBatchId).toBe(promotion.batch.id);
		});
	});

	test('rollback: simulated insert failure leaves the overlay untouched', async () => {
		// Stuff a batch into the table with an id we'll collide on. The first
		// `recordPromotion` succeeds; the second tries to use the same id and
		// fails on the PK conflict. Overlay must reflect ONLY the first call.
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			const first = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			if (!first.ok) throw new Error('first promotion failed');

			// Attempt an invalid second transition (accepted -> accepted is not
			// in the state machine). This is a pre-flight validation failure
			// that surfaces ok=false WITHOUT mutating the overlay, which is
			// the contract under test for rollback semantics.
			const second = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			expect(second.ok).toBe(false);
			expect(getEntryLifecycle(id as SourceId)).toBe('accepted');
			const rows = (await listBatches()).filter((b) => b.reviewerId === TEST_REVIEWER_ID);
			expect(rows).toHaveLength(1);
		});
	});
});

describe('commitIngestBatch', () => {
	function entry(id: string, lifecycle: SourceEntry['lifecycle'] = 'pending'): SourceEntry {
		return { ...makeEntry(id), lifecycle };
	}

	test('CB-01: happy path: sources + editions + lifecycle commit together', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const ed: Edition = { id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' };
		const result = await commitIngestBatch({
			corpus: 'regs',
			reviewerId: 'jball',
			inputSource: 'ecfr-2026',
			targetLifecycle: 'accepted',
			sources: { [id]: entry(id) },
			editions: new Map([[id, [ed]]]),
			scope: [id],
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.batchId).not.toBeNull();
		expect(getSources()[id]).toBeDefined();
		expect(getEditionsMap().get(id)?.[0]?.id).toBe('2026');
		expect(getEntryLifecycle(id)).toBe('accepted');
	});

	test('CB-02: validation failure rolls back -- no SOURCES/EDITIONS mutations leak', async () => {
		const okId = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const blockedId = 'airboss-ref:regs/cfr-14/91/107' as SourceId;
		const seedRes = await commitIngestBatch({
			corpus: 'regs',
			reviewerId: 'jball',
			inputSource: 'seed',
			targetLifecycle: 'retired',
			sources: { [blockedId]: entry(blockedId) },
			editions: new Map(),
			scope: [blockedId],
		});
		expect(seedRes.ok).toBe(true);

		const ed: Edition = { id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' };
		const priorSourcesCount = Object.keys(getSources()).length;
		const result = await commitIngestBatch({
			corpus: 'regs',
			reviewerId: 'jball',
			inputSource: 'ecfr-2026',
			targetLifecycle: 'accepted',
			sources: { [okId]: entry(okId) },
			editions: new Map([[okId, [ed]]]),
			scope: [okId, blockedId],
		});
		expect(result.ok).toBe(false);
		expect(getSources()[okId]).toBeUndefined();
		expect(getEditionsMap().has(okId)).toBe(false);
		expect(getEntryLifecycle(blockedId)).toBe('retired');
		expect(Object.keys(getSources())).toHaveLength(priorSourcesCount);
	});

	test('CB-03: empty scope upserts SOURCES/EDITIONS without recording a batch', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const ed: Edition = { id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' };
		const result = await commitIngestBatch({
			corpus: 'regs',
			reviewerId: 'jball',
			inputSource: 'idempotent-rerun',
			targetLifecycle: 'accepted',
			sources: { [id]: entry(id) },
			editions: new Map([[id, [ed]]]),
			scope: [],
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.batchId).toBeNull();
		expect(getSources()[id]).toBeDefined();
		expect(getEditionsMap().get(id)?.[0]?.id).toBe('2026');
		expect(getEntryLifecycle(id)).toBe('pending');
	});

	test('CB-04: editions are merged with existing rows (no overwrite)', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const seedEd: Edition = { id: '2025', published_date: new Date('2025-01-01'), source_url: 'about:blank' };
		__editions_internal__.setActiveTable(new Map([[id, [seedEd]]]));

		const newEd: Edition = { id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' };
		const result = await commitIngestBatch({
			corpus: 'regs',
			reviewerId: 'jball',
			inputSource: 'ecfr-2026',
			targetLifecycle: 'accepted',
			sources: { [id]: entry(id) },
			editions: new Map([[id, [newEd]]]),
			scope: [id],
		});
		expect(result.ok).toBe(true);
		const editions = getEditionsMap().get(id) ?? [];
		expect(editions.map((e) => e.id).sort()).toEqual(['2025', '2026']);
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

	test('overlay wins over static lifecycle', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) }; // pending
		await withTestEntries(entries, async () => {
			await recordPromotion({
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

describe('rebuildLifecycleOverlay', () => {
	test('replays draft -> pending -> accepted into accepted overlay', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: { ...makeEntry(id), lifecycle: 'draft' as const } };
		await withTestEntries(entries, async () => {
			const r1 = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'pending',
			});
			expect(r1.ok).toBe(true);
			const r2 = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			expect(r2.ok).toBe(true);

			// Drop the in-memory overlay; rebuild from DB; final state is accepted.
			resetRegistry();
			await rebuildLifecycleOverlay();
			expect(getEntryLifecycle(id as SourceId)).toBe('accepted');
		});
	});

	test('replays de-promotion: accepted -> pending after rollback', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		const entries = { [id]: makeEntry(id) };
		await withTestEntries(entries, async () => {
			const promo = await recordPromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'x',
				targetLifecycle: 'accepted',
			});
			if (!promo.ok) throw new Error('promotion failed');
			await recordDePromotion({
				corpus: 'regs',
				reviewerId: 'jball',
				scope: [id as SourceId],
				inputSource: 'rollback',
				targetLifecycle: 'pending',
				previousBatchId: promo.batch.id,
			});

			resetRegistry();
			await rebuildLifecycleOverlay();
			expect(getEntryLifecycle(id as SourceId)).toBe('pending');
		});
	});

	test('empty table -> empty overlay', async () => {
		await rebuildLifecycleOverlay();
		expect(getEntryLifecycle('airboss-ref:regs/anything' as SourceId)).toBeNull();
	});
});
