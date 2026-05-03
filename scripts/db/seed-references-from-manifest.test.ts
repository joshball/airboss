/**
 * Seed-handbooks idempotency + supersede-chain tests.
 *
 * Builds a synthetic `handbooks/test-handbook-<token>/<edition>/` tree under
 * a tmpdir, invokes `seedReferencesFromManifest` against it, and asserts:
 *
 *   - fresh insert: rows land with correct counts.
 *   - idempotent re-run: 0 changes when the markdown / manifest is identical.
 *   - supersede: a second edition flips superseded_by_id on the older one.
 *   - figure replacement: bumping content_hash mass-replaces figures.
 *
 * Each spec uses a unique document_slug so parallel suites don't collide on
 * the (document_slug, edition) unique index.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '@ab/db/connection';
import { __ac_seed_mapping_internal__ } from '@ab/sources/ac';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { reference, referenceFigure, referenceSection } from '../../libs/bc/study/src/schema';
import { seedReferencesFromManifest } from './seed-references-from-manifest';

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
		expect(codes).toEqual([`§${partKey}.1`, `§${partKey}.3`]);
		const sectionA = sections.find((s) => s.code === `§${partKey}.1`);
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

	it('CFR manifest throws when a referenced body file is missing', async () => {
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

		await expect(seedReferencesFromManifest({ documentSlug: dirSlug })).rejects.toThrow(/missing body file/);
	});

	it('supersede chain wires older edition to the newest', async () => {
		const a = buildFixture('superseded-a', '2026-03-A', HASH_AAA);
		buildFixture('superseded-a', '2026-03-B', HASH_BBB);
		trackFixture(a.slug);
		// Same slug for both editions; track only once.

		const summary = await seedReferencesFromManifest({ documentSlug: a.slug });
		expect(summary.editionsProcessed).toBe(2);
		// One older edition gets pointed at the newer one.
		expect(summary.supersededLinks).toBe(1);

		const refs = await db.select().from(reference).where(eq(reference.documentSlug, a.slug));
		expect(refs).toHaveLength(2);
		const older = refs.find((r) => r.edition === '2026-03-A');
		const newer = refs.find((r) => r.edition === '2026-03-B');
		expect(older).toBeDefined();
		expect(newer).toBeDefined();
		if (!older || !newer) return;
		expect(older.supersededById).toBe(newer.id);
		expect(newer.supersededById).toBeNull();
	});
});
