/**
 * Phase 7 -- read AIM derivatives.
 *
 * The on-disk shape (per ADR 018):
 *
 *   aim/<edition>/manifest.json
 *   aim/<edition>/chapter-<N>/index.md                                 chapter body
 *   aim/<edition>/chapter-<N>/section-<M>/index.md                     section body
 *   aim/<edition>/chapter-<N>/section-<M>/paragraph-<K>.md             paragraph body
 *   aim/<edition>/glossary/<slug>.md                                   glossary entry body
 *   aim/<edition>/appendix-<N>.md                                      appendix body
 *
 * Live AIM source-document ingestion (PDF / HTML -> derivatives) is a
 * separate operator pipeline outside this WP. Phase 7 only reads existing
 * derivatives.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedAimLocator } from '../types.ts';

/**
 * Per-entry record from the manifest's `entries[]` array.
 */
export interface ManifestEntry {
	readonly kind: 'chapter' | 'section' | 'paragraph' | 'glossary' | 'appendix';
	/**
	 * Locator code:
	 *   chapter   -> '5'
	 *   section   -> '5-1'
	 *   paragraph -> '5-1-7'
	 *   glossary  -> 'glossary/pilot-in-command'
	 *   appendix  -> 'appendix-1'
	 */
	readonly code: string;
	readonly title: string;
	/** Repo-relative path of the body markdown, starting with `aim/`. */
	readonly body_path: string;
	readonly content_hash: string;
}

/**
 * Top-level shape of `aim/<edition>/manifest.json`.
 */
export interface ManifestFile {
	readonly edition: string;
	readonly kind: string;
	readonly title: string;
	readonly publisher: string;
	readonly source_url: string;
	readonly source_checksum: string;
	readonly fetched_at: string;
	readonly entries: readonly ManifestEntry[];
}

/**
 * Read and validate `aim/<edition>/manifest.json` from `root`. Throws when
 * the file is missing or required fields are absent.
 */
export function readManifest(edition: string, root: string): ManifestFile {
	const path = join(root, edition, 'manifest.json');
	if (!existsSync(path)) {
		throw new Error(`aim manifest not found: ${path}`);
	}
	const raw = readFileSync(path, 'utf-8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new Error(`aim manifest is not valid JSON (${path}): ${(e as Error).message}`);
	}
	const manifest = parsed as Partial<ManifestFile>;
	const required: readonly (keyof ManifestFile)[] = [
		'edition',
		'kind',
		'title',
		'publisher',
		'source_url',
		'fetched_at',
		'entries',
	];
	for (const key of required) {
		if (manifest[key] === undefined) {
			throw new Error(`aim manifest at ${path} missing required field: ${key}`);
		}
	}
	if (!Array.isArray(manifest.entries)) {
		throw new Error(`aim manifest at ${path}: entries must be an array`);
	}
	return manifest as ManifestFile;
}

/**
 * Map a parsed AIM locator to the manifest's code form.
 *
 *   { chapter: '5' }                              -> '5'
 *   { chapter: '5', section: '1' }                -> '5-1'
 *   { chapter: '5', section: '1', paragraph: '7' } -> '5-1-7'
 *   { glossarySlug: 'pilot-in-command' }          -> 'glossary/pilot-in-command'
 *   { appendix: '1' }                             -> 'appendix-1'
 */
export function locatorToManifestCode(parsed: ParsedAimLocator): string | null {
	if (parsed.glossarySlug !== undefined) {
		return `glossary/${parsed.glossarySlug}`;
	}
	if (parsed.appendix !== undefined) {
		return `appendix-${parsed.appendix}`;
	}
	if (parsed.chapter === undefined) return null;
	if (parsed.section === undefined) return parsed.chapter;
	if (parsed.paragraph === undefined) return `${parsed.chapter}-${parsed.section}`;
	return `${parsed.chapter}-${parsed.section}-${parsed.paragraph}`;
}

/**
 * Find the manifest entry matching the parsed locator. Returns null when no
 * matching code exists in the manifest.
 */
export function manifestEntryForLocator(manifest: ManifestFile, parsed: ParsedAimLocator): ManifestEntry | null {
	const code = locatorToManifestCode(parsed);
	if (code === null) return null;
	return manifest.entries.find((e) => e.code === code) ?? null;
}

/**
 * Repo-relative on-disk body path for an AIM entry. Combines the derivative
 * root with the manifest's `body_path`. The `body_path` starts with `aim/`;
 * we strip that prefix when joining to `root` (which already points at the
 * `aim/` directory).
 */
export function bodyPathForEntry(entry: ManifestEntry, root: string): string {
	const relative = entry.body_path.startsWith('aim/') ? entry.body_path.slice('aim/'.length) : entry.body_path;
	return join(root, relative);
}
