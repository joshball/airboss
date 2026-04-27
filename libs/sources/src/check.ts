/**
 * `bun run check` entry-point for the airboss-ref: validator.
 *
 * Walks every Markdown file under `LESSON_CONTENT_PATHS`, runs the
 * lesson-parser, then runs the rule engine on each identifier occurrence,
 * and prints findings grouped by severity. ERROR findings exit non-zero;
 * WARNING and NOTICE findings print but don't block.
 *
 * Used both from `scripts/check.ts` (the project-wide gate) and from a CLI
 * entry-point for ad-hoc runs.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseLesson } from './lesson-parser.ts';
import { isParseError, parseIdentifier } from './parser.ts';
import { NULL_REGISTRY } from './registry-stub.ts';
import type { ParsedIdentifier, RegistryReader, ValidationFinding } from './types.ts';
import { type RuleContext, validateIdentifier } from './validator.ts';

/**
 * Lesson content paths the validator walks. Phase 1 ships only `course/regulations/`.
 * Future corpora (handbooks, AIM, ACs) add their content paths here as they
 * come online.
 */
export const LESSON_CONTENT_PATHS: readonly string[] = ['course/regulations'] as const;

const MARKDOWN_EXTENSION = '.md';

export interface ValidateOptions {
	/**
	 * Override the default `NULL_REGISTRY`. Phase 2's registry-core lib will
	 * pass its real `RegistryReader` here; today only tests use this hook.
	 */
	readonly registry?: RegistryReader;
	/**
	 * Override the lesson content roots. Tests pass fixture directories;
	 * production callers leave it undefined to walk `LESSON_CONTENT_PATHS`.
	 */
	readonly contentPaths?: readonly string[];
	/**
	 * Override the working directory. Defaults to `process.cwd()`. Tests use
	 * this to isolate fixture corpora.
	 */
	readonly cwd?: string;
}

export interface ValidateReport {
	readonly filesScanned: number;
	readonly identifiersFound: number;
	readonly findings: readonly ValidationFinding[];
}

/**
 * Walk lesson Markdown files, parse + validate, and return aggregated findings.
 *
 * Never throws. File-system errors and YAML parse errors land on the report's
 * `findings` array.
 */
export function validateReferences(opts: ValidateOptions = {}): ValidateReport {
	const registry = opts.registry ?? NULL_REGISTRY;
	const cwd = opts.cwd ?? process.cwd();
	const roots = opts.contentPaths ?? LESSON_CONTENT_PATHS;

	const findings: ValidationFinding[] = [];
	let filesScanned = 0;
	let identifiersFound = 0;

	for (const root of roots) {
		const absRoot = join(cwd, root);
		if (!exists(absRoot)) continue;
		for (const file of walkMarkdownFiles(absRoot)) {
			filesScanned += 1;
			const relPath = file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : file;
			let source: string;
			try {
				source = readFileSync(file, 'utf-8');
			} catch (err) {
				findings.push({
					severity: 'error',
					ruleId: -1,
					message: `failed to read lesson: ${(err as Error).message}`,
					location: { file: relPath, line: 1, column: 1 },
					identifier: null,
				});
				continue;
			}

			const lesson = parseLesson(relPath, source);
			findings.push(...lesson.findings);

			for (const occ of lesson.occurrences) {
				identifiersFound += 1;
				const parsed = parseIdentifier(occ.raw);
				const parseError = isParseError(parsed) ? parsed : undefined;
				const parsedOk: ParsedIdentifier | null = isParseError(parsed) ? null : parsed;

				const ctx: RuleContext = {
					registry,
					location: occ.location,
					occurrence: occ,
					acknowledgments: lesson.acknowledgments,
				};
				const occFindings = validateIdentifier(parsedOk, ctx, parseError);
				findings.push(...occFindings);
			}
		}
	}

	return { filesScanned, identifiersFound, findings };
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------

/**
 * Run the validator and print a CLI-style report. Exit code 0 if no ERROR
 * findings; non-zero otherwise. Called by `scripts/check.ts` and the
 * `airboss-ref` script alias.
 */
export function runCli(opts: ValidateOptions = {}): number {
	const report = validateReferences(opts);
	const errors = report.findings.filter((f) => f.severity === 'error');
	const warnings = report.findings.filter((f) => f.severity === 'warning');
	const notices = report.findings.filter((f) => f.severity === 'notice');

	if (errors.length > 0) {
		process.stderr.write(`\nReference identifier validation: ${errors.length} ERROR(s)\n`);
		for (const f of errors) {
			process.stderr.write(formatFinding(f));
		}
	}
	if (warnings.length > 0) {
		process.stdout.write(`\nReference identifier validation: ${warnings.length} WARNING(s)\n`);
		for (const f of warnings) {
			process.stdout.write(formatFinding(f));
		}
	}
	if (notices.length > 0) {
		process.stdout.write(`\nReference identifier validation: ${notices.length} NOTICE(s)\n`);
		for (const f of notices) {
			process.stdout.write(formatFinding(f));
		}
	}

	process.stdout.write(
		`\nReference identifier validation: ${report.filesScanned} lesson(s) scanned, ${report.identifiersFound} identifier(s) found, ${report.findings.length} finding(s).\n`,
	);

	return errors.length > 0 ? 1 : 0;
}

function formatFinding(f: ValidationFinding): string {
	const ruleTag = f.ruleId >= 0 ? `row ${f.ruleId}` : 'lesson-parser';
	const id = f.identifier ? `[${f.identifier}] ` : '';
	const loc = `${f.location.file}:${f.location.line}:${f.location.column}`;
	return `  ${loc}\n    ${id}${ruleTag}: ${f.message}\n`;
}

// ---------------------------------------------------------------------------
// File-system helpers
// ---------------------------------------------------------------------------

function* walkMarkdownFiles(root: string): Generator<string> {
	const stack: string[] = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined) break;
		let entries: ReturnType<typeof readdirSync>;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(full);
			} else if (entry.isFile() && entry.name.endsWith(MARKDOWN_EXTENSION)) {
				yield full;
			}
		}
	}
}

function exists(path: string): boolean {
	try {
		statSync(path);
		return true;
	} catch {
		return false;
	}
}
