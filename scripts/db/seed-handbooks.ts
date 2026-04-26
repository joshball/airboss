#!/usr/bin/env bun
/**
 * Handbook seed phase.
 *
 * Reads the `handbooks/` tree (committed by the ingestion pipeline) and
 * upserts:
 *
 *   - one `study.reference` row per (document_slug, edition)
 *   - one `study.handbook_section` row per chapter / section / subsection
 *     described in `manifest.json`
 *   - per-section `study.handbook_figure` rows (replaced wholesale when the
 *     section's content_hash changes)
 *   - `superseded_by_id` chained on older editions of the same document
 *
 * Idempotent: a section whose content_hash matches the DB row is a no-op
 * (apart from refreshing scaffolding fields like ordinal / parent / locator).
 *
 * Wired into `bun run db seed handbooks` via `seed-all.ts`. Also runnable
 * standalone for content authors:
 *
 *   bun scripts/db/seed-handbooks.ts                  # all editions
 *   bun scripts/db/seed-handbooks.ts phak             # one document slug
 *   bun scripts/db/seed-handbooks.ts phak FAA-H-8083-25C   # one edition
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type HandbookManifest, handbookManifestSchema } from '@ab/bc-study';
// Build helpers live in the handbooks BC but aren't re-exported from the
// barrel (route handlers should never need them; only seed code does).
// Direct relative path is documented in libs/bc/study/src/handbooks.ts.
import {
	attachSupersededByLatest,
	replaceFiguresForSection,
	upsertHandbookSection,
	upsertReference,
} from '../../libs/bc/study/src/handbooks';

// Use fileURLToPath rather than the bun-specific `import.meta.dir` so the
// module loads cleanly under vitest as well as bun.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const HANDBOOKS_DIR = resolve(REPO_ROOT, 'handbooks');

export interface SeedHandbooksOptions {
	/** Filter to a single document slug (e.g. `phak`). Default = all. */
	documentSlug?: string;
	/** Filter to a single edition tag (e.g. `FAA-H-8083-25C`). Requires documentSlug. */
	edition?: string;
	/** Optional dev-seed marker; production runs leave this null. */
	seedOrigin?: string | null;
}

export interface SeedHandbooksSummary {
	editionsProcessed: number;
	sectionsTouched: number;
	sectionsChanged: number;
	figuresWritten: number;
	supersededLinks: number;
}

/** Walk the handbooks/ tree and upsert everything. */
export async function seedHandbooks(options: SeedHandbooksOptions = {}): Promise<SeedHandbooksSummary> {
	if (!existsSync(HANDBOOKS_DIR)) {
		throw new Error(`handbooks directory not found: ${HANDBOOKS_DIR}`);
	}

	const summary: SeedHandbooksSummary = {
		editionsProcessed: 0,
		sectionsTouched: 0,
		sectionsChanged: 0,
		figuresWritten: 0,
		supersededLinks: 0,
	};

	const documentSlugs = options.documentSlug ? [options.documentSlug] : listChildDirs(HANDBOOKS_DIR);

	for (const slug of documentSlugs) {
		const slugDir = resolve(HANDBOOKS_DIR, slug);
		if (!statSync(slugDir).isDirectory()) continue;
		const editions = options.edition ? [options.edition] : listChildDirs(slugDir);
		const seededReferenceIds: string[] = [];
		for (const edition of editions) {
			const manifestPath = resolve(slugDir, edition, 'manifest.json');
			if (!existsSync(manifestPath)) continue;
			const refId = await seedEdition(slug, edition, manifestPath, options, summary);
			seededReferenceIds.push(refId);
		}
		// Wire `superseded_by_id` chains for this document slug (only when we
		// processed > 1 edition this run; otherwise leave existing pointers
		// untouched).
		if (seededReferenceIds.length > 1) {
			const latestId = seededReferenceIds[seededReferenceIds.length - 1];
			await attachSupersededByLatest(slug, latestId);
			summary.supersededLinks += seededReferenceIds.length - 1;
		}
	}
	return summary;
}

