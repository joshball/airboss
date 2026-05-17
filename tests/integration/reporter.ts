/**
 * Custom Playwright reporter for the flightbag coverage sweep.
 *
 * The sweep parameterises several thousand reader URLs into individual tests.
 * Playwright's stock `list` reporter prints one line per test -- thousands of
 * lines of pass/fail noise that bury the signal. This reporter replaces that:
 * it stays silent during the run and prints one tight, actionable summary at
 * the end.
 *
 * Terminal summary (printed by `onEnd`):
 *  - What the sweep tested (the three tiers, in one sentence each).
 *  - Per-tier pass/fail counts AND timings (wall-clock + summed test time).
 *  - Per-book breakdown: every book, its URL count, pass/fail, and how long
 *    its slice of the run took -- so a slow corpus is obvious at a glance.
 *  - Failures grouped by book/corpus (`kind/documentSlug`), each group with a
 *    fail count, the failing URLs, and a copy-paste command to retest JUST
 *    that book without re-running the whole sweep.
 *
 * Disk artefacts (written by `onEnd`):
 *  - `coverage-report.md`     -- the full grouped markdown report.
 *  - `coverage-failures.txt`  -- plain-text failure log: one URL + error per
 *                                line, greppable, no markdown.
 *  - `coverage-summary.json`  -- machine-readable summary for follow-up agents.
 *
 * Skipped data is loaded from `tests/integration/.out/skipped.json`, which the
 * spec writes once before tests start. Writing once to disk survives high
 * worker parallelism without coordinating writes.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

type Tier = 'sanity' | 'structural' | 'content' | 'other';

interface FailureRecord {
	readonly tier: string;
	/** `kind/documentSlug` -- the book/corpus this URL belongs to. */
	readonly book: string;
	readonly url: string;
	readonly title: string;
	readonly errorMessage: string;
}

interface SkipPayload {
	readonly generatedAt: string;
	readonly counts: {
		readonly sanity: number;
		readonly structural: number;
		readonly content: number;
		readonly skipped: number;
	};
	readonly skipped: ReadonlyArray<{
		readonly kind: string;
		readonly documentSlug: string;
		readonly code: string;
		readonly reason: string;
		readonly classification: 'covered-by-parent' | 'no-route';
	}>;
}

/** Pass/fail counts plus summed per-test duration (ms). */
type Bucket = { passed: number; failed: number; durationMs: number };

const newBucket = (): Bucket => ({ passed: 0, failed: 0, durationMs: 0 });

/**
 * One-line description of what each tier asserts. Printed in the terminal
 * summary so the reader knows what was actually exercised.
 */
const TIER_BLURB: Record<Exclude<Tier, 'other'>, string> = {
	sanity: 'every leaf reader URL responds with status < 400',
	structural: 'landing + chapter pages render: 2xx, body > 500 chars, non-empty H1',
	content: 'sampled chapter sections render the right row (code or title in body)',
};

/**
 * Test titles are built by the spec as:
 *   `[<tier>] <kind>/<documentSlug> <url>`
 * e.g. `[sanity] handbook/phak /handbook/phak/8083-25C/14/3`.
 *
 * This pattern pulls the three fields back out so we can group results by
 * book and emit a per-book retest command. The `book` capture intentionally
 * stops at the first whitespace so it never swallows the URL.
 */
const TITLE_PATTERN = /^\[(sanity|structural|content)\]\s+(\S+)\s+(\S+)/;

/** ANSI helpers -- skipped when stdout is not a TTY (piped logs stay clean). */
const useColor = process.stdout.isTTY === true;
const color = (code: string, s: string): string => (useColor ? `[${code}m${s}[0m` : s);
const bold = (s: string): string => color('1', s);
const red = (s: string): string => color('31', s);
const green = (s: string): string => color('32', s);
const yellow = (s: string): string => color('33', s);
const dim = (s: string): string => color('2', s);

