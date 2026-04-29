/**
 * Per-corpus manifest reader/writer.
 *
 * Per ADR 021, the cache uses two manifest shapes:
 *
 *   - Flat corpora (AC, ACS, AIM): one `<corpus>/manifest.json` with an
 *     `entries[]` array indexing every doc downloaded for that corpus.
 *   - Regs: one `regulations/cfr-<title>/manifest.json` per CFR title.
 *   - Handbooks: one `handbooks/<slug>/<edition>/manifest.json` per cached
 *     edition, holding `primary` + `errata[]` (errata wired by the Python
 *     ingest, not the TS downloader).
 *
 * Writes go through tmp+rename for atomicity. The downloader runs single-
 * threaded per corpus so concurrent invocations are not supported (and never
 * have been).
 *
 * The downloader only reads/writes `entries[]` for AC/ACS/AIM/regs and
 * `primary` for handbooks. Errata entries are managed by the Python pipeline.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Corpus } from './args';
import type { DownloadPlan } from './plans';

export interface ManifestEntry {
	readonly corpus: Corpus;
	readonly doc: string;
	readonly edition: string | null;
	readonly source_url: string;
	readonly source_filename: string;
	readonly source_sha256: string;
	readonly size_bytes: number;
	readonly fetched_at: string;
	readonly last_modified?: string;
	readonly etag?: string;
	readonly schema_version: number;
}

export interface CorpusManifestFile {
	readonly schema_version: number;
	readonly corpus: Corpus;
	readonly entries: readonly ManifestEntry[];
}

export interface HandbookManifestFile {
	readonly schema_version: number;
	readonly corpus: 'handbooks';
	readonly doc: string;
	readonly edition: string | null;
	readonly primary: ManifestEntry;
	readonly errata?: readonly ManifestEntry[];
}

/**
 * Resolve the path to the manifest file that owns a plan's entry.
 *
 *   - handbooks: per-edition at `handbooks/<slug>/<edition>/manifest.json`,
 *     co-located with the PDF; the slug is the dir, and (when edition is
 *     non-null) is the edition dir, but for handbooks-extras the slug already
 *     encodes edition so the manifest sits next to the file.
 *   - regs: per-title at `regulations/cfr-<title>/manifest.json`.
 *   - aim/ac/acs: per-corpus at `<corpus>/manifest.json`.
 */
export function manifestPathFor(plan: DownloadPlan): string {
	if (plan.corpus === 'handbooks') {
		return join(dirname(plan.destPath), 'manifest.json');
	}
	if (plan.corpus === 'regs') {
		// destPath is `<root>/regulations/cfr-<title>/<edition>...xml`. The
		// per-title manifest sits next to the XML files.
		return join(dirname(plan.destPath), 'manifest.json');
	}
	// AC, ACS, AIM: per-corpus manifest one level up from the file.
	return join(dirname(plan.destPath), 'manifest.json');
}

function entryKey(entry: { doc: string; edition: string | null }): string {
	return `${entry.doc}@${entry.edition ?? ''}`;
}

function readJsonOrNull(path: string): unknown {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, 'utf-8'));
	} catch {
		return null;
	}
}

function writeAtomic(path: string, contents: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, contents, 'utf-8');
	renameSync(tmp, path);
}

function isEntry(value: unknown): value is ManifestEntry {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.source_url === 'string' &&
		typeof v.source_sha256 === 'string' &&
		typeof v.size_bytes === 'number' &&
		typeof v.source_filename === 'string'
	);
}

function readCorpusManifest(path: string): CorpusManifestFile | null {
	const raw = readJsonOrNull(path);
	if (raw === null || typeof raw !== 'object') return null;
	const r = raw as Partial<CorpusManifestFile>;
	if (!Array.isArray(r.entries)) return null;
	const entries = r.entries.filter(isEntry);
	if (typeof r.schema_version !== 'number' || typeof r.corpus !== 'string') return null;
	return { schema_version: r.schema_version, corpus: r.corpus as Corpus, entries };
}

function readHandbookManifest(path: string): HandbookManifestFile | null {
	const raw = readJsonOrNull(path);
	if (raw === null || typeof raw !== 'object') return null;
	const r = raw as Partial<HandbookManifestFile>;
	if (!isEntry(r.primary)) return null;
	if (typeof r.schema_version !== 'number' || r.corpus !== 'handbooks') return null;
	const errata = Array.isArray(r.errata) ? r.errata.filter(isEntry) : undefined;
	return {
		schema_version: r.schema_version,
		corpus: 'handbooks',
		doc: typeof r.doc === 'string' ? r.doc : '',
		edition: typeof r.edition === 'string' ? r.edition : null,
		primary: r.primary,
		...(errata !== undefined ? { errata } : {}),
	};
}

/**
 * Read the manifest entry for a single download plan. Returns null when no
 * matching record is present (e.g. fresh cache, manifest missing/corrupt, or
 * the entry was never written).
 */
export function readManifestEntry(plan: DownloadPlan): ManifestEntry | null {
	const path = manifestPathFor(plan);
	if (plan.corpus === 'handbooks') {
		const manifest = readHandbookManifest(path);
		if (manifest === null) return null;
		// The downloader only touches `primary`. Errata are downloaded by the
		// Python pipeline and don't flow through this reader.
		return manifest.primary;
	}
	const manifest = readCorpusManifest(path);
	if (manifest === null) return null;
	const key = entryKey(plan);
	return manifest.entries.find((e) => entryKey(e) === key) ?? null;
}

/**
 * Insert or replace the manifest record for a single plan, writing atomically.
 */
export function writeManifestEntry(plan: DownloadPlan, entry: ManifestEntry): void {
	const path = manifestPathFor(plan);
	if (plan.corpus === 'handbooks') {
		const existing = readHandbookManifest(path);
		const next: HandbookManifestFile = {
			schema_version: entry.schema_version,
			corpus: 'handbooks',
			doc: plan.doc,
			edition: plan.edition,
			primary: entry,
			...(existing !== undefined && existing !== null && existing.errata !== undefined && existing.errata.length > 0
				? { errata: existing.errata }
				: {}),
		};
		writeAtomic(path, `${JSON.stringify(next, null, 2)}\n`);
		return;
	}

	const existing = readCorpusManifest(path);
	const key = entryKey(entry);
	const merged: ManifestEntry[] = [];
	if (existing !== null) {
		for (const e of existing.entries) {
			if (entryKey(e) !== key) merged.push(e);
		}
	}
	merged.push(entry);
	merged.sort((a, b) => entryKey(a).localeCompare(entryKey(b)));
	const file: CorpusManifestFile = {
		schema_version: entry.schema_version,
		corpus: plan.corpus,
		entries: merged,
	};
	writeAtomic(path, `${JSON.stringify(file, null, 2)}\n`);
}
