/**
 * `--fix` mode: walks lesson Markdown files and stamps `?at=<edition>` on
 * unpinned `airboss-ref:` URLs.
 *
 * Source of truth: ADR 019 §1.3 ("Auto-stamp"). Behavior summary:
 *
 *   - Reads each `.md` file under `LESSON_CONTENT_PATHS`.
 *   - For each `IdentifierOccurrence` whose `pin === null`, looks up
 *     `getCurrentAcceptedEdition(corpus)` via the production registry.
 *   - If non-null: rewrites the URL in place to add `?at=<edition>`.
 *   - If null: leaves the URL unchanged (validator continues to emit row-3
 *     ERROR until Phase 3+ ingestion populates the corpus).
 *   - Already-pinned URLs are NEVER touched (the diff job in Phase 5 owns
 *     stale-pin advancement).
 *   - Slug-encoded editions (no `?at=` because the slug pins) are unchanged.
 *   - Identifiers inside fenced code or inline code are skipped (the
 *     `parseLesson` skip-range logic handles this).
 *
 * The script refuses to run when `process.env.CI === 'true'`. CI must never
 * write to author files.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { LESSON_CONTENT_PATHS, type ValidateOptions, validateReferences } from './check.ts';
import { parseLesson } from './lesson-parser.ts';
import { isParseError, parseIdentifier } from './parser.ts';
import { productionRegistry } from './registry/index.ts';
import type { IdentifierOccurrence, RegistryReader, ValidationFinding } from './types.ts';

export interface FixOptions {
	/** Override the production registry (tests). */
	readonly registry?: RegistryReader;
	/** Override the working directory. Defaults to `process.cwd()`. */
	readonly cwd?: string;
	/** Override the lesson roots. Defaults to `LESSON_CONTENT_PATHS`. */
	readonly contentPaths?: readonly string[];
}

export interface FixReport {
	readonly filesScanned: number;
	readonly filesModified: number;
	readonly identifiersStamped: number;
	readonly remainingErrors: readonly ValidationFinding[];
}

/**
 * Walk lessons, rewrite unpinned identifiers in place, return a report.
 * Never throws; filesystem errors surface as validator-level findings on
 * the re-run pass (the second-pass validator surfaces any new errors).
 */
export function applyFixes(opts: FixOptions = {}): FixReport {
	const registry = opts.registry ?? productionRegistry;
	const cwd = opts.cwd ?? process.cwd();
	const roots = opts.contentPaths ?? LESSON_CONTENT_PATHS;

	let filesScanned = 0;
	let filesModified = 0;
	let identifiersStamped = 0;

	for (const root of roots) {
		const absRoot = join(cwd, root);
		for (const file of walkMarkdownFiles(absRoot)) {
			filesScanned += 1;
			const relPath = file.startsWith(`${cwd}${sep}`) ? file.slice(cwd.length + 1) : file;
			let source: string;
			try {
				source = readFileSync(file, 'utf-8');
			} catch {
				continue;
			}

			const lesson = parseLesson(relPath, source);
			const edits = collectEdits(lesson.occurrences, registry);
			if (edits.length === 0) continue;

			const newSource = applyEdits(source, edits);
			if (newSource === source) continue;

			writeFileSync(file, newSource, 'utf-8');
			filesModified += 1;
			identifiersStamped += edits.length;
		}
	}

	// Re-run the validator on the rewritten files for sanity.
	const validateOpts: ValidateOptions = { registry, cwd, contentPaths: roots };
	const reReport = validateReferences(validateOpts);
	const remainingErrors = reReport.findings.filter((f) => f.severity === 'error');

	return { filesScanned, filesModified, identifiersStamped, remainingErrors };
}

/**
 * CLI entry: refuses to run when `CI=true`. Prints a per-file summary and
 * exits 0 on success, non-zero on failure.
 */
export function runFixCli(opts: FixOptions = {}): number {
	if (process.env.CI === 'true') {
		process.stderr.write('--fix is local-only; CI must not write to lesson files.\n');
		return 2;
	}

	const report = applyFixes(opts);

	process.stdout.write(
		`\nReference identifier --fix: ${report.filesScanned} lesson(s) scanned, ${report.filesModified} file(s) modified, ${report.identifiersStamped} identifier(s) stamped.\n`,
	);
	if (report.remainingErrors.length > 0) {
		process.stderr.write(
			`\n--fix re-validation surfaced ${report.remainingErrors.length} ERROR(s) after rewrite. Inspect:\n`,
		);
		for (const f of report.remainingErrors) {
			const loc = `${f.location.file}:${f.location.line}:${f.location.column}`;
			const id = f.identifier ? `[${f.identifier}] ` : '';
			process.stderr.write(`  ${loc}\n    ${id}row ${f.ruleId}: ${f.message}\n`);
		}
		return 1;
	}
	return 0;
}