/** Human-readable duration: `1.2s`, `3m04s`. */
function fmtDuration(ms: number): string {
	const secs = ms / 1000;
	if (secs < 60) return `${secs.toFixed(1)}s`;
	const m = Math.floor(secs / 60);
	const s = Math.round(secs % 60);
	return `${m}m${String(s).padStart(2, '0')}s`;
}

/** One book's entry in `manifest.json` -- the plan written by the spec. */
interface ManifestBook {
	readonly book: string;
	readonly kind: string;
	readonly documentSlug: string;
	readonly sanity: number;
	readonly structural: number;
	readonly content: number;
	readonly total: number;
}

interface ManifestPayload {
	readonly generatedAt: string;
	readonly totals: { readonly sanity: number; readonly structural: number; readonly content: number; readonly total: number; readonly books: number };
	readonly books: readonly ManifestBook[];
}

export default class CoverageReporter implements Reporter {
	private readonly perTier: Record<Tier, Bucket> = {
		sanity: newBucket(),
		structural: newBucket(),
		content: newBucket(),
		other: newBucket(),
	};
	/** Per-book aggregate, keyed by `kind/documentSlug`. */
	private readonly perBook = new Map<string, Bucket>();
	private readonly failures: FailureRecord[] = [];
	private outDir = resolvePath('tests/integration/.out');
	private wallStart = 0;
	/** Total URLs this run will execute (post `--grep`). */
	private plannedTotal = 0;
	/** Tests finished so far, for the live progress line. */
	private done = 0;
	/** Books fully finished, to fire a one-line completion per book. */
	private readonly bookExpected = new Map<string, number>();

	onBegin(_config: FullConfig, suite: Suite): void {
		mkdirSync(this.outDir, { recursive: true });
		this.wallStart = Date.now();

		// Count the tests this run will actually execute (post `--grep`),
		// grouped by book, so per-book progress reflects the real scope.
		for (const test of suite.allTests()) {
			if ((test.parent.project()?.name ?? '') !== 'flightbag-coverage') continue;
			const book = TITLE_PATTERN.exec(test.title)?.[2] ?? 'unknown';
			this.bookExpected.set(book, (this.bookExpected.get(book) ?? 0) + 1);
			this.plannedTotal += 1;
		}
		printRunPlan(this.bookExpected, this.plannedTotal, readManifest(this.outDir), this.outDir);
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		// `flightbag-coverage` is the only project this reporter cares about.
		const projectName = test.parent.project()?.name ?? '';
		if (projectName !== 'flightbag-coverage') return;

		const match = TITLE_PATTERN.exec(test.title);
		const tier: Tier = (match?.[1] as Tier) ?? 'other';
		const book = match?.[2] ?? 'unknown';
		const url = match?.[3] ?? test.title;

		const tierBucket = this.perTier[tier];
		const bookBucket = this.perBook.get(book) ?? newBucket();
		this.perBook.set(book, bookBucket);

		tierBucket.durationMs += result.duration;
		bookBucket.durationMs += result.duration;

		if (result.status === 'passed') {
			tierBucket.passed += 1;
			bookBucket.passed += 1;
		} else if (result.status === 'failed' || result.status === 'timedOut') {
			tierBucket.failed += 1;
			bookBucket.failed += 1;
			this.failures.push({
				tier,
				book,
				url,
				title: test.title,
				errorMessage: (result.error?.message ?? result.errors[0]?.message ?? '(no error message)')
					.split('\n')[0]
					.trim(),
			});
		}

		// Live progress: print a one-line update each time a book finishes
		// all of its URLs. With high parallelism several books complete close
		// together; one line each keeps the running output short but informative.
		this.done += 1;
		const expected = this.bookExpected.get(book) ?? 0;
		const finishedInBook = bookBucket.passed + bookBucket.failed;
		if (expected > 0 && finishedInBook === expected) {
			printBookDone(book, bookBucket, this.done, this.plannedTotal);
		}
	}

