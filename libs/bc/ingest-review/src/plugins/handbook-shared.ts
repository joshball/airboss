/**
 * Shared helpers for the handbook-* plugins.
 *
 * Reads `handbooks/<slug>/<edition>/warnings.json` + `manifest.json` from
 * the in-tree handbook directory. The handbooks repository ships its
 * extracted derivatives in-tree (per ADR 018: source bytes live in the
 * developer-local cache, but extracted manifest + section bodies are
 * committed). The plugins read those derivatives only -- they never
 * touch the source PDF.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * One row in `<edition>/warnings.json`'s `warnings` array.
 */
export interface WarningEntry {
	id: string;
	code: string;
	section_code: string | null;
	message: string;
}

export interface WarningsFile {
	schema_version: number;
	document_slug: string;
	edition: string;
	manifest_sha256: string;
	generated_at: string;
	warnings: readonly WarningEntry[];
}

/**
 * One row in `<edition>/manifest.json`'s `figures` array.
 */
export interface FigureManifestEntry {
	id: string;
	section_code: string;
	ordinal: number;
	caption: string;
	asset_path: string;
	width: number;
	height: number;
	caption_page_num?: number | null;
}

export interface ManifestFile {
	document_slug: string;
	edition: string;
	figures: readonly FigureManifestEntry[];
	[key: string]: unknown;
}

/**
 * One handbook directory the producer found under `handbooks/`.
 */
export interface HandbookEdition {
	slug: string;
	edition: string;
	editionDir: string;
	warningsPath: string;
	manifestPath: string;
}

/**
 * Walk `handbooks/<slug>/<edition>/` directories that have both a
 * `warnings.json` and a `manifest.json`. Used by the handbook plugins to
 * iterate every published edition during a producer run.
 *
 * Skips slugs that have no extracted artifacts yet (e.g. an early-stage
 * handbook config without a corresponding ingest).
 */
export async function listHandbookEditions(repoRoot: string, slug?: string): Promise<readonly HandbookEdition[]> {
	const handbooksRoot = path.join(repoRoot, 'handbooks');
	const slugs = slug ? [slug] : await safeReadDir(handbooksRoot);
	const out: HandbookEdition[] = [];
	for (const candidateSlug of slugs) {
		const slugDir = path.join(handbooksRoot, candidateSlug);
		const editions = await safeReadDir(slugDir);
		for (const edition of editions) {
			const editionDir = path.join(slugDir, edition);
			const warningsPath = path.join(editionDir, 'warnings.json');
			const manifestPath = path.join(editionDir, 'manifest.json');
			if (!(await fileExists(warningsPath))) continue;
			if (!(await fileExists(manifestPath))) continue;
			out.push({ slug: candidateSlug, edition, editionDir, warningsPath, manifestPath });
		}
	}
	out.sort((a, b) => (a.slug !== b.slug ? a.slug.localeCompare(b.slug) : a.edition.localeCompare(b.edition)));
	return out;
}

async function safeReadDir(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries.filter((e) => e.isDirectory()).map((e) => e.name);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw err;
	}
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await readFile(p);
		return true;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw err;
	}
}

/**
 * Read + parse a `warnings.json` file. Throws on malformed JSON; returns
 * a fresh object every call (no caching -- the producer runs are
 * infrequent and the file is small).
 */
export async function readWarnings(warningsPath: string): Promise<WarningsFile> {
	const raw = await readFile(warningsPath, 'utf8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		const cause = err instanceof Error ? err.message : String(err);
		throw new HandbookManifestError(`malformed warnings.json at ${warningsPath}: ${cause}`);
	}
	if (!isWarningsFile(parsed)) {
		throw new HandbookManifestError(`warnings.json at ${warningsPath} is missing required fields`);
	}
	return parsed;
}

/**
 * Read + parse a `manifest.json` file.
 */
export async function readManifest(manifestPath: string): Promise<ManifestFile> {
	const raw = await readFile(manifestPath, 'utf8');
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		const cause = err instanceof Error ? err.message : String(err);
		throw new HandbookManifestError(`malformed manifest.json at ${manifestPath}: ${cause}`);
	}
	if (!isManifestFile(parsed)) {
		throw new HandbookManifestError(`manifest.json at ${manifestPath} is missing required fields`);
	}
	return parsed;
}

/**
 * Pull the FAA page number out of a warning message of the form
 * `"... on page 83 had no paired image"`. Returns null when the regex
 * doesn't match (e.g. an empty-section-kept warning).
 */
export function extractPageNumber(message: string): number | null {
	const match = message.match(/on page (\d+)/);
	if (!match) return null;
	const n = Number.parseInt(match[1] ?? '', 10);
	return Number.isFinite(n) ? n : null;
}

/**
 * Pull the caption text out of a warning message. The figures.py classifier
 * emits captions back-quoted: ``Caption `Figure 4-7. Koch chart sample.` on
 * page 83 had no paired image.``. The regex anchors on the first backtick
 * pair so a literal backtick inside the caption can survive (handbook
 * captions never embed backticks today, but the regex doesn't assume).
 */
export function extractCaption(message: string): string | null {
	const match = message.match(/`([^`]+)`/);
	return match ? (match[1] ?? null) : null;
}

/**
 * Pull the detected mode from the message tail (`-> mode: image-extracted-elsewhere`).
 * Returns `'unknown'` when the mode is missing.
 */
export function extractMode(message: string): string {
	const match = message.match(/-> mode:\s*([\w-]+)/);
	return match ? (match[1] ?? 'unknown') : 'unknown';
}

/**
 * Pull `(width x height, index N)` shape out of a `figure-without-caption`
 * warning message: `"Image on page 7 (index 3, 480x320) had no paired
 * caption."`.
 */
export function extractImageStats(message: string): { index: number; width: number; height: number } | null {
	const match = message.match(/index (\d+),\s*(\d+)x(\d+)/);
	if (!match) return null;
	const index = Number.parseInt(match[1] ?? '', 10);
	const width = Number.parseInt(match[2] ?? '', 10);
	const height = Number.parseInt(match[3] ?? '', 10);
	if (!Number.isFinite(index) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
	return { index, width, height };
}

export class HandbookManifestError extends Error {
	readonly code = 'HANDBOOK_MANIFEST_ERROR';
	constructor(message: string) {
		super(message);
		this.name = 'HandbookManifestError';
	}
}

function isWarningsFile(value: unknown): value is WarningsFile {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	if (typeof v.document_slug !== 'string') return false;
	if (typeof v.edition !== 'string') return false;
	if (!Array.isArray(v.warnings)) return false;
	for (const w of v.warnings) {
		if (typeof w !== 'object' || w === null) return false;
		const wr = w as Record<string, unknown>;
		if (typeof wr.id !== 'string') return false;
		if (typeof wr.code !== 'string') return false;
		if (typeof wr.message !== 'string') return false;
	}
	return true;
}

function isManifestFile(value: unknown): value is ManifestFile {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	if (typeof v.document_slug !== 'string') return false;
	if (typeof v.edition !== 'string') return false;
	if (!Array.isArray(v.figures)) return false;
	return true;
}
