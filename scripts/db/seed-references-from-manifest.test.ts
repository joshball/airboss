/**
 * Seed-handbooks idempotency + supersede-chain tests.
 *
 * Builds a synthetic `handbooks/test-handbook-<token>/<edition>/` tree under
 * a tmpdir, invokes `seedReferencesFromManifest` against it, and asserts:
 *
 *   - fresh insert: rows land with correct counts.
 *   - idempotent re-run: 0 changes when the markdown / manifest is identical.
 *   - supersede: a second edition publishes the older edition to
 *     `sources_registry.editions` with `retired_at IS NOT NULL` and the newer
 *     with `retired_at IS NULL` (per ADR 026; the `supersededById` column is
 *     gone).
 *   - figure replacement: bumping content_hash mass-replaces figures.
 *
 * Each spec uses a unique document_slug so parallel suites don't collide on
 * the (document_slug, edition) unique index.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { __ac_seed_mapping_internal__ } from '@ab/sources/ac';
import { __acs_seed_mapping_internal__ } from '@ab/sources/acs';
import { sourceIdForReference } from '@ab/sources';
import { editions as editionsTable } from '@ab/sources/server';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { reference, referenceFigure, referenceSection } from '../../libs/bc/study/src/schema';
import { pickEditions, seedReferencesFromManifest } from './seed-references-from-manifest';

function sha256Hex(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const HANDBOOKS_DIR = join(REPO_ROOT, 'handbooks');
const AIM_DIR = join(REPO_ROOT, 'aim');
const AC_DIR = join(REPO_ROOT, 'ac');
const REGS_DIR = join(REPO_ROOT, 'regulations');
const ACS_DIR = join(REPO_ROOT, 'acs');

interface Fixture {
	slug: string;
	edition: string;
	manifestPath: string;
	bodyPath: string;
}

function buildFixture(slugSuffix: string, edition: string, contentHash: string): Fixture {
	const slug = `test-${SUITE_TOKEN}-${slugSuffix}`;
	const editionDir = join(HANDBOOKS_DIR, slug, edition);
	mkdirSync(editionDir, { recursive: true });
	const bodyPath = join(editionDir, 'sample.md');
	writeFileSync(bodyPath, `---\nhandbook: ${slug}\nedition: ${edition}\n---\n\n# Sample\n\nBody.\n`);
	const manifestPath = join(editionDir, 'manifest.json');
	const manifest = {
		document_slug: slug,
		edition,
		kind: 'handbook',
		title: `Test Handbook (${slugSuffix})`,
		publisher: 'FAA',
		source_url: 'https://example.com/test.pdf',
		fetched_at: '2026-04-26T00:00:00.000+00:00',
		subjects: ['training-ops'],
		sections: [
			{
				level: 'chapter',
				code: '1',
				ordinal: 1,
				parent_code: null,
				title: 'Sample Chapter',
				faa_page_start: '1-1',
				faa_page_end: '1-5',
				source_locator: 'TEST Ch 1',
				body_path: `handbooks/${slug}/${edition}/sample.md`,
				content_hash: contentHash,
				has_figures: true,
				has_tables: false,
			},
		],
		figures: [
			{
				id: 'fig-1-00',
				section_code: '1',
				ordinal: 0,
				caption: 'Figure 1-1. Sample figure.',
				asset_path: `handbooks/${slug}/${edition}/figures/fig-1-00.png`,
				width: 100,
				height: 100,
			},
		],
		warnings: [],
	};
	writeFileSync(manifestPath, JSON.stringify(manifest));
	return { slug, edition, manifestPath, bodyPath };
}

interface TrackedFixture {
	slug: string;
	corpusDir: string;
}

const fixtures: TrackedFixture[] = [];

function trackFixture(slug: string, corpusDir: string = HANDBOOKS_DIR): void {
	fixtures.push({ slug, corpusDir });
}

afterAll(async () => {
	// Wipe DB rows for every fixture slug.
	for (const { slug } of fixtures) {
		await db.delete(reference).where(eq(reference.documentSlug, slug));
	}
	// Wipe disk fixtures.
	for (const { slug, corpusDir } of fixtures) {
		const dir = join(corpusDir, slug);
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	}
});

// 64-char hex strings (Zod schema requires SHA-256 hex format).
const HASH_AAA = 'a'.repeat(64);
const HASH_BBB = 'b'.repeat(64);
const HASH_BBB_CHANGED = 'c'.repeat(64);

describe('seedReferencesFromManifest', () => {
	it('fresh insert + idempotent re-run', async () => {
		const fx = buildFixture('idempotent', '2026-01', HASH_AAA);
		trackFixture(fx.slug);

		const first = await seedReferencesFromManifest({ documentSlug: fx.slug });
		expect(first.editionsProcessed).toBe(1);
		expect(first.sectionsTouched).toBe(1);
		expect(first.sectionsChanged).toBe(1);
		expect(first.figuresWritten).toBe(1);

		const refRows = await db.select().from(reference).where(eq(reference.documentSlug, fx.slug));
		expect(refRows).toHaveLength(1);
		const ref = refRows[0];
		expect(ref).toBeDefined();
		if (!ref) return;

		const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, ref.id));
		expect(sections).toHaveLength(1);
		const section = sections[0];
		expect(section).toBeDefined();
		if (!section) return;

		const figures = await db.select().from(referenceFigure).where(eq(referenceFigure.sectionId, section.id));
		expect(figures).toHaveLength(1);

		const second = await seedReferencesFromManifest({ documentSlug: fx.slug });
		expect(second.sectionsTouched).toBe(1);
		expect(second.sectionsChanged).toBe(0);
		expect(second.figuresWritten).toBe(0);

		// Figure rows unchanged after no-op re-seed.
		const figuresAgain = await db.select().from(referenceFigure).where(eq(referenceFigure.sectionId, section.id));
		expect(figuresAgain).toHaveLength(1);
		expect(figuresAgain[0]?.id).toBe(figures[0]?.id);
	});

	it('content_hash change triggers figure replacement', async () => {
		const fx = buildFixture('rehash', '2026-02', HASH_BBB);
		trackFixture(fx.slug);

		await seedReferencesFromManifest({ documentSlug: fx.slug });
		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, fx.slug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;
		const sectionRow = (await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id)))[0];
		expect(sectionRow).toBeDefined();
		if (!sectionRow) return;
		const initialFigure = (
			await db.select().from(referenceFigure).where(eq(referenceFigure.sectionId, sectionRow.id))
		)[0];
		expect(initialFigure).toBeDefined();
		if (!initialFigure) return;

		// Bump the manifest's content hash (simulating a re-extraction with different body).
		buildFixture('rehash', '2026-02', HASH_BBB_CHANGED);

		const second = await seedReferencesFromManifest({ documentSlug: fx.slug });
		expect(second.sectionsChanged).toBe(1);
		expect(second.figuresWritten).toBe(1);

		const newFigure = (await db.select().from(referenceFigure).where(eq(referenceFigure.sectionId, sectionRow.id)))[0];
		expect(newFigure).toBeDefined();
		expect(newFigure?.id).not.toBe(initialFigure.id);
	});

	it('whole-doc manifest produces a single reference_section row at depth 0', async () => {
		const slug = `test-${SUITE_TOKEN}-wholedoc`;
		const edition = '2026-04';
		trackFixture(slug);
		const editionDir = join(HANDBOOKS_DIR, slug, edition);
		mkdirSync(editionDir, { recursive: true });
		const bodyFilename = `${slug}-${edition}.md`;
		const bodyPath = join(editionDir, bodyFilename);
		const bodyContent = '# Whole Doc Sample\n\nFull document body here.\n';
		writeFileSync(bodyPath, bodyContent);
		// SHA-256 of the body content above (stable; computed once and pinned).
		// Computed via:
		//   crypto.createHash('sha256').update(bodyContent).digest('hex')
		const bodySha = sha256Hex(bodyContent);
		const manifestPath = join(editionDir, 'manifest.json');
		writeFileSync(
			manifestPath,
			JSON.stringify({
				document_slug: slug,
				edition,
				kind: 'whole-doc',
				title: 'Whole Doc Test',
				publisher: 'FAA',
				source_url: 'https://example.com/wholedoc.pdf',
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				subjects: ['training-ops'],
				primary_cert: 'private',
				body_path: `handbooks/${slug}/${edition}/${bodyFilename}`,
				body_sha256: bodySha,
				page_count: 42,
				doc_id: 'faa-test-wd',
				faa_edition: '1A',
			}),
		);

		const summary = await seedReferencesFromManifest({ documentSlug: slug });
		expect(summary.editionsProcessed).toBe(1);
		expect(summary.sectionsTouched).toBe(1);
		expect(summary.sectionsChanged).toBe(1);

		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, slug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;
		expect(refRow.subjects).toEqual(['training-ops']);
		expect(refRow.primaryCert).toBe('private');
		expect(refRow.sectionSchema).toEqual({ levels: ['document'], strictSequence: true });
		expect(refRow.metadata).toEqual({ page_count: 42, doc_id: 'faa-test-wd', faa_edition: '1A' });

		const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id));
		expect(sections).toHaveLength(1);
		const sec = sections[0];
		if (!sec) return;
		expect(sec.depth).toBe(0);
		expect(sec.level).toBe('document');
		expect(sec.code).toBe('1');
		expect(sec.parentId).toBeNull();
		expect(sec.contentMd).toBe(bodyContent);
		expect(sec.contentHash).toBe(bodySha);

		// Idempotent re-run.
		const second = await seedReferencesFromManifest({ documentSlug: slug });
		expect(second.sectionsTouched).toBe(1);
		expect(second.sectionsChanged).toBe(0);
	});

	it('AIM manifest produces a chapter -> section -> paragraph tree', async () => {
		const slug = `test-${SUITE_TOKEN}-aim`;
		const edition = '2026-04';
		trackFixture(slug, AIM_DIR);
		const editionDir = join(AIM_DIR, slug, edition);
		const chapterDir = join(editionDir, '01-air-navigation');
		const sectionDir = join(chapterDir, '01-navigation-aids');
		mkdirSync(sectionDir, { recursive: true });

		const chapterBody = '# Chapter 1\n\nIntro.\n';
		const sectionBody = '# Section 1-1\n\nSection body.\n';
		const paragraphBody = '# Paragraph 1-1-1\n\nParagraph body.\n';
		writeFileSync(join(chapterDir, '00-air-navigation.md'), chapterBody);
		writeFileSync(join(sectionDir, '00-navigation-aids.md'), sectionBody);
		writeFileSync(join(sectionDir, '01-general.md'), paragraphBody);

		const chapterHash = sha256Hex(chapterBody);
		const sectionHash = sha256Hex(sectionBody);
		const paragraphHash = sha256Hex(paragraphBody);

		const manifestPath = join(editionDir, 'manifest.json');
		writeFileSync(
			manifestPath,
			JSON.stringify({
				kind: 'aim',
				document_slug: slug,
				edition,
				title: 'Aeronautical Information Manual (test)',
				publisher: 'FAA',
				source_url: 'https://example.com/aim.pdf',
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				subjects: ['regulations', 'procedures', 'navigation'],
				primary_cert: null,
				entries: [
					{
						kind: 'chapter',
						code: '1',
						title: 'Air Navigation',
						body_path: `aim/${slug}/${edition}/01-air-navigation/00-air-navigation.md`,
						content_hash: chapterHash,
					},
					{
						kind: 'section',
						code: '1-1',
						title: 'Navigation Aids',
						body_path: `aim/${slug}/${edition}/01-air-navigation/01-navigation-aids/00-navigation-aids.md`,
						content_hash: sectionHash,
					},
					{
						kind: 'paragraph',
						code: '1-1-1',
						title: 'General',
						body_path: `aim/${slug}/${edition}/01-air-navigation/01-navigation-aids/01-general.md`,
						content_hash: paragraphHash,
					},
				],
			}),
		);

		const summary = await seedReferencesFromManifest({ documentSlug: slug });
		expect(summary.editionsProcessed).toBe(1);
		expect(summary.sectionsTouched).toBe(3);
		expect(summary.sectionsChanged).toBe(3);

		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, slug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;
		expect(refRow.kind).toBe('aim');
		expect(refRow.subjects).toEqual(['regulations', 'procedures', 'navigation']);
		expect(refRow.primaryCert).toBeNull();
		expect(refRow.sectionSchema).toEqual({
			levels: ['chapter', 'section', 'paragraph', 'appendix', 'glossary'],
			strictSequence: false,
		});

		const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id));
		expect(sections).toHaveLength(3);

		const chapter = sections.find((s) => s.code === '1');
		const section = sections.find((s) => s.code === '1-1');
		const paragraph = sections.find((s) => s.code === '1-1-1');
		expect(chapter).toBeDefined();
		expect(section).toBeDefined();
		expect(paragraph).toBeDefined();
		if (!chapter || !section || !paragraph) return;

		expect(chapter.depth).toBe(0);
		expect(chapter.level).toBe('chapter');
		expect(chapter.parentId).toBeNull();
		expect(chapter.contentMd).toBe(chapterBody);

		expect(section.depth).toBe(1);
		expect(section.level).toBe('section');
		expect(section.parentId).toBe(chapter.id);
		expect(section.contentMd).toBe(sectionBody);

		expect(paragraph.depth).toBe(2);
		expect(paragraph.level).toBe('paragraph');
		expect(paragraph.parentId).toBe(section.id);
		expect(paragraph.contentMd).toBe(paragraphBody);

		// Idempotent re-run: zero changes.
		const second = await seedReferencesFromManifest({ documentSlug: slug });
		expect(second.sectionsTouched).toBe(3);
		expect(second.sectionsChanged).toBe(0);
	});

	it('AIM seed throws when a child entry references a missing parent', async () => {
		const slug = `test-${SUITE_TOKEN}-aim-orphan`;
		const edition = '2026-04';
		trackFixture(slug, AIM_DIR);
		const editionDir = join(AIM_DIR, slug, edition);
		const orphanDir = join(editionDir, '09-airspace', '01-controlled-airspace');
		mkdirSync(orphanDir, { recursive: true });
		const orphanBody = '# Orphan paragraph\n';
		writeFileSync(join(orphanDir, '01-orphan.md'), orphanBody);
		const manifestPath = join(editionDir, 'manifest.json');
		// Paragraph 9-1-1 references section 9-1, which is NOT in the entries.
		writeFileSync(
			manifestPath,
			JSON.stringify({
				kind: 'aim',
				document_slug: slug,
				edition,
				title: 'AIM (orphan test)',
				publisher: 'FAA',
				source_url: 'https://example.com/aim.pdf',
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				subjects: ['regulations'],
				primary_cert: null,
				entries: [
					{
						kind: 'paragraph',
						code: '9-1-1',
						title: 'Orphan paragraph',
						body_path: `aim/${slug}/${edition}/09-airspace/01-controlled-airspace/01-orphan.md`,
						content_hash: sha256Hex(orphanBody),
					},
				],
			}),
		);

		await expect(seedReferencesFromManifest({ documentSlug: slug })).rejects.toThrow(/missing parent/);
	});

	it('AC manifest produces a single circular section + idempotent re-run', async () => {
		// Synthetic doc_slug + revision so we don't collide with the built-in
		// production AC list. The test-only mapping helper makes the slug
		// resolvable without polluting the canonical registry.
		// AC schema requires `doc_slug` to be digit-only with `-`/`.` separators
		// (mirroring real FAA AC numbers like `91-21-1`); SUITE_TOKEN is hex so
		// strip any letters out for the synthetic slug.
		const numericToken = SUITE_TOKEN.replace(/[a-f]/g, '');
		const docSlug = `999-${numericToken}-1`;
		const revision = 'a';
		const documentSlug = `test-ac-${SUITE_TOKEN}`;
		const edition = 'AC TEST-1A';
		__ac_seed_mapping_internal__.register({ docSlug, revision, documentSlug, edition });
		trackFixture(documentSlug);

		const editionDir = join(AC_DIR, docSlug, revision);
		mkdirSync(editionDir, { recursive: true });
		const bodyPath = join(editionDir, 'body.md');
		const bodyContent = '# AC Test\n\nFull AC body markdown.\n';
		writeFileSync(bodyPath, bodyContent);
		const bodySha = sha256Hex(bodyContent);

		const manifestPath = join(editionDir, 'manifest.json');
		writeFileSync(
			manifestPath,
			JSON.stringify({
				schema_version: 1,
				kind: 'ac',
				corpus: 'ac',
				doc_slug: docSlug,
				doc_number: docSlug,
				revision,
				title: 'AC Synthetic Test',
				publisher: 'FAA',
				publication_date: '2026-01-15',
				source_url: 'https://example.com/ac-test.pdf',
				source_sha256: 'a'.repeat(64),
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				page_count: 12,
				body_path: `ac/${docSlug}/${revision}/body.md`,
				body_sha256: bodySha,
				sections: [],
				changes: [],
			}),
		);

		// Track the AC dir for cleanup (directory != document_slug under AC).
		fixtures.push({ slug: docSlug, corpusDir: AC_DIR });

		// AC dispatcher filters by on-disk directory (`doc_slug`), not by the
		// DB `document_slug` -- the registry mediates between the two.
		const summary = await seedReferencesFromManifest({ documentSlug: docSlug });
		expect(summary.editionsProcessed).toBe(1);
		expect(summary.sectionsTouched).toBe(1);
		expect(summary.sectionsChanged).toBe(1);

		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, documentSlug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;
		expect(refRow.kind).toBe('ac');
		expect(refRow.edition).toBe(edition);
		expect(refRow.sectionSchema).toEqual({ levels: ['circular'], strictSequence: true });

		const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id));
		expect(sections).toHaveLength(1);
		const sec = sections[0];
		if (!sec) return;
		expect(sec.depth).toBe(0);
		expect(sec.level).toBe('circular');
		expect(sec.code).toBe('1');
		expect(sec.parentId).toBeNull();
		expect(sec.contentMd).toBe(bodyContent);
		expect(sec.contentHash).toBe(bodySha);

		// Idempotent re-run.
		const second = await seedReferencesFromManifest({ documentSlug: docSlug });
		expect(second.sectionsTouched).toBe(1);
		expect(second.sectionsChanged).toBe(0);

		__ac_seed_mapping_internal__.reset();
	});

	it('AC seed throws a clear error when the registry has no mapping for (doc_slug, revision)', async () => {
		// Same numeric-slug constraint as the previous test (AC_DOC_SLUG_REGEX).
		const numericToken = SUITE_TOKEN.replace(/[a-f]/g, '');
		const docSlug = `888-${numericToken}-9`;
		const revision = 'a';
		const editionDir = join(AC_DIR, docSlug, revision);
		mkdirSync(editionDir, { recursive: true });
		const bodyPath = join(editionDir, 'body.md');
		const bodyContent = '# Orphan AC\n';
		writeFileSync(bodyPath, bodyContent);
		const bodySha = sha256Hex(bodyContent);
		writeFileSync(
			join(editionDir, 'manifest.json'),
			JSON.stringify({
				schema_version: 1,
				kind: 'ac',
				corpus: 'ac',
				doc_slug: docSlug,
				doc_number: docSlug,
				revision,
				title: 'AC Orphan',
				publisher: 'FAA',
				publication_date: null,
				source_url: 'https://example.com/orphan.pdf',
				source_sha256: 'a'.repeat(64),
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				page_count: 1,
				body_path: `ac/${docSlug}/${revision}/body.md`,
				body_sha256: bodySha,
				sections: [],
				changes: [],
			}),
		);
		fixtures.push({ slug: docSlug, corpusDir: AC_DIR });

		// Scope to this AC's on-disk directory so unrelated fixtures don't run
		// (the AIM orphan test would otherwise throw first under {} filter).
		await expect(seedReferencesFromManifest({ documentSlug: docSlug })).rejects.toThrow(/no DB mapping/);
	});

	it('CFR manifest seeds matching parts and skips long-tail parts', async () => {
		// Synthetic title=14 + parts that don't exist in the production cfr-titles
		// YAML, so we can pre-insert a test reference and verify the seeder finds
		// it by slug. Part 99999 mimics the long-tail parts that should be skipped.
		const partKey = `99-${SUITE_TOKEN.replace(/[a-f]/g, '').slice(0, 4) || '1'}`;
		const skippedPartKey = `999-${SUITE_TOKEN.replace(/[a-f]/g, '').slice(0, 4) || '2'}`;
		const titleNumber = '14';
		const documentSlug = `${titleNumber}cfr${partKey}`;
		const edition = 'current';
		const dirSlug = `test-${SUITE_TOKEN}-cfr-14`;
		const editionDate = '2026-04-22';

		// Pre-insert the reference row (mimics what cfr-titles.yaml seeds in
		// production). The CFR seed adapter only attaches sections to existing
		// references; without this row, it would skip `partKey` too.
		await db.insert(reference).values({
			id: `ref_test_${SUITE_TOKEN}_cfr`,
			kind: 'cfr',
			documentSlug,
			edition,
			title: `${titleNumber} CFR Part ${partKey} -- Test`,
			publisher: 'FAA',
			url: `https://www.ecfr.gov/current/title-${titleNumber}/part-${partKey}`,
			subjects: ['regulations'],
			primaryCert: null,
			sectionSchema: { levels: [] },
			metadata: {},
		});
		fixtures.push({ slug: documentSlug, corpusDir: HANDBOOKS_DIR }); // dummy corpusDir for cleanup

		const editionDir = join(REGS_DIR, dirSlug, editionDate);
		mkdirSync(join(editionDir, partKey), { recursive: true });
		const body1 = `# §${partKey}.1\n\nTest section A body.\n`;
		const body2 = `# §${partKey}.3\n\nTest section B body.\n`;
		writeFileSync(join(editionDir, partKey, `${partKey}-1.md`), body1);
		writeFileSync(join(editionDir, partKey, `${partKey}-3.md`), body2);
		const hash1 = sha256Hex(body1);
		const hash2 = sha256Hex(body2);

		writeFileSync(
			join(editionDir, 'manifest.json'),
			JSON.stringify({
				schemaVersion: 1,
				kind: 'cfr',
				title: titleNumber,
				editionSlug: '2026',
				editionDate,
				sourceUrl: 'file:///test.xml',
				sourceSha256: 'a'.repeat(64),
				fetchedAt: '2026-04-30T22:31:18.124Z',
				partCount: 2,
				subpartCount: 0,
				sectionCount: 2,
			}),
		);
		writeFileSync(
			join(editionDir, 'sections.json'),
			JSON.stringify({
				schemaVersion: 1,
				edition: '2026',
				sectionsByPart: {
					[partKey]: [
						{
							id: `airboss-ref:regs/cfr-${titleNumber}/${partKey}/3`,
							canonical_short: `§${partKey}.3`,
							canonical_title: 'Section B',
							last_amended_date: '2024-08-01',
							body_path: `${partKey}/${partKey}-3.md`,
							body_sha256: hash2,
						},
						{
							id: `airboss-ref:regs/cfr-${titleNumber}/${partKey}/1`,
							canonical_short: `§${partKey}.1`,
							canonical_title: 'Section A',
							last_amended_date: '2024-08-01',
							body_path: `${partKey}/${partKey}-1.md`,
							body_sha256: hash1,
						},
					],
					// Long-tail Part with no DB row -- the seeder must SKIP it
					// without raising an error. No body files written either.
					[skippedPartKey]: [
						{
							id: `airboss-ref:regs/cfr-${titleNumber}/${skippedPartKey}/1`,
							canonical_short: `§${skippedPartKey}.1`,
							canonical_title: 'Long-tail (should be skipped)',
							last_amended_date: '2024-01-01',
							body_path: `${skippedPartKey}/${skippedPartKey}-1.md`,
							body_sha256: 'd'.repeat(64),
						},
					],
				},
			}),
		);

		// Track on-disk fixture for cleanup.
		fixtures.push({ slug: dirSlug, corpusDir: REGS_DIR });

		const summary = await seedReferencesFromManifest({ documentSlug: dirSlug });
		expect(summary.editionsProcessed).toBe(1);
		expect(summary.sectionsTouched).toBe(2);
		expect(summary.sectionsChanged).toBe(2);

		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, documentSlug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;
		expect(refRow.kind).toBe('cfr');
		expect(refRow.sectionSchema).toEqual({
			levels: ['part', 'subpart', 'section', 'paragraph', 'subparagraph', 'clause'],
			strictSequence: false,
		});

		const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id));
		expect(sections).toHaveLength(2);
		const codes = sections.map((s) => s.code).sort();
		// Code is the URL-slug-shape form (`<part>.<section>`), NOT the
		// citation-display form `§<part>.<section>` -- that's what
		// `canonical_short` is for. The seeder strips the `§` prefix so
		// `/library/regulations/14-cfr/<part>/<part>.<section>` resolves.
		expect(codes).toEqual([`${partKey}.1`, `${partKey}.3`]);
		const sectionA = sections.find((s) => s.code === `${partKey}.1`);
		expect(sectionA?.level).toBe('section');
		expect(sectionA?.depth).toBe(0);
		expect(sectionA?.parentId).toBeNull();
		expect(sectionA?.contentMd).toBe(body1);
		expect(sectionA?.contentHash).toBe(hash1);

		// No reference row created for the long-tail Part.
		const longTailSlug = `${titleNumber}cfr${skippedPartKey}`;
		const skippedRefs = await db.select().from(reference).where(eq(reference.documentSlug, longTailSlug));
		expect(skippedRefs).toHaveLength(0);

		// Idempotent re-run: zero changes.
		const second = await seedReferencesFromManifest({ documentSlug: dirSlug });
		expect(second.sectionsTouched).toBe(2);
		expect(second.sectionsChanged).toBe(0);
	});

	it('CFR manifest with Subpart tree lays down subpart rows + parents sections under them (Wave 2)', async () => {
		const partKey = `91-${SUITE_TOKEN.replace(/[a-f]/g, '').slice(0, 4) || '3'}`;
		const titleNumber = '14';
		const documentSlug = `${titleNumber}cfr${partKey}`;
		const edition = 'current';
		const dirSlug = `test-${SUITE_TOKEN}-cfr-tree`;
		const editionDate = '2026-04-22';

		await db.insert(reference).values({
			id: `ref_test_${SUITE_TOKEN}_cfr_tree`,
			kind: 'cfr',
			documentSlug,
			edition,
			title: `${titleNumber} CFR Part ${partKey} -- Tree test`,
			publisher: 'FAA',
			url: `https://www.ecfr.gov/current/title-${titleNumber}/part-${partKey}`,
			subjects: ['regulations'],
			primaryCert: null,
			sectionSchema: { levels: [] },
			metadata: {},
		});
		fixtures.push({ slug: documentSlug, corpusDir: HANDBOOKS_DIR });

		const editionDir = join(REGS_DIR, dirSlug, editionDate);
		mkdirSync(join(editionDir, partKey), { recursive: true });
		const body1 = `# §${partKey}.1\n\nApplicability body.\n`;
		const body103 = `# §${partKey}.103\n\nPreflight body.\n`;
		writeFileSync(join(editionDir, partKey, `${partKey}-1.md`), body1);
		writeFileSync(join(editionDir, partKey, `${partKey}-103.md`), body103);
		const hash1 = sha256Hex(body1);
		const hash103 = sha256Hex(body103);

		writeFileSync(
			join(editionDir, 'manifest.json'),
			JSON.stringify({
				schemaVersion: 1,
				kind: 'cfr',
				title: titleNumber,
				editionSlug: '2026',
				editionDate,
				sourceUrl: 'file:///tree.xml',
				sourceSha256: 'b'.repeat(64),
				fetchedAt: '2026-04-30T22:31:18.124Z',
				partCount: 1,
				subpartCount: 2,
				sectionCount: 2,
				parts: [
					{
						number: partKey,
						officialTitle: 'Tree Fixture',
						subparts: [
							{ id: 'a', ordinal: 0, title: 'General', sections: [`${partKey}.1`] },
							{ id: 'b', ordinal: 1, title: 'Flight Rules', sections: [`${partKey}.103`] },
						],
					},
				],
			}),
		);
		writeFileSync(
			join(editionDir, 'sections.json'),
			JSON.stringify({
				schemaVersion: 1,
				edition: '2026',
				sectionsByPart: {
					[partKey]: [
						{
							id: `airboss-ref:regs/cfr-${titleNumber}/${partKey}/1`,
							canonical_short: `§${partKey}.1`,
							canonical_title: 'Applicability',
							last_amended_date: '2024-08-01',
							body_path: `${partKey}/${partKey}-1.md`,
							body_sha256: hash1,
							subpart_id: 'a',
						},
						{
							id: `airboss-ref:regs/cfr-${titleNumber}/${partKey}/103`,
							canonical_short: `§${partKey}.103`,
							canonical_title: 'Preflight action',
							last_amended_date: '2024-08-01',
							body_path: `${partKey}/${partKey}-103.md`,
							body_sha256: hash103,
							subpart_id: 'b',
						},
					],
				},
			}),
		);

		fixtures.push({ slug: dirSlug, corpusDir: REGS_DIR });

		const summary = await seedReferencesFromManifest({ documentSlug: dirSlug });
		expect(summary.editionsProcessed).toBe(1);
		// 2 subparts + 2 sections = 4 rows touched.
		expect(summary.sectionsTouched).toBe(4);
		expect(summary.sectionsChanged).toBe(4);

		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, documentSlug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;

		const allRows = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id));
		expect(allRows).toHaveLength(4);

		const subpartRows = allRows.filter((r) => r.level === 'subpart');
		expect(subpartRows).toHaveLength(2);
		const subpartA = subpartRows.find((r) => r.code === 'subpart-A');
		expect(subpartA).toBeDefined();
		expect(subpartA?.depth).toBe(0);
		expect(subpartA?.parentId).toBeNull();
		expect(subpartA?.title).toBe('Subpart A -- General');
		expect(subpartA?.airbossRef).toBe(`airboss-ref:regs/cfr-${titleNumber}/${partKey}/subpart-A`);
		const subpartB = subpartRows.find((r) => r.code === 'subpart-B');
		expect(subpartB?.depth).toBe(0);
		expect(subpartB?.title).toBe('Subpart B -- Flight Rules');

		const sectionRows = allRows.filter((r) => r.level === 'section');
		expect(sectionRows).toHaveLength(2);
		const section1 = sectionRows.find((r) => r.code === `${partKey}.1`);
		expect(section1?.depth).toBe(1);
		expect(section1?.parentId).toBe(subpartA?.id);
		const section103 = sectionRows.find((r) => r.code === `${partKey}.103`);
		expect(section103?.depth).toBe(1);
		expect(section103?.parentId).toBe(subpartB?.id);

		// Idempotent re-run: zero changes (no re-write of subparts or sections).
		const second = await seedReferencesFromManifest({ documentSlug: dirSlug });
		expect(second.sectionsTouched).toBe(4);
		expect(second.sectionsChanged).toBe(0);
	});

	it('CFR manifest skips a Part whose body files are not yet registered (fresh dev box)', async () => {
		const partKey = `97-${SUITE_TOKEN.replace(/[a-f]/g, '').slice(0, 4) || '1'}`;
		const documentSlug = `14cfr${partKey}`;
		const edition = 'current';
		const dirSlug = `test-${SUITE_TOKEN}-cfr-missing`;
		const editionDate = '2026-04-22';

		await db.insert(reference).values({
			id: `ref_test_missing_${SUITE_TOKEN}`,
			kind: 'cfr',
			documentSlug,
			edition,
			title: `14 CFR Part ${partKey} -- Test missing`,
			publisher: 'FAA',
			url: `https://www.ecfr.gov/current/title-14/part-${partKey}`,
			subjects: ['regulations'],
			primaryCert: null,
			sectionSchema: { levels: [] },
			metadata: {},
			seedOrigin: `test-${SUITE_TOKEN}-cfr-missing`,
		});
		fixtures.push({ slug: documentSlug, corpusDir: HANDBOOKS_DIR });
		fixtures.push({ slug: dirSlug, corpusDir: REGS_DIR });

		const editionDir = join(REGS_DIR, dirSlug, editionDate);
		mkdirSync(editionDir, { recursive: true });
		writeFileSync(
			join(editionDir, 'manifest.json'),
			JSON.stringify({
				schemaVersion: 1,
				kind: 'cfr',
				title: '14',
				editionSlug: '2026',
				editionDate,
				sourceUrl: 'file:///test.xml',
				sourceSha256: 'a'.repeat(64),
				fetchedAt: '2026-04-30T22:31:18.124Z',
				partCount: 1,
				subpartCount: 0,
				sectionCount: 1,
			}),
		);
		writeFileSync(
			join(editionDir, 'sections.json'),
			JSON.stringify({
				schemaVersion: 1,
				edition: '2026',
				sectionsByPart: {
					[partKey]: [
						{
							id: `airboss-ref:regs/cfr-14/${partKey}/1`,
							canonical_short: `§${partKey}.1`,
							canonical_title: 'Missing body section',
							last_amended_date: '2024-01-01',
							body_path: `${partKey}/${partKey}-1.md`,
							body_sha256: 'e'.repeat(64),
						},
					],
				},
			}),
		);

		// Body files are gitignored per ADR 018; on a fresh dev box `bun run
		// sources register cfr` hasn't run yet. The seeder should skip the Part
		// (not crash the whole seed) so other phases like cards / abby can finish.
		const summary = await seedReferencesFromManifest({ documentSlug: dirSlug });
		expect(summary.editionsProcessed).toBe(0);
		expect(summary.sectionsTouched).toBe(0);
		// Reference row stays in place (the YAML phase already authored it); just
		// no sections attached.
		const sections = await db
			.select()
			.from(referenceSection)
			.where(eq(referenceSection.referenceId, `ref_test_missing_${SUITE_TOKEN}`));
		expect(sections).toHaveLength(0);
	});

	it('CFR manifest throws when SOME (but not all) body files are missing -- partial extraction is a bug', async () => {
		const partKey = `98-${SUITE_TOKEN.replace(/[a-f]/g, '').slice(0, 4) || '1'}`;
		const documentSlug = `14cfr${partKey}`;
		const edition = 'current';
		const dirSlug = `test-${SUITE_TOKEN}-cfr-partial`;
		const editionDate = '2026-04-22';

		await db.insert(reference).values({
			id: `ref_test_partial_${SUITE_TOKEN}`,
			kind: 'cfr',
			documentSlug,
			edition,
			title: `14 CFR Part ${partKey} -- Test partial`,
			publisher: 'FAA',
			url: `https://www.ecfr.gov/current/title-14/part-${partKey}`,
			subjects: ['regulations'],
			primaryCert: null,
			sectionSchema: { levels: [] },
			metadata: {},
			seedOrigin: `test-${SUITE_TOKEN}-cfr-partial`,
		});
		fixtures.push({ slug: documentSlug, corpusDir: HANDBOOKS_DIR });
		fixtures.push({ slug: dirSlug, corpusDir: REGS_DIR });

		const editionDir = join(REGS_DIR, dirSlug, editionDate);
		mkdirSync(editionDir, { recursive: true });
		writeFileSync(
			join(editionDir, 'manifest.json'),
			JSON.stringify({
				schemaVersion: 1,
				kind: 'cfr',
				title: '14',
				editionSlug: '2026',
				editionDate,
				sourceUrl: 'file:///test.xml',
				sourceSha256: 'a'.repeat(64),
				fetchedAt: '2026-04-30T22:31:18.124Z',
				partCount: 1,
				subpartCount: 0,
				sectionCount: 2,
			}),
		);
		writeFileSync(
			join(editionDir, 'sections.json'),
			JSON.stringify({
				schemaVersion: 1,
				edition: '2026',
				sectionsByPart: {
					[partKey]: [
						{
							id: `airboss-ref:regs/cfr-14/${partKey}/1`,
							canonical_short: `§${partKey}.1`,
							canonical_title: 'Present',
							last_amended_date: '2024-01-01',
							body_path: `${partKey}/${partKey}-1.md`,
							body_sha256: 'e'.repeat(64),
						},
						{
							id: `airboss-ref:regs/cfr-14/${partKey}/2`,
							canonical_short: `§${partKey}.2`,
							canonical_title: 'Missing',
							last_amended_date: '2024-01-01',
							body_path: `${partKey}/${partKey}-2.md`,
							body_sha256: 'e'.repeat(64),
						},
					],
				},
			}),
		);
		// Write only ONE of the two body files. This simulates a partial extraction
		// bug, not a fresh dev box.
		mkdirSync(join(editionDir, partKey), { recursive: true });
		writeFileSync(join(editionDir, partKey, `${partKey}-1.md`), '# Present\n');

		await expect(seedReferencesFromManifest({ documentSlug: dirSlug })).rejects.toThrow(/Partial extraction is a bug/);
	});

	it('CFR rolling-edition: dispatcher seeds only the latest snapshot when multiple editions are on disk', async () => {
		// Two snapshot dirs side-by-side. The older one has NO body files (would
		// crash the CFR adapter with "missing body file") -- mimicking what
		// happens on a fresh dev box where `bun run sources register cfr` only
		// produced derivatives for one edition. The newer snapshot has body
		// files. The dispatcher must pick the newer one and skip the older.
		const partKey = `96-${SUITE_TOKEN.replace(/[a-f]/g, '').slice(0, 4) || '7'}`;
		const documentSlug = `14cfr${partKey}`;
		const dirSlug = `test-${SUITE_TOKEN}-cfr-rolling`;
		const olderEdition = '2026-04-20';
		const newerEdition = '2026-04-24';

		await db.insert(reference).values({
			id: `ref_test_rolling_${SUITE_TOKEN}`,
			kind: 'cfr',
			documentSlug,
			edition: 'current',
			title: `14 CFR Part ${partKey} -- Rolling-edition test`,
			publisher: 'FAA',
			url: `https://www.ecfr.gov/current/title-14/part-${partKey}`,
			subjects: ['regulations'],
			primaryCert: null,
			sectionSchema: { levels: [] },
			metadata: {},
		});
		fixtures.push({ slug: documentSlug, corpusDir: HANDBOOKS_DIR });
		fixtures.push({ slug: dirSlug, corpusDir: REGS_DIR });

		// Older edition: manifest + sections.json declaring a body file we
		// deliberately leave on disk-missing. If the dispatcher walked it, the
		// CFR adapter would throw `missing body file`.
		const olderDir = join(REGS_DIR, dirSlug, olderEdition);
		mkdirSync(olderDir, { recursive: true });
		writeFileSync(
			join(olderDir, 'manifest.json'),
			JSON.stringify({
				schemaVersion: 1,
				kind: 'cfr',
				title: '14',
				editionSlug: '2026',
				editionDate: olderEdition,
				sourceUrl: 'file:///old.xml',
				sourceSha256: 'a'.repeat(64),
				fetchedAt: '2026-04-20T00:00:00.000Z',
				partCount: 1,
				subpartCount: 0,
				sectionCount: 1,
			}),
		);
		writeFileSync(
			join(olderDir, 'sections.json'),
			JSON.stringify({
				schemaVersion: 1,
				edition: '2026',
				sectionsByPart: {
					[partKey]: [
						{
							id: `airboss-ref:regs/cfr-14/${partKey}/1`,
							canonical_short: `§${partKey}.1`,
							canonical_title: 'Older snapshot, body missing',
							last_amended_date: '2024-01-01',
							body_path: `${partKey}/${partKey}-1.md`,
							body_sha256: 'e'.repeat(64),
						},
					],
				},
			}),
		);

		// Newer edition: full inline derivatives.
		const newerDir = join(REGS_DIR, dirSlug, newerEdition);
		mkdirSync(join(newerDir, partKey), { recursive: true });
		const body = `# §${partKey}.1\n\nNewer snapshot body.\n`;
		writeFileSync(join(newerDir, partKey, `${partKey}-1.md`), body);
		const bodyHash = sha256Hex(body);
		writeFileSync(
			join(newerDir, 'manifest.json'),
			JSON.stringify({
				schemaVersion: 1,
				kind: 'cfr',
				title: '14',
				editionSlug: '2026',
				editionDate: newerEdition,
				sourceUrl: 'file:///new.xml',
				sourceSha256: 'b'.repeat(64),
				fetchedAt: '2026-04-24T00:00:00.000Z',
				partCount: 1,
				subpartCount: 0,
				sectionCount: 1,
			}),
		);
		writeFileSync(
			join(newerDir, 'sections.json'),
			JSON.stringify({
				schemaVersion: 1,
				edition: '2026',
				sectionsByPart: {
					[partKey]: [
						{
							id: `airboss-ref:regs/cfr-14/${partKey}/1`,
							canonical_short: `§${partKey}.1`,
							canonical_title: 'Newer snapshot',
							last_amended_date: '2024-08-01',
							body_path: `${partKey}/${partKey}-1.md`,
							body_sha256: bodyHash,
						},
					],
				},
			}),
		);

		// Should NOT throw -- dispatcher picks newer snapshot and skips older.
		const summary = await seedReferencesFromManifest({ documentSlug: dirSlug });
		expect(summary.editionsProcessed).toBe(1);
		expect(summary.sectionsTouched).toBe(1);
		expect(summary.sectionsChanged).toBe(1);

		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, documentSlug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;
		const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id));
		expect(sections).toHaveLength(1);
		expect(sections[0]?.contentMd).toBe(body);
	});

	it('pickEditions picks the latest CFR snapshot but returns every handbook edition', () => {
		const tmp = join(REGS_DIR, `pick-editions-${SUITE_TOKEN}`);
		const handbookTmp = join(HANDBOOKS_DIR, `pick-editions-${SUITE_TOKEN}`);
		mkdirSync(join(tmp, '2026-04-20'), { recursive: true });
		mkdirSync(join(tmp, '2026-04-24'), { recursive: true });
		mkdirSync(join(handbookTmp, 'A'), { recursive: true });
		mkdirSync(join(handbookTmp, 'B'), { recursive: true });
		fixtures.push({ slug: `pick-editions-${SUITE_TOKEN}`, corpusDir: REGS_DIR });
		fixtures.push({ slug: `pick-editions-${SUITE_TOKEN}`, corpusDir: HANDBOOKS_DIR });

		// Rolling corpus -> latest only.
		expect(pickEditions({ corpusDir: 'regulations', childAbs: tmp, explicitEdition: undefined })).toEqual([
			'2026-04-24',
		]);

		// Non-rolling corpus -> every edition.
		expect(pickEditions({ corpusDir: 'handbooks', childAbs: handbookTmp, explicitEdition: undefined }).sort()).toEqual([
			'A',
			'B',
		]);

		// Explicit override always wins.
		expect(pickEditions({ corpusDir: 'regulations', childAbs: tmp, explicitEdition: '2026-04-20' })).toEqual([
			'2026-04-20',
		]);
	});

	it('ACS manifest produces a 4-level tree (publication -> area -> task -> element)', async () => {
		// Synthetic manifest slug + DB documentSlug so the test doesn't collide
		// with the built-in production ACS list. The test-only mapping helper
		// makes the slug resolvable without polluting the canonical registry.
		const manifestSlug = `test-acs-${SUITE_TOKEN}`;
		const documentSlug = `test-acs-doc-${SUITE_TOKEN}`;
		const edition = 'TEST-ACS-1';
		__acs_seed_mapping_internal__.register({ manifestSlug, documentSlug, edition });

		const slugDir = join(ACS_DIR, manifestSlug);
		const areaDir = join(slugDir, 'area-01');
		mkdirSync(areaDir, { recursive: true });
		const taskBody = '# Task A. Sample\n\nFull task body.\n';
		const taskBodyPath = join(areaDir, 'task-a.md');
		writeFileSync(taskBodyPath, taskBody);
		const taskBodySha = sha256Hex(taskBody);

		const manifestPath = join(slugDir, 'manifest.json');
		writeFileSync(
			manifestPath,
			JSON.stringify({
				kind: 'acs',
				schema_version: 1,
				corpus: 'acs',
				slug: manifestSlug,
				title: 'Synthetic ACS Test',
				publisher: 'FAA',
				publication_date: '2026-01-15',
				source_url: 'https://example.com/acs-test.pdf',
				source_sha256: 'a'.repeat(64),
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				page_count: 50,
				areas: [
					{
						area: '01',
						title: 'Sample Area',
						tasks: [
							{
								task: 'a',
								title: 'Sample Task',
								body_path: `acs/${manifestSlug}/area-01/task-a.md`,
								body_sha256: taskBodySha,
								elements: [
									{ triad: 'k', ordinal: '01', code: 'TS.I.A.K1', title: 'Element 1.' },
									{ triad: 'r', ordinal: '02', code: 'TS.I.A.R2', title: 'Element 2.' },
								],
							},
						],
					},
				],
			}),
		);
		// Track the on-disk fixture for cleanup; the ACS dispatcher keys
		// supersede grouping by childDir for the `acs/` corpus, so the slug
		// the supersede code sees is `manifestSlug`, not the corpus dir.
		fixtures.push({ slug: manifestSlug, corpusDir: ACS_DIR });
		fixtures.push({ slug: documentSlug, corpusDir: HANDBOOKS_DIR });

		// `documentSlug` filter is the dispatcher-effective slug; for ACS that's
		// the manifest's child dir name (the per-child convention).
		const summary = await seedReferencesFromManifest({ documentSlug: manifestSlug });
		expect(summary.editionsProcessed).toBe(1);
		// 1 publication + 1 area + 1 task + 2 elements = 5 sections.
		expect(summary.sectionsTouched).toBe(5);
		expect(summary.sectionsChanged).toBe(5);

		const refRow = (await db.select().from(reference).where(eq(reference.documentSlug, documentSlug)))[0];
		expect(refRow).toBeDefined();
		if (!refRow) return;
		expect(refRow.kind).toBe('acs');
		expect(refRow.edition).toBe(edition);
		expect(refRow.sectionSchema).toEqual({
			levels: ['publication', 'area', 'task', 'element'],
			strictSequence: true,
		});

		const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, refRow.id));
		expect(sections).toHaveLength(5);

		const pub = sections.find((s) => s.code === 'publication');
		const area = sections.find((s) => s.code === 'I');
		const task = sections.find((s) => s.code === 'I.A');
		const elemK = sections.find((s) => s.code === 'TS.I.A.K1');
		const elemR = sections.find((s) => s.code === 'TS.I.A.R2');

		expect(pub).toBeDefined();
		expect(area).toBeDefined();
		expect(task).toBeDefined();
		expect(elemK).toBeDefined();
		expect(elemR).toBeDefined();
		if (!pub || !area || !task || !elemK || !elemR) return;

		expect(pub.depth).toBe(0);
		expect(pub.level).toBe('publication');
		expect(pub.parentId).toBeNull();
		expect(pub.contentMd).toBe('');

		expect(area.depth).toBe(1);
		expect(area.level).toBe('area');
		expect(area.parentId).toBe(pub.id);

		expect(task.depth).toBe(2);
		expect(task.level).toBe('task');
		expect(task.parentId).toBe(area.id);
		expect(task.contentMd).toBe(taskBody);
		expect(task.contentHash).toBe(taskBodySha);

		expect(elemK.depth).toBe(3);
		expect(elemK.level).toBe('element');
		expect(elemK.parentId).toBe(task.id);
		expect(elemK.contentMd).toBe('');
		expect(elemR.parentId).toBe(task.id);

		// Idempotent re-run: zero changes.
		const second = await seedReferencesFromManifest({ documentSlug: manifestSlug });
		expect(second.sectionsTouched).toBe(5);
		expect(second.sectionsChanged).toBe(0);

		__acs_seed_mapping_internal__.reset();
	});

	it('ACS seed throws a clear error when the registry has no mapping for the manifest slug', async () => {
		const manifestSlug = `orphan-acs-${SUITE_TOKEN}`;
		const slugDir = join(ACS_DIR, manifestSlug);
		const areaDir = join(slugDir, 'area-01');
		mkdirSync(areaDir, { recursive: true });
		const taskBody = '# Orphan task\n';
		writeFileSync(join(areaDir, 'task-a.md'), taskBody);
		const taskBodySha = sha256Hex(taskBody);

		writeFileSync(
			join(slugDir, 'manifest.json'),
			JSON.stringify({
				kind: 'acs',
				schema_version: 1,
				corpus: 'acs',
				slug: manifestSlug,
				title: 'Orphan ACS',
				publisher: 'FAA',
				publication_date: null,
				source_url: 'https://example.com/orphan.pdf',
				source_sha256: 'a'.repeat(64),
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				page_count: 1,
				areas: [
					{
						area: '01',
						title: 'Orphan',
						tasks: [
							{
								task: 'a',
								title: 'Orphan Task',
								body_path: `acs/${manifestSlug}/area-01/task-a.md`,
								body_sha256: taskBodySha,
								elements: [],
							},
						],
					},
				],
			}),
		);
		fixtures.push({ slug: manifestSlug, corpusDir: ACS_DIR });

		await expect(seedReferencesFromManifest({ documentSlug: manifestSlug })).rejects.toThrow(/no DB mapping/);
	});

	it('ACS seed throws when a referenced task body file is missing', async () => {
		const manifestSlug = `missing-body-acs-${SUITE_TOKEN}`;
		const documentSlug = `missing-body-doc-${SUITE_TOKEN}`;
		const edition = 'TEST-ACS-MB';
		__acs_seed_mapping_internal__.register({ manifestSlug, documentSlug, edition });

		const slugDir = join(ACS_DIR, manifestSlug);
		mkdirSync(slugDir, { recursive: true });
		writeFileSync(
			join(slugDir, 'manifest.json'),
			JSON.stringify({
				kind: 'acs',
				schema_version: 1,
				corpus: 'acs',
				slug: manifestSlug,
				title: 'Missing-body ACS',
				publisher: 'FAA',
				publication_date: null,
				source_url: 'https://example.com/missing.pdf',
				source_sha256: 'a'.repeat(64),
				fetched_at: '2026-04-26T00:00:00.000+00:00',
				page_count: 1,
				areas: [
					{
						area: '01',
						title: 'Missing',
						tasks: [
							{
								task: 'a',
								title: 'No body on disk',
								body_path: `acs/${manifestSlug}/area-01/task-a.md`,
								body_sha256: 'b'.repeat(64),
								elements: [],
							},
						],
					},
				],
			}),
		);
		fixtures.push({ slug: manifestSlug, corpusDir: ACS_DIR });
		fixtures.push({ slug: documentSlug, corpusDir: HANDBOOKS_DIR });

		await expect(seedReferencesFromManifest({ documentSlug: manifestSlug })).rejects.toThrow(/missing task body/);

		__acs_seed_mapping_internal__.reset();
	});

	it('supersede chain publishes older edition with retired_at; newer with retired_at IS NULL', async () => {
		const a = buildFixture('superseded-a', '2026-03-A', HASH_AAA);
		buildFixture('superseded-a', '2026-03-B', HASH_BBB);
		trackFixture(a.slug);
		// Same slug for both editions; track only once.

		const summary = await seedReferencesFromManifest({ documentSlug: a.slug });
		expect(summary.editionsProcessed).toBe(2);
		// One older edition gets retired in the registry; one current.
		expect(summary.supersededLinks).toBe(1);

		const refs = await db.select().from(reference).where(eq(reference.documentSlug, a.slug));
		expect(refs).toHaveLength(2);
		const older = refs.find((r) => r.edition === '2026-03-A');
		const newer = refs.find((r) => r.edition === '2026-03-B');
		expect(older).toBeDefined();
		expect(newer).toBeDefined();
		if (!older || !newer) return;

		// Per ADR 026: the registry is the source of truth. The older edition
		// has `retired_at IS NOT NULL`; the newer has `retired_at IS NULL`.
		const sourceId = sourceIdForReference(newer);
		const editionRows = await db.select().from(editionsTable).where(eq(editionsTable.sourceId, sourceId));
		expect(editionRows).toHaveLength(2);
		const olderEdRow = editionRows.find((e) => e.editionLabel === '2026-03-A');
		const newerEdRow = editionRows.find((e) => e.editionLabel === '2026-03-B');
		expect(olderEdRow?.retiredAt).not.toBeNull();
		expect(newerEdRow?.retiredAt).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Cross-corpus seed-shape contract. Walks whatever real CFR rows the dev DB
// happens to hold (idempotent across re-seeds; nothing test-tagged here)
// and asserts the shape every renderer + URL parser depends on:
//
//   1. Section codes parse against the URL slug shape declared in
//      libs/aviation/src/slugs.ts (SECTION_SHAPE).
//   2. Top-level CFR sections sit at depth 0 with `parent_id IS NULL` --
//      the shape `buildSectionListView` and `getFlatSection` query for.
//   3. Top-level CFR section level is exactly `'section'` (not `'subsection'`
//      or some other level the flat probe wouldn't match).
//
// If any of these contracts breaks, every CFR detail-page link 404s and
// the section list silently falls through to the umbrella card. The unit
// tests above pin synthetic-fixture behaviour; this suite pins the
// integration with whatever the production seeder actually produced.
// Skips cleanly when the dev DB hasn't been seeded with CFR rows yet.
// ---------------------------------------------------------------------------

describe('CFR seed-shape contract (real DB)', () => {
	// Mirror of SECTION_SHAPE in libs/aviation/src/slugs.ts. Duplicated rather
	// than imported so a refactor that loosens the production regex doesn't
	// silently relax this contract.
	const URL_SECTION_SHAPE = /^[a-z0-9]+(?:\.[a-z0-9]+)?(?:-[a-z0-9]+(?:\.[a-z0-9]+)?)?$/i;

	// Real CFR rows only -- skip rows seed-tagged by other test suites
	// running in parallel (their suite tokens land in `seed_origin`) AND
	// rows with test-shape document slugs (`14cfr97-XXXX`) where the test
	// race is faster than the row's `seed_origin` write.
	const isProductionRow = (row: { seedOrigin: string | null; documentSlug: string }): boolean => {
		if (row.seedOrigin && (row.seedOrigin.startsWith('test-') || row.seedOrigin.startsWith('regs-test-'))) {
			return false;
		}
		// CFR test fixtures use slugs like `14cfr97-1234` (Part-token format).
		// Production CFR slugs are `<title>cfr<part>` with no internal hyphen.
		if (/^(14|49)cfr\d+-/.test(row.documentSlug)) return false;
		return true;
	};

	it('every CFR top-level section has a code that parses as a URL slug', async () => {
		const allCfrRefs = await db.select().from(reference).where(eq(reference.kind, REFERENCE_KINDS.CFR));
		const cfrRefs = allCfrRefs.filter(isProductionRow);
		if (cfrRefs.length === 0) {
			// Dev DB without CFR seed -- skip rather than fail; the synthetic
			// suite above still covers the regression on every run.
			console.warn('cfr-shape contract: no CFR rows in DB -- skipping');
			return;
		}

		const violations: { ref: string; code: string }[] = [];
		for (const ref of cfrRefs) {
			const sections = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, ref.id));
			for (const s of sections) {
				// Subpart container rows carry a structural code (`subpart-A`,
				// `subpart-F-G`) that's never directly URL-targeted -- only the
				// child section rows (level=`section`) appear in the
				// `/library/regulations/14-cfr/<part>/<section>` route. Skip
				// non-section levels so the eCFR's combined-reserved subparts
				// (e.g. 14 CFR 71 "Subparts F-G [Reserved]") don't trip the
				// URL-slug contract that's meant for routable sections.
				if (s.level !== 'section') continue;
				if (!URL_SECTION_SHAPE.test(s.code)) {
					violations.push({ ref: ref.documentSlug, code: s.code });
				}
			}
		}

		expect(
			violations,
			`section codes must parse as URL slugs (no \`§\` prefix etc.). ` +
				`Failures: ${violations
					.slice(0, 5)
					.map((v) => `${v.ref}/${v.code}`)
					.join(', ')}${violations.length > 5 ? ` +${violations.length - 5} more` : ''}`,
		).toEqual([]);
	});

	it('every CFR reference with sections has at least one top-level section row', async () => {
		// Lock the "data ingested but not seeded into reference_section"
		// failure mode that produced the original bug: 11 CFR refs in the DB
		// with zero matching reference_section rows. If this returns nothing,
		// the regulations browse page falls through to the external link.
		const allCfrRefs = await db.select().from(reference).where(eq(reference.kind, REFERENCE_KINDS.CFR));
		const cfrRefs = allCfrRefs.filter(isProductionRow);
		if (cfrRefs.length === 0) return;

		const refsWithoutSections: string[] = [];
		for (const ref of cfrRefs) {
			const top = await db
				.select()
				.from(referenceSection)
				.where(
					and(eq(referenceSection.referenceId, ref.id), eq(referenceSection.level, REFERENCE_SECTION_LEVELS.SECTION)),
				)
				.limit(1);
			if (top.length === 0) refsWithoutSections.push(ref.documentSlug);
		}

		expect(
			refsWithoutSections,
			`CFR reference rows must have ingested section rows. Missing: ${refsWithoutSections.join(', ')}. ` +
				`Run \`bun run sources register cfr --title=14 --edition=<date>\` then ` +
				`\`bun scripts/db/seed-references-from-manifest.ts\`.`,
		).toEqual([]);
	});

	// ----------------------------------------------------------------------
	// External-URL contract: every production CFR row must have either
	// an authored `url` column OR a derivable canonical eCFR URL via the
	// nav-tree YAML. Locks the "card has no eCFR link" failure mode.
	// ----------------------------------------------------------------------
	it('every production CFR reference has a derivable canonical eCFR URL', async () => {
		const { buildPartUrl } = await import('@ab/sources');
		const allCfrRefs = await db.select().from(reference).where(eq(reference.kind, REFERENCE_KINDS.CFR));
		const cfrRefs = allCfrRefs.filter(isProductionRow);
		if (cfrRefs.length === 0) return;

		const missing: string[] = [];
		for (const ref of cfrRefs) {
			const slug = ref.documentSlug;
			const match = slug.match(/^(14|49)cfr(.+)$/);
			if (match === null) continue;
			const titleNumber = match[1] === '14' ? 14 : 49;
			const partNumber = match[2] ?? '';
			const built = buildPartUrl(titleNumber, partNumber);
			if (!built.startsWith('https://www.ecfr.gov/')) {
				if (!ref.url || ref.url.length === 0) missing.push(slug);
			}
		}

		expect(missing, `CFR refs missing an eCFR URL: ${missing.join(', ')}`).toEqual([]);
	});

	// ----------------------------------------------------------------------
	// Wave 1 authoring contract: every priority Part (the ones authored in
	// `regulations/cfr-{14,49}/_authoring/parts.yaml` AND backed by a row in
	// `course/references/cfr-titles.yaml`) must carry `description` +
	// `whyItMatters` + `officialTitle` in `reference.metadata` after seed.
	//
	// Skipped cleanly when the DB has not been seeded yet (cfrRefs empty)
	// so a fresh dev clone doesn't trip the assertion.
	// ----------------------------------------------------------------------
	it('every priority Part has description, whyItMatters, and officialTitle in metadata', async () => {
		const PRIORITY_14_CFR_PARTS_AUTHORED_AND_SEEDED: readonly string[] = [
			// Intersection of the priority list and `cfr-titles.yaml` slugs --
			// the authoring YAML covers more Parts than the YAML refs, but the
			// seeder only stamps metadata where a DB row exists. Wave 1 added
			// the operational/commercial-carriage Parts (103/105/119/121/125/
			// 133/137) to both YAMLs so the seeder materializes their copy.
			// Wave 2 added the owner-pilot core Parts (39 ADs, 43 maintenance,
			// 67 medical standards) -- every owner-pilot encounters all three.
			// Wave 3 closed the priority list with 65 (non-flight-crew certs:
			// mechanics, dispatchers, controllers), 93 (special air-traffic
			// rules: DC SFRA, Hudson, Grand Canyon), 97 (Standard Instrument
			// Procedures: every IAP a pilot flies), 142 (training centers:
			// type-rating mills, sim providers).
			'14cfr23',
			'14cfr39',
			'14cfr43',
			'14cfr61',
			'14cfr65',
			'14cfr67',
			'14cfr68',
			'14cfr71',
			'14cfr73',
			'14cfr91',
			'14cfr93',
			'14cfr97',
			'14cfr103',
			'14cfr105',
			'14cfr119',
			'14cfr121',
			'14cfr125',
			'14cfr133',
			'14cfr135',
			'14cfr137',
			'14cfr141',
			'14cfr142',
		];
		const PRIORITY_49_CFR_PARTS_AUTHORED_AND_SEEDED: readonly string[] = ['49cfr830', '49cfr1552'];
		const expectedSlugs = [...PRIORITY_14_CFR_PARTS_AUTHORED_AND_SEEDED, ...PRIORITY_49_CFR_PARTS_AUTHORED_AND_SEEDED];

		const allCfrRefs = await db.select().from(reference).where(eq(reference.kind, REFERENCE_KINDS.CFR));
		const cfrRefs = allCfrRefs.filter(isProductionRow);
		if (cfrRefs.length === 0) {
			console.warn('cfr Wave 1 metadata contract: no CFR rows in DB -- skipping');
			return;
		}

		const slugToMetadata = new Map<string, Record<string, unknown>>();
		for (const ref of cfrRefs) {
			slugToMetadata.set(ref.documentSlug, (ref.metadata ?? {}) as Record<string, unknown>);
		}

		const missing: string[] = [];
		for (const slug of expectedSlugs) {
			const md = slugToMetadata.get(slug);
			if (md === undefined) {
				// Reference row absent means the YAML phase didn't seed it; the
				// metadata contract can't apply. Surface in the failure list so
				// the gap is visible.
				missing.push(`${slug} (no DB row)`);
				continue;
			}
			const gaps: string[] = [];
			if (typeof md.officialTitle !== 'string' || md.officialTitle.length === 0) gaps.push('officialTitle');
			if (typeof md.description !== 'string' || md.description.length === 0) gaps.push('description');
			if (typeof md.whyItMatters !== 'string' || md.whyItMatters.length === 0) gaps.push('whyItMatters');
			if (!Array.isArray(md.topics) || md.topics.length === 0) gaps.push('topics');
			if (gaps.length > 0) missing.push(`${slug} (${gaps.join(', ')})`);
		}

		expect(
			missing,
			`Priority CFR Parts must have description+whyItMatters+officialTitle+topics. Missing: ${missing.join('; ')}`,
		).toEqual([]);
	});
});
