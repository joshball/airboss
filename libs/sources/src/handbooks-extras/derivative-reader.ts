/**
 * Read handbooks-extras YAML config, cache manifests, and ingest derivatives.
 *
 * Source of truth: `scripts/sources/config/handbooks-extras.yaml` (the YAML
 * inventory), ADR 021 (cache manifest shape), and the ingest at `./ingest.ts`
 * which writes the derivative manifests this module reads back.
 *
 * On-disk shapes:
 *
 *   In cache (`<cache>/handbooks/<doc_id>/`):
 *     - `<doc_id>.pdf`        the FAA whole-doc PDF
 *     - `manifest.json`       `HandbookManifestFile` (downloader writes; we
 *                             read `primary` here for source_url + sha)
 *
 *   In repo derivatives (`<repo>/handbooks/<friendly-slug>/<faa-dir>/`):
 *     - `document.md`         full whole-doc body markdown
 *     - `manifest.json`       `ExtrasManifestFile` extends the chapter-aware
 *                             `ManifestFile` with `body_path` + empty
 *                             `sections[]` so the existing handbooks
 *                             resolver can read them.
 *
 *   Corpus-level (`<repo>/handbooks/handbooks-extras-index.json`):
 *     - `ExtrasCorpusIndex`  one entry per ingested handbook for audit.
 */

import { existsSync, readFileSync } from 'node:fs';
import {
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	CERT_APPLICABILITY_VALUES,
	type CertApplicability,
} from '@ab/constants';
import { parse as parseYaml } from 'yaml';
import type { ManifestFile, ManifestSection } from '../handbooks/derivative-reader.ts';

// ---------------------------------------------------------------------------
// YAML inventory
// ---------------------------------------------------------------------------

/**
 * One row of the handbooks-extras YAML config. The YAML is the canonical
 * source of truth for `subjects` + `primary_cert` on whole-doc handbooks
 * (per the post-WP-SUB convention) so `register handbooks-extras` can
 * write them into every produced manifest. Without that, the ingest
 * rewrites manifests cleanly each run and strips any fields it doesn't
 * author -- the bug surfaced by WP-MTN.
 */
export interface ExtrasYamlEntry {
	readonly doc_id: string;
	readonly edition: string | null;
	readonly url: string;
	readonly filename: string;
	/** Aviation topics this handbook covers. 1-3 entries, all from `AVIATION_TOPIC_VALUES`. Required. */
	readonly subjects: readonly AviationTopic[];
	/**
	 * Primary cert that owns this handbook for library-by-cert browsing,
	 * or `null` for cert-agnostic. Mirrors the column on `study.reference`.
	 */
	readonly primary_cert: CertApplicability | null;
}

export interface ExtrasYaml {
	readonly base_url: string;
	readonly entries: readonly ExtrasYamlEntry[];
}

/**
 * Resolve the path to `scripts/sources/config/handbooks-extras.yaml` from the
 * project root. The lib runs inside the same monorepo so `process.cwd()` at
 * CLI invocation time is the repo root; tests can override via the
 * `_resolveExtrasYamlPath` mechanism in the unit tests.
 */
let _yamlPathOverride: string | null = null;

export function _setHandbooksExtrasYamlPath(path: string | null): void {
	_yamlPathOverride = path;
}

function defaultYamlPath(): string {
	return `${process.cwd()}/scripts/sources/config/handbooks-extras.yaml`;
}

function isValidSubjects(value: unknown): value is AviationTopic[] {
	if (!Array.isArray(value)) return false;
	if (value.length < 1 || value.length > 3) return false;
	return value.every((v) => typeof v === 'string' && (AVIATION_TOPIC_VALUES as readonly string[]).includes(v));
}

function isValidPrimaryCert(value: unknown): value is CertApplicability | null {
	if (value === null) return true;
	return typeof value === 'string' && (CERT_APPLICABILITY_VALUES as readonly string[]).includes(value);
}

/**
 * Parse the handbooks-extras YAML config. Throws on missing file or malformed
 * shape. Re-reads on every call -- callers should cache if needed.
 *
 * Validates `subjects` (1-3 entries, each in `AVIATION_TOPIC_VALUES`) and
 * `primary_cert` (null or in `CERT_APPLICABILITY_VALUES`) so register
 * fails fast on a bad row instead of producing a manifest the seeder
 * later rejects.
 */
export function loadHandbooksExtrasYaml(): ExtrasYaml {
	const path = _yamlPathOverride ?? defaultYamlPath();
	if (!existsSync(path)) {
		throw new Error(`handbooks-extras YAML not found at ${path}`);
	}
	const raw = readFileSync(path, 'utf-8');
	const parsed = parseYaml(raw) as Partial<ExtrasYaml> | undefined;
	if (parsed === undefined || !Array.isArray(parsed.entries)) {
		throw new Error(`handbooks-extras YAML at ${path} missing entries[] array`);
	}
	if (typeof parsed.base_url !== 'string') {
		throw new Error(`handbooks-extras YAML at ${path} missing base_url`);
	}
	for (const e of parsed.entries) {
		if (typeof e.doc_id !== 'string' || typeof e.url !== 'string' || typeof e.filename !== 'string') {
			throw new Error(`handbooks-extras YAML at ${path} has malformed entry: ${JSON.stringify(e)}`);
		}
		if (!isValidSubjects(e.subjects)) {
			throw new Error(
				`handbooks-extras YAML at ${path} entry ${e.doc_id} has invalid subjects (require 1-3 from AVIATION_TOPIC_VALUES): ${JSON.stringify(e.subjects)}`,
			);
		}
		if (!('primary_cert' in e)) {
			throw new Error(
				`handbooks-extras YAML at ${path} entry ${e.doc_id} missing primary_cert (use null for cert-agnostic)`,
			);
		}
		if (!isValidPrimaryCert(e.primary_cert)) {
			throw new Error(
				`handbooks-extras YAML at ${path} entry ${e.doc_id} has invalid primary_cert (require null or one of CERT_APPLICABILITY_VALUES): ${JSON.stringify(e.primary_cert)}`,
			);
		}
	}
	return parsed as ExtrasYaml;
}

