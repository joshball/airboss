#!/usr/bin/env bun

/**
 * Migrate free-text legacy citations in `course/knowledge/**\/node.md` to the
 * structured ADR-019 form (per the 2026-05 amendment, optional edition + drift
 * sentinels).
 *
 * Per ADR 019 amendment D2, this script does **not** auto-rewrite legacy
 * citations even when chapter titles match between the cited edition and the
 * current edition. Auto-rewrite-on-title-match looks safe for the 14 AFH 3B
 * citations we have today; it scales catastrophically when the next corpus has
 * hundreds of legacy citations and a content-equivalence claim is made by the
 * migrator on the author's behalf.
 *
 * Two phases, two flags:
 *
 *   --dry-run (default)   Walk every node.md, find every legacy citation,
 *                         look up the chapter in the current edition's
 *                         on-disk manifest, and write a review queue at
 *                         `course/knowledge/.migration-review.md`. No
 *                         source files are modified.
 *
 *   --apply               Read the review queue. For every row whose
 *                         checkbox is ticked (`- [x]`), apply the proposed
 *                         rewrite to its source file. Untickled rows are
 *                         left alone. Source files for unticked rows are
 *                         not modified.
 *
 * The review file is idempotent: re-running `--dry-run` regenerates it from
 * current source state, preserving ticks the human has already made (matched
 * by source file path + line number).
 *
 * Optional filters (apply to both modes):
 *   --slug <slug>             Restrict to one handbook slug (e.g. `afh`).
 *   --legacy-edition <tag>    Restrict to one legacy edition tag in the
 *                             cited `source:` string (e.g. `FAA-H-8083-3B`).
 *
 * Usage:
 *   bun scripts/db/migrate-knowledge-citations.ts --dry-run
 *   bun scripts/db/migrate-knowledge-citations.ts --dry-run --slug afh --legacy-edition FAA-H-8083-3B
 *   bun scripts/db/migrate-knowledge-citations.ts --apply
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Paths and constants
// ---------------------------------------------------------------------------

/** Repo root resolved from this file's location (scripts/db -> repo root). */
export const REPO_ROOT = resolve(import.meta.dir ?? __dirname, '..', '..');

/** Knowledge corpus root relative to the repo root. */
export const KNOWLEDGE_DIR = 'course/knowledge';

/** Handbook corpus root relative to the repo root. */
export const HANDBOOKS_DIR = 'handbooks';

/** Review queue file the script writes/reads under the knowledge dir. */
export const REVIEW_FILE_RELPATH = 'course/knowledge/.migration-review.md';

/** Sentinels emitted into the review file. */
const REVIEW_FILE_HEADING = '# Knowledge citation migration -- review queue';
const REVIEW_ROW_FENCE = '<!-- migration-row -->';

// ---------------------------------------------------------------------------
// Handbook source-string patterns
// ---------------------------------------------------------------------------

/**
 * One handbook recognizer. The migration matches the legacy `source:` line
 * against every pattern in order; the first match wins. The pattern names the
 * canonical slug (used in the proposed `airboss-ref:` URI) and the regex used
 * to lift an edition tag out of the source string. Edition is required: a
 * legacy citation must declare which edition it was authored against, or the
 * migration cannot compute a meaningful sentinel comparison.
 */
interface HandbookPattern {
	/** Matches the `source:` line. */
	source: RegExp;
	/** Canonical slug for the `airboss-ref:handbooks/<slug>/...` URI. */
	slug: string;
	/** Captures the edition tag inside `source` (e.g. `FAA-H-8083-3B`). */
	edition: RegExp;
}

