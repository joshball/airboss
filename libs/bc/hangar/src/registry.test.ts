/**
 * Registry helper tests -- create, update (incl. rev conflict), soft-delete
 * for both `hangar.reference` and `hangar.source`. Uses the live dev
 * Postgres connection (same pattern as libs/bc/study/*.test.ts) and seeds a
 * test user to satisfy the FK on updated_by.
 */

import { bauthUser } from '@ab/auth/schema';
import { db } from '@ab/db';
import { generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	createReference,
	createSource,
	getReference,
	getReferenceSummary,
	getSource,
	listReferences,
	listSources,
	NotFoundError,
	RevConflictError,
	softDeleteReference,
	softDeleteSource,
	updateReference,
	updateSource,
} from './registry';
import { hangarReference, hangarSource } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `hangar-registry-test-${TEST_USER_ID}@airboss.test`;
const ID_PREFIX = `test-${TEST_USER_ID.slice(-12)
	.toLowerCase()
	.replace(/[^a-z0-9]/g, '-')}`;

// Collected for targeted cleanup so this suite never walks live rows.
const refIds: string[] = [];
const srcIds: string[] = [];

function refId(suffix: string): string {
	const id = `${ID_PREFIX}-ref-${suffix}`;
	refIds.push(id);
	return id;
}

function srcId(suffix: string): string {
	const id = `${ID_PREFIX}-src-${suffix}`;
	srcIds.push(id);
	return id;
}

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			emailVerified: false,
			name: 'Hangar registry test',
			firstName: 'Hangar',
			lastName: 'Registry',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
});

