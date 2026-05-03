/**
 * Markdown-to-section-tree parser for hand-curated body overrides.
 *
 * Source of truth: `docs/work-packages/wp-mtn-section-tree/spec.md` Decision D3.
 *
 * Used by `handbooks-extras` ingest to promote a Class C handbook from a
 * single whole-doc body to a chapter / section tree when the override
 * markdown carries `## ` chapter headings (and optional `### ` section
 * headings under them). Today this services Tips on Mountain Flying; the
 * shape is reusable for any future scanned-pamphlet handbook whose OCR is
 * unusable but whose hand-curated body has structural headings.
 *
 * Heading hierarchy:
 *
 *   `# Title`             -> document title (required, exactly one)
 *   `## Chapter`          -> chapter (1+ required for section-tree shape)
 *   `### Section`         -> section nested in the most recent chapter
 *   `#### ` or deeper     -> rejected (parser strict-mode error)
 *
 * Pure function; no IO. Slug shape mirrors `tools/handbook-ingest`'s
 * `_title_slug` and the AIM ingest's `titleSlug` (lowercase, runs of
 * non-alphanumerics collapse to `-`, leading/trailing hyphens trimmed,
 * truncated to `TITLE_SLUG_MAX_LENGTH`).
 */

/**
 * One parsed `### ` section under a chapter. The body is the prose between
 * this `### ` heading and the next `### ` (or `## `) heading, including
 * trailing blank lines.
 */
export interface ParsedSection {
	readonly title: string;
	readonly slug: string;
	readonly body: string;
}

/**
 * One parsed `## ` chapter. The overview body is the prose between this
 * `## ` heading and the first `### ` heading inside it (or the next `## `
 * heading if the chapter has no `### ` sections).
 */
export interface ParsedChapter {
	readonly title: string;
	readonly slug: string;
	readonly overview: string;
	readonly sections: readonly ParsedSection[];
}

/**
 * Successful parse result -- the override is structured (>= 1 `## ` heading).
 */
export interface ParsedSectionTree {
	readonly kind: 'section-tree';
	readonly title: string;
	readonly chapters: readonly ParsedChapter[];
}

/**
 * Sentinel for unstructured overrides (zero `## ` headings). The caller
 * falls through to whole-doc behaviour. NOT an error.
 */
export interface ParsedFlat {
	readonly kind: 'flat';
}

export type ParseResult = ParsedSectionTree | ParsedFlat;

/**
 * Parser errors are thrown for strict-mode violations (missing H1, H4+
 * headings, duplicate slugs). Use try/catch at the call site if these
 * should be reported rather than propagated.
 */
export class OverrideParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OverrideParseError';
	}
}

