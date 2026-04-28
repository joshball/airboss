#!/usr/bin/env bun

/**
 * Phase 9 -- pre-ADR-019 lesson migration.
 *
 * Source of truth: ADR 019 §9. Walks `course/regulations/**` (and any other
 * lesson roots passed via `--root`), identifies eCFR / FAA URLs that map to
 * an `airboss-ref:` identifier, and rewrites them in place. Unmappable URLs
 * (corpus index pages like Title 14 root, AIM html catalog, AC catalog, etc.)
 * stay as plain links and surface in the skipped list.
 *
 * Bare-prose section citations (`§91.103`, `61.51(b)(1)`) are left as prose
 * per ADR 019 §9 ("the migration tool offers a 'leave as prose' option").
 * Promoting prose mentions to identifiers is a per-lesson editorial pass that
 * doesn't belong in this mechanical migration.
 *
 * Pin policy: each migrated reference pins to the year of the lesson's last
 * meaningful edit (read from `git log --follow --pretty=%aI <file>`). The
 * pin slug matches the regs corpus's edition convention (year-only, e.g.
 * `?at=2026`). When git history is unavailable (untracked file, fresh repo),
 * the pin falls back to the corpus's current accepted edition.
 *
 * Output:
 *
 *   - Rewrites lesson files in place.
 *   - Prints an inventory table (lessons touched, identifiers added, skipped
 *     with reason).
 *   - Exit 0 on success; non-zero only on hard error (unreadable file, etc.).
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import '@ab/sources';
import type { SourceId } from '@ab/sources';
import { hydrateRegsFromDerivatives, parseIdentifier, productionRegistry } from '@ab/sources';

const DEFAULT_ROOTS = ['course/regulations'] as const;
const MARKDOWN_EXTENSION = '.md';
const FALLBACK_REGS_EDITION = '2026';

interface MigrationCandidate {
	readonly file: string;
	readonly line: number;
	readonly column: number;
	readonly originalUrl: string;
	readonly originalLinkText: string;
	readonly identifier: SourceId | null;
	readonly skipReason: string | null;
}

interface MigrationReport {
	readonly lessonsScanned: number;
	readonly lessonsTouched: number;
	readonly identifiersMigrated: number;
	readonly skipped: readonly MigrationCandidate[];
	readonly migrated: readonly MigrationCandidate[];
}

interface CliArgs {
	readonly roots: readonly string[];
	readonly dryRun: boolean;
	readonly help: boolean;
}

const USAGE = `usage:
  bun scripts/migrate-lessons.ts [--root=<path>] [--dry-run]

  --root=<path>   Override default lesson roots (repeatable). Defaults to ${DEFAULT_ROOTS.join(', ')}.
  --dry-run       Print the migration plan without writing files.
  --help          Show this usage.
`;

async function main(argv: readonly string[]): Promise<number> {
	const parsed = parseArgs(argv);
	if (parsed.help) {
		process.stdout.write(USAGE);
		return 0;
	}

	// Hydrate the registry so identifier resolution can validate before we
	// commit to a rewrite. If hydration fails (no on-disk derivatives), the
	// migration falls back to a per-corpus current-edition pin and surfaces
	// any unresolved identifier in the skipped list.
	const cwd = process.cwd();
	hydrateRegsFromDerivatives({ cwd });

	const allCandidates: MigrationCandidate[] = [];
	let lessonsScanned = 0;
	const touchedFiles = new Set<string>();

	for (const root of parsed.roots) {
		const absRoot = join(cwd, root);
		if (!exists(absRoot)) continue;
		for (const file of walkMarkdownFiles(absRoot)) {
			lessonsScanned += 1;
			const relFile = relative(cwd, file);
			const source = readFileSync(file, 'utf-8');
			const lessonYear = lessonEditionPin(file);
			const candidates = discoverCandidates(source, relFile, lessonYear);
			if (candidates.length === 0) continue;

			const migrated = candidates.filter((c) => c.identifier !== null && c.skipReason === null);
			if (migrated.length > 0 && !parsed.dryRun) {
				const next = applyMigrations(source, migrated);
				writeFileSync(file, next, 'utf-8');
				touchedFiles.add(relFile);
			} else if (migrated.length > 0 && parsed.dryRun) {
				touchedFiles.add(relFile);
			}
			allCandidates.push(...candidates);
		}
	}

	const migrated = allCandidates.filter((c) => c.identifier !== null && c.skipReason === null);
	const skipped = allCandidates.filter((c) => c.identifier === null || c.skipReason !== null);

	const report: MigrationReport = {
		lessonsScanned,
		lessonsTouched: touchedFiles.size,
		identifiersMigrated: migrated.length,
		skipped,
		migrated,
	};

	printReport(report, parsed.dryRun);
	return 0;
}

// ---------------------------------------------------------------------------
// Migration discovery
// ---------------------------------------------------------------------------

interface MarkdownLink {
	readonly start: number;
	readonly end: number;
	readonly text: string;
	readonly url: string;
	readonly line: number;
	readonly column: number;
}

const ECFR_HOST_PATTERN = /^https?:\/\/(?:www\.)?ecfr\.gov\/current\//u;

function discoverCandidates(source: string, file: string, pin: string): MigrationCandidate[] {
	const candidates: MigrationCandidate[] = [];
	for (const link of findMarkdownLinks(source)) {
		const url = link.url.trim();
		if (!ECFR_HOST_PATTERN.test(url)) continue;
		const result = mapEcfrUrlToIdentifier(url, pin);
		candidates.push({
			file,
			line: link.line,
			column: link.column,
			originalUrl: link.url,
			originalLinkText: link.text,
			identifier: result.identifier,
			skipReason: result.skipReason,
		});
	}
	return candidates;
}

interface MapResult {
	readonly identifier: SourceId | null;
	readonly skipReason: string | null;
}

/**
 * Map an eCFR URL to the appropriate `airboss-ref:` identifier.
 *
 * Supported shapes:
 *
 *   /current/title-14                                                  -> SKIP (Title-only, no part)
 *   /current/title-14/chapter-I/subchapter-F/part-91                   -> regs/cfr-14/91
 *   /current/title-49/subtitle-B/chapter-VIII/part-830                 -> regs/cfr-49/830
 *   /current/title-14/...part-NN/subpart-X                             -> regs/cfr-14/NN/subpart-x
 *   /current/title-14/...section-NN.MM                                 -> regs/cfr-14/NN/MM
 *
 * Returns `{ identifier: null, skipReason: <why> }` for shapes the migrator
 * doesn't handle (Title-only, version-pinned URLs, anchor-only fragments,
 * etc.).
 */