	onEnd(result: FullResult): void {
		const skip = readSkipPayload(this.outDir);
		const grouped = groupByBook(this.failures);
		const books = bookRows(this.perBook);
		const wallMs = this.wallStart > 0 ? Date.now() - this.wallStart : 0;

		// Disk artefacts.
		writeFileSync(
			resolvePath(this.outDir, 'coverage-report.md'),
			renderMarkdown(this.perTier, books, grouped, skip, result.status, wallMs),
		);
		writeFileSync(resolvePath(this.outDir, 'coverage-failures.txt'), renderFailureLog(grouped));
		writeFileSync(
			resolvePath(this.outDir, 'coverage-summary.json'),
			JSON.stringify(
				{
					status: result.status,
					wallMs,
					perTier: this.perTier,
					books,
					failureCount: this.failures.length,
					byBook: grouped.map((g) => ({ book: g.book, failed: g.failures.length })),
					failures: this.failures,
					skippedCount: skip?.skipped.length ?? 0,
				},
				null,
				2,
			),
		);

		// Terminal summary -- the whole point of this reporter.
		printTerminalSummary(this.perTier, books, grouped, skip, result.status, wallMs, this.outDir);
	}
}

/** One book/corpus group: its key plus every failure under it. */
interface BookGroup {
	readonly book: string;
	readonly failures: readonly FailureRecord[];
}

/** Per-book aggregate row for the breakdown table. */
interface BookRow {
	readonly book: string;
	readonly passed: number;
	readonly failed: number;
	readonly total: number;
	readonly durationMs: number;
}

function bookRows(perBook: ReadonlyMap<string, Bucket>): readonly BookRow[] {
	return [...perBook.entries()]
		.map(([book, b]) => ({
			book,
			passed: b.passed,
			failed: b.failed,
			total: b.passed + b.failed,
			durationMs: b.durationMs,
		}))
		// Failing books first, then by URL count -- the biggest, most-broken
		// corpora rise to the top of the table.
		.sort((a, b) => b.failed - a.failed || b.total - a.total || a.book.localeCompare(b.book));
}

function groupByBook(failures: readonly FailureRecord[]): readonly BookGroup[] {
	const map = new Map<string, FailureRecord[]>();
	for (const f of failures) {
		const list = map.get(f.book) ?? [];
		list.push(f);
		map.set(f.book, list);
	}
	return [...map.entries()]
		.map(([book, list]) => ({ book, failures: list.sort((a, b) => a.url.localeCompare(b.url)) }))
		.sort((a, b) => b.failures.length - a.failures.length || a.book.localeCompare(b.book));
}

function readSkipPayload(outDir: string): SkipPayload | null {
	try {
		return JSON.parse(readFileSync(resolvePath(outDir, 'skipped.json'), 'utf8')) as SkipPayload;
	} catch {
		return null;
	}
}

function readManifest(outDir: string): ManifestPayload | null {
	try {
		return JSON.parse(readFileSync(resolvePath(outDir, 'manifest.json'), 'utf8')) as ManifestPayload;
	} catch {
		return null;
	}
}

/** The retest command for one book -- the dispatcher's `--book` filter. */
function retestCommand(book: string): string {
	return `bun run test integration --book "${book}"`;
}

// ---------------------------------------------------------------------------
// Run plan + live progress
// ---------------------------------------------------------------------------

/**
 * Print, at run start, the full list of what will be checked: every book in
 * scope with its URL count, broken down by tier. This is the "tell me what is
 * going to be checked" dump. The book set comes from the tests actually
 * scheduled this run (`bookExpected`), so a `--grep`/`--book` filter narrows
 * it; the per-tier split comes from `manifest.json` when available.
 */
