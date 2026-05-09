/**
 * Tests for the bulk seed paths added to support COPY-based ingestion:
 *
 *   - bulkUpsertReferenceSections (COPY FROM STDIN + INSERT ... ON CONFLICT)
 *   - bulkReplaceFiguresForSections (DELETE + chunked multi-row INSERT)
 *
 * Real Postgres -- exercises the COPY protocol path end-to-end. Each suite
 * builds its own per-suite reference rows so parallel test runs (and the
 * row-by-row test suite in `references.test.ts`) don't contend on the same
 * `(document_slug, edition)` index.
 */

import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { airbossRefForHandbookSection } from '@ab/sources';
import { generateReferenceId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	bulkReplaceFiguresForSections,
	bulkUpsertReferenceSections,
	type FigureInput,
	type UpsertReferenceSectionInput,
} from './references';
import { reference, referenceFigure, referenceSection } from './schema';

const SUITE_TAG = `bulk-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const SLUG = `bulk-${SUITE_TOKEN}`;
const REF_ID = generateReferenceId();
const REF_ID_TWO = generateReferenceId();

beforeAll(async () => {
	const now = new Date();
	await db.insert(reference).values([
		{
			id: REF_ID,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: SLUG,
			edition: 'FAA-H-BULK-1',
			title: 'Bulk Test Handbook',
			publisher: 'TEST',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: REF_ID_TWO,
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: `${SLUG}-two`,
			edition: 'FAA-H-BULK-2',
			title: 'Bulk Test Handbook Two',
			publisher: 'TEST',
			url: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);
});

afterAll(async () => {
	await db.delete(referenceFigure).where(eq(referenceFigure.seedOrigin, SUITE_TAG));
	await db.delete(referenceSection).where(eq(referenceSection.seedOrigin, SUITE_TAG));
	await db.delete(reference).where(eq(reference.seedOrigin, SUITE_TAG));
});

function chapter(idx: number): UpsertReferenceSectionInput {
	const code = String(idx);
	return {
		referenceId: REF_ID,
		parentId: null,
		level: REFERENCE_SECTION_LEVELS.CHAPTER,
		ordinal: idx,
		depth: 0,
		code,
		airbossRef: airbossRefForHandbookSection(SLUG, 'FAA-H-BULK-1', code),
		title: `Chapter ${idx}`,
		faaPages: { start: `${idx}-1`, end: `${idx}-1` },
		sourceLocator: `BULK Ch ${idx}`,
		contentMd: `# Chapter ${idx}\n\nBody for chapter ${idx}.`,
		contentHash: `hash-ch-${idx}`,
		hasFigures: false,
		hasTables: false,
		metadata: {},
		seedOrigin: SUITE_TAG,
	};
}

function section(chapterIdx: number, sectionIdx: number, parentId: string | null): UpsertReferenceSectionInput {
	const code = `${chapterIdx}.${sectionIdx}`;
	return {
		referenceId: REF_ID,
		parentId,
		level: REFERENCE_SECTION_LEVELS.SECTION,
		ordinal: sectionIdx,
		depth: 1,
		code,
		airbossRef: airbossRefForHandbookSection(SLUG, 'FAA-H-BULK-1', code),
		title: `Section ${code}`,
		faaPages: { start: `${chapterIdx}-${sectionIdx}`, end: `${chapterIdx}-${sectionIdx}` },
		sourceLocator: `BULK Ch ${chapterIdx} §${sectionIdx}`,
		contentMd: `Section ${code} body. Includes a comma, "quotes", and \nnewlines\rfor CSV-escape coverage.`,
		contentHash: `hash-${code}`,
		hasFigures: false,
		hasTables: false,
		metadata: { idx: sectionIdx, kind: 'section' },
		seedOrigin: SUITE_TAG,
	};
}

