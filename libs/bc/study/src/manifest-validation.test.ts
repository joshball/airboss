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
	acManifestSchema,
	acsManifestSchema,
	aimManifestSchema,
	cfrManifestSchema,
	cfrSectionsFileSchema,
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
			body_path: 'handbooks/phak/FAA-H-8083-25C/01-introduction-to-flying/00-introduction-to-flying.md',
			content_hash: 'a'.repeat(64),
			has_figures: false,
			has_tables: false,
		},
	],
	figures: [],
} as const;

const VALID_AIM = {
	kind: 'aim',
	document_slug: 'aim',
	edition: '2026-04',
	title: 'Aeronautical Information Manual',
	publisher: 'FAA',
	source_url: 'https://www.faa.gov/air_traffic/publications/media/aim.pdf',
	fetched_at: '2026-04-26T00:00:00.000+00:00',
	subjects: ['regulations', 'procedures', 'navigation'],
	primary_cert: null,
	entries: [
		{
			kind: 'chapter',
			code: '1',
			title: 'Air Navigation',
			body_path: 'aim/2026-04/01-air-navigation/00-air-navigation.md',
			content_hash: 'a'.repeat(64),
		},
		{
			kind: 'section',
			code: '1-1',
			title: 'Navigation Aids',
			body_path: 'aim/2026-04/01-air-navigation/01-navigation-aids/00-navigation-aids.md',
			content_hash: 'b'.repeat(64),
		},
		{
			kind: 'paragraph',
			code: '1-1-1',
			title: 'General',
			body_path: 'aim/2026-04/01-air-navigation/01-navigation-aids/01-general.md',
			content_hash: 'c'.repeat(64),
		},
	],
} as const;

const VALID_AC = {
	kind: 'ac',
	schema_version: 1,
	corpus: 'ac',
	doc_slug: '61-98',
	doc_number: '61-98',
	revision: 'd',
	title: 'AC 61-98D - Currency Requirements and Guidance',
	publisher: 'FAA',
	publication_date: '2018-04-30',
	source_url: 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_61-98D.pdf',
	source_sha256: 'a'.repeat(64),
	fetched_at: '2026-04-26T00:00:00.000+00:00',
	page_count: 49,
	body_path: 'ac/61-98/d/ac-61-98-d.md',
	body_sha256: 'b'.repeat(64),
	sections: [],
	changes: [],
} as const;

const VALID_WHOLE_DOC = {
	kind: 'whole-doc',
	document_slug: 'risk-management',
	edition: '8083-2A',
	title: 'Risk Management Handbook',
	publisher: 'FAA',
	source_url: 'https://www.faa.gov/risk-mgmt.pdf',
	fetched_at: '2026-04-26T00:00:00.000+00:00',
	body_path: 'handbooks/risk-management/FAA-H-8083-2A/risk-management-FAA-H-8083-2A.md',
	body_sha256: 'b'.repeat(64),
	page_count: 80,
	doc_id: 'faa-h-8083-2',
	faa_edition: '2A',
} as const;

const VALID_ACS = {
	kind: 'acs',
	schema_version: 1,
	corpus: 'acs',
	slug: 'ppl-airplane-6c',
	title: 'Private Pilot for Airplane Category ACS',
	publisher: 'FAA',
	publication_date: '2023-11-01',
	source_url: 'https://www.faa.gov/training_testing/testing/acs/private_airplane_acs_6.pdf',
	source_sha256: 'a'.repeat(64),
	fetched_at: '2026-04-27T21:20:47.864+00:00',
	page_count: 87,
	areas: [
		{
			area: '01',
			title: 'Preflight Preparation',
			tasks: [
				{
					task: 'a',
					title: 'Pilot Qualifications',
					body_path: 'acs/ppl-airplane-6c/area-01/task-a.md',
					body_sha256: 'b'.repeat(64),
					elements: [
						{
							triad: 'k',
							ordinal: '01',
							code: 'PA.I.A.K1',
							title: 'Certification requirements, recent flight experience, and recordkeeping.',
						},
					],
				},
			],
		},
	],
} as const;

const VALID_CFR = {
	kind: 'cfr',
	schemaVersion: 1,
	title: '14',
	editionSlug: '2026',
	editionDate: '2026-04-22',
	sourceUrl: 'file:///cache/regulations/cfr-14/2026-04-22.xml',
	sourceSha256: 'a'.repeat(64),
	fetchedAt: '2026-04-30T22:31:18.124Z',
	partCount: 226,
	subpartCount: 664,
	sectionCount: 6328,
} as const;