function printRunPlan(
	bookExpected: ReadonlyMap<string, number>,
	plannedTotal: number,
	manifest: ManifestPayload | null,
	outDir: string,
): void {
	const byTotal = manifest ? new Map(manifest.books.map((b) => [b.book, b])) : new Map<string, ManifestBook>();
	const books = [...bookExpected.entries()]
		.map(([book, count]) => ({ book, count, tiers: byTotal.get(book) ?? null }))
		.sort((a, b) => b.count - a.count || a.book.localeCompare(b.book));

	const out: string[] = [];
	out.push('');
	out.push(bold('━━━ Flightbag coverage -- run plan ━━━'));
	out.push(dim(`  ${plannedTotal} URLs across ${books.length} books will be checked.`));
	out.push('');
	const nameW = Math.min(40, Math.max(8, ...books.map((b) => b.book.length)));
	out.push(dim(`    ${'book'.padEnd(nameW)}  ${'urls'.padStart(6)}   sanity / structural / content`));
	for (const b of books) {
		const t = b.tiers;
		const split = t ? `${t.sanity} / ${t.structural} / ${t.content}` : dim('(counts after collection)');
		out.push(`    ${b.book.padEnd(nameW)}  ${String(b.count).padStart(6)}   ${dim(split)}`);
	}
	out.push('');
	out.push(dim(`  full plan: ${resolvePath(outDir, 'manifest.json')}`));
	out.push(dim('  progress prints one line per book as it finishes; summary at the end.'));
	out.push('');
	process.stdout.write(out.join('\n') + '\n');
}

/** One-line live update fired when a book finishes all of its URLs. */
function printBookDone(book: string, bucket: Bucket, done: number, total: number): void {
	const pct = total > 0 ? Math.round((done / total) * 100) : 100;
	const counts = `${bucket.passed} ok` + (bucket.failed > 0 ? `, ${bucket.failed} FAIL` : '');
	const mark = bucket.failed > 0 ? red('✘') : green('✓');
	const line = `  ${mark} ${book.padEnd(34)} ${counts.padEnd(18)} ${fmtDuration(bucket.durationMs).padStart(7)}   ${dim(`[${pct}% -- ${done}/${total}]`)}`;
	process.stdout.write(line + '\n');
}

/** `sanity   1234 / 1240 passed  6 FAILED  (12.3s)` */
function tierLine(label: string, bucket: Bucket | undefined): string {
	if (!bucket) return `${label}  (no results)`;
	const total = bucket.passed + bucket.failed;
	const tail = bucket.failed > 0 ? `  ${bucket.failed} FAILED` : '';
	return `${label}  ${bucket.passed} / ${total} passed${tail}  (${fmtDuration(bucket.durationMs)})`;
}

// ---------------------------------------------------------------------------
// Terminal summary
// ---------------------------------------------------------------------------

