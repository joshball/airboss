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
	HANDBOOK_MANIFEST_WARNING_CODES,
	HANDBOOK_WARNING_TRIAGE_STATUS_VALUES,
	handbookHeartbeatInputSchema,
	handbookManifestErrataEntrySchema,
	handbookManifestWarningSchema,
	handbookWarningsFileSchema,
	handbookWarningsTriageFileSchema,
	infoManifestSchema,
	manifestSchema,
	ntsbAljManifestSchema,
	safoManifestSchema,
	sectionTreeManifestSchema,
	WP_FIXABLE_WARNING_CODES,
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
	document_slug: 'aviation-instructor',
	edition: '8083-9',
	title: "Aviation Instructor's Handbook",
	publisher: 'FAA',
	source_url: 'https://www.faa.gov/aih.pdf',
	fetched_at: '2026-04-26T00:00:00.000+00:00',
	body_path: 'handbooks/aviation-instructor/FAA-H-8083-9/aviation-instructor-FAA-H-8083-9.md',
	body_sha256: 'b'.repeat(64),
	page_count: 228,
	doc_id: 'faa-h-8083-9',
	faa_edition: '9',
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

const VALID_NTSB_ALJ = {
	kind: 'ntsb-alj',
	schema_version: 1,
	corpus: 'ntsb-alj',
	case_number: 'ea-5567',
	edition: '2011',
	title: 'NTSB Order EA-5567 (Administrative Law Judge ruling)',
	publisher: 'NTSB',
	publication_date: '2011-06-15',
	source_url: 'https://www.ntsb.gov/legal/alj/Pages/default.aspx',
	source_sha256: 'a'.repeat(64),
	fetched_at: '2026-05-03T00:00:00.000+00:00',
	page_count: 18,
	body_path: 'ntsb-alj/ea-5567/2011/ntsb-alj-ea-5567.md',
	body_sha256: 'b'.repeat(64),
	sections: [],
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

	it('accepts an AC manifest with structured sections[] (WP-AC-PROMOTE)', () => {
		const sectionTreeAc = {
			...VALID_AC,
			sections: [
				{
					level: 'chapter',
					code: '1',
					ordinal: 1,
					parent_code: null,
					title: 'GENERAL',
					faa_page_start: null,
					faa_page_end: null,
					source_locator: 'AC 61-98D Ch 1',
					body_path: 'ac/61-98/d/01-general/00-01-general.md',
					content_hash: 'c'.repeat(64),
				},
				{
					level: 'section',
					code: '1.1',
					ordinal: 1,
					parent_code: '1',
					title: 'Purpose of This Advisory Circular (AC)',
					faa_page_start: null,
					faa_page_end: null,
					source_locator: 'AC 61-98D Ch 1 §1.1',
					body_path: 'ac/61-98/d/01-general/01-purpose-of-this-advisory-circular-ac.md',
					content_hash: 'd'.repeat(64),
				},
			],
		};
		const result = acManifestSchema.safeParse(sectionTreeAc);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.sections).toHaveLength(2);
			expect(result.data.sections[0]?.code).toBe('1');
			expect(result.data.sections[1]?.parent_code).toBe('1');
		}
	});

	it('accepts AC appendix container codes (`appendix-a`, `appendix-1`)', () => {
		const sectionTreeAc = {
			...VALID_AC,
			sections: [
				{
					level: 'chapter',
					code: 'appendix-a',
					ordinal: 1,
					parent_code: null,
					title: 'SAMPLE ENDORSEMENTS',
					faa_page_start: null,
					faa_page_end: null,
					source_locator: 'AC 61-98D Appendix A',
					body_path: 'ac/61-98/d/appendix-a-sample-endorsements/00-appendix-a-sample-endorsements.md',
					content_hash: 'e'.repeat(64),
				},
			],
		};
		const result = acManifestSchema.safeParse(sectionTreeAc);
		expect(result.success).toBe(true);
	});

	it('rejects an AC manifest with a malformed section code', () => {
		const sectionTreeAc = {
			...VALID_AC,
			sections: [
				{
					level: 'chapter',
					code: 'NOT-A-VALID-CODE',
					ordinal: 1,
					parent_code: null,
					title: 'Bad code',
					faa_page_start: null,
					faa_page_end: null,
					source_locator: 'AC ?',
					body_path: 'ac/61-98/d/foo/00-foo.md',
					content_hash: 'f'.repeat(64),
				},
			],
		};
		const result = acManifestSchema.safeParse(sectionTreeAc);
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

	it('accepts a valid NTSB-ALJ manifest (whole-doc mode)', () => {
		const result = manifestSchema.safeParse(VALID_NTSB_ALJ);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('ntsb-alj');
		}
	});

	it('accepts an NTSB-ALJ manifest with section-tree opinion sections', () => {
		const sectionTreeAlj = {
			...VALID_NTSB_ALJ,
			sections: [
				{
					level: 'section',
					code: 'findings-of-fact',
					ordinal: 0,
					title: 'Findings of Fact',
					body_path: 'ntsb-alj/ea-5567/2011/findings-of-fact.md',
					content_hash: 'c'.repeat(64),
				},
				{
					level: 'section',
					code: 'conclusions-of-law',
					ordinal: 1,
					title: 'Conclusions of Law',
					body_path: 'ntsb-alj/ea-5567/2011/conclusions-of-law.md',
					content_hash: 'd'.repeat(64),
				},
				{
					level: 'section',
					code: 'order',
					ordinal: 2,
					title: 'Order',
					body_path: 'ntsb-alj/ea-5567/2011/order.md',
					content_hash: 'e'.repeat(64),
				},
			],
		};
		const result = ntsbAljManifestSchema.safeParse(sectionTreeAlj);
		expect(result.success).toBe(true);
	});

	it('rejects an NTSB-ALJ manifest with an unknown opinion-section code', () => {
		const broken = {
			...VALID_NTSB_ALJ,
			sections: [
				{
					level: 'section',
					code: 'preamble',
					ordinal: 0,
					title: 'Preamble',
					body_path: 'ntsb-alj/ea-5567/2011/preamble.md',
					content_hash: 'c'.repeat(64),
				},
			],
		};
		const result = ntsbAljManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an NTSB-ALJ manifest with an unknown case-number prefix', () => {
		const result = ntsbAljManifestSchema.safeParse({ ...VALID_NTSB_ALJ, case_number: 'xy-1234' });
		expect(result.success).toBe(false);
	});

	it('rejects an NTSB-ALJ manifest with an uppercase case-number prefix', () => {
		const result = ntsbAljManifestSchema.safeParse({ ...VALID_NTSB_ALJ, case_number: 'EA-5567' });
		expect(result.success).toBe(false);
	});

	it("rejects an NTSB-ALJ manifest missing 'body_path'", () => {
		const { body_path: _drop, ...withoutBody } = VALID_NTSB_ALJ;
		const result = ntsbAljManifestSchema.safeParse(withoutBody);
		expect(result.success).toBe(false);
	});

	it('rejects an NTSB-ALJ manifest with malformed body_sha256', () => {
		const result = ntsbAljManifestSchema.safeParse({ ...VALID_NTSB_ALJ, body_sha256: 'not-a-hex' });
		expect(result.success).toBe(false);
	});

	it('rejects an NTSB-ALJ manifest with the wrong corpus literal', () => {
		const result = ntsbAljManifestSchema.safeParse({ ...VALID_NTSB_ALJ, corpus: 'ntsb' });
		expect(result.success).toBe(false);
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
		const broken = { ...VALID_WHOLE_DOC, body_path: 'handbooks/aviation-instructor/FAA-H-8083-9/document.md' };
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
		{ slug: 'iph', edition: 'FAA-H-8083-16B', kind: 'handbook' },
		{ slug: 'ifh', edition: 'FAA-H-8083-15B', kind: 'handbook' },
		{ slug: 'risk-management', edition: 'FAA-H-8083-2A', kind: 'handbook' },
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

const VALID_SAFO = {
	kind: 'safo',
	corpus: 'safo',
	bulletin_id: '23001',
	title: 'Potential Damage to Nose Landing Gear by Improper Towing Procedures',
	publisher: 'FAA',
	publication_date: '2023-01-03',
	audience: null,
	source_url: 'https://www.faa.gov/sites/faa.gov/files/SAFO23001.pdf',
	source_sha256: 'a'.repeat(64),
	fetched_at: '2026-05-03T00:00:00.000+00:00',
	page_count: 2,
	body_path: 'safo/23001/safo-23001.md',
	body_sha256: 'b'.repeat(64),
	sections: [
		{
			code: 'subject',
			ordinal: 0,
			title: 'Subject',
			source_locator: 'SAFO 23001 -- Subject',
			body_path: 'safo/23001/sections/00-subject.md',
			content_hash: 'c'.repeat(64),
		},
	],
} as const;

const VALID_INFO = {
	kind: 'info',
	corpus: 'info',
	bulletin_id: '23006',
	title: 'Special Airworthiness Information Bulletins',
	publisher: 'FAA',
	publication_date: '2023-05-02',
	audience: null,
	source_url: 'https://www.faa.gov/sites/faa.gov/files/InFO23006.pdf',
	source_sha256: 'a'.repeat(64),
	fetched_at: '2026-05-03T00:00:00.000+00:00',
	page_count: 1,
	body_path: 'info/23006/info-23006.md',
	body_sha256: 'b'.repeat(64),
	sections: [],
} as const;

describe('manifestSchema (SAFO + InFO bulletin shapes)', () => {
	it('accepts a valid SAFO manifest', () => {
		const result = manifestSchema.safeParse(VALID_SAFO);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('safo');
		}
	});

	it('accepts a valid InFO manifest', () => {
		const result = manifestSchema.safeParse(VALID_INFO);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.kind).toBe('info');
		}
	});

	it('accepts a SAFO manifest with empty sections (whole-bulletin mode)', () => {
		const result = safoManifestSchema.safeParse({ ...VALID_SAFO, sections: [] });
		expect(result.success).toBe(true);
	});

	it('rejects a SAFO manifest with a malformed bulletin id (non-5-digit)', () => {
		const result = safoManifestSchema.safeParse({ ...VALID_SAFO, bulletin_id: '2300' });
		expect(result.success).toBe(false);
	});

	it('rejects a SAFO manifest with a malformed bulletin id (alphabetic)', () => {
		const result = safoManifestSchema.safeParse({ ...VALID_SAFO, bulletin_id: 'abcde' });
		expect(result.success).toBe(false);
	});

	it('rejects a SAFO manifest with malformed body_sha256', () => {
		const result = safoManifestSchema.safeParse({ ...VALID_SAFO, body_sha256: 'not-hex' });
		expect(result.success).toBe(false);
	});

	it('rejects a SAFO manifest where corpus does not match kind', () => {
		const result = safoManifestSchema.safeParse({ ...VALID_SAFO, corpus: 'info' });
		expect(result.success).toBe(false);
	});

	it('rejects a SAFO manifest with a section code containing uppercase', () => {
		const broken = {
			...VALID_SAFO,
			sections: [{ ...VALID_SAFO.sections[0], code: 'Subject' }],
		};
		const result = safoManifestSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects an InFO manifest where bulletin_id is missing', () => {
		const { bulletin_id: _drop, ...rest } = VALID_INFO;
		const result = infoManifestSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('rejects an InFO manifest where kind is "safo"', () => {
		const result = infoManifestSchema.safeParse({ ...VALID_INFO, kind: 'safo' });
		expect(result.success).toBe(false);
	});
});

describe('on-disk manifest fixtures (SAFO)', () => {
	const SAFO_FIXTURES = ['23001', '23002', '23003', '23004', '24002', '25001'] as const;
	for (const id of SAFO_FIXTURES) {
		it(`parses cleanly: safo/${id}`, () => {
			const path = resolve(REPO_ROOT, 'safo', id, 'manifest.json');
			const raw = JSON.parse(readFileSync(path, 'utf-8'));
			const result = manifestSchema.safeParse(raw);
			const issuesSummary = result.success
				? null
				: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
			expect(issuesSummary, `Manifest safo/${id}\n${issuesSummary ?? ''}`).toBeNull();
			if (result.success && result.data.kind === 'safo') {
				expect(result.data.bulletin_id).toBe(id);
				expect(result.data.sections.length).toBeGreaterThan(0);
			}
		});
	}
});

describe('on-disk manifest fixtures (InFO)', () => {
	const INFO_FIXTURES = ['23001', '23006', '24001', '25001'] as const;
	for (const id of INFO_FIXTURES) {
		it(`parses cleanly: info/${id}`, () => {
			const path = resolve(REPO_ROOT, 'info', id, 'manifest.json');
			const raw = JSON.parse(readFileSync(path, 'utf-8'));
			const result = manifestSchema.safeParse(raw);
			const issuesSummary = result.success
				? null
				: result.error.issues.map((i) => `${i.path.join('.')}: ${i.code}: ${i.message}`).join('\n');
			expect(issuesSummary, `Manifest info/${id}\n${issuesSummary ?? ''}`).toBeNull();
			if (result.success && result.data.kind === 'info') {
				expect(result.data.bulletin_id).toBe(id);
				expect(result.data.sections.length).toBeGreaterThan(0);
			}
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

describe('handbookHeartbeatInputSchema (POST /heartbeat wire shape)', () => {
	// Pins the numeric-only contract for the heartbeat POST body. The route
	// reads `delta` directly off `parsed.data` and forwards it to
	// `recordHeartbeat(userId, sectionId, delta)`, which uses it as a
	// numeric integer second-count. A string-typed value would either coerce
	// inside the BC (silent) or land in DB columns typed as integer
	// (loud) -- pinning the schema rejection is the cheaper guard.
	//
	// Closes the chunk-1 study-app correctness "rating numeric key on the
	// heartbeat payload" item from the 2026-05-01 review cluster.

	it('accepts a positive integer delta', () => {
		const result = handbookHeartbeatInputSchema.safeParse({ delta: 30 });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.delta).toBe(30);
	});

	it('rejects a string-typed delta (no Zod coerce)', () => {
		// Zod's `z.number()` does NOT accept '30'. A future regression that
		// flipped this to `z.coerce.number()` would silently parse strings;
		// pin the strict-type contract here.
		const result = handbookHeartbeatInputSchema.safeParse({ delta: '30' });
		expect(result.success).toBe(false);
		if (!result.success) {
			const issue = result.error.issues[0];
			expect(issue?.path).toEqual(['delta']);
			expect(issue?.code).toBe('invalid_type');
		}
	});

	it('rejects a non-integer delta', () => {
		const result = handbookHeartbeatInputSchema.safeParse({ delta: 1.5 });
		expect(result.success).toBe(false);
	});

	it('rejects a zero or negative delta', () => {
		expect(handbookHeartbeatInputSchema.safeParse({ delta: 0 }).success).toBe(false);
		expect(handbookHeartbeatInputSchema.safeParse({ delta: -1 }).success).toBe(false);
	});

	it('rejects a missing delta field', () => {
		const result = handbookHeartbeatInputSchema.safeParse({});
		expect(result.success).toBe(false);
	});

	it('rejects a boolean / null / undefined delta', () => {
		expect(handbookHeartbeatInputSchema.safeParse({ delta: true }).success).toBe(false);
		expect(handbookHeartbeatInputSchema.safeParse({ delta: null }).success).toBe(false);
		expect(handbookHeartbeatInputSchema.safeParse({ delta: undefined }).success).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Warning taxonomy + warnings.json sibling file
// (WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1A)
// ---------------------------------------------------------------------------

describe('handbookManifestWarningSchema (Sub-phase 1A taxonomy extensions)', () => {
	const VALID_WARNING_ID = 'a'.repeat(16);

	it.each(HANDBOOK_MANIFEST_WARNING_CODES)('accepts code %s', (code) => {
		const result = handbookManifestWarningSchema.safeParse({
			code,
			section_code: '1',
			message: `synthetic ${code} warning for code-coverage test`,
		});
		expect(result.success).toBe(true);
	});

	it('accepts a manifest warning with an optional id', () => {
		const result = handbookManifestWarningSchema.safeParse({
			id: VALID_WARNING_ID,
			code: 'caption-without-figure',
			section_code: '12',
			message: 'Caption `Figure 12-1.` on page 12-7 had no paired image.',
		});
		expect(result.success).toBe(true);
	});

	it('accepts a manifest warning without an id (pre-WP back-compat)', () => {
		const result = handbookManifestWarningSchema.safeParse({
			code: 'figure-without-caption',
			section_code: '12',
			message: 'Image on page 12-3 (index 0) had no paired caption.',
		});
		expect(result.success).toBe(true);
	});

	it('rejects an unknown warning code', () => {
		const result = handbookManifestWarningSchema.safeParse({
			code: 'never-emitted-by-any-pipeline',
			section_code: '1',
			message: 'should fail',
		});
		expect(result.success).toBe(false);
	});

	it('rejects an id that is not 16 hex chars', () => {
		const cases = ['ABCDEFabcdef0123', 'g'.repeat(16), 'a'.repeat(15), 'a'.repeat(17), ''];
		for (const id of cases) {
			const result = handbookManifestWarningSchema.safeParse({
				id,
				code: 'caption-without-figure',
				section_code: '1',
				message: 'msg',
			});
			expect(result.success).toBe(false);
		}
	});

	it('accepts a warning with null section_code (cross-section / pipeline-level)', () => {
		const result = handbookManifestWarningSchema.safeParse({
			code: 'front-matter-page-range-not-declared',
			section_code: null,
			message: 'phak.yaml is missing front_matter_page_range; defaulting to first-chapter detection.',
		});
		expect(result.success).toBe(true);
	});

	it('exposes the new v2 codes in the closed vocabulary', () => {
		const codes = new Set<string>(HANDBOOK_MANIFEST_WARNING_CODES);
		expect(codes.has('table-cell-merge-ambiguity')).toBe(true);
		expect(codes.has('tablish-block-not-converted')).toBe(true);
		expect(codes.has('ocr-leak-in-section-body')).toBe(true);
		expect(codes.has('empty-section-kept')).toBe(true);
		expect(codes.has('empty-section-merged')).toBe(true);
		expect(codes.has('front-matter-page-range-not-declared')).toBe(true);
	});

	it('keeps toc-verify in the vocabulary (decision 6: surfaced for separate triage)', () => {
		const codes = new Set<string>(HANDBOOK_MANIFEST_WARNING_CODES);
		expect(codes.has('toc-verify')).toBe(true);
		// And it is NOT classed as fixable -- it is parser instrumentation, not
		// extraction quality, per the WP scoping decision.
		expect(WP_FIXABLE_WARNING_CODES.has('toc-verify' as never)).toBe(false);
	});

	it('classifies fixable codes per the WP success criterion', () => {
		// All fixable codes must be in the closed vocabulary.
		for (const code of WP_FIXABLE_WARNING_CODES) {
			expect(HANDBOOK_MANIFEST_WARNING_CODES).toContain(code);
		}
		// And the parser-instrumentation codes are NOT in the fixable set.
		for (const code of ['toc', 'toc-verify', 'llm', 'page-label', 'section-strategy'] as const) {
			expect(WP_FIXABLE_WARNING_CODES.has(code as never)).toBe(false);
		}
	});
});

describe('handbookWarningsFileSchema (sibling warnings.json)', () => {
	const VALID_WARNINGS_FILE = {
		schema_version: 1,
		document_slug: 'phak',
		edition: 'FAA-H-8083-25C',
		manifest_sha256: 'a'.repeat(64),
		generated_at: '2026-05-04T00:00:00.000+00:00',
		warnings: [
			{
				id: 'b'.repeat(16),
				code: 'caption-without-figure',
				section_code: '12',
				message: 'Caption `Figure 12-1.` on page 12-7 had no paired image.',
			},
			{
				id: 'c'.repeat(16),
				code: 'front-matter-page-range-not-declared',
				section_code: null,
				message: 'phak.yaml is missing front_matter_page_range.',
			},
		],
	} as const;

	it('accepts a valid warnings.json shape', () => {
		const result = handbookWarningsFileSchema.safeParse(VALID_WARNINGS_FILE);
		expect(result.success).toBe(true);
	});

	it('accepts a warnings.json with an empty warnings array', () => {
		const result = handbookWarningsFileSchema.safeParse({ ...VALID_WARNINGS_FILE, warnings: [] });
		expect(result.success).toBe(true);
	});

	it('defaults warnings[] to [] when the field is omitted', () => {
		const { warnings: _drop, ...withoutWarnings } = VALID_WARNINGS_FILE;
		const result = handbookWarningsFileSchema.safeParse(withoutWarnings);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.warnings).toEqual([]);
		}
	});

	it('rejects a warnings.json missing the schema_version', () => {
		const { schema_version: _drop, ...rest } = VALID_WARNINGS_FILE;
		const result = handbookWarningsFileSchema.safeParse(rest);
		expect(result.success).toBe(false);
	});

	it('rejects a warnings.json with an entry missing id', () => {
		const broken = {
			...VALID_WARNINGS_FILE,
			warnings: [
				{
					code: 'caption-without-figure' as const,
					section_code: '1',
					message: 'no id',
				},
			],
		};
		const result = handbookWarningsFileSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects a warnings.json with malformed manifest_sha256', () => {
		const result = handbookWarningsFileSchema.safeParse({
			...VALID_WARNINGS_FILE,
			manifest_sha256: 'not-a-sha',
		});
		expect(result.success).toBe(false);
	});

	it('rejects a warnings.json with an unknown warning code', () => {
		const broken = {
			...VALID_WARNINGS_FILE,
			warnings: [
				{
					id: 'd'.repeat(16),
					code: 'made-up-code',
					section_code: '1',
					message: 'msg',
				},
			],
		};
		const result = handbookWarningsFileSchema.safeParse(broken);
		expect(result.success).toBe(false);
	});

	it('rejects a non-1 schema_version (forward-compat is by minting new schemas)', () => {
		const result = handbookWarningsFileSchema.safeParse({ ...VALID_WARNINGS_FILE, schema_version: 2 });
		expect(result.success).toBe(false);
	});
});

describe('handbookWarningsTriageFileSchema (validation/<corpus>/<doc>/<edition>/warnings-triage.json)', () => {
	const ISO = '2026-05-04T00:00:00.000+00:00';
	const REFERENCE_ID = 'ref_01ARZ3NDEKTSV4RRFFQ69G5FAV';
	const VALID_TRIAGE_FILE = {
		schema_version: 1 as const,
		reference_id: REFERENCE_ID,
		manifest_sha256: 'a'.repeat(64),
		triaged_at: ISO,
		triage: {
			['b'.repeat(16)]: { status: 'wontfix', note: 'expected; FAA caption art', decided_at: ISO, decided_by: 'jb' },
			['c'.repeat(16)]: { status: 'fixed', decided_at: ISO },
		},
	};

	it('accepts a valid triage file', () => {
		const result = handbookWarningsTriageFileSchema.safeParse(VALID_TRIAGE_FILE);
		expect(result.success).toBe(true);
	});

	it('defaults triage to {} when omitted', () => {
		const { triage: _drop, ...rest } = VALID_TRIAGE_FILE;
		const result = handbookWarningsTriageFileSchema.safeParse(rest);
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.triage).toEqual({});
	});

	it('accepts every triage status value', () => {
		for (const status of HANDBOOK_WARNING_TRIAGE_STATUS_VALUES) {
			const result = handbookWarningsTriageFileSchema.safeParse({
				...VALID_TRIAGE_FILE,
				triage: { ['d'.repeat(16)]: { status, decided_at: ISO } },
			});
			expect(result.success).toBe(true);
		}
	});

	it('rejects an unknown triage status', () => {
		const result = handbookWarningsTriageFileSchema.safeParse({
			...VALID_TRIAGE_FILE,
			triage: { ['e'.repeat(16)]: { status: 'snoozed', decided_at: ISO } },
		});
		expect(result.success).toBe(false);
	});

	it('rejects a triage entry keyed by a non-16-hex id', () => {
		const result = handbookWarningsTriageFileSchema.safeParse({
			...VALID_TRIAGE_FILE,
			triage: { 'not-a-hash': { status: 'open', decided_at: ISO } },
		});
		expect(result.success).toBe(false);
	});

	it('rejects malformed manifest_sha256', () => {
		const result = handbookWarningsTriageFileSchema.safeParse({
			...VALID_TRIAGE_FILE,
			manifest_sha256: 'not-a-sha',
		});
		expect(result.success).toBe(false);
	});

	it('rejects schema_version other than 1', () => {
		const result = handbookWarningsTriageFileSchema.safeParse({ ...VALID_TRIAGE_FILE, schema_version: 2 });
		expect(result.success).toBe(false);
	});

	it('rejects an empty reference_id', () => {
		const result = handbookWarningsTriageFileSchema.safeParse({ ...VALID_TRIAGE_FILE, reference_id: '' });
		expect(result.success).toBe(false);
	});
});
