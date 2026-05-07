#!/usr/bin/env bun

/**
 * Bug-tracker frontmatter lint. Phase 6 of `tracking-system-overhaul`.
 *
 * Validates every `docs/bugs/bug-*.md` against the schema in `@ab/types`.
 * Reports each failure with file path + field name. Exits non-zero on any
 * validation error.
 *
 * Wired into `bun run check` as the `bug-frontmatter` step (see
 * `scripts/check.ts`).
 */

import { loadAllBugs } from '../lib/bug-loader';

interface LintFailure {
	bugPath: string;
	field: string;
	message: string;
}

function lintFrontmatter(): LintFailure[] {
	const failures: LintFailure[] = [];
	const bugs = loadAllBugs();
	for (const bug of bugs) {
		if (bug.validation_errors.length === 0) continue;
		for (const err of bug.validation_errors) {
			failures.push({ bugPath: bug.bugPath, field: err.field, message: err.message });
		}
	}
	return failures;
}

function reportFailures(failures: readonly LintFailure[]): void {
	for (const f of failures) {
		console.error(`  ${f.bugPath}\n    [${f.field}] ${f.message}`);
	}
}

function main(): void {
	const failures = lintFrontmatter();

	if (failures.length === 0) {
		console.log('bug-frontmatter: ok');
		return;
	}

	console.error(`bug-frontmatter: ${failures.length} schema failure(s):`);
	reportFailures(failures);
	process.exit(1);
}

main();
