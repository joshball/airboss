/**
 * Per-corpus manifest reader/writer.
 *
 * Per ADR 021 + ADR 022, the cache uses three manifest shapes:
 *
 *   - Flat corpora (AC, ACS): one `<corpus>/manifest.json` with an
 *     `entries[]` array indexing every doc downloaded for that corpus.
 *   - Regs: one `regulations/cfr-<title>/manifest.json` per CFR title.
 *   - Handbooks: one `handbooks/<slug>/<edition>/manifest.json` per cached
 *     edition, holding `primary` + `chapters[]` + `ancillary[]` + `errata[]`.
 *   - AIM: one `aim/manifest.json` corpus-wide, holding `primary` + `sections[]`
 *     + `appendices[]`.
 *
 * Writes go through tmp+rename for atomicity. The downloader runs single-
 * threaded per corpus so concurrent invocations are not supported (and never
 * have been).
 *
 * The downloader writes:
 *   - `entries[]` for AC/ACS/regs and handbooks-extras (whole-doc-only).
 *   - `primary` + `chapters[]` + `ancillary[]` for chapter-aware handbooks.
 *   - `primary` + `sections[]` + `appendices[]` for AIM.
 * Errata entries on handbook manifests are managed by the Python ingest
 * pipeline; we preserve them across writes.
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

/**
 * Chapter-PDF artifact in a per-handbook manifest. `chapter_page_url` is the
 * intermediate two-hop chapter HTML page URL; null for direct-pattern
 * handbooks (AFH, IPH, etc.).
 */
export interface ChapterArtifact extends ManifestEntry {
	readonly ordinal: number;
	readonly chapter_page_url: string | null;
}

export interface AncillaryArtifact extends ManifestEntry {
	readonly ancillary_kind: 'front' | 'toc' | 'glossary' | 'index' | 'appendix';
	readonly appendix_id: string | null;
}

export interface AimSectionArtifact extends ManifestEntry {
	readonly chapter: number;
	readonly section: number;
}

export interface AimAppendixArtifact extends ManifestEntry {
	readonly ordinal: number;
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
	readonly chapters?: readonly ChapterArtifact[];
	readonly ancillary?: readonly AncillaryArtifact[];
	readonly errata?: readonly ManifestEntry[];
}

export interface AimCorpusManifestFile {
	readonly schema_version: number;
	readonly corpus: 'aim';
	readonly primary: ManifestEntry;
	readonly sections: readonly AimSectionArtifact[];
	readonly appendices: readonly AimAppendixArtifact[];
}

/**
 * Resolve the path to the manifest file that owns a plan's entry.
 *
 *   - chapter-aware handbooks: per-edition at
 *     `handbooks/<slug>/<edition>/manifest.json`, co-located with the
 *     whole-doc + chapter PDFs + ancillaries.
 *   - flat handbooks (handbooks-extras whole-doc-only): per-handbook at
 *     `handbooks/<slug>/manifest.json` (slug already encodes edition).
 *   - regs: per-title at `regulations/cfr-<title>/manifest.json`.
 *   - AC, ACS: per-corpus at `<corpus>/manifest.json`.
 *   - AIM: corpus-wide at `aim/manifest.json` (one manifest per corpus, all
 *     section + appendix HTML + bundled PDF entries co-located).
 */
