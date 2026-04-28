/**
 * Phase 10 (slice) -- read ACS derivatives.
 *
 * The on-disk shape (per ADR 018; mirrors `libs/sources/src/ac/derivative-reader.ts`,
 * adopting the cert-syllabus WP's locked Q7 locator format):
 *
 *   acs/index.json                                                    corpus-level catalog
 *   acs/<slug>/manifest.json                                          per-publication manifest
 *   acs/<slug>/area-<NN>/task-<letter>.md                             per-task body markdown
 *
 * Where `<slug>` is the locked publication slug (e.g. `ppl-airplane-6c`)
 * and `<NN>` is the 2-digit zero-padded area ordinal. Cert + edition
 * collapse into the slug per the locked Q7 resolution.
 *
 * The task body file is the unit of derivative storage for the slice -- one
 * file per Task, holding the full task block (References, Objective, Note,
 * Knowledge / Risk Management / Skills with every K/R/S element bullet
 * verbatim). Per-element body files are deliberately not produced: ACS
 * elements are mostly single-sentence atoms, and the renderer can extract
 * an element from its task body via the element id (`PA.I.C.K3`) when the
 * `@text` token is bound to an element identifier.
 *
 * The corpus-level `acs/index.json` is the audit-trail / discovery surface:
 * one entry per ingested publication slug, with publication date +
 * source_sha256. The resolver consults it to enumerate the corpus without
 * walking the directory tree.
 *
 * Source of truth: ADR 019 §1.2 (`acs` URI shape), ADR 018 (storage policy),
 * cert-syllabus WP locked Q7 (2026-04-27).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Per-publication manifest. One file per publication slug under
 * `acs/<slug>/manifest.json`.
 */
export interface AcsManifestFile {
	readonly schema_version: 1;
	readonly corpus: 'acs';
	/** Publication slug (matches `ACS_PUBLICATION_SLUGS` in `locator.ts`). E.g. `'ppl-airplane-6c'`. */
	readonly slug: string;
	/** Title from the ACS cover page. */
	readonly title: string;
	/** Publisher (always "FAA" for ACSs). */
	readonly publisher: 'FAA';
	/** ISO `YYYY-MM-DD` publication / effective date detected on the cover page (or null when not detectable). */
	readonly publication_date: string | null;
	readonly source_url: string;
	readonly source_sha256: string;
	readonly fetched_at: string;
	/** Page count from `pdfinfo`. */
	readonly page_count: number;
	/** Per-area structure (Area of Operation -> Tasks -> Elements). */
	readonly areas: readonly AcsManifestArea[];
}

export interface AcsManifestArea {
	/** 2-digit zero-padded area ordinal (e.g. `'05'` for Area V). */
	readonly area: string;
	/** Area title from the heading (e.g. `'Preflight Preparation'`). */
	readonly title: string;
	readonly tasks: readonly AcsManifestTask[];
}

export interface AcsManifestTask {
	/** Task letter, lowercased (e.g. `'a'`). */
	readonly task: string;
	/** Task title from the heading (e.g. `'Pilot Qualifications'`). */
	readonly title: string;
	/** Repo-relative path to the task body markdown. */
	readonly body_path: string;
	readonly body_sha256: string;
	/** Per-element entries (knowledge / risk-management / skill). */
	readonly elements: readonly AcsManifestElement[];
}

export interface AcsManifestElement {
	/** Triad letter -- `'k'`, `'r'`, or `'s'`. */
	readonly triad: 'k' | 'r' | 's';
	/** 2-digit zero-padded ordinal (`'01'`, `'02'`, ...). Sub-lettered children (`PA.I.C.K3a`) collapse into the parent's body. */
	readonly ordinal: string;
	/** Full code as printed in the PDF (`PA.I.C.K3`). Useful for in-body element-extraction. */
	readonly code: string;
	/** First-sentence summary (no sub-letter expansion). Long lines truncated to 280 chars. */
	readonly title: string;
}

/**
 * Corpus-level `acs/index.json`. Lists every ingested publication slug so
 * the resolver can enumerate without filesystem walking.
 */
export interface AcsCorpusIndex {
	readonly schema_version: 1;
	readonly fetched_at: string;
	readonly entries: readonly AcsCorpusIndexEntry[];
}

export interface AcsCorpusIndexEntry {
	readonly slug: string;
	readonly title: string;
	readonly publication_date: string | null;
	readonly manifest_path: string;
}

/**
 * Read the corpus-level catalog at `<root>/index.json`. Returns null when the
 * file does not exist (corpus has not been ingested yet).
 */
export function readCorpusIndex(root: string): AcsCorpusIndex | null {
	const path = join(root, 'index.json');
	if (!existsSync(path)) return null;
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`acs corpus index is not valid JSON (${path}): ${(e as Error).message}`);
	}
	const idx = parsed as Partial<AcsCorpusIndex>;
	if (idx.schema_version !== 1 || !Array.isArray(idx.entries) || typeof idx.fetched_at !== 'string') {
		throw new Error(`acs corpus index at ${path} is malformed`);
	}
	return idx as AcsCorpusIndex;
}

/**
 * Read a per-publication manifest at `<root>/<slug>/manifest.json`.
 * Throws when the file is missing or required fields are absent.
 */
export function readAcsManifest(root: string, slug: string): AcsManifestFile {
	const path = join(root, slug, 'manifest.json');
	if (!existsSync(path)) {
		throw new Error(`acs manifest not found: ${path}`);
	}
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`acs manifest is not valid JSON (${path}): ${(e as Error).message}`);
	}
	const m = parsed as Partial<AcsManifestFile>;
	const required: readonly (keyof AcsManifestFile)[] = [
		'schema_version',
		'corpus',
		'slug',
		'title',
		'source_url',
		'source_sha256',
		'fetched_at',
	];
	for (const key of required) {
		if (m[key] === undefined) {
			throw new Error(`acs manifest at ${path} missing required field: ${String(key)}`);
		}
	}
	if (!Array.isArray(m.areas)) {
		throw new Error(`acs manifest at ${path}: areas must be an array`);
	}
	return m as AcsManifestFile;
}