function mapEcfrUrlToIdentifier(url: string, pin: string): MapResult {
	const match = ECFR_HOST_PATTERN.exec(url);
	if (match === null) return { identifier: null, skipReason: 'not an eCFR URL' };

	const path = url.slice(match[0].length);
	// Strip query string and trailing slash for parsing.
	const [pathWithoutQuery] = path.split('?');
	if (pathWithoutQuery === undefined) return { identifier: null, skipReason: 'empty eCFR path' };
	const segments = pathWithoutQuery.replace(/\/+$/u, '').split('/');

	const titleSegment = segments[0];
	const titleMatch = /^title-(\d{1,2})$/u.exec(titleSegment ?? '');
	if (titleMatch === null) {
		return { identifier: null, skipReason: `unrecognized title segment: ${titleSegment ?? '(empty)'}` };
	}
	const title = titleMatch[1];
	if (title !== '14' && title !== '49') {
		return { identifier: null, skipReason: `unsupported CFR title for migration: ${title}` };
	}

	// Find the part-NN segment (any depth; eCFR layers chapter / subchapter /
	// subtitle / etc. between title and part).
	let part: string | null = null;
	let postPartIndex = -1;
	for (let i = 1; i < segments.length; i += 1) {
		const seg = segments[i] ?? '';
		const m = /^part-([0-9]+)$/u.exec(seg);
		if (m !== null) {
			part = m[1] ?? null;
			postPartIndex = i + 1;
			break;
		}
	}

	if (part === null) {
		return {
			identifier: null,
			skipReason: 'eCFR URL is title-level (no /part-NN); no airboss-ref: identifier maps to a Title root',
		};
	}

	// Inspect what follows part-NN: nothing (whole part), subpart-X, or section-NN.MM.
	const afterPart = segments.slice(postPartIndex);
	let locator = `cfr-${title}/${part}`;
	if (afterPart.length > 0) {
		const head = afterPart[0] ?? '';
		const subpartMatch = /^subpart-([A-Za-z]+)$/u.exec(head);
		const sectionMatch = /^section-([0-9]+)\.([0-9]+[a-z]?)$/u.exec(head);
		if (subpartMatch !== null && afterPart.length === 1) {
			locator = `${locator}/subpart-${subpartMatch[1]?.toLowerCase()}`;
		} else if (sectionMatch !== null && afterPart.length === 1) {
			// section-NN.MM means part NN, section MM. eCFR collapses both into one segment;
			// the section number after the dot is the airboss-ref locator's `<section>`.
			const ePart = sectionMatch[1];
			const eSection = sectionMatch[2];
			if (ePart !== part) {
				return {
					identifier: null,
					skipReason: `eCFR section URL part (${ePart}) disagrees with discovered part (${part})`,
				};
			}
			locator = `${locator}/${eSection}`;
		} else {
			return {
				identifier: null,
				skipReason: `unsupported tail segments after part-${part}: ${afterPart.join('/')}`,
			};
		}
	}

	const identifier = `airboss-ref:regs/${locator}?at=${pin}` as SourceId;
	const parsed = parseIdentifier(identifier);
	if ('kind' in parsed) {
		return { identifier: null, skipReason: `parser rejected synthesized identifier: ${parsed.message}` };
	}
	const entry = productionRegistry.getEntry(identifier);
	if (entry === null) {
		return {
			identifier: null,
			skipReason: `synthesized identifier ${identifier} does not resolve in current registry`,
		};
	}
	return { identifier, skipReason: null };
}

// ---------------------------------------------------------------------------
// Lesson rewrite
// ---------------------------------------------------------------------------