// ---------------------------------------------------------------------------
// Cache-side manifest (subset of the downloader's HandbookManifestFile)
// ---------------------------------------------------------------------------

interface CacheManifestPrimary {
	readonly source_url: string;
	readonly source_sha256: string;
	readonly source_filename: string;
	readonly fetched_at: string;
	readonly last_modified?: string;
}

export interface CacheManifest {
	readonly schema_version: number;
	readonly corpus: 'handbooks';
	readonly doc: string;
	readonly edition: string | null;
	readonly primary: CacheManifestPrimary;
}

function isPrimary(value: unknown): value is CacheManifestPrimary {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.source_url === 'string' &&
		typeof v.source_sha256 === 'string' &&
		typeof v.source_filename === 'string' &&
		typeof v.fetched_at === 'string'
	);
}

/**
 * Read a downloader-written cache manifest at the given path. Returns null
 * when the manifest does not exist or fails shape validation. Throws on
 * malformed JSON so caller can surface the error directly.
 */
export function readCacheManifest(path: string): CacheManifest | null {
	if (!existsSync(path)) return null;
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`handbooks-extras cache manifest is not valid JSON (${path}): ${(e as Error).message}`);
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const m = parsed as Partial<CacheManifest>;
	if (typeof m.schema_version !== 'number') return null;
	if (m.corpus !== 'handbooks') return null;
	if (typeof m.doc !== 'string') return null;
	if (!isPrimary(m.primary)) return null;
	return {
		schema_version: m.schema_version,
		corpus: 'handbooks',
		doc: m.doc,
		edition: typeof m.edition === 'string' ? m.edition : null,
		primary: m.primary,
	};
}

// ---------------------------------------------------------------------------
// Derivative-side manifest (extends `handbooks/derivative-reader.ManifestFile`)
// ---------------------------------------------------------------------------

/**
 * Per-handbook derivative manifest written by `ingest.ts`. Extends the
 * chapter-aware `ManifestFile` with the whole-doc fields (`body_path`,
 * `body_sha256`, `page_count`) and two extras-specific fields:
 *
 *   - `doc_id`: the FAA `doc_id` from the YAML (`faa-h-8083-2`), preserved
 *     for audit so a reader can round-trip back to the YAML inventory.
 *   - `faa_edition`: the FAA's published revision string (`'2A'`, `null`
 *     for `aviation-instructor`). Distinct from the `edition` slug used by
 *     the locator (`'8083-2A'`).
 *
 * `sections` is empty for whole-doc-only handbooks; the existing handbooks
 * resolver short-circuits on the `body_path` field instead.
 */
export interface ExtrasManifestFile extends ManifestFile {
	readonly sections: readonly ManifestSection[];
	readonly body_path: string;
	readonly body_sha256: string;
	readonly page_count: number;
	readonly doc_id: string;
	readonly faa_edition: string | null;
	/** Aviation topics, mirrored from the YAML row. Required by the post-WP-SUB seed. */
	readonly subjects: readonly AviationTopic[];
	/** Primary cert (or null = cert-agnostic), mirrored from the YAML row. */
	readonly primary_cert: CertApplicability | null;
}

// ---------------------------------------------------------------------------
// Corpus-level index
// ---------------------------------------------------------------------------

export interface ExtrasCorpusIndexEntry {
	readonly doc_id: string;
	readonly slug: string;
	readonly edition_slug: string;
	readonly faa_dir: string;
	readonly title: string;
	readonly publication_date: string | null;
	readonly manifest_path: string;
}

export interface ExtrasCorpusIndex {
	readonly schema_version: 1;
	readonly fetched_at: string;
	readonly entries: readonly ExtrasCorpusIndexEntry[];
}

/**
 * Read the corpus-level catalog at
 * `<root>/handbooks-extras-index.json`. Returns null when the file does not
 * exist (corpus has not been ingested yet).
 */
export function readExtrasCorpusIndex(root: string): ExtrasCorpusIndex | null {
	const path = `${root}/handbooks-extras-index.json`;
	if (!existsSync(path)) return null;
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`handbooks-extras index is not valid JSON (${path}): ${(e as Error).message}`);
	}
	const idx = parsed as Partial<ExtrasCorpusIndex>;
	if (idx.schema_version !== 1 || !Array.isArray(idx.entries) || typeof idx.fetched_at !== 'string') {
		throw new Error(`handbooks-extras index at ${path} is malformed`);
	}
	return idx as ExtrasCorpusIndex;
}