const VALID_CFR_SECTIONS_FILE = {
	schemaVersion: 1,
	edition: '2026',
	sectionsByPart: {
		'91': [
			{
				id: 'airboss-ref:regs/cfr-14/91/103',
				canonical_short: '§91.103',
				canonical_title: 'Preflight action',
				last_amended_date: '2024-08-01',
				body_path: '91/91-103.md',
				body_sha256: 'c'.repeat(64),
			},
		],
	},
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

	it('accepts a valid AIM manifest', () => {
		const result = manifestSchema.safeParse(VALID_AIM);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('aim');
		}
	});

	it("rejects an AIM manifest missing 'entries'", () => {
		const { entries: _drop, ...withoutEntries } = VALID_AIM;
		const result = aimManifestSchema.safeParse(withoutEntries);
		expect(result.success).toBe(false);
	});

	it('rejects an AIM manifest entry with an unknown kind', () => {
		const broken = {
			...VALID_AIM,
			entries: [{ ...VALID_AIM.entries[0], kind: 'novel-leaf' }],
		};
		const result = aimManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an AIM manifest entry with malformed content_hash', () => {
		const broken = {
			...VALID_AIM,
			entries: [{ ...VALID_AIM.entries[0], content_hash: 'not-a-sha' }],
		};
		const result = aimManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an AIM manifest with too many subjects (>3)', () => {
		const result = aimManifestSchema.safeParse({
			...VALID_AIM,
			subjects: ['regulations', 'procedures', 'navigation', 'communications'],
		});
		expect(result.success).toBe(false);
	});

	it('accepts a valid AC manifest', () => {
		const result = manifestSchema.safeParse(VALID_AC);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('ac');
		}
	});

	it('rejects an AC manifest with a malformed revision (uppercase)', () => {
		const result = acManifestSchema.safeParse({ ...VALID_AC, revision: 'D' });
		expect(result.success).toBe(false);
	});

	it('rejects an AC manifest with a multi-letter revision', () => {
		const result = acManifestSchema.safeParse({ ...VALID_AC, revision: 'aa' });
		expect(result.success).toBe(false);
	});

	it("rejects an AC manifest missing 'body_path'", () => {
		const { body_path: _drop, ...withoutBody } = VALID_AC;
		const result = acManifestSchema.safeParse(withoutBody);
		expect(result.success).toBe(false);
	});

	it('accepts a valid CFR manifest', () => {
		const result = manifestSchema.safeParse(VALID_CFR);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('cfr');
		}
	});

	it("rejects a CFR manifest with a title other than '14' or '49'", () => {
		const result = cfrManifestSchema.safeParse({ ...VALID_CFR, title: '15' });
		expect(result.success).toBe(false);
	});

	it("rejects a CFR manifest missing 'partCount'", () => {
		const { partCount: _drop, ...withoutPartCount } = VALID_CFR;
		const result = cfrManifestSchema.safeParse(withoutPartCount);
		expect(result.success).toBe(false);
	});

	it('rejects a CFR manifest with a malformed editionDate', () => {
		const result = cfrManifestSchema.safeParse({ ...VALID_CFR, editionDate: '04/22/2026' });
		expect(result.success).toBe(false);
	});

	it('accepts a valid ACS manifest', () => {
		const result = manifestSchema.safeParse(VALID_ACS);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('acs');
		}
	});

	it("rejects an ACS manifest missing 'areas'", () => {
		const { areas: _drop, ...withoutAreas } = VALID_ACS;
		const result = acsManifestSchema.safeParse(withoutAreas);
		expect(result.success).toBe(false);
	});

	it('rejects an ACS manifest with a non-FAA publisher', () => {
		const result = acsManifestSchema.safeParse({ ...VALID_ACS, publisher: 'AOPA' });
		expect(result.success).toBe(false);
	});

	it('rejects an ACS task with a malformed body_sha256', () => {
		const broken = {
			...VALID_ACS,
			areas: [
				{
					...VALID_ACS.areas[0],
					tasks: [{ ...VALID_ACS.areas[0].tasks[0], body_sha256: 'not-a-hash' }],
				},
			],
		};
		const result = acsManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an ACS element with an unknown triad value', () => {
		const broken = {
			...VALID_ACS,
			areas: [
				{
					...VALID_ACS.areas[0],
					tasks: [
						{
							...VALID_ACS.areas[0].tasks[0],
							elements: [{ ...VALID_ACS.areas[0].tasks[0].elements[0], triad: 'x' }],
						},
					],
				},
			],
		};
		const result = acsManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an ACS area with a non-padded ordinal', () => {
		const broken = {
			...VALID_ACS,
			areas: [{ ...VALID_ACS.areas[0], area: '1' }],
		};
		const result = acsManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an ACS task with a multi-letter task identifier', () => {
		const broken = {
			...VALID_ACS,
			areas: [
				{
					...VALID_ACS.areas[0],
					tasks: [{ ...VALID_ACS.areas[0].tasks[0], task: 'aa' }],
				},
			],
		};
		const result = acsManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('accepts an ACS manifest with empty elements (CFI ACS shape)', () => {
		const result = acsManifestSchema.safeParse({
			...VALID_ACS,
			areas: [
				{
					...VALID_ACS.areas[0],
					tasks: [{ ...VALID_ACS.areas[0].tasks[0], elements: [] }],
				},
			],
		});
		expect(result.success).toBe(true);
	});
});

