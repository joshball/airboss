/**
 * Phase 6 -- read PR #242's handbook derivatives.
 *
 * ADR 016 phase 0 (PR #242) shipped a Python pipeline at
 * `tools/handbook-ingest/` that fetches FAA handbook PDFs, extracts markdown +
 * figures + tables, and writes a per-handbook `manifest.json`. Phase 6 of ADR
 * 019 reads that manifest and surfaces sections / chapters / subsections to
 * the registry without re-doing any extraction work.
 *
 * The on-disk shape (per ADR 018):
 *
 *   handbooks/<doc>/<faa-dir>/manifest.json
 *   handbooks/<doc>/<faa-dir>/<chapter>/<file>.md       section bodies
 *   handbooks/<doc>/<faa-dir>/figures/fig-<...>.png     figures
 *   handbooks/<doc>/<faa-dir>/tables/tbl-<...>.html     tables
 *
 * The locator path uses the short edition slug (`8083-25C`); the on-disk
 * directory uses the full FAA filename (`FAA-H-8083-25C`). The mapping lives
 * in `DOC_EDITIONS` in `resolver.ts`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedHandbooksLocator } from '../types.ts';

/**
 * Per-section record from the manifest's `sections[]` array.
 */
export interface ManifestSection {
	readonly level: 'chapter' | 'section' | 'subsection';
	readonly code: string;
	readonly ordinal: number;
	readonly parent_code: string | null;
	readonly title: string;
	readonly faa_page_start: string;
	readonly faa_page_end: string;
	readonly source_locator: string;
	readonly body_path: string;
	readonly content_hash: string;
	readonly has_figures: boolean;
	readonly has_tables: boolean;
}

/**
 * Top-level shape of `handbooks/<doc>/<faa-dir>/manifest.json`. Mirrors the
 * shape PR #242's pipeline writes.
 */
export interface ManifestFile {
	readonly document_slug: string;
	readonly edition: string;
	readonly kind: string;
	readonly title: string;
	readonly publisher: string;
	readonly source_url: string;
	readonly source_checksum: string;
	readonly fetched_at: string;
	readonly sections: readonly ManifestSection[];
}

/**
 * Read and validate `handbooks/<doc>/<faa-dir>/manifest.json` from `root`.
 * Throws when the file is missing or required fields are absent.
 */
export function readManifest(faaDir: string, root: string, docSlug: string): ManifestFile {
	const path = join(root, docSlug, faaDir, 'manifest.json');
	if (!existsSync(path)) {
		throw new Error(`handbook manifest not found: ${path}`);
	}
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`handbook manifest is not valid JSON (${path}): ${(e as Error).message}`);
	}
	const manifest = parsed as Partial<ManifestFile>;
	const required: readonly (keyof ManifestFile)[] = [
		'document_slug',
		'edition',
		'kind',
		'title',
		'publisher',
		'source_url',
		'fetched_at',
		'sections',
	];
	for (const key of required) {
		if (manifest[key] === undefined) {
			throw new Error(`handbook manifest at ${path} missing required field: ${key}`);
		}
	}
	if (!Array.isArray(manifest.sections)) {
		throw new Error(`handbook manifest at ${path}: sections must be an array`);
	}
	return manifest as ManifestFile;
}

/**
 * Map a parsed handbook locator to the manifest's dotted code form.
 *
 *   chapter='12', section=undefined  -> '12'
 *   chapter='12', section='3'         -> '12.3'
 *   chapter='1',  section='2', subsection='2' -> '1.2.2'
 *
 * Returns null for paragraph / figure / table / intro shapes that don't map to
 * a registry entry.
 */
export function locatorToManifestCode(parsed: ParsedHandbooksLocator): string | null {
	if (parsed.figure !== undefined || parsed.table !== undefined) return null;
	if (parsed.paragraph !== undefined) {
		// Paragraph references resolve to the containing section.
		if (parsed.chapter === undefined || parsed.section === undefined) return null;
		return `${parsed.chapter}.${parsed.section}`;
	}
	if (parsed.section === 'intro') {
		// Chapter intro is not a separately-coded section in the manifest; it's
		// the chapter's `index.md` body. Return the chapter code.
		if (parsed.chapter === undefined) return null;
		return parsed.chapter;
	}
	if (parsed.chapter === undefined) return null;
	if (parsed.section === undefined) return parsed.chapter;
	if (parsed.subsection === undefined) return `${parsed.chapter}.${parsed.section}`;
	return `${parsed.chapter}.${parsed.section}.${parsed.subsection}`;
}

/**
 * Find the manifest section matching the parsed locator. Returns null when
 * the locator addresses a figure / table (no entry) or when no matching code
 * exists in the manifest.
 */
export function manifestSectionForLocator(
	manifest: ManifestFile,
	parsed: ParsedHandbooksLocator,
): ManifestSection | null {
	const code = locatorToManifestCode(parsed);
	if (code === null) return null;
	return manifest.sections.find((s) => s.code === code) ?? null;
}

/**
 * Repo-relative on-disk body path for a handbook entry. Combines the
 * derivative root with the manifest's `body_path` (which is itself
 * repo-relative starting at `handbooks/`). Returns null when the locator has
 * no manifest entry.
 *
 * The `body_path` shipped by PR #242 starts with `handbooks/...`; we strip
 * that prefix when joining to `root` (which already points at the
 * `handbooks/` directory).
 */
export function bodyPathForSection(section: ManifestSection, root: string): string {
	// Strip the leading `handbooks/` segment from `body_path` because `root`
	// already points at the `handbooks` directory.
	const relative = section.body_path.startsWith('handbooks/')
		? section.body_path.slice('handbooks/'.length)
		: section.body_path;
	return join(root, relative);
}
