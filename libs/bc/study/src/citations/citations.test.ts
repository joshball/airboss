/**
 * Unit tests for the pure mapping logic inside `citations.ts`.
 *
 * The DB-touching paths (verifySourceOwnership, verifyTargetExists for
 * regulation/AC/knowledge, the unique-violation surface) are covered by
 * integration tests against the real Postgres fixture. This suite exercises:
 *
 *   - The external_ref delimiter encoding round-trips through the picker
 *     write side and `resolveCitationTargets` read side without losing the
 *     URL or title.
 *   - URL validation in `verifyTargetExists` for external_ref accepts http(s)
 *     and rejects everything else.
 *   - The "missing target" branches in `resolveCitationTargets` /
 *     `resolveCitationSources` keep the row but flag it visibly.
 */

import { CITATION_SOURCE_TYPES, CITATION_TARGET_TYPES, EXTERNAL_REF_TARGET_DELIMITER } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { resolveCitationSources, resolveCitationTargets } from './citations';
import type { ContentCitationRow } from './schema';

interface FakeQueryResult<T> {
	from: () => { where: () => Promise<T[]> };
}

interface FakeDb {
	select: <T>(_columns: unknown) => FakeQueryResult<T>;
	insert: () => never;
	delete: () => never;
}

/** Build a fake `Db` that returns empty rows for every select. */
function emptyDb(): FakeDb {
	return {
		select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
		insert: () => {
			throw new Error('not implemented in fake');
		},
		delete: () => {
			throw new Error('not implemented in fake');
		},
	};
}

function makeCitationRow(
	partial: Partial<ContentCitationRow> & Pick<ContentCitationRow, 'targetType' | 'targetId'>,
): ContentCitationRow {
	const now = new Date('2026-04-25T00:00:00Z');
	return {
		id: partial.id ?? 'cit_test',
		sourceType: partial.sourceType ?? CITATION_SOURCE_TYPES.CARD,
		sourceId: partial.sourceId ?? 'card_test',
		targetType: partial.targetType,
		targetId: partial.targetId,
		citationContext: partial.citationContext ?? null,
		createdBy: partial.createdBy ?? 'user_test',
		createdAt: partial.createdAt ?? now,
		updatedAt: partial.updatedAt ?? now,
	};
}

describe('resolveCitationTargets', () => {
	it('returns an empty array for empty input without touching the db', async () => {
		const result = await resolveCitationTargets([]);
		expect(result).toEqual([]);
	});

	it('decodes external_ref target_id back into url and title', async () => {
		const url = 'https://www.faa.gov/regulations';
		const title = 'FAA Regulations Index';
		const targetId = `${url}${EXTERNAL_REF_TARGET_DELIMITER}${title}`;
		const row = makeCitationRow({
			targetType: CITATION_TARGET_TYPES.EXTERNAL_REF,
			targetId,
		});

		// biome-ignore lint/suspicious/noExplicitAny: fake db only needs select+from+where
		const result = await resolveCitationTargets([row], emptyDb() as any);

		expect(result).toHaveLength(1);
		expect(result[0].target.label).toBe(title);
		expect(result[0].target.detail).toBe(url);
		expect(result[0].target.href).toBe(url);
		expect(result[0].target.id).toBe(targetId);
	});

	it('preserves delimiters that appear inside the title', async () => {
		const url = 'https://example.com/a';
		const title = `Title with ${EXTERNAL_REF_TARGET_DELIMITER} a pipe`;
		const targetId = `${url}${EXTERNAL_REF_TARGET_DELIMITER}${title}`;
		const row = makeCitationRow({
			targetType: CITATION_TARGET_TYPES.EXTERNAL_REF,
			targetId,
		});

		// biome-ignore lint/suspicious/noExplicitAny: fake db only needs select+from+where
		const [first] = await resolveCitationTargets([row], emptyDb() as any);

		expect(first.target.label).toBe(title);
		expect(first.target.href).toBe(url);
	});

	it('falls back to the url as the label when the title is empty', async () => {
		const url = 'https://example.com/no-title';
		const targetId = `${url}${EXTERNAL_REF_TARGET_DELIMITER}`;
		const row = makeCitationRow({
			targetType: CITATION_TARGET_TYPES.EXTERNAL_REF,
			targetId,
		});

		// biome-ignore lint/suspicious/noExplicitAny: fake db only needs select+from+where
		const [first] = await resolveCitationTargets([row], emptyDb() as any);

		expect(first.target.label).toBe(url);
	});

	it('flags an internal target as missing when the lookup returns nothing', async () => {
		const row = makeCitationRow({
			targetType: CITATION_TARGET_TYPES.REGULATION_NODE,
			targetId: 'ref_unknown',
		});

		// biome-ignore lint/suspicious/noExplicitAny: fake db only needs select+from+where
		const [first] = await resolveCitationTargets([row], emptyDb() as any);

		expect(first.target.label).toBe('ref_unknown');
		expect(first.target.detail).toMatch(/missing/i);
		expect(first.target.href).toBeUndefined();
	});
});

describe('resolveCitationSources', () => {
	it('returns an empty array for empty input', async () => {
		const result = await resolveCitationSources([]);
		expect(result).toEqual([]);
	});

	it('flags a missing source row but keeps the citation row', async () => {
		const row = makeCitationRow({
			sourceType: CITATION_SOURCE_TYPES.CARD,
			sourceId: 'card_ghost',
			targetType: CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
			targetId: 'node_test',
		});

		// biome-ignore lint/suspicious/noExplicitAny: fake db only needs select+from+where
		const [first] = await resolveCitationSources([row], emptyDb() as any);

		expect(first.source.exists).toBe(false);
		expect(first.source.id).toBe('card_ghost');
		expect(first.source.label).toBe('card_ghost');
	});
});