describe('bulkUpsertReferenceSections', () => {
	it('returns an empty array for empty input without touching the DB', async () => {
		const out = await bulkUpsertReferenceSections([]);
		expect(out).toEqual([]);
	});

	it('inserts N rows via COPY+merge and returns results in input order', async () => {
		const inputs = [chapter(1), chapter(2), chapter(3)];
		const out = await bulkUpsertReferenceSections(inputs);
		expect(out).toHaveLength(3);
		// All freshly inserted -> changed: true
		expect(out.map((r) => r.changed)).toEqual([true, true, true]);
		expect(out.map((r) => r.row.code)).toEqual(['1', '2', '3']);
		// Spot-check the row was actually written.
		const row = await db
			.select()
			.from(referenceSection)
			.where(eq(referenceSection.id, out[0]?.row.id ?? ''));
		expect(row).toHaveLength(1);
		expect(row[0]?.title).toBe('Chapter 1');
	});

	it('re-running with identical inputs returns all changed=false (cache fast-path)', async () => {
		// First pass to land them.
		const first = await bulkUpsertReferenceSections([chapter(10), chapter(11)]);
		expect(first.every((r) => r.changed)).toBe(true);

		// Second pass with the same inputs -> cache hit, zero DB writes.
		const before = await db
			.select({ updatedAt: referenceSection.updatedAt })
			.from(referenceSection)
			.where(eq(referenceSection.id, first[0]?.row.id ?? ''));
		const second = await bulkUpsertReferenceSections([chapter(10), chapter(11)]);
		const after = await db
			.select({ updatedAt: referenceSection.updatedAt })
			.from(referenceSection)
			.where(eq(referenceSection.id, first[0]?.row.id ?? ''));
		expect(second.every((r) => !r.changed)).toBe(true);
		expect(second.map((r) => r.row.code)).toEqual(['10', '11']);
		// updated_at didn't move because nothing was written.
		expect(after[0]?.updatedAt.getTime()).toBe(before[0]?.updatedAt.getTime());
	});

	it('honors parent->child depth ordering', async () => {
		// Build a chapter + section in one call. The seeders feed inputs in
		// depth order; we mirror the handbook seeder pattern (parent_id
		// resolved AFTER the parent's bulk pass), so feed parents first via
		// a depth-0 batch, then children via a depth-1 batch.
		const ch = chapter(20);
		const parents = await bulkUpsertReferenceSections([ch]);
		const parentRow = parents[0]?.row;
		expect(parentRow).toBeDefined();
		if (!parentRow) return;
		const children = [section(20, 1, parentRow.id), section(20, 2, parentRow.id)];
		const childResults = await bulkUpsertReferenceSections(children);
		expect(childResults).toHaveLength(2);
		expect(childResults.every((r) => r.changed)).toBe(true);
		// FK landed and resolves back to the chapter.
		const fetched = await db
			.select({ parentId: referenceSection.parentId })
			.from(referenceSection)
			.where(eq(referenceSection.id, childResults[0]?.row.id ?? ''));
		expect(fetched[0]?.parentId).toBe(parentRow.id);
	});

	it('mixed unchanged / content-changed / new returns correct flags', async () => {
		const a = chapter(30);
		const b = chapter(31);
		// First pass: both new.
		await bulkUpsertReferenceSections([a, b]);

		// Mutate b's hash + body. a stays identical. c is brand new.
		const bMutated = { ...b, contentMd: '# Updated body 31', contentHash: 'hash-ch-31-v2' };
		const c = chapter(32);
		const out = await bulkUpsertReferenceSections([a, bMutated, c]);
		expect(out.map((r) => r.changed)).toEqual([false, true, true]);
		// Spot-check b's row was actually updated.
		const fetched = await db.select().from(referenceSection).where(eq(referenceSection.code, '31'));
		const onlyB = fetched.find((r) => r.referenceId === REF_ID);
		expect(onlyB?.contentHash).toBe('hash-ch-31-v2');
		expect(onlyB?.contentMd).toBe('# Updated body 31');
	});

	it('handles inputs spanning multiple references in one call', async () => {
		const ch1 = chapter(40);
		const ch2 = {
			...chapter(40),
			referenceId: REF_ID_TWO,
			airbossRef: airbossRefForHandbookSection(`${SLUG}-two`, 'FAA-H-BULK-2', '40'),
		};
		const out = await bulkUpsertReferenceSections([ch1, ch2]);
		expect(out).toHaveLength(2);
		expect(out.every((r) => r.changed)).toBe(true);
		// They're separate rows under distinct references.
		expect(out[0]?.row.referenceId).toBe(REF_ID);
		expect(out[1]?.row.referenceId).toBe(REF_ID_TWO);
		expect(out[0]?.row.id).not.toBe(out[1]?.row.id);
	});

	it('CSV escaping survives commas, quotes, and newlines in body content', async () => {
		const tricky: UpsertReferenceSectionInput = {
			...chapter(50),
			contentMd: 'Line one,\n"quoted line",\rcr-followed,\r\ncrlf\nend',
			title: 'Title with, "quotes", and\ttabs',
			contentHash: 'hash-tricky-50',
		};
		const out = await bulkUpsertReferenceSections([tricky]);
		expect(out[0]?.changed).toBe(true);
		const fetched = await db
			.select()
			.from(referenceSection)
			.where(eq(referenceSection.id, out[0]?.row.id ?? ''));
		expect(fetched[0]?.contentMd).toBe('Line one,\n"quoted line",\rcr-followed,\r\ncrlf\nend');
		expect(fetched[0]?.title).toBe('Title with, "quotes", and\ttabs');
	});

	it('JSON metadata round-trips correctly', async () => {
		const ch = {
			...chapter(60),
			metadata: { extraction_status: 'placeholder', notes: 'has, commas, and "quotes"' },
		};
		const out = await bulkUpsertReferenceSections([ch]);
		const fetched = await db
			.select()
			.from(referenceSection)
			.where(eq(referenceSection.id, out[0]?.row.id ?? ''));
		expect(fetched[0]?.metadata).toMatchObject({
			extraction_status: 'placeholder',
			notes: 'has, commas, and "quotes"',
			faaPages: { start: '60-1', end: '60-1' },
		});
	});
});

