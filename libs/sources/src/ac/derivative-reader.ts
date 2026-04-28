/**
 * Phase 8 -- read AC derivatives.
 *
 * The on-disk shape (per ADR 018):
 *
 *   ac/index.json                                    corpus-level catalog
 *   ac/<doc-slug>/<rev>/manifest.json                per-AC manifest
 *   ac/<doc-slug>/<rev>/document.md                  full document body
 *   ac/<doc-slug>/<rev>/section-<n>.md               optional per-section body
 *   ac/<doc-slug>/<rev>/change-<n>.md                optional Change body
 *
 * The doc slug is the FAA's catalog number with dots replaced by dashes for
 * filesystem safety (`91-21-1` for AC 91-21.1). The `manifest.json` records
 * the canonical doc number with dots preserved so the locator round-trips.
 *
 * The corpus-level `ac/index.json` is the audit-trail / discovery surface:
 * one entry per ingested (doc, rev) pair, with publication date + source_sha256
 * + body hash. The resolver consults it to enumerate the corpus without
 * walking the directory tree.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Per-AC manifest. One file per (doc, rev) pair under `ac/<doc-slug>/<rev>/`.
 */
export interface AcManifestFile {
	readonly schema_version: 1;
	readonly corpus: 'ac';
	/** Filesystem-safe slug (dots -> dashes), e.g. `91-21-1` for AC 91-21.1. */
	readonly doc_slug: string;
	/** Canonical doc number with dots preserved (`91-21.1`). Round-trips with the locator. */
	readonly doc_number: string;
	/** Lowercased revision letter (`j`, `b`, `d`). */
	readonly revision: string;
	/** Title from the AC cover page. */
	readonly title: string;
	/** Publisher (always "FAA" for ACs). */
	readonly publisher: 'FAA';
	/** ISO `YYYY-MM-DD` publication date detected on the cover page (or null when not detectable). */
	readonly publication_date: string | null;
	readonly source_url: string;
	readonly source_sha256: string;
	readonly fetched_at: string;
	/** Page count from `pdfinfo`. */
	readonly page_count: number;
	/** Repo-relative path to the full document markdown. */
	readonly body_path: string;
	readonly body_sha256: string;
	/** Optional per-section bodies. Phase 8.1 keeps this empty; section-level extraction is a follow-up. */
	readonly sections: readonly AcManifestSection[];
	/** Optional per-Change bodies. Filled when an AC has Changes issued against it. */
	readonly changes: readonly AcManifestChange[];
}

export interface AcManifestSection {
	readonly section: string;
	readonly title: string;
	readonly body_path: string;
	readonly body_sha256: string;
}

export interface AcManifestChange {
	readonly change: string;
	readonly issued_date: string;
	readonly body_path: string;
	readonly body_sha256: string;
}

/**
 * Corpus-level `ac/index.json`. Lists every ingested (doc, rev) pair so the
 * resolver can enumerate without filesystem walking.
 */
export interface AcCorpusIndex {
	readonly schema_version: 1;
	readonly fetched_at: string;
	readonly entries: readonly AcCorpusIndexEntry[];
}

export interface AcCorpusIndexEntry {
	readonly doc_slug: string;
	readonly doc_number: string;
	readonly revision: string;
	readonly title: string;
	readonly publication_date: string | null;
	readonly manifest_path: string;
}

/**
 * Read the corpus-level catalog at `<root>/index.json`. Returns null when the
 * file does not exist (corpus has not been ingested yet).
 */
export function readCorpusIndex(root: string): AcCorpusIndex | null {
	const path = join(root, 'index.json');
	if (!existsSync(path)) return null;
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`ac corpus index is not valid JSON (${path}): ${(e as Error).message}`);
	}
	const idx = parsed as Partial<AcCorpusIndex>;
	if (idx.schema_version !== 1 || !Array.isArray(idx.entries) || typeof idx.fetched_at !== 'string') {
		throw new Error(`ac corpus index at ${path} is malformed`);
	}
	return idx as AcCorpusIndex;
}

/**
 * Read a per-AC manifest at `<root>/<doc-slug>/<rev>/manifest.json`. Throws
 * when the file is missing or required fields are absent.
 */
export function readAcManifest(root: string, docSlug: string, revision: string): AcManifestFile {
	const path = join(root, docSlug, revision, 'manifest.json');
	if (!existsSync(path)) {
		throw new Error(`ac manifest not found: ${path}`);
	}
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`ac manifest is not valid JSON (${path}): ${(e as Error).message}`);
	}
	const m = parsed as Partial<AcManifestFile>;
	const required: readonly (keyof AcManifestFile)[] = [
		'schema_version',
		'corpus',
		'doc_slug',
		'doc_number',
		'revision',
		'title',
		'source_url',
		'source_sha256',
		'fetched_at',
		'body_path',
		'body_sha256',
	];
	for (const key of required) {
		if (m[key] === undefined) {
			throw new Error(`ac manifest at ${path} missing required field: ${String(key)}`);
		}
	}
	if (!Array.isArray(m.sections)) {
		throw new Error(`ac manifest at ${path}: sections must be an array`);
	}
	if (!Array.isArray(m.changes)) {
		throw new Error(`ac manifest at ${path}: changes must be an array`);
	}
	return m as AcManifestFile;
}

/**
 * Compute the filesystem-safe doc slug from the canonical doc number. Replaces
 * dots with dashes so paths are filesystem-safe and case-stable on macOS.
 *
 *   '61-65'  -> '61-65'
 *   '91-21.1' -> '91-21-1'
 *   '00-6'   -> '00-6'
 */
export function docSlugFromDocNumber(docNumber: string): string {
	return docNumber.replace(/\./g, '-');
}
