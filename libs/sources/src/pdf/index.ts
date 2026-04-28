/**
 * Shared PDF extraction surface.
 *
 * One canonical extractor for every corpus that ships as PDF (AIM, AC, ACS,
 * handbooks, POHs). Wraps Poppler's `pdftotext` -- zero npm deps, deterministic.
 *
 * Consumers import from `@ab/sources/pdf`:
 *
 *   import { extractPdf, extractPdfText } from '@ab/sources/pdf';
 *
 *   const doc = extractPdf(absPath);
 *   const slug = findAcsEditionSlug(doc.pages.slice(0, 3)); // cover-page heuristic
 */

export {
	__resetAvailabilityCache,
	extractPdf,
	extractPdfPages,
	extractPdfText,
	PdfExtractionError,
	PdfNotFoundError,
	PdftotextNotInstalledError,
} from './extract.ts';
export {
	findAcSlug,
	findAcsEditionSlug,
	findAnyEditionSlug,
	findEffectiveDate,
	findHandbookEditionSlug,
} from './identify.ts';
export type {
	ExtractedDocument,
	ExtractedPage,
	ExtractOptions,
	PageRange,
	PdfMetadata,
} from './types.ts';