const HEADING_RE = /^(#+)\s+(.+?)\s*$/;
const TITLE_SLUG_PATTERN = /[^a-z0-9]+/g;
/**
 * Max slug length. Mirrors AIM's `TITLE_SLUG_MAX_LENGTH` and Python's
 * `tools/handbook-ingest/ingest/normalize.py:_title_slug` `[:48]`. Kept
 * identical so a section path produced by the override parser is
 * indistinguishable from one the chapter-aware Python ingest would write.
 */
const TITLE_SLUG_MAX_LENGTH = 48;

/**
 * Mirror of AIM's `titleSlug` (and `tools/handbook-ingest/ingest/normalize.py:_title_slug`).
 * Kept identical so override-derived paths and PDF-extracted paths are
 * indistinguishable to downstream walkers.
 */
export function titleSlug(title: string): string {
	const slug = title.toLowerCase().replace(TITLE_SLUG_PATTERN, '-').replace(/^-+|-+$/g, '');
	return (slug.length > 0 ? slug : 'section').slice(0, TITLE_SLUG_MAX_LENGTH);
}

/**
 * Parse a markdown override into a section tree. Returns:
 *
 *   - `{ kind: 'section-tree', title, chapters }` when the override has
 *     a single `# ` document heading + at least one `## ` chapter heading.
 *   - `{ kind: 'flat' }` when the override has zero `## ` chapter headings
 *     (the caller falls through to whole-doc behaviour).
 *
 * Throws `OverrideParseError` for strict-mode violations:
 *   - zero `# ` headings, or more than one
 *   - any `#### ` (depth 4+) heading
 *   - duplicate chapter slug within the doc
 *   - duplicate section slug within a chapter
 */
export function parseOverrideToSectionTree(markdown: string): ParseResult {
	const lines = markdown.split('\n');

	// Pass 1: collect heading offsets + their content. We treat anything
	// inside fenced code blocks (` ``` `) as opaque so a `## ` inside a
	// code sample doesn't get parsed as a chapter heading.
	interface HeadingHit {
		readonly depth: number;
		readonly title: string;
		readonly lineIndex: number;
	}
	const headings: HeadingHit[] = [];
	let inFence = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const fenceMatch = line.match(/^```/);
		if (fenceMatch !== null) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		const m = line.match(HEADING_RE);
		if (m === null) continue;
		const depth = (m[1] ?? '').length;
		const title = m[2] ?? '';
		headings.push({ depth, title, lineIndex: i });
	}

	// Validate H1 -- exactly one document title required for any successful parse.
	const h1Hits = headings.filter((h) => h.depth === 1);
	if (h1Hits.length === 0) {
		throw new OverrideParseError('override has no `# ` document title heading');
	}
	if (h1Hits.length > 1) {
		throw new OverrideParseError(
			`override has ${h1Hits.length} \`# \` headings; expected exactly one document title`,
		);
	}
	const docTitle = h1Hits[0]?.title ?? '';

	// No H2 -> sentinel "flat" so the caller falls through to whole-doc.
	const h2Hits = headings.filter((h) => h.depth === 2);
	if (h2Hits.length === 0) {
		return { kind: 'flat' };
	}

	// Reject H4+ outright (the schema cap is depth 3 / chapter / section /
	// subsection; the override is the authoring layer so depth > 3 means
	// the author wrote beyond what the manifest can represent).
	const tooDeep = headings.filter((h) => h.depth >= 4);
	if (tooDeep.length > 0) {
		const samples = tooDeep
			.slice(0, 3)
			.map((h) => `line ${h.lineIndex + 1}: \`${'#'.repeat(h.depth)} ${h.title}\``)
			.join('; ');
		throw new OverrideParseError(
			`override has H4+ heading${tooDeep.length === 1 ? '' : 's'} (max depth is 3): ${samples}`,
		);
	}

	// Pass 2: walk headings and slice the line ranges between them. The body
	// for heading[i] is `lines[heading[i].lineIndex + 1 .. heading[i+1].lineIndex)`.
	const structuralHeadings = headings.filter((h) => h.depth === 1 || h.depth === 2 || h.depth === 3);

	interface ChapterAccumulator {
		readonly title: string;
		readonly slug: string;
		overviewStartLine: number;
		overviewEndLine: number;
		sections: ParsedSection[];
	}

	const chapters: ChapterAccumulator[] = [];
	const chapterSlugs = new Set<string>();

	for (let i = 0; i < structuralHeadings.length; i++) {
		const h = structuralHeadings[i];
		if (h === undefined) continue;
		const next = structuralHeadings[i + 1];
		const startLine = h.lineIndex + 1;
		const endLine = next === undefined ? lines.length : next.lineIndex;

		if (h.depth === 1) {
			// Document body before the first H2 is dropped (any prose between `# `
			// and the first `## ` is preamble that belongs to the doc, not a chapter).
			continue;
		}

		if (h.depth === 2) {
			const slug = titleSlug(h.title);
			if (chapterSlugs.has(slug)) {
				throw new OverrideParseError(
					`duplicate chapter slug "${slug}" (from heading "${h.title}" at line ${h.lineIndex + 1})`,
				);
			}
			chapterSlugs.add(slug);
			chapters.push({
				title: h.title,
				slug,
				overviewStartLine: startLine,
				overviewEndLine: endLine,
				sections: [],
			});
			continue;
		}

		if (h.depth === 3) {
			const chapter = chapters[chapters.length - 1];
			if (chapter === undefined) {
				throw new OverrideParseError(
					`section heading "${h.title}" at line ${h.lineIndex + 1} appears before any chapter (\`## \`)`,
				);
			}
			// First section under this chapter -> truncate the chapter overview's
			// end at this section's start.
			if (chapter.sections.length === 0) {
				chapter.overviewEndLine = h.lineIndex;
			}
			const sectionSlug = titleSlug(h.title);
			const dupe = chapter.sections.find((s) => s.slug === sectionSlug);
			if (dupe !== undefined) {
				throw new OverrideParseError(
					`duplicate section slug "${sectionSlug}" inside chapter "${chapter.title}" (from heading "${h.title}" at line ${h.lineIndex + 1})`,
				);
			}
			const body = sliceBody(lines, startLine, endLine);
			chapter.sections.push({ title: h.title, slug: sectionSlug, body });
			continue;
		}
	}

	const finalChapters: ParsedChapter[] = chapters.map((c) => ({
		title: c.title,
		slug: c.slug,
		overview: sliceBody(lines, c.overviewStartLine, c.overviewEndLine),
		sections: c.sections,
	}));

	return { kind: 'section-tree', title: docTitle, chapters: finalChapters };
}

/**
 * Extract `lines[start .. end)` and join with newlines, trimming trailing
 * blank lines. Leading blank lines are preserved (the parser cannot tell
 * structural intent there). Empty body becomes `""` (zero-length string),
 * not a sentinel -- the writer decides whether to inject a placeholder.
 */
function sliceBody(lines: readonly string[], start: number, end: number): string {
	if (end <= start) return '';
	const body = lines.slice(start, end).join('\n');
	// Trim trailing whitespace-only lines; preserve leading whitespace.
	return body.replace(/\s+$/, '');
}
