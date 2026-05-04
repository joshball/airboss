/**
 * Test-plan markdown parser.
 *
 * Converts a `docs/work-packages/<wp>/test-plan.md` into a flat list of steps
 * suitable for the test-plan walker. Each table row in the plan becomes one
 * step; the step's `stepRef` is a stable hash of `(filePath || '|' || h2 ||
 * '|' || rowIndex)` so renumbering rows or reordering sections invalidates
 * the prior session steps cleanly rather than silently re-mapping outcomes
 * onto the wrong row.
 *
 * v1 supports table rows only. Future test plans that switch to checklists
 * (`- [ ] step ...`) extend the parser; the data shape is forward-compatible.
 *
 * Server-only: takes the raw markdown body (caller reads the file) so the
 * parser itself has no filesystem dependency. Lives in the BC because the
 * caller is the loader / walker server load, both of which are server code.
 */

import { createHash } from 'node:crypto';
import { stripFrontmatter } from '@ab/utils';

export interface TestPlanStep {
	/** 1-based step index across the entire plan (top-to-bottom across all tables). */
	readonly stepIndex: number;
	/** H2 heading the step lives under (empty when the row is before any H2). */
	readonly sectionTitle: string;
	/** Column 1 of the row -- typically a step number / short label. */
	readonly title: string;
	/** Column 2 -- the action the reviewer performs. */
	readonly action: string;
	/** Column 3 -- the expected outcome. */
	readonly expected: string;
	/** Stable id used as the walker's idempotency key on `review_step.stepRef`. */
	readonly stepRef: string;
}

/**
 * Parse a test-plan markdown body into walker steps. `filePath` is repo-relative
 * (e.g. `docs/work-packages/foo/test-plan.md`) and feeds into the `stepRef` hash;
 * passing the same file path with the same content always produces the same
 * `stepRef`s.
 */
export function parseTestPlan(filePath: string, markdown: string): readonly TestPlanStep[] {
	const body = stripFrontmatter(markdown);
	const lines = body.split(/\r?\n/);
	const steps: TestPlanStep[] = [];
	let sectionTitle = '';
	let stepIndex = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const h2Match = line.match(/^##\s+(.+?)\s*$/);
		if (h2Match) {
			sectionTitle = (h2Match[1] ?? '').trim();
			continue;
		}
		// A table starts with a header row (`| col | col |`) followed by a
		// separator row (`| --- | --- |`). Detect the separator on its own
		// line so we don't misread a paragraph that happens to contain pipes.
		if (!isTableSeparator(line)) continue;
		if (i === 0) continue;
		const headerLine = lines[i - 1];
		if (headerLine === undefined || !isTableHeader(headerLine)) continue;
		// Walk forward, consuming rows until we hit a non-row line.
		let rowIndex = 0;
		let j = i + 1;
		while (j < lines.length) {
			const row = lines[j];
			if (row === undefined) break;
			if (!isTableRow(row)) break;
			const cells = parseTableRow(row);
			if (cells.length >= 3) {
				stepIndex += 1;
				const title = cells[0] ?? '';
				const action = cells[1] ?? '';
				const expected = cells[2] ?? '';
				const stepRef = hashStepRef(filePath, sectionTitle, rowIndex);
				steps.push({ stepIndex, sectionTitle, title, action, expected, stepRef });
			}
			rowIndex += 1;
			j += 1;
		}
		// Skip past the consumed rows so the outer loop doesn't re-enter this table.
		i = j - 1;
	}
	return steps;
}

function isTableSeparator(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
	const inner = trimmed.slice(1, -1);
	// One or more dashes per cell (with optional leading / trailing colon for
	// alignment markers). GitHub-flavored markdown allows `:--`, `--:`, `:--:`.
	return inner.split('|').every((cell) => /^\s*:?-+:?\s*$/.test(cell));
}

function isTableHeader(line: string): boolean {
	const trimmed = line.trim();
	return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|', 1);
}

function isTableRow(line: string): boolean {
	const trimmed = line.trim();
	return trimmed.startsWith('|') && trimmed.endsWith('|');
}

function parseTableRow(line: string): readonly string[] {
	const trimmed = line.trim();
	const inner = trimmed.slice(1, -1);
	return inner.split('|').map((cell) => cell.trim());
}

/**
 * Hash a step's source location into a stable 12-character id. Renumbering a
 * row (changing its `rowIndex`) or reordering sections (changing the H2
 * heading) invalidates the prior step cleanly: the new id is different, so
 * recordStep cannot accidentally overwrite a row that was valid before the
 * edit.
 */
function hashStepRef(filePath: string, sectionTitle: string, rowIndex: number): string {
	const hash = createHash('sha256');
	hash.update(filePath);
	hash.update('|');
	hash.update(sectionTitle);
	hash.update('|');
	hash.update(String(rowIndex));
	return hash.digest('hex').slice(0, 12);
}
