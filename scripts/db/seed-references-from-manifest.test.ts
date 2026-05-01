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

const fixtures: string[] = [];

function trackFixture(slug: string): void {
	fixtures.push(slug);
}

afterAll(async () => {
	// Wipe DB rows for every fixture slug.
	for (const slug of fixtures) {
		await db.delete(reference).where(eq(reference.documentSlug, slug));
	}
	// Wipe disk fixtures.
	for (const slug of fixtures) {
		const dir = join(HANDBOOKS_DIR, slug);
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
		const bodyPath = join(editionDir, 'document.md');
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
				body_path: `handbooks/${slug}/${edition}/document.md`,
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
