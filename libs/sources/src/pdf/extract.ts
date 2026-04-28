/**
 * PDF extraction via `pdftotext` (Poppler).
 *
 * Public surface:
 *   - `extractPdf(path, opts?)` -- full document with per-page text + metadata
 *   - `extractPdfText(path, opts?)` -- all pages joined, single string
 *   - `extractPdfPages(path, range, opts?)` -- specific pages
 *
 * Errors thrown:
 *   - `PdftotextNotInstalledError` when the binary isn't on PATH
 *   - `PdfNotFoundError` when the source file doesn't exist
 *   - `PdfExtractionError` for any other failure (encrypted, malformed, etc.)
 *
 * Determinism: the same PDF processed by the same `pdftotext` version produces
 * byte-identical output. Whitespace normalization happens here in TypeScript
 * (collapse runs, trim, drop trailing whitespace) so consumers don't each
 * re-implement it.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { ExtractedDocument, ExtractedPage, ExtractOptions, PageRange, PdfMetadata } from './types.ts';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PdftotextNotInstalledError extends Error {
	constructor(binary: string) {
		super(
			`pdftotext is required for PDF extraction. Tried to run '${binary}' but it failed. ` +
				`Install via 'brew install poppler' (macOS) or 'apt-get install poppler-utils' (Debian/Ubuntu). ` +
				`Override the binary path with the AIRBOSS_PDFTOTEXT_PATH env var.`,
		);
	}
}

export class PdfNotFoundError extends Error {
	constructor(path: string) {
		super(`PDF source not found: ${path}`);
	}
}

export class PdfExtractionError extends Error {
	readonly source: string;
	constructor(source: string, message: string) {
		super(`PDF extraction failed for ${source}: ${message}`);
		this.source = source;
	}
}

// ---------------------------------------------------------------------------
// Binary resolution + availability check
// ---------------------------------------------------------------------------

let cachedAvailability: { readonly binary: string; readonly available: boolean } | null = null;

function resolveBinary(override?: string): string {
	if (override !== undefined && override.length > 0) return override;
	const fromEnv = process.env.AIRBOSS_PDFTOTEXT_PATH;
	if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
	return 'pdftotext';
}

function ensureAvailable(binary: string): void {
	if (cachedAvailability !== null && cachedAvailability.binary === binary) {
		if (!cachedAvailability.available) throw new PdftotextNotInstalledError(binary);
		return;
	}
	// `pdftotext -v` writes to stderr and exits 0.
	const result = spawnSync(binary, ['-v'], { encoding: 'utf-8' });
	const ok = result.status === 0 || /pdftotext/i.test(`${result.stdout ?? ''}${result.stderr ?? ''}`);
	cachedAvailability = { binary, available: ok };
	if (!ok) throw new PdftotextNotInstalledError(binary);
}

/** For tests: forget the cached availability check. */
export function __resetAvailabilityCache(): void {
	cachedAvailability = null;
}

// ---------------------------------------------------------------------------
// pdfinfo: page count + metadata
// ---------------------------------------------------------------------------

/**
 * Pull document info using `pdfinfo`, the sibling tool from the same Poppler
 * package. Returns page count + best-effort metadata.
 */
function readPdfInfo(source: string, binary: string): { pageCount: number; metadata: PdfMetadata } {
	// `pdfinfo` lives next to `pdftotext`. Reuse the override convention for
	// simplicity: same path with the last segment swapped.
	const pdfinfoBinary = binary.endsWith('pdftotext') ? `${binary.slice(0, -'pdftotext'.length)}pdfinfo` : 'pdfinfo';
	const result = spawnSync(pdfinfoBinary, [source], { encoding: 'utf-8' });
	if (result.status !== 0) {
		throw new PdfExtractionError(source, `pdfinfo exited ${result.status ?? 'null'}: ${result.stderr ?? ''}`);
	}
	const stdout = result.stdout ?? '';
	const fields = parsePdfInfoOutput(stdout);

	const pageCount = parseInt(fields.get('Pages') ?? '', 10);
	if (!Number.isFinite(pageCount) || pageCount <= 0) {
		throw new PdfExtractionError(source, `pdfinfo did not report a valid page count: ${stdout}`);
	}

	const metadata: PdfMetadata = {
		title: fields.get('Title'),
		author: fields.get('Author'),
		creator: fields.get('Creator'),
		producer: fields.get('Producer'),
		subject: fields.get('Subject'),
		keywords: fields.get('Keywords'),
		creationDate: parsePdfDate(fields.get('CreationDate')),
		modificationDate: parsePdfDate(fields.get('ModDate')),
	};
	return { pageCount, metadata };
}

function parsePdfInfoOutput(stdout: string): Map<string, string> {
	const out = new Map<string, string>();
	for (const line of stdout.split('\n')) {
		const idx = line.indexOf(':');
		if (idx <= 0) continue;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim();
		if (key.length === 0 || value.length === 0) continue;
		out.set(key, value);
	}
	return out;
}

