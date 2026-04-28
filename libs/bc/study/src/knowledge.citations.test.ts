/**
 * Tests for `getCitationsForKnowledgeNode`. Covers:
 *
 *   - Returns the empty array when the node id is unknown.
 *   - Returns the empty array when the node has no references.
 *   - Filters legacy entries out (pre-migration shape) so downstream
 *     consumers see a uniform StructuredCitation[] surface.
 *   - Returns mixed rows narrowed to structured-only (the migration is
 *     in flight; some rows are flipped, some are not).
 *   - Returns every entry when the row is fully migrated.
 */

import { CITATION_FRAMINGS } from '@ab/constants';
import { db } from '@ab/db/connection';
import type { LegacyCitation, StructuredCitation } from '@ab/types';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCitationsForKnowledgeNode } from './knowledge';
import { knowledgeNode } from './schema';

const TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');

const NODE_EMPTY = `kn-cit-empty-${TOKEN}`;
const NODE_LEGACY = `kn-cit-legacy-${TOKEN}`;
const NODE_MIXED = `kn-cit-mixed-${TOKEN}`;
const NODE_STRUCTURED = `kn-cit-structured-${TOKEN}`;
const ALL_IDS: ReadonlyArray<string> = [NODE_EMPTY, NODE_LEGACY, NODE_MIXED, NODE_STRUCTURED];

beforeAll(async () => {
	const now = new Date();

	const legacy: LegacyCitation[] = [{ source: 'PHAK', detail: 'Chapter 5', note: '' }];
	const structured: StructuredCitation = {
		kind: 'cfr',
		reference_id: 'ref_test_placeholder',
		locator: { title: 14, part: 91, section: '3' },
		framing: CITATION_FRAMINGS.REGULATORY,
	};
	const mixed: ReadonlyArray<unknown> = [structured, { source: 'AIM', detail: '5-1-7', note: '' } as LegacyCitation];

	const baseRow = {
		title: 'test node',
		domain: 'aerodynamics',
		contentMd: '',
		createdAt: now,
		updatedAt: now,
	};

	await db.insert(knowledgeNode).values([
		{ ...baseRow, id: NODE_EMPTY, references: [] },
		{
			...baseRow,
			id: NODE_LEGACY,
			references: legacy as unknown as { source: string; detail: string; note: string }[],
		},
		{
			...baseRow,
			id: NODE_MIXED,
			references: mixed as unknown as { source: string; detail: string; note: string }[],
		},
		{
			...baseRow,
			id: NODE_STRUCTURED,
			references: [structured] as unknown as { source: string; detail: string; note: string }[],
			referencesV2Migrated: true,
		},
	]);
});

afterAll(async () => {
	await db.delete(knowledgeNode).where(inArray(knowledgeNode.id, ALL_IDS as string[]));
});

describe('getCitationsForKnowledgeNode', () => {
	it('returns [] for an unknown node id', async () => {
		expect(await getCitationsForKnowledgeNode(`unknown-${TOKEN}`)).toEqual([]);
	});

	it('returns [] for a node with no references', async () => {
		expect(await getCitationsForKnowledgeNode(NODE_EMPTY)).toEqual([]);
	});

	it('filters legacy entries out (returns [] for a legacy-only node)', async () => {
		const result = await getCitationsForKnowledgeNode(NODE_LEGACY);
		expect(result).toEqual([]);
	});

	it('returns only the structured entry from a mixed row', async () => {
		const result = await getCitationsForKnowledgeNode(NODE_MIXED);
		expect(result.length).toBe(1);
		expect(result[0]?.kind).toBe('cfr');
	});

	it('returns every entry on a fully-migrated row', async () => {
		const result = await getCitationsForKnowledgeNode(NODE_STRUCTURED);
		expect(result.length).toBe(1);
		expect(result[0]?.kind).toBe('cfr');
	});
});
