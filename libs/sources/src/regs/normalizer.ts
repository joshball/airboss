/**
 * Phase 3 -- normalizer.
 *
 * Source of truth: ADR 019 §2.1 (`SourceEntry` schema), §5 (versioning workflow
 * normalization rules: whitespace stripped, line endings LF, Unicode NFC), and
 * §1.5.1 (`last_amended_date` non-null edge cases).
 *
 * Turns the walker's `RawSection` / `RawSubpart` / `RawPart` shapes into the
 * canonical `SourceEntry` plus a body markdown string. The derivative-writer
 * is what writes those bodies to disk; the normalizer is pure.
 */

import type { SourceEntry, SourceId } from '../types.ts';
import type { RawPart, RawSection, RawSubpart } from './xml-walker.ts';

const RESERVED_TITLE = '[Reserved]';

export interface NormalizerOptions {
	/** Edition's publication date (e.g. new Date('2026-01-01')); used as `last_amended_date` fallback. */
	readonly publishedDate: Date;
}

export interface NormalizedSection {
	readonly entry: SourceEntry;
	readonly bodyMarkdown: string;
	readonly bodyHashInput: string;
}

/** Normalize a section into its `SourceEntry` + body markdown. */
export function normalizeRawSection(raw: RawSection, opts: NormalizerOptions): NormalizedSection {
	const id = sectionId(raw);
	const canonicalShort = `§${raw.part}.${raw.section}`;
	const canonicalFormal = `${raw.title} CFR § ${raw.part}.${raw.section}`;
	const canonicalTitle = raw.reserved ? RESERVED_TITLE : raw.headTitle;

	const lastAmended = parseLastAmended(raw.amendedDate, opts.publishedDate);

	const bodyMarkdown = formatSectionMarkdown({
		canonicalShort,
		canonicalTitle,
		body: raw.bodyText,
		reserved: raw.reserved,
	});

	return {
		entry: {
			id,
			corpus: 'regs',
			canonical_short: canonicalShort,
			canonical_formal: canonicalFormal,
			canonical_title: canonicalTitle,
			last_amended_date: lastAmended,
			lifecycle: 'pending',
		},
		bodyMarkdown,
		bodyHashInput: bodyMarkdown,
	};
}

export interface NormalizedSubpart {
	readonly entry: SourceEntry;
	readonly bodyMarkdown: string;
}

export function normalizeRawSubpart(raw: RawSubpart, opts: NormalizerOptions): NormalizedSubpart {
	const id = `airboss-ref:regs/cfr-${raw.title}/${raw.part}/subpart-${raw.subpart}` as SourceId;
	const upper = raw.subpart.toUpperCase();
	const canonicalShort = `Subpart ${upper}`;
	const canonicalFormal = `${raw.title} CFR Part ${raw.part}, Subpart ${upper}`;
	const canonicalTitle = raw.headTitle.trim().length > 0 ? normalizeText(raw.headTitle) : `Subpart ${upper}`;

	return {
		entry: {
			id,
			corpus: 'regs',
			canonical_short: canonicalShort,
			canonical_formal: canonicalFormal,
			canonical_title: canonicalTitle,
			last_amended_date: opts.publishedDate,
			lifecycle: 'pending',
		},
		bodyMarkdown: formatOverviewMarkdown({ canonicalShort, canonicalTitle, kind: 'subpart' }),
	};
}

export interface NormalizedPart {
	readonly entry: SourceEntry;
	readonly bodyMarkdown: string;
}

export function normalizeRawPart(raw: RawPart, opts: NormalizerOptions): NormalizedPart {
	const id = `airboss-ref:regs/cfr-${raw.title}/${raw.part}` as SourceId;
	const canonicalShort = `${raw.title} CFR Part ${raw.part}`;
	const canonicalFormal = canonicalShort;
	const canonicalTitle = raw.headTitle.trim().length > 0 ? normalizeText(raw.headTitle) : `Part ${raw.part}`;

	return {
		entry: {
			id,
			corpus: 'regs',
			canonical_short: canonicalShort,
			canonical_formal: canonicalFormal,
			canonical_title: canonicalTitle,
			last_amended_date: opts.publishedDate,
			lifecycle: 'pending',
		},
		bodyMarkdown: formatOverviewMarkdown({ canonicalShort, canonicalTitle, kind: 'part' }),
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sectionId(raw: RawSection): SourceId {
	return `airboss-ref:regs/cfr-${raw.title}/${raw.part}/${raw.section}` as SourceId;
}

function parseLastAmended(rawDate: string | null, fallback: Date): Date {
	if (rawDate === null) return fallback;
	const parsed = new Date(rawDate);
	if (Number.isNaN(parsed.getTime())) return fallback;
	return parsed;
}

/**
 * Apply ADR 019 §5 normalization rules to a body string:
 *
 * - Unicode NFC
 * - Line endings LF
 * - Strip leading + trailing whitespace
 * - Collapse runs of >=3 newlines to 2
 */
export function normalizeText(input: string): string {
	const nfc = input.normalize('NFC');
	const lf = nfc.replace(/\r\n?/gu, '\n');
	const collapsed = lf.replace(/\n{3,}/gu, '\n\n');
	return collapsed.trim();
}

interface SectionMarkdownInput {
	readonly canonicalShort: string;
	readonly canonicalTitle: string;
	readonly body: string;
	readonly reserved: boolean;
}

function formatSectionMarkdown(input: SectionMarkdownInput): string {
	const heading = `# ${input.canonicalShort} ${input.canonicalTitle}`;
	if (input.reserved) {
		return `${heading}\n\n[Reserved]\n`;
	}
	const body = normalizeText(input.body);
	if (body.length === 0) {
		return `${heading}\n`;
	}
	return `${heading}\n\n${body}\n`;
}

interface OverviewMarkdownInput {
	readonly canonicalShort: string;
	readonly canonicalTitle: string;
	readonly kind: 'subpart' | 'part';
}

function formatOverviewMarkdown(input: OverviewMarkdownInput): string {
	const heading = `# ${input.canonicalShort} ${input.canonicalTitle}`;
	return `${heading}\n`;
}

// ---------------------------------------------------------------------------
// Test-only re-export
// ---------------------------------------------------------------------------

export const __normalizer_internal__ = {
	normalizeText,
	parseLastAmended,
};