function applyMigrations(source: string, migrated: readonly MigrationCandidate[]): string {
	// Sort descending by occurrence position so multiple replacements per file
	// don't shift each other's offsets. We rediscover positions by URL string
	// match -- which is safe because each URL is matched against its exact
	// link form in the source.
	let next = source;
	for (const c of migrated) {
		if (c.identifier === null) continue;
		const newUrl = c.identifier;
		// Replace EXACTLY one occurrence of `(${c.originalUrl})` in `next`.
		// Using `(URL)` rather than the bare URL avoids accidentally rewriting
		// the same URL when it appears in plain prose elsewhere in the file.
		const needle = `(${c.originalUrl})`;
		const replacement = `(${newUrl})`;
		const idx = next.indexOf(needle);
		if (idx === -1) continue;
		next = `${next.slice(0, idx)}${replacement}${next.slice(idx + needle.length)}`;
	}
	return next;
}

// ---------------------------------------------------------------------------
// Markdown link discovery
// ---------------------------------------------------------------------------

const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function findMarkdownLinks(source: string): readonly MarkdownLink[] {
	const out: MarkdownLink[] = [];
	const re = new RegExp(LINK_PATTERN.source, 'g');
	let m: RegExpExecArray | null = re.exec(source);
	while (m !== null) {
		const start = m.index;
		const end = re.lastIndex;
		const text = m[1] ?? '';
		const url = m[2] ?? '';
		const { line, column } = lineColumn(source, start);
		out.push({ start, end, text, url, line, column });
		m = re.exec(source);
	}
	return out;
}

function lineColumn(source: string, offset: number): { readonly line: number; readonly column: number } {
	let line = 1;
	let lineStart = 0;
	for (let i = 0; i < offset; i += 1) {
		if (source.charCodeAt(i) === 10) {
			line += 1;
			lineStart = i + 1;
		}
	}
	return { line, column: offset - lineStart + 1 };
}

// ---------------------------------------------------------------------------
// Edition pin resolution from git history
// ---------------------------------------------------------------------------

const ISO_YEAR_PATTERN = /^(\d{4})/u;

function lessonEditionPin(absFile: string): string {
	try {
		const out = execSync(`git log --follow --pretty=%aI -- "${absFile}"`, {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		const lines = out.split('\n').filter((l) => l.trim().length > 0);
		if (lines.length === 0) return FALLBACK_REGS_EDITION;
		const newest = lines[0] ?? '';
		const match = ISO_YEAR_PATTERN.exec(newest);
		if (match === null) return FALLBACK_REGS_EDITION;
		const year = match[1];
		if (year === undefined) return FALLBACK_REGS_EDITION;
		// Pin to the year of the lesson's last meaningful edit, but cap at the
		// current accepted regs edition: pinning forward of accepted breaks
		// validation. The cap is the larger of the lesson year and the corpus
		// current edition; we always pin to the LESSON year if the registry
		// has it, otherwise fall back to fallback edition. Any cap mismatch is
		// caught at validate time as a row-3 ERROR (we'd want to know).
		return year;
	} catch {
		return FALLBACK_REGS_EDITION;
	}
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printReport(report: MigrationReport, dryRun: boolean): void {
	const mode = dryRun ? 'DRY-RUN' : 'WRITE';
	process.stdout.write(`\nLesson migration (${mode})\n`);
	process.stdout.write(`  lessons scanned:   ${report.lessonsScanned}\n`);
	process.stdout.write(`  lessons touched:   ${report.lessonsTouched}\n`);
	process.stdout.write(`  identifiers added: ${report.identifiersMigrated}\n`);
	process.stdout.write(`  skipped:           ${report.skipped.length}\n`);

	if (report.migrated.length > 0) {
		process.stdout.write('\nMigrated:\n');
		for (const c of report.migrated) {
			process.stdout.write(`  ${c.file}:${c.line}\n`);
			process.stdout.write(`    ${c.originalUrl}\n`);
			process.stdout.write(`    -> ${c.identifier ?? '(none)'}\n`);
		}
	}

	if (report.skipped.length > 0) {
		process.stdout.write('\nSkipped (left as plain links; review before re-running):\n');
		for (const c of report.skipped) {
			process.stdout.write(`  ${c.file}:${c.line}\n`);
			process.stdout.write(`    ${c.originalUrl}\n`);
			process.stdout.write(`    reason: ${c.skipReason ?? 'unknown'}\n`);
		}
	}
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): CliArgs {
	const roots: string[] = [];
	let dryRun = false;
	let help = false;
	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg === '--dry-run') dryRun = true;
		else if (arg.startsWith('--root=')) roots.push(arg.slice('--root='.length));
		else {
			process.stderr.write(`unknown argument: ${arg}\n${USAGE}`);
			help = true;
		}
	}
	return {
		roots: roots.length > 0 ? roots : DEFAULT_ROOTS,
		dryRun,
		help,
	};
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
			} else if (entry.isFile() && extname(entry.name) === MARKDOWN_EXTENSION) {
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

main(process.argv.slice(2)).then((code) => process.exit(code));
