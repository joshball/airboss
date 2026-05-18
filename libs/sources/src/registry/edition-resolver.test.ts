/**
 * Resolver-API tests for ADR 026 §6. Hits the real `sources_registry.editions`
 * table; per the project rule, mocking the DB is banned. Each test seeds rows
 * via `upsertEdition` (the seed-time write helper this WP introduces) and
 * cleans up via a per-test reviewer-scoped delete keyed by sourceId prefix.
 *
 * Mirrors the harness shape from `registry.test.ts`.
 */

import { db } from '@ab/db/connection';
import { createId } from '@ab/utils';
import { like } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { editions as editionsTable } from '../db/schema.ts';
import type { SourceId } from '../types.ts';
import {
	getCurrentEdition,
	getEditionByLabel,
	isEditionSuperseded,
	listEditionsForSource,
} from './edition-resolver.ts';
import { upsertEdition } from './edition-writer.ts';

// All test sources live under this prefix so cleanup can target them
// without colliding with concurrent test files (registry.test.ts owns its
// own scope under reviewerId; we match by sourceId pattern instead).
const TEST_PREFIX = 'airboss-ref:test-edition-resolver/';

async function cleanup(): Promise<void> {
	await db.delete(editionsTable).where(like(editionsTable.sourceId, `${TEST_PREFIX}%`));
}

beforeEach(cleanup);
afterEach(cleanup);

function sourceId(slug: string): SourceId {
	return `${TEST_PREFIX}${slug}` as SourceId;
}

describe('getCurrentEdition', () => {
	test('returns the current row when one is current', async () => {
		const id = sourceId('afh-current');
		await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3B',
			publishedAt: new Date('2017-01-01'),
			retiredAt: new Date('2024-04-01'),
		});
		await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3C',
			publishedAt: new Date('2024-04-01'),
		});

		const current = await getCurrentEdition(id);
		expect(current).not.toBeNull();
		expect(current?.editionLabel).toBe('8083-3C');
		expect(current?.retiredAt).toBeNull();
	});

	test('returns null when every row is retired', async () => {
		const id = sourceId('afh-all-retired');
		await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3B',
			publishedAt: new Date('2017-01-01'),
			retiredAt: new Date('2024-04-01'),
		});
		await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3C',
			publishedAt: new Date('2024-04-01'),
			retiredAt: new Date('2025-04-01'),
		});

		expect(await getCurrentEdition(id)).toBeNull();
	});

	test('returns null when no rows exist for the slug', async () => {
		const id = sourceId('unknown-slug');
		expect(await getCurrentEdition(id)).toBeNull();
	});

	test('tiebreak on equal published_at uses lex-greater id', async () => {
		const id = sourceId('afh-tiebreak');
		const sharedDate = new Date('2024-04-01');
		// Insert two rows with the same publishedAt; both current. The lex-
		// greater id (the second `edition_<ULID>`) should win because ULIDs
		// are monotonic.
		const first = await upsertEdition({ sourceId: id, editionLabel: 'A', publishedAt: sharedDate });
		const second = await upsertEdition({ sourceId: id, editionLabel: 'B', publishedAt: sharedDate });

		const current = await getCurrentEdition(id);
		expect(current).not.toBeNull();
		// One of the two ids should win deterministically; the rule is "lex-
		// greater id wins on tie". Confirm against the actual ids written.
		const winner = first.id < second.id ? second : first;
		expect(current?.id).toBe(winner.id);
	});
});

describe('getEditionByLabel', () => {
	test('returns the labelled row', async () => {
		const id = sourceId('afh-by-label');
		await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3B',
			publishedAt: new Date('2017-01-01'),
			retiredAt: new Date('2024-04-01'),
		});

		const row = await getEditionByLabel(id, '8083-3B');
		expect(row?.editionLabel).toBe('8083-3B');
		expect(row?.retiredAt).not.toBeNull();
	});

	test('returns null on unknown label', async () => {
		const id = sourceId('afh-unknown');
		await upsertEdition({ sourceId: id, editionLabel: '8083-3B', publishedAt: new Date('2017-01-01') });
		expect(await getEditionByLabel(id, '8083-3D')).toBeNull();
	});
});