function parsePdfDate(raw: string | undefined): Date | undefined {
	if (raw === undefined || raw.length === 0) return undefined;
	// pdfinfo returns ISO-ish "Tue Apr 22 10:15:33 2026 UTC" or sometimes raw "D:20260422101533Z00'00'".
	// Try ISO first, then PDF-internal D: form.
	const native = new Date(raw);
	if (!Number.isNaN(native.getTime())) return native;
	const m = raw.match(/^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
	if (m !== null) {
		const [, yyyy, mm, dd, hh, mi, ss] = m;
		const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
		const parsed = new Date(iso);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// pdftotext: per-page extraction
// ---------------------------------------------------------------------------

function modeFlag(mode: ExtractOptions['mode']): string | null {
	switch (mode) {
		case 'raw':
			return '-raw';
		case 'simple':
			// pdftotext's default mode (no flag) is the reading-order extractor that
			// auto-paragraphs. We pass null here and skip adding a mode flag.
			return null;
		case 'layout':
		case undefined:
			return '-layout';
	}
}

/**
 * Run `pdftotext` for an inclusive page range and return the extracted text.
 * Single subprocess; no temp files.
 */
function runPdftotext(source: string, firstPage: number, lastPage: number, opts: ExtractOptions): string {
	const binary = resolveBinary(opts.binary);
	const mode = modeFlag(opts.mode);
	const args = ['-enc', 'UTF-8', '-f', String(firstPage), '-l', String(lastPage)];
	if (mode !== null) args.push(mode);
	args.push(source, '-'); // output to stdout
	const result = spawnSync(binary, args, { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
	if (result.status !== 0) {
		throw new PdfExtractionError(source, `pdftotext exited ${result.status ?? 'null'}: ${result.stderr ?? ''}`);
	}
	return result.stdout ?? '';
}

/** pdftotext separates pages with form-feed (\f) when given a range. */
function splitPages(rawText: string, firstPage: number): ExtractedPage[] {
	const segments = rawText.split('\f');
	// pdftotext can emit a trailing form-feed; drop empty trailing segment.
	if (segments.length > 0 && segments[segments.length - 1] === '') {
		segments.pop();
	}
	return segments.map((seg, i) => ({
		pageNumber: firstPage + i,
		text: normalizeWhitespace(seg),
	}));
}

/**
 * Whitespace normalization: trim each line, drop leading/trailing blank lines,
 * collapse runs of 3+ blank lines to 2 (preserves paragraph breaks). Does NOT
 * collapse intra-line whitespace -- column layout from `-layout` is preserved.
 */
function normalizeWhitespace(text: string): string {
	const lines = text.split(/\r?\n/).map((l) => l.replace(/[ \t]+$/g, ''));
	// Drop leading blanks
	while (lines.length > 0 && lines[0].trim() === '') lines.shift();
	// Drop trailing blanks
	while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
	// Collapse 3+ blank-line runs to 2
	const out: string[] = [];
	let blankRun = 0;
	for (const line of lines) {
		if (line.trim() === '') {
			blankRun += 1;
			if (blankRun <= 2) out.push(line);
		} else {
			blankRun = 0;
			out.push(line);
		}
	}
	return out.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Extract a full PDF: per-page text + metadata. */
export function extractPdf(source: string, opts: ExtractOptions = {}): ExtractedDocument {
	if (!existsSync(source)) throw new PdfNotFoundError(source);
	const binary = resolveBinary(opts.binary);
	ensureAvailable(binary);

	const info = readPdfInfo(source, binary);
	const firstPage = opts.firstPage ?? 1;
	const lastPage = opts.lastPage ?? info.pageCount;
	if (firstPage < 1 || lastPage < firstPage || lastPage > info.pageCount) {
		throw new PdfExtractionError(
			source,
			`requested page range ${firstPage}..${lastPage} is out of bounds for ${info.pageCount}-page document`,
		);
	}

	const raw = runPdftotext(source, firstPage, lastPage, opts);
	const pages = splitPages(raw, firstPage);
	return {
		source,
		pageCount: info.pageCount,
		pages,
		metadata: info.metadata,
	};
}

/** Extract a PDF and return all page text joined with double newlines. */
export function extractPdfText(source: string, opts: ExtractOptions = {}): string {
	const doc = extractPdf(source, opts);
	return doc.pages.map((p) => p.text).join('\n\n');
}

/**
 * Extract specific pages. Accepts either an inclusive range
 * (`{ first, last }`) or a list of page numbers (e.g. `[1, 3, 5]`).
 */
export function extractPdfPages(source: string, range: PageRange, opts: ExtractOptions = {}): readonly ExtractedPage[] {
	if ('first' in range && 'last' in range) {
		const doc = extractPdf(source, { ...opts, firstPage: range.first, lastPage: range.last });
		return doc.pages;
	}
	// Non-contiguous: one subprocess per page (rare; fine for cover-page scraping).
	const pages: ExtractedPage[] = [];
	for (const n of range) {
		const doc = extractPdf(source, { ...opts, firstPage: n, lastPage: n });
		if (doc.pages[0] !== undefined) pages.push(doc.pages[0]);
	}
	return pages;
}