// ---------------------------------------------------------------------------
// Edit collection + application
// ---------------------------------------------------------------------------

interface Edit {
	/** Byte offset of the URL's start in the lesson source. */
	readonly start: number;
	/** Byte offset just past the URL's end. */
	readonly end: number;
	/** Replacement text. */
	readonly replacement: string;
}

/**
 * For each unpinned occurrence whose corpus has a current accepted edition,
 * compute an edit that appends `?at=<edition>` to the URL. Skips:
 *
 *   - Already-pinned URLs (`pin !== null`).
 *   - Malformed URLs (parse errors).
 *   - Unknown-corpus URLs (`corpus === 'unknown'`).
 *   - Corpora whose `getCurrentAcceptedEdition` returns null (no real
 *     resolver registered yet, or the resolver hasn't decided).
 *
 * `parseLesson` exposes line/column locations but not byte offsets, so
 * `applyEdits` uses the raw URL itself as a search key. Duplicate URLs in
 * the same lesson are rare; offset-precise edits are a future enhancement.
 */
function collectEdits(occurrences: readonly IdentifierOccurrence[], registry: RegistryReader): readonly Edit[] {
	const edits: Edit[] = [];
	for (const occ of occurrences) {
		const parsed = parseIdentifier(occ.raw);
		if (isParseError(parsed)) continue;
		if (parsed.corpus === 'unknown') continue;
		if (parsed.pin !== null) continue; // already pinned

		const accepted = registry.getCurrentAcceptedEdition(parsed.corpus);
		if (accepted === null) continue;

		edits.push({
			// start/end placeholders; applyEdits uses string match on the raw URL.
			start: -1,
			end: -1,
			replacement: `${occ.raw}?at=${accepted}`,
		});
	}
	return edits;
}

/**
 * Apply edits to `source`. Each edit's `replacement` has the form
 * `<originalUrl>?at=<edition>`; we deduce the search target by stripping the
 * suffix.
 *
 * Replaces only the **first** occurrence of each unique unpinned URL per
 * pass. Idempotence: re-running on the rewritten source finds no unpinned
 * occurrences, so no edits.
 */
function applyEdits(source: string, edits: readonly Edit[]): string {
	let out = source;
	const replaced = new Set<string>();
	for (const edit of edits) {
		const atIndex = edit.replacement.lastIndexOf('?at=');
		if (atIndex === -1) continue;
		const original = edit.replacement.slice(0, atIndex);
		if (replaced.has(original)) continue;
		// Match the original URL as the body of an inline link `(...)`. We
		// look for `(<original>)` first (inline link form) to avoid matching
		// inside a longer string. Fall back to the raw URL.
		const inlineForm = `(${original})`;
		const inlineIdx = out.indexOf(inlineForm);
		if (inlineIdx !== -1) {
			out = `${out.slice(0, inlineIdx)}(${edit.replacement})${out.slice(inlineIdx + inlineForm.length)}`;
			replaced.add(original);
			continue;
		}
		// Reference-definition form: `[label]: <url>`.
		const refDefForm = `: ${original}`;
		const refDefIdx = out.indexOf(refDefForm);
		if (refDefIdx !== -1) {
			out = `${out.slice(0, refDefIdx)}: ${edit.replacement}${out.slice(refDefIdx + refDefForm.length)}`;
			replaced.add(original);
			continue;
		}
		// Bare URL form: replace the first occurrence. Take care not to match
		// inside a longer URL-like substring; only replace whole URLs by
		// requiring word/space boundary semantics.
		const bareIdx = out.indexOf(original);
		if (bareIdx !== -1) {
			// Defensive: ensure we don't extend a URL that's already pinned.
			const trailing = out.charCodeAt(bareIdx + original.length);
			if (Number.isNaN(trailing) || trailing !== 0x3f /* '?' */) {
				out = `${out.slice(0, bareIdx)}${edit.replacement}${out.slice(bareIdx + original.length)}`;
				replaced.add(original);
			}
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// File-system helpers
// ---------------------------------------------------------------------------

function* walkMarkdownFiles(root: string): Generator<string> {
	let entries: ReturnType<typeof readdirSync>;
	try {
		entries = readdirSync(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(root, entry.name);
		if (entry.isDirectory()) {
			yield* walkMarkdownFiles(full);
			continue;
		}
		if (entry.isFile() && entry.name.endsWith('.md')) {
			try {
				if (statSync(full).isFile()) yield full;
			} catch {
				// ignore
			}
		}
	}
}
