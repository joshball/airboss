/**
 * Unit tests for the handbook-section errata BC layer.
 *
 * Pure validation tests run without a database. The DB-dependent tests
 * (insert + cascade + query ordering) live in scripts/db/* integration
 * tests where Postgres is provisioned for the run.
 */

import { describe, expect, it } from 'vitest';
import {
	type ErrataInsert,
	ErrataValidationError,
	formatErrataForDisplay,
	type HandbookSectionErrataRow,
	newErrataId,
	validateErrataInsert,
} from './handbooks-errata';

const VALID: ErrataInsert = {
	sectionId: 'hbs_01ABCDEFGHJKMNPQRSTVWXYZ12',
	errataId: 'mosaic',
	sourceUrl: 'https://www.faa.gov/example.pdf',
	publishedAt: '2025-10-20',
	patchKind: 'append_paragraph',
	targetAnchor: 'Preflight Assessment of the Aircraft',
	targetPage: '2-12',
	originalText: null,
	replacementText: 'Many light sport category certificated airplanes are equipped with water-cooled engines.',
};

describe('newErrataId', () => {
	it('returns a hbe_<ULID>-shaped string', () => {
		const id = newErrataId();
		expect(id).toMatch(/^hbe_[0-9a-hjkmnp-tv-z]{26}$/i);
	});

	it('is unique on each call', () => {
		expect(newErrataId()).not.toEqual(newErrataId());
	});
});

describe('validateErrataInsert', () => {
	it('passes a valid row', () => {
		expect(() => validateErrataInsert(VALID)).not.toThrow();
	});

	it('rejects an unknown patch_kind', () => {
		expect(() => validateErrataInsert({ ...VALID, patchKind: 'replace_table' as ErrataInsert['patchKind'] })).toThrow(
			ErrataValidationError,
		);
	});

	it('rejects add_subsection with non-null original_text', () => {
		const err = expect(() =>
			validateErrataInsert({
				...VALID,
				patchKind: 'add_subsection',
				originalText: 'something',
			}),
		);
		err.toThrow(ErrataValidationError);
		err.toThrow(/originalText = null/);
	});

	it('accepts add_subsection with null original_text', () => {
		expect(() =>
			validateErrataInsert({
				...VALID,
				patchKind: 'add_subsection',
				originalText: null,
			}),
		).not.toThrow();
	});

	it('rejects target_page that is not <chapter>-<page>', () => {
		expect(() => validateErrataInsert({ ...VALID, targetPage: '2.4' })).toThrow(/targetPage/);
	});

	it('rejects target_page that is a PDF page integer', () => {
		expect(() => validateErrataInsert({ ...VALID, targetPage: '42' })).toThrow(/targetPage/);
	});

	it('rejects empty replacement_text', () => {
		expect(() => validateErrataInsert({ ...VALID, replacementText: '   ' })).toThrow(/replacementText/);
	});

	it('rejects non-HTTPS source_url', () => {
		expect(() => validateErrataInsert({ ...VALID, sourceUrl: 'http://insecure.test/x.pdf' })).toThrow(/HTTPS/);
	});

	it('rejects non-ISO published_at', () => {
		expect(() => validateErrataInsert({ ...VALID, publishedAt: 'October 2025' })).toThrow(/ISO 8601/);
	});
});

describe('formatErrataForDisplay', () => {
	it('serializes Date appliedAt to ISO', () => {
		const appliedAt = new Date('2026-04-28T12:00:00Z');
		const row: HandbookSectionErrataRow = {
			...VALID,
			id: 'hbe_test',
			appliedAt,
			createdAt: appliedAt,
		} as HandbookSectionErrataRow;
		const out = formatErrataForDisplay(row);
		expect(out.appliedAt).toEqual(appliedAt.toISOString());
		expect(out.publishedAt).toEqual('2025-10-20');
		expect(out.patchKind).toEqual('append_paragraph');
	});

	it('preserves null original_text on add_subsection', () => {
		const row: HandbookSectionErrataRow = {
			...VALID,
			id: 'hbe_test',
			patchKind: 'add_subsection',
			originalText: null,
			appliedAt: new Date(),
			createdAt: new Date(),
		} as HandbookSectionErrataRow;
		const out = formatErrataForDisplay(row);
		expect(out.originalText).toBeNull();
	});
});