function printTerminalSummary(
	perTier: Record<Tier, Bucket>,
	books: readonly BookRow[],
	grouped: readonly BookGroup[],
	skip: SkipPayload | null,
	status: FullResult['status'],
	wallMs: number,
	outDir: string,
): void {
	const totalFailed = grouped.reduce((n, g) => n + g.failures.length, 0);
	const totalTests = (['sanity', 'structural', 'content', 'other'] as const).reduce(
		(n, k) => n + perTier[k].passed + perTier[k].failed,
		0,
	);
	const out: string[] = [];
	out.push('');
	out.push(bold('━━━ Flightbag coverage sweep ━━━'));
	out.push('');

	// What was tested.
	out.push('  ' + bold('What this tested'));
	out.push(dim(`  ${totalTests} reader URLs across ${books.length} books, in three tiers:`));
	for (const key of ['sanity', 'structural', 'content'] as const) {
		out.push(dim(`    ${key.padEnd(10)} ${TIER_BLURB[key]}`));
	}
	out.push('');

	// Tier totals with timings.
	out.push('  ' + bold('Tiers') + dim(`  (wall clock ${fmtDuration(wallMs)})`));
	for (const key of ['sanity', 'structural', 'content'] as const) {
		const bucket = perTier[key];
		const line = tierLine('  ' + key.padEnd(10), bucket);
		out.push('  ' + (bucket.failed > 0 ? red(line) : green(line)));
	}
	out.push('');

	// Per-book breakdown table -- always shown; this is the "summary of what
	// is tested" with timing per book.
	out.push('  ' + bold('By book'));
	const nameW = Math.min(36, Math.max(8, ...books.map((b) => b.book.length)));
	out.push(dim(`    ${'book'.padEnd(nameW)}  ${'urls'.padStart(6)}  ${'pass'.padStart(6)}  ${'fail'.padStart(6)}  time`));
	for (const row of books) {
		const cells = `    ${row.book.padEnd(nameW)}  ${String(row.total).padStart(6)}  ${String(row.passed).padStart(6)}  ${String(row.failed).padStart(6)}  ${fmtDuration(row.durationMs)}`;
		out.push(row.failed > 0 ? red(cells) : dim(cells));
	}
	out.push('');

	if (totalFailed === 0) {
		out.push('  ' + green(`✓ all ${totalTests} URLs responded -- run status: ${status}`));
		const skipCount = skip?.skipped.length ?? 0;
		if (skipCount > 0) {
			out.push('  ' + dim(`${skipCount} rows skipped (covered-by-parent / no-route -- see report)`));
		}
		out.push('');
		out.push(dim(`  full report: ${resolvePath(outDir, 'coverage-report.md')}`));
		out.push('');
		process.stdout.write(out.join('\n') + '\n');
		return;
	}

	// Failures grouped by book.
	out.push(
		'  ' +
			bold(
				red(
					`${totalFailed} failure${totalFailed === 1 ? '' : 's'} across ${grouped.length} book${grouped.length === 1 ? '' : 's'}:`,
				),
			),
	);
	out.push('');
	for (const group of grouped) {
		out.push('  ' + bold(red(`▸ ${group.book}`)) + dim(`  (${group.failures.length} failed)`));
		// Show up to 8 failing URLs per book; the rest go to the failure log.
		const shown = group.failures.slice(0, 8);
		for (const f of shown) {
			out.push(`      ${dim('[' + f.tier + ']')} ${f.url}`);
			out.push(`        ${dim(f.errorMessage)}`);
		}
		if (group.failures.length > shown.length) {
			out.push(dim(`      ... ${group.failures.length - shown.length} more (see coverage-failures.txt)`));
		}
		out.push('      ' + yellow('retest:') + ' ' + retestCommand(group.book));
		out.push('');
	}

	out.push('  ' + bold('Artefacts:'));
	out.push(dim(`    report:   ${resolvePath(outDir, 'coverage-report.md')}`));
	out.push(dim(`    failures: ${resolvePath(outDir, 'coverage-failures.txt')}`));
	out.push('');
	out.push('  ' + bold('Retest all failing books in one run:'));
	out.push('    ' + yellow(`bun run test integration --grep "${grouped.map((g) => g.book).join('|')}"`));
	out.push('');
	process.stdout.write(out.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Disk artefacts
// ---------------------------------------------------------------------------

/** Plain-text, greppable failure log -- one block per book, no markdown. */
function renderFailureLog(grouped: readonly BookGroup[]): string {
	if (grouped.length === 0) return 'No failures.\n';
	const lines: string[] = [];
	lines.push(`# Flightbag coverage failures -- ${new Date().toISOString()}`);
	lines.push('');
	for (const group of grouped) {
		lines.push(`## ${group.book}  (${group.failures.length} failed)`);
		lines.push(`retest: ${retestCommand(group.book)}`);
		lines.push('');
		for (const f of group.failures) {
			lines.push(`[${f.tier}] ${f.url}`);
			lines.push(`  ${f.errorMessage}`);
		}
		lines.push('');
	}
	return lines.join('\n') + '\n';
}

function renderMarkdown(
	perTier: Record<Tier, Bucket>,
	books: readonly BookRow[],
	grouped: readonly BookGroup[],
	skip: SkipPayload | null,
	overallStatus: FullResult['status'],
	wallMs: number,
): string {
	const today = new Date().toISOString().slice(0, 10);
	const totalFailed = grouped.reduce((n, g) => n + g.failures.length, 0);
	const totalTests = (['sanity', 'structural', 'content', 'other'] as const).reduce(
		(n, k) => n + perTier[k].passed + perTier[k].failed,
		0,
	);
	const lines: string[] = [];

	lines.push(`# Flightbag coverage run -- ${today}`);
	lines.push('');
	lines.push(
		`Run status: \`${overallStatus}\` -- ${totalTests} URLs across ${books.length} books, ${totalFailed} failure${totalFailed === 1 ? '' : 's'}, wall clock ${fmtDuration(wallMs)}.`,
	);
	lines.push('');

	lines.push('## What this tested');
	lines.push('');
	lines.push('Three tiers, every public flightbag reader URL the seeded registry produces:');
	lines.push('');
	for (const key of ['sanity', 'structural', 'content'] as const) {
		lines.push(`- **${key}** -- ${TIER_BLURB[key]}`);
	}
	lines.push('');

	lines.push('## Tier totals');
	lines.push('');
	lines.push('```text');
	lines.push(tierLine('sanity    ', perTier.sanity));
	lines.push(tierLine('structural', perTier.structural));
	lines.push(tierLine('content   ', perTier.content));
	lines.push('```');
	lines.push('');

	lines.push('## By book');
	lines.push('');
	if (books.length === 0) {
		lines.push('_No results._');
		lines.push('');
	} else {
		const nameW = Math.max(4, ...books.map((b) => b.book.length));
		const head = `| ${'Book'.padEnd(nameW)} | URLs | Pass | Fail | Time     |`;
		const sep = `| ${'-'.repeat(nameW)} | ---- | ---- | ---- | -------- |`;
		lines.push(head);
		lines.push(sep);
		for (const row of books) {
			lines.push(
				`| ${row.book.padEnd(nameW)} | ${String(row.total).padEnd(4)} | ${String(row.passed).padEnd(4)} | ${String(row.failed).padEnd(4)} | ${fmtDuration(row.durationMs).padEnd(8)} |`,
			);
		}
		lines.push('');
	}

	lines.push(`## Failures by book (${totalFailed})`);
	lines.push('');
	if (grouped.length === 0) {
		lines.push('_None._');
		lines.push('');
	} else {
		lines.push('Each book retests independently -- run only the one you are fixing.');
		lines.push('');
		for (const group of grouped) {
			lines.push(`### ${group.book} -- ${group.failures.length} failed`);
			lines.push('');
			lines.push('```bash');
			lines.push(retestCommand(group.book));
			lines.push('```');
			lines.push('');
			for (const f of group.failures) {
				lines.push(`- **[${f.tier}]** \`${f.url}\``);
				lines.push(`  - ${f.errorMessage}`);
			}
			lines.push('');
		}
		lines.push('### Retest every failing book at once');
		lines.push('');
		lines.push('```bash');
		lines.push(`bun run test integration --grep "${grouped.map((g) => g.book).join('|')}"`);
		lines.push('```');
		lines.push('');
	}

	lines.push('## Skipped rows (covered-by-parent / no-route)');
	lines.push('');
	if (!skip) {
		lines.push('_No skip log emitted by the spec (skipped.json missing)._');
	} else if (skip.skipped.length === 0) {
		lines.push('_No rows skipped._');
	} else {
		const byClass = new Map<string, Map<string, number>>();
		for (const entry of skip.skipped) {
			const inner = byClass.get(entry.classification) ?? new Map<string, number>();
			inner.set(entry.reason, (inner.get(entry.reason) ?? 0) + 1);
			byClass.set(entry.classification, inner);
		}
		for (const [classification, reasons] of byClass.entries()) {
			lines.push(`### ${classification}`);
			lines.push('');
			for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) {
				lines.push(`- ${count} -- ${reason}`);
			}
			lines.push('');
		}
	}

	return `${lines.join('\n')}\n`;
}