describe('cfrSectionsFileSchema', () => {
	it('accepts a valid sections.json shape', () => {
		const result = cfrSectionsFileSchema.safeParse(VALID_CFR_SECTIONS_FILE);
		expect(result.success).toBe(true);
	});

	it('rejects a sections file with malformed body_sha256', () => {
		const broken = {
			...VALID_CFR_SECTIONS_FILE,
			sectionsByPart: {
				'91': [{ ...VALID_CFR_SECTIONS_FILE.sectionsByPart['91'][0], body_sha256: 'short' }],
			},
		};
		const result = cfrSectionsFileSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects a sections file missing canonical_short on an entry', () => {
		const { canonical_short: _drop, ...partial } = VALID_CFR_SECTIONS_FILE.sectionsByPart['91'][0];
		const broken = {
			...VALID_CFR_SECTIONS_FILE,
			sectionsByPart: { '91': [partial] },
		};
		const result = cfrSectionsFileSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects a sections file with non-airboss-ref id prefix', () => {
		const broken = {
			...VALID_CFR_SECTIONS_FILE,
			sectionsByPart: {
				'91': [{ ...VALID_CFR_SECTIONS_FILE.sectionsByPart['91'][0], id: 'cfr/14/91/103' }],
			},
		};
		const result = cfrSectionsFileSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});
});