describe('isEditionSuperseded', () => {
	test('returns true for a retired row', async () => {
		const id = sourceId('afh-retired');
		await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3B',
			publishedAt: new Date('2017-01-01'),
			retiredAt: new Date('2024-04-01'),
		});
		expect(await isEditionSuperseded(id, '8083-3B')).toBe(true);
	});

	test('returns false for a current row', async () => {
		const id = sourceId('afh-still-current');
		await upsertEdition({ sourceId: id, editionLabel: '8083-3C', publishedAt: new Date('2024-04-01') });
		expect(await isEditionSuperseded(id, '8083-3C')).toBe(false);
	});

	test('returns false for an unknown label', async () => {
		const id = sourceId('afh-unknown-label');
		expect(await isEditionSuperseded(id, '8083-3D')).toBe(false);
	});
});

describe('listEditionsForSource', () => {
	test('returns rows oldest-first', async () => {
		const id = sourceId('afh-list');
		await upsertEdition({ sourceId: id, editionLabel: '8083-3A', publishedAt: new Date('2010-01-01') });
		await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3B',
			publishedAt: new Date('2017-01-01'),
			retiredAt: new Date('2024-04-01'),
		});
		await upsertEdition({ sourceId: id, editionLabel: '8083-3C', publishedAt: new Date('2024-04-01') });

		const rows = await listEditionsForSource(id);
		expect(rows.map((r) => r.editionLabel)).toEqual(['8083-3A', '8083-3B', '8083-3C']);
	});

	test('returns [] for unknown slug', async () => {
		expect(await listEditionsForSource(sourceId('completely-unknown'))).toEqual([]);
	});
});

describe('upsertEdition idempotency', () => {
	test('re-running with the same (sourceId, editionLabel) updates in place', async () => {
		const id = sourceId('afh-idempotent');
		const first = await upsertEdition({ sourceId: id, editionLabel: '8083-3C', publishedAt: new Date('2024-04-01') });
		const second = await upsertEdition({
			sourceId: id,
			editionLabel: '8083-3C',
			publishedAt: new Date('2024-04-01'),
			retiredAt: new Date('2025-01-01'),
		});

		// Same row id (no churn).
		expect(second.id).toBe(first.id);
		expect(second.retiredAt).not.toBeNull();

		// Only one row total for the (sourceId, label) pair.
		const rows = await listEditionsForSource(id);
		expect(rows).toHaveLength(1);
	});

	test('UNIQUE(source_id, edition_label) blocks bypass-the-helper dupes', async () => {
		// Direct insert of a duplicate `(sourceId, editionLabel)` pair must fail
		// at the schema layer -- this is the load-bearing invariant the resolver
		// (single-row return), the NOT EXISTS subquery (single-valued lookup),
		// and `markPriorEditionsRetired` (one current row per source) all rely
		// on. ADR 026 §6 / `editions_source_label_uq` partial of `db/schema.ts`.
		const id = sourceId('uq-collision');
		await upsertEdition({ sourceId: id, editionLabel: 'rev-a', publishedAt: new Date('2024-01-01') });
		// The insert builder is a Drizzle thenable, not a native Promise; the
		// `expect(...).rejects` matcher only accepts a real Promise (rejecting a
		// thenable -- or an async fn wrapping it -- with "expected a promise").
		// Drive the query through an explicit `await` and assert on the caught
		// error instead.
		let collisionError: unknown;
		try {
			await db.insert(editionsTable).values({
				id: createId('edition'),
				sourceId: id,
				editionLabel: 'rev-a',
				publishedAt: new Date('2024-02-01'),
				retiredAt: null,
				metadata: null,
			});
		} catch (err) {
			collisionError = err;
		}
		expect(collisionError).toBeInstanceOf(Error);
		expect((collisionError as Error).message).toMatch(/Failed query: insert into "sources_registry"\."editions"/);

		// Pair with a different label is allowed -- the constraint is per-pair.
		await expect(
			upsertEdition({ sourceId: id, editionLabel: 'rev-b', publishedAt: new Date('2024-03-01') }),
		).resolves.toMatchObject({ editionLabel: 'rev-b' });
	});
});