export function manifestPathFor(plan: DownloadPlan): string {
	if (plan.corpus === 'handbooks') {
		// For chapter-aware handbooks the destPath is
		// `<root>/handbooks/<slug>/<edition>/<filename>`; the manifest sits in
		// that edition dir. For handbooks-extras it's `<root>/handbooks/<slug>/<doc>.pdf`;
		// the manifest sits in that slug dir. dirname(destPath) is the right
		// answer in both cases.
		return join(dirname(plan.destPath), 'manifest.json');
	}
	if (plan.corpus === 'regs') {
		return join(dirname(plan.destPath), 'manifest.json');
	}
	if (plan.corpus === 'aim') {
		return join(dirname(plan.destPath), 'manifest.json');
	}
	// AC, ACS: per-corpus manifest one level up from the file.
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

function isChapterArtifact(value: unknown): value is ChapterArtifact {
	if (!isEntry(value)) return false;
	const v = value as unknown as Record<string, unknown>;
	return typeof v.ordinal === 'number';
}

function isAncillaryArtifact(value: unknown): value is AncillaryArtifact {
	if (!isEntry(value)) return false;
	const v = value as unknown as Record<string, unknown>;
	return typeof v.ancillary_kind === 'string';
}

function isAimSectionArtifact(value: unknown): value is AimSectionArtifact {
	if (!isEntry(value)) return false;
	const v = value as unknown as Record<string, unknown>;
	return typeof v.chapter === 'number' && typeof v.section === 'number';
}

function isAimAppendixArtifact(value: unknown): value is AimAppendixArtifact {
	if (!isEntry(value)) return false;
	const v = value as unknown as Record<string, unknown>;
	return typeof v.ordinal === 'number';
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
	const chapters = Array.isArray(r.chapters) ? r.chapters.filter(isChapterArtifact) : undefined;
	const ancillary = Array.isArray(r.ancillary) ? r.ancillary.filter(isAncillaryArtifact) : undefined;
	const errata = Array.isArray(r.errata) ? r.errata.filter(isEntry) : undefined;
	return {
		schema_version: r.schema_version,
		corpus: 'handbooks',
		doc: typeof r.doc === 'string' ? r.doc : '',
		edition: typeof r.edition === 'string' ? r.edition : null,
		primary: r.primary,
		...(chapters !== undefined ? { chapters } : {}),
		...(ancillary !== undefined ? { ancillary } : {}),
		...(errata !== undefined ? { errata } : {}),
	};
}

function readAimCorpusManifest(path: string): AimCorpusManifestFile | null {
	const raw = readJsonOrNull(path);
	if (raw === null || typeof raw !== 'object') return null;
	const r = raw as Partial<AimCorpusManifestFile>;
	if (typeof r.schema_version !== 'number' || r.corpus !== 'aim') return null;
	if (!isEntry(r.primary)) return null;
	const sections = Array.isArray(r.sections) ? r.sections.filter(isAimSectionArtifact) : [];
	const appendices = Array.isArray(r.appendices) ? r.appendices.filter(isAimAppendixArtifact) : [];
	return {
		schema_version: r.schema_version,
		corpus: 'aim',
		primary: r.primary,
		sections,
		appendices,
	};
}

/**
 * Read the manifest entry for a single download plan. Returns null when no
 * matching record is present.
 */
export function readManifestEntry(plan: DownloadPlan): ManifestEntry | null {
	const path = manifestPathFor(plan);
	if (plan.corpus === 'handbooks') {
		const manifest = readHandbookManifest(path);
		if (manifest === null) return null;
		if (plan.kind === 'whole-doc') return manifest.primary;
		if (plan.kind === 'chapter-pdf' && plan.ordinal !== null) {
			return manifest.chapters?.find((c) => c.ordinal === plan.ordinal) ?? null;
		}
		if (plan.kind === 'ancillary-pdf' && plan.ancillaryKind !== null) {
			return manifest.ancillary?.find((a) => a.ancillary_kind === plan.ancillaryKind) ?? null;
		}
		if (plan.kind === 'flat-pdf') return manifest.primary;
		return null;
	}
	if (plan.corpus === 'aim') {
		const manifest = readAimCorpusManifest(path);
		if (manifest === null) return null;
		if (plan.kind === 'whole-doc') return manifest.primary;
		if (plan.kind === 'aim-section' && plan.ordinal !== null && plan.section !== null) {
			return manifest.sections.find((s) => s.chapter === plan.ordinal && s.section === plan.section) ?? null;
		}
		if (plan.kind === 'aim-appendix' && plan.ordinal !== null) {
			return manifest.appendices.find((a) => a.ordinal === plan.ordinal) ?? null;
		}
		return null;
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
		writeHandbookEntry(path, plan, entry);
		return;
	}

	if (plan.corpus === 'aim') {
		writeAimEntry(path, plan, entry);
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

function writeHandbookEntry(path: string, plan: DownloadPlan, entry: ManifestEntry): void {
	const existing = readHandbookManifest(path);
	const existingChapters = existing?.chapters ?? [];
	const existingAncillary = existing?.ancillary ?? [];
	const existingErrata = existing?.errata ?? [];
	const existingPrimary = existing?.primary;

	let primary: ManifestEntry = existingPrimary ?? entry;
	let chapters: ChapterArtifact[] = [...existingChapters];
	let ancillary: AncillaryArtifact[] = [...existingAncillary];

	if (plan.kind === 'whole-doc' || plan.kind === 'flat-pdf') {
		primary = entry;
	} else if (plan.kind === 'chapter-pdf' && plan.ordinal !== null) {
		const ord = plan.ordinal;
		chapters = chapters.filter((c) => c.ordinal !== ord);
		chapters.push({ ...entry, ordinal: ord, chapter_page_url: plan.chapterPageUrl });
		chapters.sort((a, b) => a.ordinal - b.ordinal);
	} else if (plan.kind === 'ancillary-pdf' && plan.ancillaryKind !== null) {
		const kind = plan.ancillaryKind;
		// Use ancillary kind + appendix_id as identity (multiple appendices possible).
		const appendixId = kind === 'appendix' ? null : null; // future: parse from URL
		ancillary = ancillary.filter((a) => !(a.ancillary_kind === kind && a.appendix_id === appendixId));
		ancillary.push({ ...entry, ancillary_kind: kind, appendix_id: appendixId });
		ancillary.sort((a, b) => a.ancillary_kind.localeCompare(b.ancillary_kind));
	}

	const next: HandbookManifestFile = {
		schema_version: entry.schema_version,
		corpus: 'handbooks',
		doc: plan.doc,
		edition: plan.edition,
		primary,
		...(chapters.length > 0 ? { chapters } : {}),
		...(ancillary.length > 0 ? { ancillary } : {}),
		...(existingErrata.length > 0 ? { errata: existingErrata } : {}),
	};
	writeAtomic(path, `${JSON.stringify(next, null, 2)}\n`);
}

function writeAimEntry(path: string, plan: DownloadPlan, entry: ManifestEntry): void {
	const existing = readAimCorpusManifest(path);
	const existingSections = existing?.sections ?? [];
	const existingAppendices = existing?.appendices ?? [];
	let primary: ManifestEntry = existing?.primary ?? entry;
	let sections: AimSectionArtifact[] = [...existingSections];
	let appendices: AimAppendixArtifact[] = [...existingAppendices];

	if (plan.kind === 'whole-doc') {
		primary = entry;
	} else if (plan.kind === 'aim-section' && plan.ordinal !== null && plan.section !== null) {
		const chapter = plan.ordinal;
		const section = plan.section;
		sections = sections.filter((s) => !(s.chapter === chapter && s.section === section));
		sections.push({ ...entry, chapter, section });
		sections.sort((a, b) => a.chapter - b.chapter || a.section - b.section);
	} else if (plan.kind === 'aim-appendix' && plan.ordinal !== null) {
		const ord = plan.ordinal;
		appendices = appendices.filter((a) => a.ordinal !== ord);
		appendices.push({ ...entry, ordinal: ord });
		appendices.sort((a, b) => a.ordinal - b.ordinal);
	}

	const next: AimCorpusManifestFile = {
		schema_version: entry.schema_version,
		corpus: 'aim',
		primary,
		sections,
		appendices,
	};
	writeAtomic(path, `${JSON.stringify(next, null, 2)}\n`);
}

/**
 * Read the full handbook manifest for a slug+edition, including chapters,
 * ancillaries, and errata. Returns null when missing or invalid. Used by
 * inventory and verify-urls.
 */
export function readHandbookManifestFile(path: string): HandbookManifestFile | null {
	return readHandbookManifest(path);
}

/**
 * Read the full AIM corpus manifest. Returns null when missing or invalid.
 */
export function readAimCorpusManifestFile(path: string): AimCorpusManifestFile | null {
	return readAimCorpusManifest(path);
}

/**
 * Read the full corpus (AC/ACS/regs/handbooks-extras) manifest at a path.
 * Returns null when missing or invalid.
 */
export function readCorpusManifestFile(path: string): CorpusManifestFile | null {
	return readCorpusManifest(path);
}
