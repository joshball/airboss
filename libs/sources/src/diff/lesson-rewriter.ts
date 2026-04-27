/**
 * Phase 5 -- lesson rewriter.
 *
 * Source of truth: ADR 019 §5 (auto-advance step of the versioning workflow).
 *
 * Consumes a `DiffReport`, walks `LESSON_CONTENT_PATHS`, and rewrites
 * `?at=<old>` to `?at=<new>` for every occurrence whose pin-stripped id is
 * in the report's auto-advance set. The rewrite is textual: the URL substring
 * is replaced in place; no AST round-trip; line endings preserved.
 *
 * Idempotent: a second run with the same report mutates nothing.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LESSON_CONTENT_PATHS } from '../check.ts';
import { parseLesson } from '../lesson-parser.ts';
import { stripPin } from '../registry/query.ts';
import type { SourceId } from '../types.ts';
import { ADVANCEABLE_KINDS, type DiffOutcome, type DiffReport, type RewriteReport, type RewriteSkip } from './types.ts';

export interface RewriteOpts {
	readonly cwd?: string;
	/** Tests bypass the dirty-tree check. Production CLI sets `false` (default). */
	readonly skipGitCheck?: boolean;
	/** Override lesson roots. Production reads `LESSON_CONTENT_PATHS`; tests pass fixtures. */
	readonly contentPaths?: readonly string[];
}

const MARKDOWN_EXTENSION = '.md';

export function runRewrite(report: DiffReport, opts: RewriteOpts = {}): RewriteReport {
	const cwd = opts.cwd ?? process.cwd();
	const contentPaths = opts.contentPaths ?? LESSON_CONTENT_PATHS;
	const skipped: RewriteSkip[] = [];

	if (opts.skipGitCheck !== true) {
		const dirty = isGitTreeDirty(cwd);
		if (dirty.dirty) {
			throw new RewriterError(`refusing to rewrite: working tree dirty (${dirty.message})`);
		}
	}

	const advanceMap = buildAdvanceMap(report);

	let filesScanned = 0;
	let filesRewritten = 0;
	let occurrencesAdvanced = 0;

	for (const root of contentPaths) {
		const absRoot = join(cwd, root);
		if (!existsSync(absRoot)) continue;
		for (const file of walkMarkdownFiles(absRoot)) {
			filesScanned += 1;
			let source: string;
			try {
				source = readFileSync(file, 'utf-8');
			} catch (err) {
				skipped.push({ file: relPath(file, cwd), reason: `read failed: ${(err as Error).message}` });
				continue;
			}
			const relFile = relPath(file, cwd);
			const result = rewriteSource(source, relFile, advanceMap, report);
			if (result.changed) {
				writeFileSync(file, result.next, 'utf-8');
				filesRewritten += 1;
				occurrencesAdvanced += result.advanced;
			}
		}
	}

	return {
		schemaVersion: 1,
		corpus: report.corpus,
		editionPair: report.editionPair,
		filesScanned,
		filesRewritten,
		occurrencesAdvanced,
		skipped,
	};
}

export class RewriterError extends Error {}

interface RewriteResult {
	readonly changed: boolean;
	readonly next: string;
	readonly advanced: number;
}

function rewriteSource(
	source: string,
	relFile: string,
	advanceMap: ReadonlyMap<SourceId, AdvanceTarget>,
	report: DiffReport,
): RewriteResult {
	const lesson = parseLesson(relFile, source);
	if (lesson.occurrences.length === 0) {
		return { changed: false, next: source, advanced: 0 };
	}

	let next = source;
	let advanced = 0;
	const seen = new Set<string>();
	for (const occ of lesson.occurrences) {
		const stripped = stripPin(occ.raw) as SourceId;
		const target = advanceMap.get(stripped);
		if (target === undefined) continue;
		// Pin must equal the report's `old` for advancement.
		const oldPinUrl = `${stripped}?at=${report.editionPair.old}`;
		if (occ.raw !== oldPinUrl) continue;
		const newPinUrl = `${target.toId}?at=${report.editionPair.new}`;
		if (seen.has(occ.raw)) continue;
		seen.add(occ.raw);
		// Replace every textual occurrence of the exact raw URL with the new URL.
		// Each replacement counts once per textual hit.
		const before = next;
		next = next.split(occ.raw).join(newPinUrl);
		// Count actual replacements by length difference.
		const diffCount = countOccurrences(before, occ.raw);
		advanced += diffCount;
	}
	return { changed: next !== source, next, advanced };
}

interface AdvanceTarget {
	readonly toId: SourceId;
}

function buildAdvanceMap(report: DiffReport): ReadonlyMap<SourceId, AdvanceTarget> {
	const map = new Map<SourceId, AdvanceTarget>();
	for (const outcome of report.outcomes) {
		if (!ADVANCEABLE_KINDS.has(outcome.kind)) continue;
		const toId = pickAdvanceTarget(outcome);
		if (toId === null) continue;
		map.set(outcome.pair.id, { toId });
	}
	return map;
}

function pickAdvanceTarget(outcome: DiffOutcome): SourceId | null {
	// `auto-advance`: same id, just the pin moves.
	// `alias-silent`: alias `to` may be a single id (always single for silent per ADR 019 §6.1).
	// `alias-merge`: alias `to` is a single merged target.
	if (outcome.kind === 'auto-advance') return outcome.pair.id;
	const to = outcome.aliasTo;
	if (to === undefined) return null;
	if (Array.isArray(to)) return to[0] ?? null; // shouldn't happen for silent/merge per spec
	return to as SourceId;
}

function countOccurrences(haystack: string, needle: string): number {
	if (needle.length === 0) return 0;
	let count = 0;
	let from = 0;
	while (true) {
		const idx = haystack.indexOf(needle, from);
		if (idx === -1) break;
		count += 1;
		from = idx + needle.length;
	}
	return count;
}

function isGitTreeDirty(cwd: string): { readonly dirty: boolean; readonly message: string } {
	try {
		const out = execSync('git status --porcelain', { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
		const trimmed = out.trim();
		if (trimmed.length === 0) return { dirty: false, message: '' };
		const firstLine = trimmed.split('\n')[0] ?? '';
		return { dirty: true, message: firstLine };
	} catch {
		// Not a git tree (or git unavailable). Treat as not-dirty -- the rewriter
		// is being run outside version control and the operator owns the
		// consequence.
		return { dirty: false, message: '' };
	}
}

function relPath(absFile: string, cwd: string): string {
	return absFile.startsWith(`${cwd}/`) ? absFile.slice(cwd.length + 1) : absFile;
}

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

// Suppress unused-import warning for statSync in some environments.
void statSync;