const HANDBOOK_PATTERNS: readonly HandbookPattern[] = [
	{
		source: /\b(?:AFH|Airplane Flying Handbook)\b/i,
		slug: 'afh',
		edition: /\bFAA-H-8083-3[A-Z]?\b/i,
	},
	{
		source: /\b(?:PHAK|Pilot's Handbook of Aeronautical Knowledge)\b/i,
		slug: 'phak',
		edition: /\bFAA-H-8083-25[A-Z]?\b/i,
	},
	{
		source: /\b(?:AIH|Aviation Instructor's Handbook)\b/i,
		slug: 'aviation-instructor',
		edition: /\bFAA-H-8083-9[A-Z]?\b/i,
	},
	{
		source: /\b(?:IPH|Instrument Procedures Handbook)\b/i,
		slug: 'iph',
		edition: /\bFAA-H-8083-16[A-Z]?\b/i,
	},
	{
		source: /\b(?:Instrument Flying Handbook|IFH)\b/i,
		slug: 'ifh',
		edition: /\bFAA-H-8083-15[A-Z]?\b/i,
	},
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A legacy `references:` entry parsed out of node.md frontmatter. */
export interface LegacyCitationBlock {
	/** Repo-relative path to the source file. */
	relPath: string;
	/** 1-indexed line number of the `- source:` line. */
	startLine: number;
	/** 1-indexed line number of the LAST line of this entry (inclusive). */
	endLine: number;
	/** Indent string used by the entry's body lines (e.g. `    `). */
	bodyIndent: string;
	/** Raw text of the entry (joined source lines, trimmed of trailing newline). */
	rawYaml: string;
	source: string;
	detail: string;
	note: string;
}

/** Outcome of parsing a legacy `source` string against the handbook patterns. */
export interface ParsedLegacySource {
	slug: string;
	edition: string;
}

/** Outcome of parsing a legacy `detail` string. */
export interface ParsedLegacyDetail {
	/** Chapter number if present in `detail`; null otherwise. */
	chapter: number | null;
	/** Chapter title if `detail` had a `Chapter N -- Title` form; null otherwise. */
	chapterTitle: string | null;
}

/** A chapter row from a handbook manifest. */
interface ManifestChapter {
	/** `code` field from the manifest -- the chapter number as a string. */
	code: string;
	title: string;
}

/** Edition + chapter list loaded from `handbooks/<slug>/<edition>/manifest.json`. */
interface ManifestSnapshot {
	slug: string;
	edition: string;
	chapters: readonly ManifestChapter[];
}

/** A row computed for the review queue. */
export interface ReviewRow {
	/** Repo-relative source file path. */
	relPath: string;
	/** 1-indexed line of the `- source:` line. */
	startLine: number;
	endLine: number;
	bodyIndent: string;
	legacy: LegacyCitationBlock;
	parsedSource: ParsedLegacySource | null;
	parsedDetail: ParsedLegacyDetail;
	/** Resolved current edition for the slug, if any. */
	currentEdition: string | null;
	/** Chapter title in the current edition for the parsed chapter number, if any. */
	currentChapterTitle: string | null;
	/** Note: blank when not authored. */
	legacyNote: string;
	/** Proposed structured-form YAML body (without leading `- ` prefix). */
	proposedYaml: string;
	/** Whether the legacy chapter title and current chapter title match exactly. */
	titleMatch: boolean;
	/** Free-form reason this row may not have a clean rewrite. */
	notes: readonly string[];
}

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

export function walkNodeMd(root: string): string[] {
	const out: string[] = [];
	let stat: ReturnType<typeof statSync>;
	try {
		stat = statSync(root);
	} catch {
		return out;
	}
	if (!stat.isDirectory()) return out;
	const stack: string[] = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (dir === undefined) continue;
		let entries: readonly string[];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			const full = join(dir, entry);
			let s: ReturnType<typeof statSync>;
			try {
				s = statSync(full);
			} catch {
				continue;
			}
			if (s.isDirectory()) {
				stack.push(full);
			} else if (basename(full) === 'node.md') {
				out.push(full);
			}
		}
	}
	return out.sort();
}

// ---------------------------------------------------------------------------
// Frontmatter line-aware parser
// ---------------------------------------------------------------------------

/**
 * Locate the YAML frontmatter region (between the opening and closing `---`
 * fences) and return the line range. 1-indexed; both inclusive.
 */
function findFrontmatterRange(lines: readonly string[]): { startLine: number; endLine: number } | null {
	if (lines.length === 0 || lines[0] !== '---') return null;
	for (let i = 1; i < lines.length; i += 1) {
		if (lines[i] === '---') return { startLine: 2, endLine: i };
	}
	return null;
}

/**
 * Walk frontmatter lines, find the `references:` block, and yield every entry
 * with its source/detail/note fields and exact line range. Tracks the original
 * indentation of body lines so the rewrite preserves it.
 */
export function extractLegacyCitations(text: string, relPath: string): LegacyCitationBlock[] {
	const lines = text.split(/\r?\n/);
	const range = findFrontmatterRange(lines);
	if (range === null) return [];
	// Locate `references:` line at top-level of frontmatter (no leading space).
	let refsLine = -1;
	for (let i = range.startLine - 1; i < range.endLine; i += 1) {
		if (/^references\s*:/.test(lines[i])) {
			refsLine = i;
			break;
		}
	}
	if (refsLine === -1) return [];
	// Walk forward gathering list entries until we hit a non-indented line
	// (next top-level frontmatter key) or the closing fence.
	const out: LegacyCitationBlock[] = [];
	let i = refsLine + 1;
	while (i < range.endLine) {
		const line = lines[i];
		// End of references block: top-level key (non-space first char) or empty
		// line followed by top-level key. Empty lines inside the block are
		// allowed but not common; treat any line whose first non-space char is
		// at column 0 as "exited the block".
		if (/^\S/.test(line)) break;
		if (line.trim() === '') {
			i += 1;
			continue;
		}
		const itemMatch = line.match(/^(\s+)-\s+source\s*:\s*(.*)$/);
		if (itemMatch === null) {
			// Some other indented line we didn't expect (e.g. continuation).
			// Skip without recording; the migration only handles the canonical
			// `- source: ... / detail: ... / note: ...` shape.
			i += 1;
			continue;
		}
		const itemIndent = itemMatch[1];
		const bodyIndent = `${itemIndent}  `;
		const startLine = i + 1; // 1-indexed
		const sourceValue = itemMatch[2].trim();
		let detail = '';
		let note = '';
		const rawLines: string[] = [line];
		i += 1;
		// Consume body lines while they are indented deeper than the item indent
		// (or are part of a YAML block-scalar value).
		while (i < range.endLine) {
			const bl = lines[i];
			if (bl.trim() === '') {
				rawLines.push(bl);
				i += 1;
				continue;
			}
			// A new list item or a top-level key ends this entry.
			if (/^\S/.test(bl)) break;
			if (new RegExp(`^${itemIndent}-\\s`).test(bl)) break;
			rawLines.push(bl);
			const detailMatch = bl.match(/^\s+detail\s*:\s*(.*)$/);
			const noteMatch = bl.match(/^\s+note\s*:\s*(.*)$/);
			if (detailMatch !== null) {
				detail = detailMatch[1].trim();
			} else if (noteMatch !== null) {
				const head = noteMatch[1].trim();
				// Block-scalar (`>-`, `>`, `|`, `|-`) note: gather following deeper-indented lines.
				if (head === '>-' || head === '>' || head === '|' || head === '|-') {
					i += 1;
					const noteLines: string[] = [];
					while (i < range.endLine) {
						const nl = lines[i];
						if (nl.trim() === '') {
							noteLines.push('');
							rawLines.push(nl);
							i += 1;
							continue;
						}
						// Body of the note must be indented at least one level deeper than `note:`.
						const noteBodyIndentMatch = nl.match(/^(\s+)\S/);
						if (noteBodyIndentMatch === null) break;
						if (noteBodyIndentMatch[1].length <= bodyIndent.length) break;
						noteLines.push(nl.trim());
						rawLines.push(nl);
						i += 1;
					}
					// Collapse folded block scalar (`>`/`>-`) to spaces; preserve newlines for `|`/`|-`.
					if (head === '|' || head === '|-') {
						note = noteLines.join('\n').trim();
					} else {
						note = noteLines.join(' ').replace(/\s+/g, ' ').trim();
					}
					continue;
				}
				// Trim surrounding quotes if any.
				note = head.replace(/^['"]|['"]$/g, '');
			}
			i += 1;
		}
		// Trim trailing blank lines from rawLines.
		while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') {
			rawLines.pop();
		}
		const endLine = startLine + rawLines.length - 1;
		out.push({
			relPath,
			startLine,
			endLine,
			bodyIndent,
			rawYaml: rawLines.join('\n'),
			source: sourceValue,
			detail,
			note,
		});
	}
	return out;
}

// ---------------------------------------------------------------------------
// Source / detail parsing
// ---------------------------------------------------------------------------

export function parseLegacySource(source: string): ParsedLegacySource | null {
	for (const pattern of HANDBOOK_PATTERNS) {
		if (!pattern.source.test(source)) continue;
		const editionMatch = source.match(pattern.edition);
		if (editionMatch === null) {
			// Pattern matches but no explicit edition tag; can't pin sentinel
			// comparison. Migration leaves these for human review with no
			// proposed rewrite.
			return null;
		}
		return { slug: pattern.slug, edition: editionMatch[0].toUpperCase() };
	}
	return null;
}

/**
 * Parse a legacy `detail` string. Recognised forms:
 *   "Chapter 3 -- Basic Flight Maneuvers"   -> { chapter: 3, chapterTitle: "Basic Flight Maneuvers" }
 *   "Chapter 16 -- Navigation"              -> { chapter: 16, chapterTitle: "Navigation" }
 *   "Chapter 4 -- Slow Flight, Stalls, ..." -> { chapter: 4, chapterTitle: "Slow Flight, Stalls, ..." }
 *   "Chapter on Slow Flight, Stalls, and Spins" -> { chapter: null, chapterTitle: null }
 *   "Recovery from unusual attitudes (visual)"  -> { chapter: null, chapterTitle: null }
 */
export function parseLegacyDetail(detail: string): ParsedLegacyDetail {
	// `Chapter N -- Title` (also `Chapter N - Title` or `Chapter N: Title`).
	const numberedTitled = detail.match(/^Chapter\s+(\d+)\s*(?:--?|—|:)\s*(.+?)\s*$/i);
	if (numberedTitled !== null) {
		return { chapter: Number.parseInt(numberedTitled[1], 10), chapterTitle: numberedTitled[2].trim() };
	}
	// Bare `Chapter N` (no title).
	const numberedOnly = detail.match(/^Chapter\s+(\d+)\b/i);
	if (numberedOnly !== null) {
		return { chapter: Number.parseInt(numberedOnly[1], 10), chapterTitle: null };
	}
	return { chapter: null, chapterTitle: null };
}

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------

/**
 * Find the current edition for a slug by reading the only edition directory
 * present under `handbooks/<slug>/`. If multiple edition dirs exist (mid-
 * transition state), the lexicographically-greatest one wins -- editions
 * sort lexicographically by their letter suffix (`...3C` > `...3B` > `...3A`).
 */
export function findCurrentManifest(repoRoot: string, slug: string): ManifestSnapshot | null {
	const slugDir = join(repoRoot, HANDBOOKS_DIR, slug);
	let entries: readonly string[];
	try {
		entries = readdirSync(slugDir);
	} catch {
		return null;
	}
	const editionDirs: string[] = [];
	for (const e of entries) {
		try {
			const s = statSync(join(slugDir, e));
			if (s.isDirectory()) editionDirs.push(e);
		} catch {
			// ignore
		}
	}
	if (editionDirs.length === 0) return null;
	editionDirs.sort();
	const chosenEditionDir = editionDirs[editionDirs.length - 1];
	return loadManifest(repoRoot, slug, chosenEditionDir);
}

export function loadManifest(repoRoot: string, slug: string, editionDir: string): ManifestSnapshot | null {
	const manifestPath = join(repoRoot, HANDBOOKS_DIR, slug, editionDir, 'manifest.json');
	let raw: string;
	try {
		raw = readFileSync(manifestPath, 'utf8');
	} catch {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const obj = parsed as Record<string, unknown>;
	const edition = typeof obj.edition === 'string' ? obj.edition : editionDir;
	const sectionsRaw = obj.sections;
	if (!Array.isArray(sectionsRaw)) return null;
	const chapters: ManifestChapter[] = [];
	for (const section of sectionsRaw) {
		if (typeof section !== 'object' || section === null) continue;
		const s = section as Record<string, unknown>;
		if (s.level !== 'chapter') continue;
		const code = typeof s.code === 'string' ? s.code : null;
		const title = typeof s.title === 'string' ? s.title : null;
		if (code === null || title === null) continue;
		chapters.push({ code, title });
	}
	return { slug, edition, chapters };
}

function findChapterByCode(snapshot: ManifestSnapshot, chapter: number): ManifestChapter | null {
	const target = String(chapter);
	for (const c of snapshot.chapters) {
		if (c.code === target) return c;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Proposed-rewrite YAML
// ---------------------------------------------------------------------------

/**
 * Build the proposed structured-form YAML body for a citation. Returns the
 * body lines (joined by `\n`) WITHOUT the leading `- ` and WITHOUT the body
 * indent prefix; callers prefix each line with the legacy entry's
 * `bodyIndent` (and the leading `- ` for the first line) when emitting.
 *
 * When `redirectedFrom` is non-null, the proposed YAML carries the
 * well-known `redirected_from:` field (per ADR 019 amendment 2026-05 §2)
 * pointing at the legacy citation's original target. The migration script
 * constructs this from the legacy `(slug, edition, chapter?)` tuple so the
 * rewrite preserves provenance: a later reader can see the citation used
 * to point at FAA-H-8083-3B chapter 4 before the human override moved it
 * to current 3C chapter 4 (or, on a renumbering, somewhere else).
 */
export function buildProposedYaml(args: {
	slug: string;
	chapter: number | null;
	chapterTitle: string | null;
	note: string;
	redirectedFrom: string | null;
}): string {
	const lines: string[] = [];
	const chapterPath = args.chapter === null ? '' : `/${args.chapter}`;
	lines.push(`ref: airboss-ref:handbooks/${args.slug}${chapterPath}`);
	if (args.chapterTitle !== null && args.chapterTitle.length > 0) {
		lines.push(`chapter_title: ${quoteYamlIfNeeded(args.chapterTitle)}`);
	}
	if (args.redirectedFrom !== null && args.redirectedFrom.length > 0) {
		// `airboss-ref:` URIs contain `:` but the colon is never followed by a
		// space, so YAML treats the whole value as a plain scalar (the same way
		// the `ref:` line above does). Emit unquoted to match the `ref:` style.
		lines.push(`redirected_from: ${args.redirectedFrom}`);
	}
	if (args.note.length > 0) {
		lines.push(`note: ${formatYamlScalar(args.note)}`);
	}
	return lines.join('\n');
}

/**
 * Build the original `airboss-ref:` URI for the legacy citation, used as
 * the `redirected_from` value on the proposed rewrite. Composition is
 * intentionally loose -- if we can pin a chapter we do, otherwise we fall
 * back to doc-level (slug + edition). Both are valid airboss-ref URIs per
 * amendment §1's optional-edition grammar; the validator parses without a
 * registry lookup so a retired-edition target stays accepted.
 *
 * Returns null when the legacy citation didn't parse to a recognised
 * (slug, edition) -- the migration leaves those for manual rewrite and
 * has no provenance URI to record.
 */
export function buildOriginalAirbossRef(
	parsedSource: ParsedLegacySource | null,
	chapter: number | null,
): string | null {
	if (parsedSource === null) return null;
	const editionPath = `/${parsedSource.edition}`;
	const chapterPath = chapter === null ? '' : `/${chapter}`;
	return `airboss-ref:handbooks/${parsedSource.slug}${editionPath}${chapterPath}`;
}

function quoteYamlIfNeeded(value: string): string {
	// Quote if the value contains `:` `#` leading-space, or starts with an
	// indicator character (`-`, `?`, `!`, `&`, `*`, `[`, `{`, `,`, `>`, `|`,
	// `'`, `"`, `%`, `@`, `\``).
	if (/^[-?!&*[\]{},>|'"%@`]/.test(value) || /[:#]/.test(value)) {
		return `'${value.replace(/'/g, "''")}'`;
	}
	if (/^\s|\s$/.test(value)) return `'${value.replace(/'/g, "''")}'`;
	return value;
}

function formatYamlScalar(value: string): string {
	// If the value is short and has no special chars, emit inline. Otherwise
	// emit a folded block scalar to mirror existing authored style.
	if (value.length <= 70 && !/[:#\n]/.test(value)) {
		return quoteYamlIfNeeded(value);
	}
	// Folded scalar.
	return `>-\n${value
		.split(/\n/)
		.map((l) => `  ${l}`)
		.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Review file rendering / parsing
// ---------------------------------------------------------------------------

/**
 * Render one row of the review file. Format is intentionally line-stable so
 * the parser on the `--apply` path can read it back without ambiguity.
 */
export function renderReviewRow(row: ReviewRow): string {
	const lines: string[] = [];
	lines.push(REVIEW_ROW_FENCE);
	lines.push(`- [ ] **${row.relPath}** (line ${row.startLine})`);
	lines.push('');
	lines.push('  Legacy citation:');
	lines.push('');
	lines.push('  ```yaml');
	for (const l of row.legacy.rawYaml.split(/\r?\n/)) {
		lines.push(`  ${l}`);
	}
	lines.push('  ```');
	lines.push('');
	lines.push('  Proposed rewrite:');
	lines.push('');
	lines.push('  ```yaml');
	const proposedBody = row.proposedYaml.split(/\r?\n/);
	const firstBody = proposedBody[0] ?? '';
	const restBody = proposedBody.slice(1);
	lines.push(`  - ${firstBody}`);
	for (const l of restBody) {
		lines.push(`    ${l}`);
	}
	lines.push('  ```');
	lines.push('');
	const slugLabel = row.parsedSource === null ? '(unrecognised)' : row.parsedSource.slug;
	const editionLabel = row.parsedSource === null ? '(none)' : row.parsedSource.edition;
	const currentEditionLabel = row.currentEdition ?? '(no current edition on disk)';
	lines.push(`  Slug: \`${slugLabel}\``);
	lines.push(`  Legacy edition: \`${editionLabel}\``);
	lines.push(`  Current edition: \`${currentEditionLabel}\``);
	lines.push(`  Legacy chapter title: ${row.parsedDetail.chapterTitle ?? '_(none parsed from detail)_'}`);
	lines.push(`  Current chapter title: ${row.currentChapterTitle ?? '_(no chapter / not found in current manifest)_'}`);
	lines.push(`  Title match: **${row.titleMatch ? 'yes' : 'no'}**`);
	if (row.notes.length > 0) {
		lines.push('');
		lines.push('  Notes:');
		for (const n of row.notes) {
			lines.push(`  - ${n}`);
		}
	}
	lines.push('');
	return lines.join('\n');
}

export function renderReviewFile(rows: readonly ReviewRow[], existingTicks: ReadonlyMap<string, boolean>): string {
	const head: string[] = [];
	head.push(REVIEW_FILE_HEADING);
	head.push('');
	head.push(
		'Generated by `scripts/db/migrate-knowledge-citations.ts --dry-run`. Per ADR 019 amendment 2026-05 D2, this script does NOT auto-rewrite legacy citations even when chapter titles match. Tick a row to authorise the rewrite, then run `bun scripts/db/migrate-knowledge-citations.ts --apply`.',
	);
	head.push('');
	head.push(`Rows: ${rows.length}`);
	head.push('');
	const body: string[] = [];
	for (const row of rows) {
		const key = tickKey(row.relPath, row.startLine);
		const checked = existingTicks.get(key) === true;
		const rendered = renderReviewRow(row);
		body.push(checked ? rendered.replace('- [ ]', '- [x]') : rendered);
	}
	return `${head.join('\n')}\n${body.join('\n')}`;
}

export function tickKey(relPath: string, startLine: number): string {
	return `${relPath}:${startLine}`;
}

/** Parse an existing review file -- only what we need: which rows are ticked. */
export function parseExistingTicks(text: string): Map<string, boolean> {
	const out = new Map<string, boolean>();
	const lines = text.split(/\r?\n/);
	for (const line of lines) {
		const m = line.match(/^- \[([ xX])\]\s+\*\*(.+?)\*\*\s+\(line\s+(\d+)\)/);
		if (m === null) continue;
		const checked = m[1].toLowerCase() === 'x';
		const relPath = m[2];
		const startLine = Number.parseInt(m[3], 10);
		out.set(tickKey(relPath, startLine), checked);
	}
	return out;
}

/**
 * Parse an existing review file's hand-edited "Proposed rewrite" YAML blocks.
 * For each row, returns the YAML body inside the SECOND ```yaml fence (the
 * "Proposed rewrite" block, not the "Legacy citation" block). Lines have
 * their two-space markdown indent stripped so the returned text is at the
 * canonical indent level (e.g. `- ref: ...` at column 0). When a row's
 * proposed-rewrite YAML cannot be located, the row is omitted -- the caller
 * falls back to the script-built proposedYaml for that row.
 */
export function parseExistingProposedRewrites(text: string): Map<string, string> {
	const out = new Map<string, string>();
	const lines = text.split(/\r?\n/);
	let i = 0;
	while (i < lines.length) {
		const head = lines[i].match(/^- \[[ xX]\]\s+\*\*(.+?)\*\*\s+\(line\s+(\d+)\)/);
		if (head === null) {
			i += 1;
			continue;
		}
		const relPath = head[1];
		const startLine = Number.parseInt(head[2], 10);
		// Walk forward to find the SECOND ```yaml fence (the proposed rewrite block).
		// The first fence is the legacy citation. Stop at the next migration-row marker
		// or top-level header so we don't run into the next row.
		let yamlFenceCount = 0;
		let j = i + 1;
		let proposedBody: string | null = null;
		while (j < lines.length) {
			const l = lines[j];
			if (l.startsWith('<!-- migration-row -->') || /^- \[[ xX]\]/.test(l) || /^# /.test(l)) break;
			const fenceMatch = l.match(/^(\s*)```yaml\s*$/);
			if (fenceMatch !== null) {
				yamlFenceCount += 1;
				if (yamlFenceCount === 2) {
					const fenceIndent = fenceMatch[1].length;
					const bodyLines: string[] = [];
					j += 1;
					while (j < lines.length) {
						const bl = lines[j];
						if (/^\s*```\s*$/.test(bl)) break;
						// Strip up to fenceIndent chars of leading indentation
						// (the markdown wrapping that matched the fence) so the
						// YAML body sits at column 0. Do NOT strip more -- the
						// YAML's own body indent is content.
						const stripCount = Math.min(fenceIndent, bl.length - bl.trimStart().length);
						bodyLines.push(bl.slice(stripCount));
						j += 1;
					}
					// Trim trailing blank lines.
					while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
						bodyLines.pop();
					}
					proposedBody = bodyLines.join('\n');
					break;
				}
			}
			j += 1;
		}
		if (proposedBody !== null) {
			out.set(tickKey(relPath, startLine), proposedBody);
		}
		i = j;
	}
	return out;
}

/**
 * Splice a hand-edited "Proposed rewrite" YAML block into a source file,
 * replacing the legacy citation entry at lines [startLine..endLine]. The
 * proposed block contains one or more `- ref:` items at column 0 (already
 * stripped of markdown indent by the parser); we re-indent them to match
 * the source file's list-item indent.
 */
export function applyProposedBlockToText(
	text: string,
	row: ReviewRow,
	proposedBlock: string,
): string {
	const lines = text.split(/\r?\n/);
	// itemIndent is the indent of the legacy `- source:` line; bodyIndent is
	// itemIndent + '  '. Hand-edited block starts each citation with `- ref:`.
	const itemIndent = row.bodyIndent.slice(0, Math.max(0, row.bodyIndent.length - 2));
	const blockLines = proposedBlock.split(/\r?\n/);
	const replacement: string[] = [];
	for (const l of blockLines) {
		if (l === '') {
			replacement.push('');
			continue;
		}
		// A line starting with `- ` is a list-item head: prefix with itemIndent.
		// Anything else is body of the current item: prefix with itemIndent + '  '.
		if (l.startsWith('- ')) {
			replacement.push(`${itemIndent}${l}`);
		} else {
			replacement.push(`${itemIndent}  ${l}`);
		}
	}
	const before = lines.slice(0, row.startLine - 1);
	const after = lines.slice(row.endLine);
	return [...before, ...replacement, ...after].join('\n');
}

// ---------------------------------------------------------------------------
// Building review rows
// ---------------------------------------------------------------------------

export function buildReviewRow(
	legacy: LegacyCitationBlock,
	manifestLookup: (slug: string) => ManifestSnapshot | null,
): ReviewRow {
	const parsedSource = parseLegacySource(legacy.source);
	const parsedDetail = parseLegacyDetail(legacy.detail);
	const notes: string[] = [];
	let currentEdition: string | null = null;
	let currentChapterTitle: string | null = null;
	if (parsedSource === null) {
		notes.push('source string did not match any handbook pattern; needs manual rewrite.');
	} else {
		const manifest = manifestLookup(parsedSource.slug);
		if (manifest === null) {
			notes.push(`no on-disk manifest for slug "${parsedSource.slug}".`);
		} else {
			currentEdition = manifest.edition;
			if (parsedDetail.chapter !== null) {
				const chapter = findChapterByCode(manifest, parsedDetail.chapter);
				if (chapter === null) {
					notes.push(
						`chapter ${parsedDetail.chapter} not found in current edition manifest (${manifest.edition}); the chapter may have been renumbered.`,
					);
				} else {
					currentChapterTitle = chapter.title;
				}
			} else {
				notes.push('detail does not specify a chapter number; rewrite cannot pin a chapter.');
			}
		}
	}
	const titleMatch =
		parsedDetail.chapterTitle !== null &&
		currentChapterTitle !== null &&
		parsedDetail.chapterTitle.trim().toLowerCase() === currentChapterTitle.trim().toLowerCase();
	const redirectedFrom = buildOriginalAirbossRef(parsedSource, parsedDetail.chapter);
	const proposedYaml = buildProposedYaml({
		slug: parsedSource?.slug ?? '<UNKNOWN-SLUG>',
		chapter: parsedDetail.chapter,
		chapterTitle: currentChapterTitle ?? parsedDetail.chapterTitle,
		note: legacy.note,
		redirectedFrom,
	});
	return {
		relPath: legacy.relPath,
		startLine: legacy.startLine,
		endLine: legacy.endLine,
		bodyIndent: legacy.bodyIndent,
		legacy,
		parsedSource,
		parsedDetail,
		currentEdition,
		currentChapterTitle,
		legacyNote: legacy.note,
		proposedYaml,
		titleMatch,
		notes,
	};
}

// ---------------------------------------------------------------------------
// Apply path
// ---------------------------------------------------------------------------

/**
 * Apply a single ticked row to its source file. Returns the new file text.
 * Replaces the line range `[startLine..endLine]` with the proposed YAML
 * indented to match the legacy entry. Idempotent at the level of "if the
 * lines already match the proposed shape, do nothing."
 */
export function applyRewriteToText(text: string, row: ReviewRow): string {
	const lines = text.split(/\r?\n/);
	const itemIndent = row.bodyIndent.slice(0, Math.max(0, row.bodyIndent.length - 2));
	const bodyIndent = row.bodyIndent;
	const proposedLines = row.proposedYaml.split(/\r?\n/);
	const replacement: string[] = [];
	const first = proposedLines[0] ?? '';
	replacement.push(`${itemIndent}- ${first}`);
	for (const l of proposedLines.slice(1)) {
		// Block-scalar continuation already starts with two spaces in our format;
		// indent everything else with bodyIndent.
		if (l.startsWith('  ')) {
			replacement.push(`${bodyIndent}${l}`);
		} else if (l === '') {
			replacement.push('');
		} else {
			replacement.push(`${bodyIndent}${l}`);
		}
	}
	const before = lines.slice(0, row.startLine - 1);
	const after = lines.slice(row.endLine);
	return [...before, ...replacement, ...after].join('\n');
}

// ---------------------------------------------------------------------------
// CLI driver
// ---------------------------------------------------------------------------

export interface RunOptions {
	repoRoot?: string;
	mode: 'dry-run' | 'apply';
	/**
	 * Restrict the run to citations whose parsed slug matches. When omitted,
	 * every legacy handbook citation in the corpus is included.
	 */
	slug?: string;
	/**
	 * Restrict the run to citations whose parsed legacy edition matches.
	 * Edition strings are compared case-insensitively. When omitted, every
	 * edition is included. Combine with `slug` to scope to a specific
	 * (slug, legacy-edition) cohort -- e.g. AFH 3B only.
	 */
	legacyEdition?: string;
}

export interface RunReport {
	mode: 'dry-run' | 'apply';
	rowsScanned: number;
	rowsTicked: number;
	rowsApplied: number;
	rowsLeftAlone: number;
	titleMismatches: number;
	reviewFilePath: string;
	rows: readonly ReviewRow[];
}

export function runMigration(options: RunOptions): RunReport {
	const repoRoot = options.repoRoot ?? REPO_ROOT;
	const knowledgeRoot = join(repoRoot, KNOWLEDGE_DIR);
	const reviewPath = join(repoRoot, REVIEW_FILE_RELPATH);
	const files = walkNodeMd(knowledgeRoot);
	const manifestCache = new Map<string, ManifestSnapshot | null>();
	const manifestLookup = (slug: string): ManifestSnapshot | null => {
		const cached = manifestCache.get(slug);
		if (cached !== undefined) return cached;
		const m = findCurrentManifest(repoRoot, slug);
		manifestCache.set(slug, m);
		return m;
	};
	const allRows: ReviewRow[] = [];
	for (const filePath of files) {
		const text = readFileSync(filePath, 'utf8');
		const relPath = relative(repoRoot, filePath);
		const blocks = extractLegacyCitations(text, relPath);
		for (const block of blocks) {
			// We only emit review rows for citations that actually need migration
			// -- i.e. ones that match a known handbook pattern. Free-text
			// citations to other source families (POH, AOPA, NTSB, etc.) are
			// out of scope for this script and will be addressed in their own
			// per-corpus passes.
			const parsed = parseLegacySource(block.source);
			if (parsed === null) continue;
			if (options.slug !== undefined && parsed.slug !== options.slug) continue;
			if (options.legacyEdition !== undefined && parsed.edition.toLowerCase() !== options.legacyEdition.toLowerCase()) {
				continue;
			}
			allRows.push(buildReviewRow(block, manifestLookup));
		}
	}
	let existingTicks = new Map<string, boolean>();
	let existingProposed = new Map<string, string>();
	try {
		const existing = readFileSync(reviewPath, 'utf8');
		existingTicks = parseExistingTicks(existing);
		existingProposed = parseExistingProposedRewrites(existing);
	} catch {
		// No prior review file -- fine.
	}
	const titleMismatches = allRows.filter((r) => r.parsedDetail.chapterTitle !== null && !r.titleMatch).length;
	if (options.mode === 'dry-run') {
		const rendered = renderReviewFile(allRows, existingTicks);
		writeFileSync(reviewPath, rendered, 'utf8');
		return {
			mode: 'dry-run',
			rowsScanned: allRows.length,
			rowsTicked: Array.from(existingTicks.values()).filter(Boolean).length,
			rowsApplied: 0,
			rowsLeftAlone: allRows.length,
			titleMismatches,
			reviewFilePath: reviewPath,
			rows: allRows,
		};
	}
	// --apply path: only rewrite rows whose checkbox is ticked. Group by file
	// and rewrite each file once, applying ticked rows in descending startLine
	// order so earlier line numbers stay valid as we mutate the buffer.
	const tickedByFile = new Map<string, ReviewRow[]>();
	let tickedCount = 0;
	for (const row of allRows) {
		const key = tickKey(row.relPath, row.startLine);
		if (existingTicks.get(key) !== true) continue;
		tickedCount += 1;
		const arr = tickedByFile.get(row.relPath) ?? [];
		arr.push(row);
		tickedByFile.set(row.relPath, arr);
	}
	let appliedCount = 0;
	for (const [relPath, rows] of tickedByFile) {
		rows.sort((a, b) => b.startLine - a.startLine);
		const fullPath = join(repoRoot, relPath);
		let text = readFileSync(fullPath, 'utf8');
		for (const row of rows) {
			const handEdited = existingProposed.get(tickKey(row.relPath, row.startLine));
			if (handEdited !== undefined && handEdited.trim().length > 0) {
				text = applyProposedBlockToText(text, row, handEdited);
			} else {
				text = applyRewriteToText(text, row);
			}
			appliedCount += 1;
		}
		writeFileSync(fullPath, text, 'utf8');
	}
	return {
		mode: 'apply',
		rowsScanned: allRows.length,
		rowsTicked: tickedCount,
		rowsApplied: appliedCount,
		rowsLeftAlone: allRows.length - appliedCount,
		titleMismatches,
		reviewFilePath: reviewPath,
		rows: allRows,
	};
}

function parseArgs(argv: readonly string[]): RunOptions {
	let mode: RunOptions['mode'] = 'dry-run';
	let slug: string | undefined;
	let legacyEdition: string | undefined;
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === '--dry-run') mode = 'dry-run';
		else if (a === '--apply') mode = 'apply';
		else if (a === '--slug') {
			i += 1;
			slug = argv[i];
		} else if (a === '--legacy-edition') {
			i += 1;
			legacyEdition = argv[i];
		} else {
			process.stderr.write(`migrate-knowledge-citations: unknown flag '${a}'\n`);
			process.exit(1);
		}
	}
	return { mode, slug, legacyEdition };
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const report = runMigration(options);
	process.stdout.write(
		`migrate-knowledge-citations (${report.mode}): scanned ${report.rowsScanned}, ticked ${report.rowsTicked}, applied ${report.rowsApplied}, left-alone ${report.rowsLeftAlone}, title-mismatches ${report.titleMismatches}\n`,
	);
	process.stdout.write(`  review file: ${report.reviewFilePath}\n`);
}

if (import.meta.main) {
	main().catch((err: unknown) => {
		const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
		process.stderr.write(`migrate-knowledge-citations: ${stack}\n`);
		process.exitCode = 1;
	});
}