async function seedEdition(
	documentSlug: string,
	edition: string,
	manifestPath: string,
	options: SeedHandbooksOptions,
	summary: SeedHandbooksSummary,
): Promise<string> {
	const raw = JSON.parse(await readFile(manifestPath, 'utf-8'));
	const manifest: HandbookManifest = handbookManifestSchema.parse(raw);

	const ref = await upsertReference({
		kind: manifest.kind as 'handbook',
		documentSlug: manifest.document_slug,
		edition: manifest.edition,
		title: manifest.title,
		publisher: manifest.publisher,
		url: manifest.source_url,
		seedOrigin: options.seedOrigin ?? null,
	});

	// Build code -> handbook_section.id map as we walk the manifest top-down.
	const codeToSectionId: Map<string, string> = new Map();

	// Sort sections so chapters come before their children. We sort by code
	// length first (shortest first), then lexically; this keeps chapter "12"
	// before section "12.3" before subsection "12.3.2".
	const sortedSections = [...manifest.sections].sort((a, b) => {
		if (a.code.length !== b.code.length) return a.code.length - b.code.length;
		return a.code.localeCompare(b.code);
	});

	for (const section of sortedSections) {
		const parentId = section.parent_code ? (codeToSectionId.get(section.parent_code) ?? null) : null;
		const bodyAbsPath = resolve(REPO_ROOT, section.body_path);
		const contentMd = existsSync(bodyAbsPath) ? await readFile(bodyAbsPath, 'utf-8') : '';
		const { row, changed } = await upsertHandbookSection({
			referenceId: ref.id,
			parentId,
			level: section.level as 'chapter' | 'section' | 'subsection',
			ordinal: section.ordinal,
			code: section.code,
			title: section.title,
			faaPageStart: section.faa_page_start,
			faaPageEnd: section.faa_page_end,
			sourceLocator: section.source_locator,
			contentMd,
			contentHash: section.content_hash,
			hasFigures: section.has_figures,
			hasTables: section.has_tables,
			seedOrigin: options.seedOrigin ?? null,
		});
		codeToSectionId.set(section.code, row.id);
		summary.sectionsTouched += 1;
		if (changed) {
			summary.sectionsChanged += 1;
			// Replace figures for this section since the body changed.
			const figuresForSection = manifest.figures.filter((f) => f.section_code === section.code);
			const written = await replaceFiguresForSection(
				row.id,
				figuresForSection.map((f) => ({
					ordinal: f.ordinal,
					caption: f.caption,
					assetPath: f.asset_path,
					width: f.width ?? null,
					height: f.height ?? null,
				})),
				undefined,
				options.seedOrigin ?? null,
			);
			summary.figuresWritten += written.length;
		}
	}

	summary.editionsProcessed += 1;
	console.log(
		`  ${manifest.document_slug} ${manifest.edition}: ${sortedSections.length} sections, ${manifest.figures.length} figures, ${manifest.warnings.length} warnings`,
	);
	return ref.id;
}

function listChildDirs(dir: string): string[] {
	return readdirSync(dir).filter((name) => {
		const full = resolve(dir, name);
		try {
			return statSync(full).isDirectory();
		} catch {
			return false;
		}
	});
}

// CLI entry point: `bun scripts/db/seed-handbooks.ts [doc] [edition]`.
if (import.meta.main) {
	const [doc, edition] = process.argv.slice(2);
	console.log('seed: handbooks');
	const summary = await seedHandbooks({ documentSlug: doc, edition });
	console.log(
		`done: ${summary.editionsProcessed} editions, ${summary.sectionsTouched} sections (${summary.sectionsChanged} changed), ${summary.figuresWritten} figures, ${summary.supersededLinks} superseded links.`,
	);
}
