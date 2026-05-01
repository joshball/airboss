/**
 * Discriminated-union smoke tests for the manifest validator.
 *
 * Covers the (2.B) finding from the WP-SUB parent spec: the seeder must
 * distinguish section-tree manifests (`kind: 'handbook'`) from whole-doc
 * manifests (`kind: 'whole-doc'`) and reject malformed input clearly.
 */

import { describe, expect, it } from 'vitest';
import { manifestSchema, sectionTreeManifestSchema, wholeDocManifestSchema } from './manifest-validation';

const VALID_SECTION_TREE = {
	kind: 'handbook',
	document_slug: 'phak',
	edition: 'FAA-H-8083-25C',
	title: "Pilot's Handbook of Aeronautical Knowledge",
	publisher: 'FAA',
	source_url: 'https://www.faa.gov/test.pdf',
	fetched_at: '2026-04-26T00:00:00.000+00:00',
	subjects: ['aerodynamics'],
	sections: [
		{
			level: 'chapter',
			code: '1',
			ordinal: 1,
			parent_code: null,
			title: 'Sample',
			faa_page_start: '1-1',
			faa_page_end: '1-2',
			source_locator: 'PHAK Ch 1',
			body_path: 'handbooks/phak/FAA-H-8083-25C/01/index.md',
			content_hash: 'a'.repeat(64),
			has_figures: false,
			has_tables: false,
		},
	],
	figures: [],
} as const;

const VALID_WHOLE_DOC = {
	kind: 'whole-doc',
	document_slug: 'risk-management',
	edition: '8083-2A',
	title: 'Risk Management Handbook',
	publisher: 'FAA',
	source_url: 'https://www.faa.gov/risk-mgmt.pdf',
	fetched_at: '2026-04-26T00:00:00.000+00:00',
	body_path: 'handbooks/risk-management/FAA-H-8083-2A/document.md',
	body_sha256: 'b'.repeat(64),
	page_count: 80,
	doc_id: 'faa-h-8083-2',
	faa_edition: '2A',
} as const;

describe('manifestSchema (discriminated union on kind)', () => {
	it('accepts a valid section-tree manifest', () => {
		const result = manifestSchema.safeParse(VALID_SECTION_TREE);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('handbook');
		}
	});

	it('accepts a valid whole-doc manifest', () => {
		const result = manifestSchema.safeParse(VALID_WHOLE_DOC);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('whole-doc');
		}
	});

	it('accepts a whole-doc manifest with explicit null faa_edition', () => {
		// aviation-instructor's manifest emits `"faa_edition": null` literally;
		// the schema must accept this (not just `undefined`).
		const result = manifestSchema.safeParse({ ...VALID_WHOLE_DOC, faa_edition: null });
		expect(result.success).toBe(true);
	});

	it('rejects a manifest missing the kind discriminator', () => {
		const { kind: _omit, ...withoutKind } = VALID_SECTION_TREE;
		const result = manifestSchema.safeParse(withoutKind);
		expect(result.success).toBe(false);
	});

	it('rejects a manifest with an unknown kind', () => {
		const result = manifestSchema.safeParse({ ...VALID_SECTION_TREE, kind: 'novel-shape' });
		expect(result.success).toBe(false);
	});

	it("rejects a section-tree manifest missing 'sections'", () => {
		const { sections: _drop, ...withoutSections } = VALID_SECTION_TREE;
		const result = sectionTreeManifestSchema.safeParse(withoutSections);
		expect(result.success).toBe(false);
	});

	it("rejects a whole-doc manifest missing 'body_path'", () => {
		const { body_path: _drop, ...withoutBody } = VALID_WHOLE_DOC;
		const result = wholeDocManifestSchema.safeParse(withoutBody);
		expect(result.success).toBe(false);
	});

	it('rejects a whole-doc manifest with malformed body_sha256', () => {
		const result = wholeDocManifestSchema.safeParse({ ...VALID_WHOLE_DOC, body_sha256: 'not-a-hex' });
		expect(result.success).toBe(false);
	});
});