describe('bulkReplaceFiguresForSections', () => {
	it('returns 0 for empty input without touching the DB', async () => {
		const written = await bulkReplaceFiguresForSections([]);
		expect(written).toBe(0);
	});

	it('replaces figures for a single section', async () => {
		const sec = await bulkUpsertReferenceSections([chapter(70)]);
		const sectionId = sec[0]?.row.id ?? '';
		const figs: FigureInput[] = [
			{ ordinal: 0, caption: 'Figure 1', assetPath: 'handbooks/x/y/fig1.png', width: 100, height: 50 },
			{ ordinal: 1, caption: 'Figure 2', assetPath: 'handbooks/x/y/fig2.png', width: null, height: null },
		];
		const written = await bulkReplaceFiguresForSections([{ sectionId, figures: figs }], undefined, SUITE_TAG);
		expect(written).toBe(2);
		const stored = await db.select().from(referenceFigure).where(eq(referenceFigure.sectionId, sectionId));
		expect(stored).toHaveLength(2);
		expect(stored.map((r) => r.ordinal).sort()).toEqual([0, 1]);
	});

	it('replaces figures across multiple sections in one call', async () => {
		const sec1 = await bulkUpsertReferenceSections([chapter(71)]);
		const sec2 = await bulkUpsertReferenceSections([chapter(72)]);
		const id1 = sec1[0]?.row.id ?? '';
		const id2 = sec2[0]?.row.id ?? '';
		const written = await bulkReplaceFiguresForSections(
			[
				{
					sectionId: id1,
					figures: [{ ordinal: 0, caption: 'a', assetPath: 'a.png', width: 1, height: 1 }],
				},
				{
					sectionId: id2,
					figures: [
						{ ordinal: 0, caption: 'b1', assetPath: 'b1.png', width: 2, height: 2 },
						{ ordinal: 1, caption: 'b2', assetPath: 'b2.png', width: 2, height: 2 },
					],
				},
			],
			undefined,
			SUITE_TAG,
		);
		expect(written).toBe(3);
	});

	it('empty figures[] for a section drops every prior row', async () => {
		const sec = await bulkUpsertReferenceSections([chapter(73)]);
		const id = sec[0]?.row.id ?? '';
		await bulkReplaceFiguresForSections(
			[{ sectionId: id, figures: [{ ordinal: 0, caption: 'first', assetPath: 'first.png', width: 1, height: 1 }] }],
			undefined,
			SUITE_TAG,
		);
		// Now wipe the section's figures by passing an empty array.
		const written = await bulkReplaceFiguresForSections([{ sectionId: id, figures: [] }], undefined, SUITE_TAG);
		expect(written).toBe(0);
		const stored = await db.select().from(referenceFigure).where(eq(referenceFigure.sectionId, id));
		expect(stored).toHaveLength(0);
	});
});