describe('selfDescribingPath enforcement (rename-generic-content-files)', () => {
	it("rejects a section-tree body_path ending in '/index.md'", () => {
		const broken = {
			...VALID_SECTION_TREE,
			sections: [{ ...VALID_SECTION_TREE.sections[0], body_path: 'handbooks/phak/FAA-H-8083-25C/01/index.md' }],
		};
		const result = sectionTreeManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it("rejects a whole-doc body_path ending in '/document.md'", () => {
		const broken = { ...VALID_WHOLE_DOC, body_path: 'handbooks/risk-management/FAA-H-8083-2A/document.md' };
		const result = wholeDocManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it("rejects an AIM entry body_path ending in '/index.md'", () => {
		const broken = {
			...VALID_AIM,
			entries: [{ ...VALID_AIM.entries[0], body_path: 'aim/2026-04/chapter-1/index.md' }],
		};
		const result = aimManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it("rejects an AC body_path ending in '/document.md'", () => {
		const broken = { ...VALID_AC, body_path: 'ac/61-98/d/document.md' };
		const result = acManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it("carves out paths under 'regulations/' (regs cleanup is a follow-up WP)", () => {
		// Regs writer still emits `<part>/index.md` for part overviews; the
		// CI assertion must not block this until the regs-derivative-cleanup
		// WP lands. The carve-out is filename-pattern-based; we exercise it
		// via the section-tree schema which has the strictest body_path.
		const allowed = {
			...VALID_SECTION_TREE,
			sections: [{ ...VALID_SECTION_TREE.sections[0], body_path: 'regulations/cfr-14/2026/91/index.md' }],
		};
		const result = sectionTreeManifestSchema.safeParse(allowed);
		expect(result.success).toBe(true);
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
				section_path: 'handbooks/phak/FAA-H-8083-25C/01-introduction-to-flying/04-aircraft-classifications.md',
				chapter: '01',
				target_page: '1-15',
				patch_kind: 'replace_paragraph',
				section_anchor: 'Aircraft Classifications and Ultralight Vehicles',
				new_heading: null,
				content_hash: 'c'.repeat(64),
				errata_note_path:
					'handbooks/phak/FAA-H-8083-25C/01-introduction-to-flying/04-aircraft-classifications.errata.md',
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
		{ slug: 'aviation-instructor', edition: 'FAA-H-8083-9', kind: 'handbook' },
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

describe('on-disk manifest fixture (AIM)', () => {
	it('parses cleanly: aim/2026-04', () => {
		const path = resolve(REPO_ROOT, 'aim', '2026-04', 'manifest.json');
		const raw = JSON.parse(readFileSync(path, 'utf-8'));
		const result = manifestSchema.safeParse(raw);
		const issuesSummary = result.success
			? null
			: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
		expect(issuesSummary, `Manifest aim/2026-04\n${issuesSummary ?? ''}`).toBeNull();
		if (result.success && result.data.kind === 'aim') {
			expect(result.data.entries.length).toBeGreaterThan(700);
		}
	});
});

describe('on-disk manifest fixtures (AC)', () => {
	const AC_FIXTURES = [
		{ docSlug: '00-6', revision: 'b' },
		{ docSlug: '25-7', revision: 'd' },
		{ docSlug: '61-65', revision: 'j' },
		{ docSlug: '61-83', revision: 'j' },
		{ docSlug: '61-98', revision: 'd' },
		{ docSlug: '90-66', revision: 'c' },
		{ docSlug: '91-21-1', revision: 'd' },
		{ docSlug: '91-79', revision: 'a' },
		{ docSlug: '120-71', revision: 'b' },
	] as const;

	for (const { docSlug, revision } of AC_FIXTURES) {
		it(`parses cleanly: ac/${docSlug}/${revision}`, () => {
			const path = resolve(REPO_ROOT, 'ac', docSlug, revision, 'manifest.json');
			const raw = JSON.parse(readFileSync(path, 'utf-8'));
			const result = manifestSchema.safeParse(raw);
			const issuesSummary = result.success
				? null
				: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
			expect(issuesSummary, `Manifest ac/${docSlug}/${revision}\n${issuesSummary ?? ''}`).toBeNull();
			if (result.success) {
				expect(result.data.kind).toBe('ac');
			}
		});
	}
});

describe('on-disk manifest fixtures (CFR)', () => {
	const CFR_FIXTURES = [
		{ title: '14', editionDate: '2026-04-22', expectedSections: 6328 },
		{ title: '49', editionDate: '2026-04-24', expectedSections: 22 },
	] as const;

	for (const { title, editionDate, expectedSections } of CFR_FIXTURES) {
		it(`parses cleanly: regulations/cfr-${title}/${editionDate}`, () => {
			const path = resolve(REPO_ROOT, 'regulations', `cfr-${title}`, editionDate, 'manifest.json');
			const raw = JSON.parse(readFileSync(path, 'utf-8'));
			const result = manifestSchema.safeParse(raw);
			const issuesSummary = result.success
				? null
				: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
			expect(issuesSummary, `Manifest regulations/cfr-${title}/${editionDate}\n${issuesSummary ?? ''}`).toBeNull();
			if (result.success && result.data.kind === 'cfr') {
				expect(result.data.title).toBe(title);
				expect(result.data.sectionCount).toBe(expectedSections);
			}
		});

		it(`parses cleanly: regulations/cfr-${title}/${editionDate}/sections.json`, () => {
			const path = resolve(REPO_ROOT, 'regulations', `cfr-${title}`, editionDate, 'sections.json');
			const raw = JSON.parse(readFileSync(path, 'utf-8'));
			const result = cfrSectionsFileSchema.safeParse(raw);
			const issuesSummary = result.success
				? null
				: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
			expect(issuesSummary, `sections.json regulations/cfr-${title}/${editionDate}\n${issuesSummary ?? ''}`).toBeNull();
		});
	}
});

describe('on-disk manifest fixtures (ACS)', () => {
	const ACS_FIXTURES = [
		{ slug: 'ppl-airplane-6c', expectedAreas: 12 },
		{ slug: 'ir-airplane-8c', expectedAreas: 8 },
		{ slug: 'cpl-airplane-7b', expectedAreas: 11 },
		{ slug: 'cfi-airplane-25', expectedAreas: 14 },
		{ slug: 'atp-airplane-11a', expectedAreas: 8 },
	] as const;

	for (const { slug, expectedAreas } of ACS_FIXTURES) {
		it(`parses cleanly: acs/${slug}`, () => {
			const path = resolve(REPO_ROOT, 'acs', slug, 'manifest.json');
			const raw = JSON.parse(readFileSync(path, 'utf-8'));
			const result = manifestSchema.safeParse(raw);
			const issuesSummary = result.success
				? null
				: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
			expect(issuesSummary, `Manifest acs/${slug}\n${issuesSummary ?? ''}`).toBeNull();
			if (result.success && result.data.kind === 'acs') {
				expect(result.data.slug).toBe(slug);
				expect(result.data.areas.length).toBe(expectedAreas);
			}
		});
	}
});
