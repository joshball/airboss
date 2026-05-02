/**
 * Discriminated-union smoke tests for the manifest validator.
 *
 * Covers the (2.B) finding from the WP-SUB parent spec: the seeder must
 * distinguish section-tree manifests (`kind: 'handbook'`) from whole-doc
 * manifests (`kind: 'whole-doc'`) and reject malformed input clearly.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	handbookManifestErrataEntrySchema,
	manifestSchema,
	sectionTreeManifestSchema,
	wholeDocManifestSchema,
} from './manifest-validation';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');

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

describe('handbookManifestErrataEntrySchema', () => {
	const VALID_ERRATA = {
		id: 'mosaic',
		source_url: 'https://www.faa.gov/x/PHAK_Addendum.pdf',
		published_at: '2025-10-20',
		sha256: 'a'.repeat(64),
		fetched_at: '2026-04-28T18:13:55.900013+00:00',
		applied_at: '2026-04-28T18:13:56.118948+00:00',
		parser: 'bullet-edits',
		sections_patched: [
			{
				section_code: '1.4',
				section_path: 'handbooks/phak/FAA-H-8083-25C/01/04-aircraft-classifications.md',
				chapter: '01',
				target_page: '1-15',
				patch_kind: 'replace_paragraph',
				section_anchor: 'Aircraft Classifications and Ultralight Vehicles',
				new_heading: null,
				content_hash: 'c'.repeat(64),
				errata_note_path: 'handbooks/phak/FAA-H-8083-25C/01/04-aircraft-classifications.errata.md',
			},
		],
	} as const;

	it('accepts a real-shape errata entry', () => {
		const result = handbookManifestErrataEntrySchema.safeParse(VALID_ERRATA);
		expect(result.success).toBe(true);
	});

	it('rejects an errata entry with malformed id (uppercase)', () => {
		const result = handbookManifestErrataEntrySchema.safeParse({ ...VALID_ERRATA, id: 'MOSAIC' });
		expect(result.success).toBe(false);
	});

	it('rejects an errata entry with non-ISO published_at', () => {
		const result = handbookManifestErrataEntrySchema.safeParse({ ...VALID_ERRATA, published_at: '10/20/2025' });
		expect(result.success).toBe(false);
	});

	it('rejects an errata entry with malformed sha256', () => {
		const result = handbookManifestErrataEntrySchema.safeParse({ ...VALID_ERRATA, sha256: 'abc' });
		expect(result.success).toBe(false);
	});

	it('rejects an errata entry with non-URL source_url', () => {
		const result = handbookManifestErrataEntrySchema.safeParse({ ...VALID_ERRATA, source_url: 'not a url' });
		expect(result.success).toBe(false);
	});

	it('rejects an errata entry missing sections_patched', () => {
		const { sections_patched: _drop, ...withoutPatched } = VALID_ERRATA;
		const result = handbookManifestErrataEntrySchema.safeParse(withoutPatched);
		expect(result.success).toBe(false);
	});
});

describe('section-tree manifest with errata + extraction', () => {
	const SECTION_TREE_WITH_AUDIT = {
		...VALID_SECTION_TREE,
		extraction: {
			section_strategy: {
				kind: 'toc',
				config: {
					toc: { page_start: 6, page_end: 15, pattern: 'dotted_leader' },
				},
			},
			figure_dedup: { canonicalized: 2, freed_bytes: 262476 },
		},
		errata: [
			{
				id: 'mosaic',
				source_url: 'https://www.faa.gov/x/PHAK_Addendum.pdf',
				published_at: '2025-10-20',
				sha256: 'a'.repeat(64),
				fetched_at: '2026-04-28T18:13:55.900013+00:00',
				applied_at: '2026-04-28T18:13:56.118948+00:00',
				parser: 'bullet-edits',
				sections_patched: [],
			},
		],
	} as const;

	it('accepts a section-tree manifest with both extraction and errata', () => {
		const result = sectionTreeManifestSchema.safeParse(SECTION_TREE_WITH_AUDIT);
		expect(result.success).toBe(true);
	});

	it('rejects a section-tree manifest with malformed errata entry', () => {
		const broken = {
			...SECTION_TREE_WITH_AUDIT,
			errata: [{ ...SECTION_TREE_WITH_AUDIT.errata[0], sha256: 'not-a-hash' }],
		};
		const result = sectionTreeManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});
});

describe('on-disk manifest fixtures (every shipped handbook)', () => {
	const HANDBOOK_FIXTURES = [
		{ slug: 'phak', edition: 'FAA-H-8083-25C', kind: 'handbook' },
		{ slug: 'afh', edition: 'FAA-H-8083-3C', kind: 'handbook' },
		{ slug: 'avwx', edition: 'FAA-H-8083-28B', kind: 'handbook' },
		{ slug: 'iph', edition: 'FAA-H-8083-16B', kind: 'whole-doc' },
		{ slug: 'ifh', edition: 'FAA-H-8083-15B', kind: 'whole-doc' },
		{ slug: 'risk-management', edition: 'FAA-H-8083-2A', kind: 'whole-doc' },
		{ slug: 'aviation-instructor', edition: 'FAA-H-8083-9', kind: 'whole-doc' },
		{ slug: 'amt-general', edition: 'FAA-H-8083-30B', kind: 'whole-doc' },
		{ slug: 'amt-powerplant', edition: 'FAA-H-8083-32B', kind: 'whole-doc' },
	] as const;

	for (const { slug, edition, kind } of HANDBOOK_FIXTURES) {
		it(`parses cleanly: ${slug}/${edition} (${kind})`, () => {
			const path = resolve(REPO_ROOT, 'handbooks', slug, edition, 'manifest.json');
			const raw = JSON.parse(readFileSync(path, 'utf-8'));
			const result = manifestSchema.safeParse(raw);
			// Fold the error issues into the assertion so a parse failure surfaces
			// the offending path/code/message directly without needing a console.
			const issuesSummary = result.success
				? null
				: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
			expect(issuesSummary, `Manifest ${slug}/${edition}\n${issuesSummary ?? ''}`).toBeNull();
		});
	}
});
