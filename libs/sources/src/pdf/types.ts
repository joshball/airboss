/**
 * Shared PDF extraction types.
 *
 * Source PDFs are cached at `$AIRBOSS_HANDBOOK_CACHE` per ADR 018 and
 * `docs/platform/STORAGE.md`. Extracted text is the input to ingestion
 * pipelines for corpora that ship as PDF (AIM, AC, ACS, handbooks, POHs).
 *
 * The extractor shells out to `pdftotext` (Poppler). Zero npm deps; same
 * binary on every supported developer machine and CI image; deterministic
 * output for a given Poppler version.
 *
 * See `extract.ts` for the runtime; `identify.ts` for cover-page scrapers
 * (edition slug, effective date) used by AC + ACS ingest.
 */

/** A single extracted page. Text is normalized whitespace; no layout info. */
export interface ExtractedPage {
	/** 1-based page number. */
	readonly pageNumber: number;
	/** Page text. Whitespace normalized: collapsed runs, trimmed lines, no trailing whitespace. */
	readonly text: string;
}

/** Metadata read from the PDF's /Info dictionary, when present. */
export interface PdfMetadata {
	readonly title?: string;
	readonly author?: string;
	readonly creator?: string;
	readonly producer?: string;
	readonly subject?: string;
	readonly keywords?: string;
	readonly creationDate?: Date;
	readonly modificationDate?: Date;
}

/** Result of extracting a full PDF. */
export interface ExtractedDocument {
	/** Absolute path to the source PDF. */
	readonly source: string;
	/** Total page count from `pdfinfo`. */
	readonly pageCount: number;
	/** Per-page extracted text in 1..pageCount order. */
	readonly pages: readonly ExtractedPage[];
	/** Metadata (best-effort; fields absent in the PDF are omitted). */
	readonly metadata: PdfMetadata;
}

/** Options for `extractPdf`. */
export interface ExtractOptions {
	/**
	 * `'layout'` (default) preserves table-like structure -- crucial for ACS / AC
	 * tables. `'raw'` is faster but loses spatial layout. `'simple'` reads top-to-
	 * bottom without layout heuristics.
	 */
	readonly mode?: 'layout' | 'raw' | 'simple';
	/** First page (1-based, inclusive). Default 1. */
	readonly firstPage?: number;
	/** Last page (1-based, inclusive). Default = end of document. */
	readonly lastPage?: number;
	/** Override `pdftotext` binary path. Default: `process.env.AIRBOSS_PDFTOTEXT_PATH` or `'pdftotext'`. */
	readonly binary?: string;
}

/** Range descriptor for `extractPdfPages`. Inclusive on both ends. */
export type PageRange = { readonly first: number; readonly last: number } | readonly number[];
