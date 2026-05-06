/**
 * Markdown formatter -- pure functions.
 *
 * Reformats a markdown document to satisfy a small set of markdownlint-style
 * rules. The transforms are pure (string in, string out) so they can be unit
 * tested without the filesystem. The CLI in `bin.ts` wires them up.
 *
 * Rules applied:
 *   - MD060: pipe-table alignment (every `|` at the same column per row,
 *     separator dashes match column width).
 *   - MD022: blank line before AND after headings.
 *   - MD031: blank line before and after fenced code blocks.
 *   - MD032: blank line before and after lists.
 *   - MD040: bare ` ``` ` opening fences become ` ```text `.
 *
 * Skipped:
 *   - Content inside fenced code blocks (tables inside fences are left alone).
 *   - YAML frontmatter (the first `---` ... `---` block at the top of the file).
 *   - HTML blocks (lines starting with `<` at column 0 are passed through).
 */

const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^(\s*)(```+|~~~+)\s*(\S*)\s*$/;
const LIST_RE = /^(\s*)([-*+]\s+|\d+\.\s+)/;
const TABLE_ROW_RE = /^\s*\|/;

interface Region {
	frontmatterEnd: number; // exclusive index, or 0 if none
}

function detectFrontmatter(lines: readonly string[]): Region {
	if (lines.length === 0 || lines[0] !== '---') return { frontmatterEnd: 0 };
	for (let i = 1; i < lines.length; i += 1) {
		if (lines[i] === '---') return { frontmatterEnd: i + 1 };
	}
	return { frontmatterEnd: 0 };
}

function isBlank(line: string | undefined): boolean {
	return line === undefined || line.trim() === '';
}

interface FenceInfo {
	marker: string; // ``` or ~~~
	indent: string;
	lang: string;
}

function parseFence(line: string): FenceInfo | null {
	const m = FENCE_RE.exec(line);
	if (m === null) return null;
	const indent = m[1] ?? '';
	const marker = m[2] ?? '';
	const lang = m[3] ?? '';
	return { marker, indent, lang };
}

/** Pipe-table alignment, ported from md-align-table.py. Operates on a
 * contiguous block of table rows (non-empty lines starting with `|`). */
function alignTableBlock(block: readonly string[]): string[] {
	if (block.length < 2) return [...block];
	const rows: string[][] = [];
	for (const line of block) {
		const stripped = line.trim();
		const cells = stripped.split('|').map((c) => c.trim());
		// Drop the leading and trailing empty cells produced by the bookend pipes.
		const trimmed = cells.slice();
		if (trimmed.length > 0 && trimmed[0] === '') trimmed.shift();
		if (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') trimmed.pop();
		rows.push(trimmed);
	}
	const numCols = rows.reduce((acc, r) => Math.max(acc, r.length), 0);
	for (const r of rows) {
		while (r.length < numCols) r.push('');
	}
	const widths = new Array(numCols).fill(0) as number[];
	for (let i = 0; i < rows.length; i += 1) {
		if (i === 1) continue; // separator row excluded from width calc
		const row = rows[i] ?? [];
		for (let j = 0; j < row.length; j += 1) {
			widths[j] = Math.max(widths[j] ?? 0, (row[j] ?? '').length);
		}
	}
	for (let j = 0; j < widths.length; j += 1) {
		widths[j] = Math.max(widths[j] ?? 0, 3);
	}
	const out: string[] = [];
	for (let i = 0; i < rows.length; i += 1) {
		const row = rows[i] ?? [];
		let parts: string[];
		if (i === 1) {
			parts = widths.map((w) => '-'.repeat(w));
		} else {
			parts = row.map((cell, j) => cell.padEnd(widths[j] ?? 0, ' '));
		}
		out.push(`| ${parts.join(' | ')} |`);
	}
	return out;
}

/**
 * Format a markdown document. Returns the formatted string. If the input is
 * already canonical, the output equals the input.
 */
export function formatMarkdown(input: string): string {
	const lines = input.split('\n');
	const region = detectFrontmatter(lines);
	const out: string[] = [];

	// Pass through frontmatter unchanged.
	for (let i = 0; i < region.frontmatterEnd; i += 1) {
		out.push(lines[i] ?? '');
	}

	let i = region.frontmatterEnd;
	let inFence: FenceInfo | null = null;

	while (i < lines.length) {
		const line = lines[i] ?? '';

		// Fenced code block handling.
		if (inFence !== null) {
			out.push(line);
			const closing = parseFence(line);
			if (closing !== null && closing.marker.startsWith(inFence.marker[0] ?? '')) {
				inFence = null;
				// MD031: blank line after fence close.
				const next = lines[i + 1];
				if (!isBlank(next) && next !== undefined) {
					out.push('');
				}
			}
			i += 1;
			continue;
		}

		const fence = parseFence(line);
		if (fence !== null) {
			// MD031: blank line before fence open.
			if (out.length > 0 && !isBlank(out[out.length - 1])) {
				out.push('');
			}
			// MD040: bare fence -> ```text.
			if (fence.lang === '') {
				out.push(`${fence.indent}${fence.marker}text`);
			} else {
				out.push(line);
			}
			inFence = fence;
			i += 1;
			continue;
		}

		// Heading: blank line before AND after.
		if (HEADING_RE.test(line)) {
			if (out.length > 0 && !isBlank(out[out.length - 1])) {
				out.push('');
			}
			out.push(line);
			const next = lines[i + 1];
			if (!isBlank(next) && next !== undefined) {
				out.push('');
			}
			i += 1;
			continue;
		}

		// Table block: collect contiguous `|`-prefixed lines, align, emit.
		if (TABLE_ROW_RE.test(line)) {
			const block: string[] = [];
			let j = i;
			while (j < lines.length && TABLE_ROW_RE.test(lines[j] ?? '')) {
				block.push(lines[j] ?? '');
				j += 1;
			}
			// MD032-ish: blank line before block.
			if (out.length > 0 && !isBlank(out[out.length - 1])) {
				out.push('');
			}
			for (const row of alignTableBlock(block)) out.push(row);
			// blank line after block.
			const next = lines[j];
			if (!isBlank(next) && next !== undefined) {
				out.push('');
			}
			i = j;
			continue;
		}

		// List item: ensure blank line before list start (MD032).
		if (LIST_RE.test(line)) {
			const prev = out[out.length - 1];
			const prevWasList = prev !== undefined && LIST_RE.test(prev);
			const prevWasIndented = prev !== undefined && prev.length > 0 && /^\s/.test(prev);
			if (out.length > 0 && !isBlank(prev) && !prevWasList && !prevWasIndented) {
				out.push('');
			}
			out.push(line);
			i += 1;
			// On the line that closes the list, MD032 wants a blank after.
			// We detect "list closed" lazily: handled by future heading/fence/table
			// emission, which always inserts a blank before themselves.
			continue;
		}

		out.push(line);
		i += 1;
	}

	// Collapse runs of >2 blank lines into exactly 1 (MD012-ish, conservative
	// to avoid noisy diffs we don't enforce strictly here).
	const collapsed: string[] = [];
	let blankRun = 0;
	for (const l of out) {
		if (isBlank(l)) {
			blankRun += 1;
			if (blankRun <= 1) collapsed.push('');
		} else {
			blankRun = 0;
			collapsed.push(l);
		}
	}

	// Preserve trailing newline parity with the input.
	const result = collapsed.join('\n');
	if (input.endsWith('\n') && !result.endsWith('\n')) return `${result}\n`;
	if (!input.endsWith('\n') && result.endsWith('\n')) return result.slice(0, -1);
	return result;
}
