/**
 * Zod schemas for the per-corpus source YAML configs at `scripts/sources/config/`.
 *
 * Each schema corresponds to one YAML file. The TS loader at `loader.ts`
 * reads, validates, and caches parsed configs. Failed validation surfaces a
 * structured error pointing at the YAML field.
 */

import { z } from 'zod';

// -----------------------------------------------------------------------------
// AC / ACS / handbooks-extras (shared "flat list of PDFs" shape)
// -----------------------------------------------------------------------------

const FlatEntrySchema = z.object({
	doc_id: z.string().min(1),
	edition: z.string().nullable(),
	url: z.string().url(),
	filename: z.string().min(1),
});

export const FlatCorpusSchema = z.object({
	base_url: z.string().url(),
	entries: z.array(FlatEntrySchema).min(1),
});

export type FlatCorpusConfig = z.infer<typeof FlatCorpusSchema>;
export type FlatEntry = z.infer<typeof FlatEntrySchema>;

// -----------------------------------------------------------------------------
// AIM (whole-doc PDF + section HTML + appendix HTML)
// -----------------------------------------------------------------------------

export const AimConfigSchema = z.object({
	continuous_edition: z.boolean(),
	whole_doc: z.object({
		url: z.string().url(),
		filename: z.string().min(1),
	}),
	chapter_html: z.object({
		section_url_pattern: z.string().url(),
		section_filename_pattern: z.string().min(1),
		chapter_count: z.number().int().positive(),
		sections_per_chapter: z.array(z.number().int().nonnegative()).min(1),
		chapter_0_section_url_override: z.string().url().optional(),
	}),
	appendix_html: z.object({
		url_pattern: z.string().url(),
		filename_pattern: z.string().min(1),
		appendix_count: z.number().int().nonnegative(),
	}),
	excluded_assets: z.array(z.string()).default([]),
});

export type AimConfig = z.infer<typeof AimConfigSchema>;

// -----------------------------------------------------------------------------
// Regs (CFR via eCFR)
// -----------------------------------------------------------------------------

const RegsTitleSchema = z.object({
	title: z.union([z.literal('14'), z.literal('49')]),
	parts: z.array(z.string()).default([]),
});

export const RegsConfigSchema = z.object({
	ecfr_base: z.string().url(),
	ecfr_titles_url: z.string().url(),
	titles: z.array(RegsTitleSchema).min(1),
});

export type RegsConfig = z.infer<typeof RegsConfigSchema>;
export type RegsTitleConfig = z.infer<typeof RegsTitleSchema>;

// -----------------------------------------------------------------------------
// Handbook (per-handbook chapter-aware config)
// -----------------------------------------------------------------------------

const AncillarySchema = z.object({
	kind: z.enum(['front', 'toc', 'glossary', 'index', 'appendix']),
	url: z.string().url(),
	appendix_id: z.string().optional(),
});

const ChapterPdfsBaseSchema = z.object({
	chapter_count: z.number().int().positive(),
	// AFH-style: chapter ordinal in the URL is the chapter ordinal plus an offset
	// because the publisher numbers files sequentially across all assets
	// (front=01, ch1=02, ch2=03, ..., chN = N+1). 0 by default.
	file_ordinal_offset: z.number().int().nonnegative().default(0),
	ancillary: z.array(AncillarySchema).default([]),
});

const ChapterPdfsDirectSchema = ChapterPdfsBaseSchema.extend({
	direct_pattern: z.string().url(),
	index_url: z.never().optional(),
	chapter_page_pattern: z.never().optional(),
});

const ChapterPdfsTwoHopSchema = ChapterPdfsBaseSchema.extend({
	index_url: z.string().url(),
	chapter_page_pattern: z.string().min(1),
	direct_pattern: z.never().optional(),
});

export const ChapterPdfsSchema = z.union([ChapterPdfsDirectSchema, ChapterPdfsTwoHopSchema]);
export type ChapterPdfsConfig = z.infer<typeof ChapterPdfsSchema>;
export type AncillaryConfig = z.infer<typeof AncillarySchema>;

// Per-handbook YAML carries BOTH the cache/download metadata (whole_doc,
// chapter_pdfs) AND the Python ingest knobs (page_offset, outline_strategy,
// section_strategy, prompt, errata...). The TS loader only validates the
// fields the downloader needs; unknown fields are passed through. The Python
// loader has its own validation for the ingest-side fields.
export const HandbookConfigSchema = z
	.object({
		document_slug: z.string().min(1),
		edition: z.string().min(1),
		// Optional: the Python ingest tool requires more fields; the TS
		// downloader only needs whole_doc + (optionally) chapter_pdfs.
		whole_doc: z
			.object({
				url: z.string().url(),
				filename: z.string().min(1),
			})
			.optional(),
		// Legacy field used by the Python tool. The TS loader accepts either
		// whole_doc.url OR source_url; prefer whole_doc when present.
		source_url: z.string().url().optional(),
		chapter_pdfs: ChapterPdfsSchema.optional(),
		excluded_assets: z.array(z.string()).default([]),
	})
	.passthrough();

export type HandbookConfig = z.infer<typeof HandbookConfigSchema>;