afterAll(async () => {
	for (const id of refIds) {
		await db.delete(hangarReference).where(eq(hangarReference.id, id));
	}
	for (const id of srcIds) {
		await db.delete(hangarSource).where(eq(hangarSource.id, id));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

function referenceInput(id: string) {
	return {
		id,
		displayName: id,
		aliases: ['alt-1'],
		paraphrase: 'initial body',
		tags: {
			sourceType: 'cfr' as const,
			aviationTopic: ['regulations' as const],
			flightRules: 'both' as const,
			knowledgeKind: 'reference' as const,
		},
		sources: [],
		related: [],
	};
}

function sourceInput(id: string) {
	return {
		id,
		type: 'cfr' as const,
		title: `Source ${id}`,
		version: 'v1',
		url: 'https://example.test',
		path: `data/sources/${id}.xml`,
		format: 'xml',
		checksum: 'pending-download',
		downloadedAt: 'pending-download',
	};
}

describe('registry -- references', () => {
	it('creates, flips dirty=true, rev=1, and is findable', async () => {
		const id = refId('create');
		const row = await createReference(referenceInput(id), TEST_USER_ID);
		expect(row.id).toBe(id);
		expect(row.rev).toBe(1);
		expect(row.dirty).toBe(true);
		expect(row.updatedBy).toBe(TEST_USER_ID);

		const fetched = await getReference(id);
		expect(fetched?.displayName).toBe(id);
	});

	it('updates bump rev, keep dirty, preserve id, and persist new fields', async () => {
		const id = refId('update');
		const created = await createReference(referenceInput(id), TEST_USER_ID);
		const updated = await updateReference(
			{
				...referenceInput(id),
				displayName: 'changed',
				paraphrase: 'updated body',
				rev: created.rev,
			},
			TEST_USER_ID,
		);
		expect(updated.rev).toBe(created.rev + 1);
		expect(updated.dirty).toBe(true);
		expect(updated.displayName).toBe('changed');
		expect(updated.paraphrase).toBe('updated body');
	});

	it('rejects stale rev with RevConflictError', async () => {
		const id = refId('conflict');
		const created = await createReference(referenceInput(id), TEST_USER_ID);
		await updateReference({ ...referenceInput(id), displayName: 'a', rev: created.rev }, TEST_USER_ID);

		// Second writer still holds the old rev.
		await expect(() =>
			updateReference({ ...referenceInput(id), displayName: 'b', rev: created.rev }, TEST_USER_ID),
		).rejects.toBeInstanceOf(RevConflictError);
	});

	it('soft-delete sets deletedAt, bumps rev, flips dirty, and hides from the default list', async () => {
		const id = refId('delete');
		const created = await createReference(referenceInput(id), TEST_USER_ID);
		const deleted = await softDeleteReference({ id, rev: created.rev }, TEST_USER_ID);
		expect(deleted.deletedAt).not.toBeNull();
		expect(deleted.rev).toBe(created.rev + 1);
		expect(deleted.dirty).toBe(true);

		// deletedAt rows are excluded from list() by default.
		const listed = await listReferences({ limit: 100, offset: 0 });
		expect(listed.rows.some((r) => r.id === id)).toBe(false);
	});

	it('throws NotFoundError on update of a deleted reference', async () => {
		const id = refId('deleted-update');
		const created = await createReference(referenceInput(id), TEST_USER_ID);
		const deleted = await softDeleteReference({ id, rev: created.rev }, TEST_USER_ID);

		await expect(() =>
			updateReference({ ...referenceInput(id), displayName: 'x', rev: deleted.rev }, TEST_USER_ID),
		).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe('registry -- sources', () => {
	it('creates + updates source with rev lock', async () => {
		const id = srcId('create');
		const created = await createSource(sourceInput(id), TEST_USER_ID);
		expect(created.rev).toBe(1);
		expect(created.dirty).toBe(true);

		const updated = await updateSource({ ...sourceInput(id), title: 'changed', rev: created.rev }, TEST_USER_ID);
		expect(updated.rev).toBe(created.rev + 1);
		expect(updated.title).toBe('changed');
	});

	it('rejects stale rev with RevConflictError', async () => {
		const id = srcId('conflict');
		const created = await createSource(sourceInput(id), TEST_USER_ID);
		await updateSource({ ...sourceInput(id), title: 'x', rev: created.rev }, TEST_USER_ID);

		await expect(() =>
			updateSource({ ...sourceInput(id), title: 'y', rev: created.rev }, TEST_USER_ID),
		).rejects.toBeInstanceOf(RevConflictError);
	});

	it('soft-delete hides the source from the list', async () => {
		const id = srcId('delete');
		const created = await createSource(sourceInput(id), TEST_USER_ID);
		const deleted = await softDeleteSource({ id, rev: created.rev }, TEST_USER_ID);
		expect(deleted.deletedAt).not.toBeNull();

		const listed = await listSources({ limit: 100, offset: 0 });
		expect(listed.rows.some((r) => r.id === id)).toBe(false);
	});

	it('getSource returns the row by id', async () => {
		const id = srcId('get');
		await createSource(sourceInput(id), TEST_USER_ID);
		const fetched = await getSource(id);
		expect(fetched?.id).toBe(id);
	});
});

describe('getReferenceSummary -- slim projection for /references/[id]', () => {
	it('returns id, displayName, paraphrase, tags only', async () => {
		const id = refId('summary');
		const created = await createReference(referenceInput(id), TEST_USER_ID);
		// Make sure a non-summary field exists on the row so we can assert
		// the summary projection drops it.
		expect(created.aliases.length).toBeGreaterThan(0);

		const summary = await getReferenceSummary(id);
		expect(summary).toBeDefined();
		expect(summary?.id).toBe(id);
		expect(summary?.displayName).toBe(id);
		expect(summary?.paraphrase).toBe('initial body');
		expect(summary?.tags).toBeDefined();

		// The slim projection must not include audit/lifecycle columns.
		const keys = Object.keys(summary ?? {}).sort();
		expect(keys).toEqual(['displayName', 'id', 'paraphrase', 'tags']);
	});

	it('returns undefined for a missing id', async () => {
		const summary = await getReferenceSummary(`${ID_PREFIX}-ref-does-not-exist`);
		expect(summary).toBeUndefined();
	});

	it('returns the row even if soft-deleted (no deletedAt filter on the projection)', async () => {
		const id = refId('summary-deleted');
		const created = await createReference(referenceInput(id), TEST_USER_ID);
		await softDeleteReference({ id, rev: created.rev }, TEST_USER_ID);

		const summary = await getReferenceSummary(id);
		expect(summary?.id).toBe(id);
	});
});
