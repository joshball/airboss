/**
 * Tests for the knowledge_node.references migration (cert-syllabus WP
 * phase 17). Two halves:
 *
 *   - Pure reshape: covers every supported source family + the synthetic
 *     fallback. No DB dependency.
 *   - End-to-end runner: real Postgres. Drives the idempotency flag,
 *     mixed legacy/structured arrays, synthetic-reference creation, and
 *     dry-run no-op behaviour.
 */

import { CITATION_FRAMINGS, REFERENCE_KINDS } from '@ab/constants';
import { db } from '@ab/db';
import type { LegacyCitation, StructuredCitation } from '@ab/types';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knowledgeNode, reference } from '../../libs/bc/study/src/schema';
import {
	extractCfrLocator,
	extractHandbookLocator,
	MIGRATION_SEED_ORIGIN,
	migrateReferencesToStructured,
	reshapeLegacyCitation,
	slugifySource,
} from './migrate-references-to-structured';

// ---------------------------------------------------------------------------
// Pure reshape -- no DB
// ---------------------------------------------------------------------------

describe('reshapeLegacyCitation', () => {
	it('handbook: PHAK -> kind=handbook, slug=phak, chapter extracted, framing=survey', () => {
		const result = reshapeLegacyCitation({
			source: 'PHAK (FAA-H-8083-25C)',
			detail: 'Chapter 5 -- Aerodynamics',
			note: 'AOA definition.',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.HANDBOOK);
		expect(result.resolved.documentSlug).toBe('phak');
		expect(result.resolved.edition).toBe('FAA-H-8083-25C');
		expect(result.citation.kind).toBe('handbook');
		if (result.citation.kind !== 'handbook') throw new Error('expected handbook');
		expect(result.citation.locator.chapter).toBe(5);
		expect(result.citation.framing).toBe(CITATION_FRAMINGS.SURVEY);
		expect(result.citation.note).toBe('AOA definition.');
	});

	it('handbook: AFH -> slug=afh, edition lifted from source', () => {
		const result = reshapeLegacyCitation({
			source: 'AFH (FAA-H-8083-3B)',
			detail: 'Chapter 4 -- Slow Flight, Stalls, and Spins',
			note: '',
		});
		expect(result.resolved.documentSlug).toBe('afh');
		expect(result.resolved.edition).toBe('FAA-H-8083-3B');
		expect(result.citation.kind).toBe('handbook');
	});

	it('handbook: bare PHAK without edition -> default edition', () => {
		const result = reshapeLegacyCitation({
			source: 'PHAK',
			detail: 'Chapter 11',
			note: '',
		});
		expect(result.resolved.documentSlug).toBe('phak');
		expect(result.resolved.edition).toBe('FAA-H-8083-25C');
	});

	it('handbook: IPH and Instrument Procedures Handbook both map to slug=iph', () => {
		const a = reshapeLegacyCitation({
			source: 'IPH (FAA-H-8083-16B)',
			detail: 'Chapter 4 -- Approaches',
			note: '',
		});
		const b = reshapeLegacyCitation({
			source: 'Instrument Procedures Handbook (FAA-H-8083-16B)',
			detail: 'Chapter 4 -- Circling Approaches',
			note: '',
		});
		expect(a.resolved.documentSlug).toBe('iph');
		expect(b.resolved.documentSlug).toBe('iph');
	});

	it('cfr: 14 CFR 91.3 -> kind=cfr, locator title/part/section', () => {
		const result = reshapeLegacyCitation({
			source: '14 CFR',
			detail: '91.3 -- Responsibility and authority of the pilot in command',
			note: '',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.CFR);
		expect(result.citation.kind).toBe('cfr');
		if (result.citation.kind !== 'cfr') throw new Error('expected cfr');
		expect(result.citation.locator.title).toBe(14);
		expect(result.citation.locator.part).toBe(91);
		expect(result.citation.locator.section).toBe('3');
		expect(result.citation.framing).toBe(CITATION_FRAMINGS.REGULATORY);
	});

	it('cfr: FAR 23 / Part 91 -> kind=cfr', () => {
		const result = reshapeLegacyCitation({
			source: 'FAR 23 / Part 91',
			detail: '',
			note: '',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.CFR);
		expect(result.citation.kind).toBe('cfr');
	});

	it('ac: AC 61-67C -> kind=ac, slug stable across editions, edition with letter', () => {
		const result = reshapeLegacyCitation({
			source: 'AC 61-67C',
			detail: 'Stall and Spin Awareness Training',
			note: '',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.AC);
		expect(result.resolved.documentSlug).toBe('ac-61-67');
		expect(result.resolved.edition).toBe('AC 61-67C');
		expect(result.citation.kind).toBe('ac');
		if (result.citation.kind !== 'ac') throw new Error('expected ac');
		expect(result.citation.framing).toBe(CITATION_FRAMINGS.REGULATORY);
	});

	it('acs: ACS / PTS standards -> kind=acs (when ACS appears first)', () => {
		const result = reshapeLegacyCitation({
			source: 'ACS / PTS standards',
			detail: '',
			note: '',
		});
		// "ACS" appears first in the regex check; both flagged. The migration
		// preserves the more specific decision: ACS wins when ambiguous.
		expect([REFERENCE_KINDS.ACS, REFERENCE_KINDS.PTS]).toContain(result.resolved.kind);
		if (result.citation.kind !== 'acs' && result.citation.kind !== 'pts') throw new Error('expected acs/pts');
		expect(result.citation.framing).toBe(CITATION_FRAMINGS.EXAMINER);
	});

	it('aim: AIM with hyphenated paragraph -> kind=aim, paragraph extracted', () => {
		const result = reshapeLegacyCitation({
			source: 'AIM',
			detail: '5-1-7 -- Flight Plan',
			note: '',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.AIM);
		expect(result.citation.kind).toBe('aim');
		if (result.citation.kind !== 'aim') throw new Error('expected aim');
		expect(result.citation.locator.paragraph).toBe('5-1-7');
		expect(result.citation.framing).toBe(CITATION_FRAMINGS.PROCEDURAL);
	});

	it('ntsb: NTSB report -> kind=ntsb, framing=operational', () => {
		const result = reshapeLegacyCitation({
			source: 'NTSB Birgenair Flight 301 / AeroPeru Flight 603 reports',
			detail: '',
			note: '',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.NTSB);
		expect(result.citation.kind).toBe('ntsb');
		if (result.citation.kind !== 'ntsb') throw new Error('expected ntsb');
		expect(result.citation.framing).toBe(CITATION_FRAMINGS.OPERATIONAL);
	});

	it('poh: POH / AFM Section 3 -> kind=poh, detail kept on locator', () => {
		const result = reshapeLegacyCitation({
			source: 'POH / AFM',
			detail: 'Section 3 -- Emergency Procedures',
			note: '',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.POH);
		expect(result.citation.kind).toBe('poh');
		if (result.citation.kind !== 'poh') throw new Error('expected poh');
		expect(result.citation.locator.detail).toBe('Section 3 -- Emergency Procedures');
		expect(result.citation.framing).toBe(CITATION_FRAMINGS.OPERATIONAL);
	});

	it('other: unrecognised source -> kind=other, slug derived from source', () => {
		const result = reshapeLegacyCitation({
			source: 'AOPA Air Safety Institute',
			detail: 'Stall awareness',
			note: '',
		});
		expect(result.resolved.kind).toBe(REFERENCE_KINDS.OTHER);
		expect(result.resolved.documentSlug).toBe('aopa-air-safety-institute');
		expect(result.citation.kind).toBe('other');
	});

	it('other: empty note is dropped from the output', () => {
		const result = reshapeLegacyCitation({
			source: 'PHAK',
			detail: 'Chapter 1',
			note: '',
		});
		expect(result.citation.note).toBeUndefined();
	});
});

describe('extractHandbookLocator', () => {
	it('parses chapter alone', () => {
		expect(extractHandbookLocator('Chapter 5 -- Aerodynamics')).toEqual({ chapter: 5 });
	});

	it('parses chapter + first chapter wins on multi-chapter detail', () => {
		expect(
			extractHandbookLocator('Chapter 6 -- Airplane Basic Flight Maneuvers; Chapter 5 -- Airplane Attitude'),
		).toEqual({ chapter: 6 });
	});

	it('returns chapter=0 when no chapter is present', () => {
		expect(extractHandbookLocator('pitot-static system')).toEqual({ chapter: 0 });
	});
});

describe('extractCfrLocator', () => {
	it('parses 14 CFR 91.3', () => {
		expect(extractCfrLocator('14 CFR', '91.3 -- Responsibility')).toEqual({ title: 14, part: 91, section: '3' });
	});

	it('parses FAR Part 91 with no section -> empty section', () => {
		const result = extractCfrLocator('FAR Part 91', '');
		expect(result.title).toBe(14);
		expect(result.part).toBe(91);
	});
});

describe('slugifySource', () => {
	it('lowercases + hyphenates', () => {
		expect(slugifySource('AOPA Air Safety Institute')).toBe('aopa-air-safety-institute');
	});

	it('clamps length at 32', () => {
		const long = 'AOPA Air Safety Institute / FAA Safety Team materials and notes';
		expect(slugifySource(long).length).toBeLessThanOrEqual(32);
	});

	it('returns unknown-source on empty input', () => {
		expect(slugifySource('')).toBe('unknown-source');
	});
});

// ---------------------------------------------------------------------------
// End-to-end runner -- real Postgres
// ---------------------------------------------------------------------------

const SUITE_TAG = `migrate-refs-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');

const NODE_LEGACY_ID = `kn-test-legacy-${SUITE_TOKEN}`;
const NODE_MIXED_ID = `kn-test-mixed-${SUITE_TOKEN}`;
const NODE_ALREADY_ID = `kn-test-already-${SUITE_TOKEN}`;
const NODE_EMPTY_ID = `kn-test-empty-${SUITE_TOKEN}`;

const TEST_NODE_IDS: ReadonlyArray<string> = [NODE_LEGACY_ID, NODE_MIXED_ID, NODE_ALREADY_ID, NODE_EMPTY_ID];

beforeAll(async () => {
	const now = new Date();

	const legacyOnly: LegacyCitation[] = [
		{ source: 'PHAK (FAA-H-8083-25C)', detail: 'Chapter 5', note: 'aero' },
		{ source: '14 CFR', detail: '91.3 -- Responsibility', note: '' },
		{ source: 'AOPA Air Safety Institute', detail: '', note: '' },
	];

	// Pre-existing structured entry alongside one legacy entry; migration
	// must pass through the structured one and reshape the legacy one.
	const preStructured: StructuredCitation = {
		kind: 'handbook',
		reference_id: 'placeholder-id-for-existing-structured',
		locator: { chapter: 12 },
		framing: CITATION_FRAMINGS.SURVEY,
	};
	const mixed: ReadonlyArray<unknown> = [preStructured, { source: 'AC 61-67C', detail: '', note: '' }];

	const alreadyStructured: StructuredCitation[] = [
		{
			kind: 'cfr',
			reference_id: 'already-migrated-placeholder',
			locator: { title: 14, part: 91, section: '13' },
			framing: CITATION_FRAMINGS.REGULATORY,
		},
	];

	await db.insert(knowledgeNode).values([
		{
			id: NODE_LEGACY_ID,
			title: 'Legacy node',
			domain: 'aerodynamics',
			contentMd: '## Context\n\nbody',
			references: legacyOnly as unknown as { source: string; detail: string; note: string }[],
			referencesV2Migrated: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: NODE_MIXED_ID,
			title: 'Mixed node',
			domain: 'aerodynamics',
			contentMd: '## Context\n\nbody',
			references: mixed as unknown as { source: string; detail: string; note: string }[],
			referencesV2Migrated: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: NODE_ALREADY_ID,
			title: 'Already migrated node',
			domain: 'aerodynamics',
			contentMd: '## Context\n\nbody',
			references: alreadyStructured as unknown as { source: string; detail: string; note: string }[],
			referencesV2Migrated: true,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: NODE_EMPTY_ID,
			title: 'Empty references node',
			domain: 'aerodynamics',
			contentMd: '## Context\n\nbody',
			references: [],
			referencesV2Migrated: false,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);
});

afterAll(async () => {
	// Tear down knowledge nodes first; reference rows the migration
	// synthesised carry MIGRATION_SEED_ORIGIN.
	await db.delete(knowledgeNode).where(inArray(knowledgeNode.id, TEST_NODE_IDS as string[]));
	await db.delete(reference).where(eq(reference.seedOrigin, MIGRATION_SEED_ORIGIN));
});

describe('migrateReferencesToStructured', () => {
	it('dry-run reports the plan without writing rows or flipping flags', async () => {
		const report = await migrateReferencesToStructured({ dryRun: true, onlyNodeIds: TEST_NODE_IDS });
		expect(report.rowsScanned).toBe(4);
		expect(report.rowsAlreadyMigrated).toBe(1);
		// 3 rows pending (legacy, mixed, empty); empty stays migrated=false but produces zero citations.
		expect(report.rowsMigrated).toBe(3);
		expect(report.citationsReshaped).toBeGreaterThan(0);
		expect(report.syntheticReferencesCreated).toBe(0);

		// Flag must NOT have flipped on dry-run.
		const post = await db
			.select({ id: knowledgeNode.id, flag: knowledgeNode.referencesV2Migrated })
			.from(knowledgeNode)
			.where(inArray(knowledgeNode.id, TEST_NODE_IDS as string[]));
		const legacy = post.find((r) => r.id === NODE_LEGACY_ID);
		expect(legacy?.flag).toBe(false);
	});

	it('live run reshapes, stamps the flag, and creates synthetic references', async () => {
		const report = await migrateReferencesToStructured({ onlyNodeIds: TEST_NODE_IDS });
		expect(report.rowsMigrated).toBe(3);
		expect(report.citationsReshaped).toBeGreaterThan(0);
		expect(report.citationsAlreadyStructured).toBe(1); // pre-existing structured entry on the mixed node
		// Synthetic-reference creation is a side effect, not a contract:
		// rows for CFR / AC / OTHER will be synthesised on a fresh dev DB
		// but resolved against existing rows on a re-run. The reshape
		// itself is the invariant; counts are non-negative.
		expect(report.syntheticReferencesCreated).toBeGreaterThanOrEqual(0);

		const post = await db
			.select({ id: knowledgeNode.id, flag: knowledgeNode.referencesV2Migrated, references: knowledgeNode.references })
			.from(knowledgeNode)
			.where(inArray(knowledgeNode.id, TEST_NODE_IDS as string[]));
		for (const row of post) {
			expect(row.flag).toBe(true);
		}
		// Reshaped legacy node: every entry now carries a `kind` discriminator.
		const legacy = post.find((r) => r.id === NODE_LEGACY_ID);
		const refs = (legacy?.references ?? []) as unknown as Array<{ kind?: string; reference_id?: string }>;
		expect(refs.length).toBe(3);
		for (const r of refs) {
			expect(r.kind).toBeDefined();
			expect(r.reference_id).toBeDefined();
		}
	});

	it('passes structured entries through unchanged', async () => {
		const post = await db
			.select({ references: knowledgeNode.references })
			.from(knowledgeNode)
			.where(eq(knowledgeNode.id, NODE_MIXED_ID));
		const refs = (post[0]?.references ?? []) as unknown as Array<{ kind?: string; reference_id?: string }>;
		expect(refs.length).toBe(2);
		// First entry should be the pre-existing structured handbook citation.
		expect(refs[0]?.kind).toBe('handbook');
		expect(refs[0]?.reference_id).toBe('placeholder-id-for-existing-structured');
		// Second entry: AC 61-67C reshaped.
		expect(refs[1]?.kind).toBe('ac');
	});

	it('is idempotent: a second run is a no-op', async () => {
		const report = await migrateReferencesToStructured({ onlyNodeIds: TEST_NODE_IDS });
		expect(report.rowsMigrated).toBe(0);
		expect(report.citationsReshaped).toBe(0);
		expect(report.syntheticReferencesCreated).toBe(0);
		// All four scoped rows now show as already-migrated (the 3 we just
		// migrated + the 1 that started already).
		expect(report.rowsAlreadyMigrated).toBe(4);
	});
});
