/**
 * Custom Playwright reporter for the flightbag coverage sweep.
 *
 * Wires into the `flightbag-coverage` project and is responsible for the
 * entire run-time UI plus the on-disk artefacts under
 * `tests/integration/.out/`:
 *
 *  - A tree-grouped run plan (books nested under `kind`), read from
 *    `manifest.json` (written by the spec) so `SWEEP_LIST=1` can print a
 *    compact plan and exit.
 *  - A live, repaint-in-place progress dashboard -- one bar per book -- while
 *    tests run. Gated behind `process.stdout.isTTY`; piped/CI runs fall back
 *    to one completion line per book.
 *  - Crash-safe streaming: every finished test appends one JSON line to
 *    `progress.ndjson`; `last-run.json` is written on end. If the run is
 *    interrupted (the vite dev server OOM-crashes mid-sweep), a loud banner
 *    makes that visible instead of a wall of phantom failures.
 *  - The aggregate artefacts: `coverage-report.md`, `coverage-failures.txt`,
 *    `coverage-summary.json`.
 *
 * The lone non-URL guard test (`sample size is non-trivial ...`) does not
 * carry a `[tier]` prefix; it is classified as a GUARD and never shown as a
 * phantom book.
 *
 * Skip data is loaded from `skipped.json`, which the spec writes once before
 * tests start. Writing once to disk survives 32-worker parallelism without
 * coordinating writes.
 */

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/** Title prefix `[sanity] ...` -> tier name. Non-matching titles are guards. */
const TIER_PATTERN = /^\[(sanity|structural|content)\]/;
/** A coverage test title: `[<tier>] <kind>/<documentSlug> <url>`. */
const TITLE_PATTERN = /^\[(sanity|structural|content)\]\s+(\S+?)\/(\S+?)\s+(\S.*)$/;
/** Minimum gap between in-place repaints; high worker counts fire fast. */
const REPAINT_THROTTLE_MS = 100;
/** Width of the dashboard progress bar in cells. */
const BAR_WIDTH = 32;
const BAR_FILLED = '█';
const BAR_EMPTY = '░';

// --- Terminal colour ---------------------------------------------------------
// Plain ANSI SGR codes; disabled when stdout is not a TTY (piped / CI) or
// when NO_COLOR is set, so a captured log stays clean text.
const COLOR_ENABLED = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
const SGR = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	dim: '\x1b[2m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
} as const;
/** Wrap `text` in an SGR code, or return it untouched when colour is off. */
function paint(code: string, text: string): string {
	return COLOR_ENABLED ? `${code}${text}${SGR.reset}` : text;
}

type Tier = 'sanity' | 'structural' | 'content';

interface FailureRecord {
	readonly book: string;
	readonly tier: string;
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

/** One book row from the spec-written `manifest.json`. */
interface ManifestBook {
	readonly book: string;
	readonly kind: string;
	readonly documentSlug: string;
	readonly sanity: number;
	readonly structural: number;
	readonly content: number;
	readonly total: number;
}

interface ManifestTotals {
	readonly sanity: number;
	readonly structural: number;
	readonly content: number;
	readonly total: number;
	readonly books: number;
}

interface Manifest {
	readonly generatedAt: string;
	readonly mode: string;
	readonly sampledPerBook: number | null;
	/** What this invocation runs (post sample / tier / resume narrowing). */
	readonly totals: ManifestTotals;
	readonly books: readonly ManifestBook[];
	/** Full coverage territory before narrowing. Absent on old manifests. */
	readonly coverage?: {
		readonly totals: ManifestTotals;
		readonly books: readonly ManifestBook[];
	};
}

/** Mutable run-time tally for a single book. */
interface BookProgress {
	readonly book: string;
	readonly kind: string;
	readonly documentSlug: string;
	expected: number;
	done: number;
	passed: number;
	failed: number;
}

interface TitleParts {
	readonly tier: Tier;
	readonly kind: string;
	readonly documentSlug: string;
	readonly book: string;
	readonly url: string;
}

function parseTitle(title: string): TitleParts | null {
	const m = TITLE_PATTERN.exec(title);
	if (!m) return null;
	const tier = m[1] as Tier;
	const kind = m[2] ?? '';
	const documentSlug = m[3] ?? '';
	const url = (m[4] ?? '').trim();
	return { tier, kind, documentSlug, book: `${kind}/${documentSlug}`, url };
}

export default class CoverageReporter implements Reporter {
	private readonly perTier: Record<string, { passed: number; failed: number; durationMs: number }> = {
		sanity: { passed: 0, failed: 0, durationMs: 0 },
		structural: { passed: 0, failed: 0, durationMs: 0 },
		content: { passed: 0, failed: 0, durationMs: 0 },
	};
	private readonly failures: FailureRecord[] = [];
	private readonly books = new Map<string, BookProgress>();
	/**
	 * url -> 'passed' | 'failed', for the last-run.json results map. The same
	 * URL is exercised by up to three tiers (sanity / structural / content);
	 * a failure in any tier wins, so a later passing tier never masks an
	 * earlier failure.
	 */
	private readonly results = new Map<string, 'passed' | 'failed'>();
	private guardPassed = 0;
	private guardFailed = 0;
	/** Counts every URL test end (not deduped) -- one per executed test. */
	private urlTestsRun = 0;
	private urlTestsPassed = 0;
	private urlTestsFailed = 0;
	private wallStartMs = 0;

	private outDir = resolvePath('tests/integration/.out');
	private manifest: Manifest | null = null;
	private readonly listMode = process.env.SWEEP_LIST === '1';
	private readonly resumeMode = process.env.SWEEP_RESUME === '1';
	private readonly sweepMode = process.env.SWEEP_MODE ?? 'sample';
	private readonly isTty = process.stdout.isTTY === true;

	/** Lines occupied by the live dashboard block on screen (TTY only). */
	private dashboardLines = 0;
	private lastRepaintMs = 0;
	private dashboardStarted = false;

	onBegin(_config: FullConfig): void {
		mkdirSync(this.outDir, { recursive: true });
		this.wallStartMs = Date.now();
		this.manifest = readManifest(this.outDir);

		// Truncate the streaming progress log at the start of every run.
		writeFileSync(resolvePath(this.outDir, 'progress.ndjson'), '');

		// Seed book progress from the manifest so the dashboard knows the
		// expected URL count per book before any test finishes. When the run
		// is scoped with `--book` (Playwright `--grep`), seed ONLY the matched
		// books -- otherwise the dashboard shows 45 rows of 0% noise around
		// the one book that is actually being swept.
		const bookGrep = readGrepPattern();
		if (this.manifest) {
			for (const b of this.manifest.books) {
				if (bookGrep !== null && !bookGrep.test(b.book)) continue;
				this.books.set(b.book, {
					book: b.book,
					kind: b.kind,
					documentSlug: b.documentSlug,
					expected: b.total,
					done: 0,
					passed: 0,
					failed: 0,
				});
			}
		}

		if (this.listMode) {
			// List mode runs zero tests; print only the compact plan and stop.
			this.printPlan();
			return;
		}

		// Print the plan once, then draw the initial (empty) dashboard.
		this.printPlan();
		if (this.isTty && this.books.size > 0) {
			process.stdout.write('\n');
			this.drawDashboard(true);
			this.dashboardStarted = true;
		}
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		// `flightbag-coverage` is the only project this reporter cares about.
		const projectName = test.parent.project()?.name ?? '';
		if (projectName !== 'flightbag-coverage') return;

		const parts = parseTitle(test.title);

		// GUARD: the non-URL `sample size ...` test has no `[tier]` prefix.
		// Never invent a phantom book row for it.
		if (!parts) {
			if (result.status === 'passed') this.guardPassed += 1;
			else if (result.status === 'failed' || result.status === 'timedOut') this.guardFailed += 1;
			return;
		}

		this.urlTestsRun += 1;
		const passed = result.status === 'passed';
		const failed = result.status === 'failed' || result.status === 'timedOut';
		if (passed) this.urlTestsPassed += 1;
		else if (failed) this.urlTestsFailed += 1;

		const tierBucket = this.perTier[parts.tier];
		if (tierBucket) {
			tierBucket.durationMs += result.duration;
			if (passed) tierBucket.passed += 1;
			else if (failed) tierBucket.failed += 1;
		}

		// A book may not exist in the manifest (manifest missing, or the spec
		// produced a URL the manifest did not enumerate). Track it anyway with
		// expected=0 so the dashboard still grows a row.
		let book = this.books.get(parts.book);
		if (!book) {
			book = {
				book: parts.book,
				kind: parts.kind,
				documentSlug: parts.documentSlug,
				expected: 0,
				done: 0,
				passed: 0,
				failed: 0,
			};
			this.books.set(parts.book, book);
		}
		book.done += 1;
		if (passed) book.passed += 1;
		else if (failed) book.failed += 1;

		const status: 'passed' | 'failed' = passed ? 'passed' : 'failed';
		// A URL is exercised across multiple tiers; record it failed if any
		// tier failed -- never let a later passing tier overwrite a failure.
		if (failed) this.results.set(parts.url, 'failed');
		else if (passed && this.results.get(parts.url) !== 'failed') this.results.set(parts.url, 'passed');

		if (failed) {
			this.failures.push({
				book: parts.book,
				tier: parts.tier,
				url: parts.url,
				title: test.title,
				errorMessage: result.error?.message ?? result.errors[0]?.message ?? '(no error message)',
			});
		}

		// Stream one crash-safe line. A simple synchronous append survives a
		// webServer SIGKILL because each line is flushed before the next test.
		appendFileSync(
			resolvePath(this.outDir, 'progress.ndjson'),
			`${JSON.stringify({ book: parts.book, tier: parts.tier, url: parts.url, status, durationMs: result.duration })}\n`,
		);

		// Repaint the dashboard (TTY) or emit a per-book completion line.
		if (this.isTty) {
			if (!this.dashboardStarted) {
				// No manifest meant nothing to pre-draw in onBegin (e.g. an
				// ad-hoc `--grep` run). Start the dashboard lazily now that the
				// first book is known.
				process.stdout.write('\n');
				this.drawDashboard(true);
				this.dashboardStarted = true;
			} else {
				this.maybeRepaint();
			}
		} else if (book.done === book.expected && book.expected > 0) {
			// Non-TTY fallback: one line when a book finishes all its URLs.
			const mark = book.failed === 0 ? 'ok' : `${book.failed} failed`;
			process.stdout.write(`  ${book.book}  ${book.done}/${book.expected}  ${mark}\n`);
		}
	}

	onEnd(result: FullResult): void {
		// Final repaint so the dashboard shows the terminal state, then move
		// the cursor below it for the summary block.
		if (this.isTty && this.dashboardStarted) {
			this.drawDashboard(false);
			process.stdout.write('\n');
		}

		if (this.listMode) {
			// Plan already printed in onBegin; nothing ran, nothing to write.
			return;
		}

		const skip = readSkipPayload(this.outDir);
		const plannedTotal = this.plannedUrlTotal();
		const interrupted =
			result.status === 'interrupted' ||
			result.status === 'timedout' ||
			(plannedTotal > 0 && this.urlTestsRun < plannedTotal);

		// SWEEP_RESUME=1 with nothing to do -> say so plainly.
		if (this.resumeMode && this.urlTestsRun === 0 && !interrupted) {
			process.stdout.write('last run was clean -- nothing to resume; run a full or --book run\n');
		}

		if (interrupted) {
			this.printCrashBanner(plannedTotal);
		}

		this.printSummary(skip, interrupted, plannedTotal);

		// --- Artefacts ---
		const wallMs = Date.now() - this.wallStartMs;
		this.writeLastRun(result, wallMs);
		this.writeCoverageReport(skip, result.status, interrupted, plannedTotal);
		this.writeFailuresTxt();
		this.writeSummaryJson(result.status, interrupted, plannedTotal, skip);
	}

	// --- Plan rendering ---------------------------------------------------

	/** Print the tree-grouped plan table from `manifest.json`. */
	private printPlan(): void {
		const lines = renderPlanTree(this.manifest);
		process.stdout.write(`${lines.join('\n')}\n`);
	}

	/**
	 * Planned URL count for THIS run. Sums the seeded books' expected counts
	 * -- which `onBegin` already narrowed to the `--book` scope -- so a
	 * scoped run isn't mistaken for a crashed full sweep. Falls back to the
	 * manifest total only when no books were seeded.
	 */
	private plannedUrlTotal(): number {
		let sum = 0;
		for (const b of this.books.values()) sum += b.expected;
		if (sum > 0) return sum;
		return this.manifest?.totals.total ?? 0;
	}

	// --- Live dashboard ---------------------------------------------------

	private maybeRepaint(): void {
		const now = Date.now();
		if (now - this.lastRepaintMs < REPAINT_THROTTLE_MS) return;
		this.lastRepaintMs = now;
		this.drawDashboard(false);
	}

	/**
	 * Render the per-book progress dashboard in place. `first` skips the
	 * cursor-up step (nothing drawn yet). Only ever called when `isTty`.
	 */
	private drawDashboard(first: boolean): void {
		const lines = renderDashboard(this.books);
		if (!first && this.dashboardLines > 0) {
			// Move cursor up to the top of the previous block, clear downward.
			process.stdout.write(`[${this.dashboardLines}A[0J`);
		}
		process.stdout.write(`${lines.join('\n')}\n`);
		this.dashboardLines = lines.length;
	}

	private printCrashBanner(plannedTotal: number): void {
		const RED = '\x1b[31m';
		const bar = '━'.repeat(72);
		process.stdout.write(`\n${paint(RED, bar)}\n`);
		process.stdout.write(
			paint(
				RED + SGR.bold,
				`  ⚠  RUN DID NOT FINISH -- server likely crashed.\n` +
					`     ${this.urlTestsRun}/${plannedTotal} URLs checked. Partial results below.`,
			) + '\n',
		);
		process.stdout.write(`${paint(RED, bar)}\n`);
	}

	// --- Terminal summary -------------------------------------------------

	private printSummary(skip: SkipPayload | null, interrupted: boolean, plannedTotal: number): void {
		const RED = '\x1b[31m';
		const out: string[] = [];
		out.push('');
		out.push(
			`${paint(SGR.bold, 'Flightbag coverage sweep')}  ${paint(
				SGR.dim,
				`${this.sweepMode} mode${this.manifest?.sampledPerBook ? ` (${this.manifest.sampledPerBook}/book)` : ''}`,
			)}`,
		);
		out.push('');

		// Per-tier counts + timings, as a bordered table.
		const tierRows: TableRow[] = [];
		for (const tier of ['sanity', 'structural', 'content'] as const) {
			const b = this.perTier[tier];
			if (!b) continue;
			const total = b.passed + b.failed;
			const fail = b.failed > 0 ? paint(SGR.yellow, String(b.failed)) : paint(SGR.dim, '0');
			tierRows.push({
				cells: [
					paint(TIER_COLORS[tier], tier),
					`${paint(SGR.green, String(b.passed))}/${total}`,
					fail,
					`${(b.durationMs / 1000).toFixed(1)}s`,
				],
			});
		}
		const guardTotal = this.guardPassed + this.guardFailed;
		if (guardTotal > 0) {
			const gf = this.guardFailed > 0 ? paint(SGR.yellow, String(this.guardFailed)) : paint(SGR.dim, '0');
			tierRows.push({
				cells: [paint(SGR.dim, 'guards'), `${paint(SGR.green, String(this.guardPassed))}/${guardTotal}`, gf, ''],
			});
		}
		for (const line of renderTable(
			[
				{ header: 'TIER', align: 'left' },
				{ header: 'PASS', align: 'right' },
				{ header: 'FAIL', align: 'right' },
				{ header: 'TIME', align: 'right' },
			],
			tierRows,
		)) {
			out.push(line);
		}
		out.push('');

		// Per-book breakdown, bordered table.
		for (const line of renderBookBreakdown(this.books)) out.push(line);
		out.push('');

		// Failures grouped by book, each with a retest command.
		if (this.failures.length === 0) {
			out.push(paint(SGR.green + SGR.bold, '✓  No failures.'));
		} else {
			out.push(paint(RED + SGR.bold, `✗  Failures (${this.failures.length})`));
			const byBook = groupFailuresByBook(this.failures);
			for (const [book, recs] of byBook) {
				out.push(`  ${paint(SGR.bold, book)}  ${paint(SGR.dim, `(${recs.length})`)}`);
				for (const rec of recs) {
					out.push(`    ${paint(tierColor(rec.tier), `[${rec.tier}]`)} ${rec.url}`);
					out.push(`      ${paint(RED, rec.errorMessage.split('\n')[0] ?? '')}`);
				}
				out.push(paint(SGR.dim, `    retest: bun run test integration --book "${book}"`));
			}
		}
		out.push('');

		// What-was-tested blurb.
		out.push(whatWasTestedBlurb(this.urlTestsRun, plannedTotal, skip, interrupted));
		out.push('');
		process.stdout.write(`${out.join('\n')}\n`);
	}

	// --- Artefacts --------------------------------------------------------

	private writeLastRun(result: FullResult, wallMs: number): void {
		const resultsMap: Record<string, 'passed' | 'failed'> = {};
		for (const [url, status] of this.results) resultsMap[url] = status;
		// `total` / `passed` / `failed` count executed tests (one per tier per
		// URL), not unique URLs -- `results` is a url-keyed map and necessarily
		// dedupes the three tiers that share each URL.
		writeFileSync(
			resolvePath(this.outDir, 'last-run.json'),
			`${JSON.stringify(
				{
					finishedAt: new Date().toISOString(),
					mode: this.sweepMode,
					status: result.status,
					wallMs,
					total: this.urlTestsRun,
					passed: this.urlTestsPassed,
					failed: this.urlTestsFailed,
					results: resultsMap,
				},
				null,
				2,
			)}\n`,
		);
	}

	private writeCoverageReport(
		skip: SkipPayload | null,
		overallStatus: FullResult['status'],
		interrupted: boolean,
		plannedTotal: number,
	): void {
		const report = renderReport(
			this.perTier,
			this.books,
			this.failures,
			skip,
			overallStatus,
			interrupted,
			this.urlTestsRun,
			plannedTotal,
			{ guardPassed: this.guardPassed, guardFailed: this.guardFailed },
		);
		writeFileSync(resolvePath(this.outDir, 'coverage-report.md'), report);
	}

	private writeFailuresTxt(): void {
		if (this.failures.length === 0) {
			writeFileSync(resolvePath(this.outDir, 'coverage-failures.txt'), '');
			return;
		}
		const lines: string[] = [];
		for (const rec of this.failures) {
			lines.push(`[${rec.tier}] ${rec.book} ${rec.url}`);
			lines.push(`  ${rec.errorMessage.split('\n')[0]}`);
		}
		writeFileSync(resolvePath(this.outDir, 'coverage-failures.txt'), `${lines.join('\n')}\n`);
	}

	private writeSummaryJson(
		overallStatus: FullResult['status'],
		interrupted: boolean,
		plannedTotal: number,
		skip: SkipPayload | null,
	): void {
		writeFileSync(
			resolvePath(this.outDir, 'coverage-summary.json'),
			`${JSON.stringify(
				{
					status: overallStatus,
					interrupted,
					mode: this.sweepMode,
					plannedTotal,
					urlTestsRun: this.urlTestsRun,
					perTier: this.perTier,
					guards: { passed: this.guardPassed, failed: this.guardFailed },
					books: [...this.books.values()].map((b) => ({
						book: b.book,
						kind: b.kind,
						documentSlug: b.documentSlug,
						expected: b.expected,
						done: b.done,
						passed: b.passed,
						failed: b.failed,
					})),
					failures: this.failures,
					skippedCount: skip?.skipped.length ?? 0,
				},
				null,
				2,
			)}\n`,
		);
	}
}

// --- Pure helpers (no `this`, easy to reason about) ---------------------

function readManifest(outDir: string): Manifest | null {
	try {
		const raw = readFileSync(resolvePath(outDir, 'manifest.json'), 'utf8');
		return JSON.parse(raw) as Manifest;
	} catch {
		return null;
	}
}

function readSkipPayload(outDir: string): SkipPayload | null {
	try {
		const raw = readFileSync(resolvePath(outDir, 'skipped.json'), 'utf8');
		return JSON.parse(raw) as SkipPayload;
	} catch {
		return null;
	}
}

/**
 * The Playwright `--grep` pattern, if the run is scoped (e.g. `bun run test
 * integration --book afh` -> `--grep afh`). Returns `null` for an unscoped
 * full sweep. Used to narrow the dashboard to the books actually swept.
 */
function readGrepPattern(): RegExp | null {
	const args = process.argv;
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === '--grep' || arg === '-g') {
			const next = args[i + 1];
			if (next !== undefined && next.length > 0) {
				try {
					return new RegExp(next);
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}

/** Group books by `kind`, kinds sorted A-Z, books sorted within a kind. */
function booksByKind<T extends { readonly book: string; readonly kind: string }>(
	books: Iterable<T>,
): Array<[string, T[]]> {
	const grouped = new Map<string, T[]>();
	for (const b of books) {
		const list = grouped.get(b.kind) ?? [];
		list.push(b);
		grouped.set(b.kind, list);
	}
	const out: Array<[string, T[]]> = [];
	for (const kind of [...grouped.keys()].sort()) {
		const list = (grouped.get(kind) ?? []).slice().sort((a, b) => a.book.localeCompare(b.book));
		out.push([kind, list]);
	}
	return out;
}

// --- Shared bordered-table renderer -----------------------------------------
//
// One table primitive backs the run plan, the final per-book breakdown, and
// the live dashboard so they share a single look: rounded box-drawing border,
// a bold header row, a header rule, and ANSI-aware column alignment (padding
// measures *visible* width, so coloured cells still line up).

const BOX = {
	tl: '╭',
	tr: '╮',
	bl: '╰',
	br: '╯',
	h: '─',
	v: '│',
	teeL: '├',
	teeR: '┤',
} as const;

/** Visible width of a string, ignoring ANSI SGR escape sequences. */
function visibleWidth(text: string): number {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI SGR.
	return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/** Pad `text` to `width` visible columns (ANSI-aware). `align` defaults left. */
function padCell(text: string, width: number, align: 'left' | 'right'): string {
	const gap = Math.max(0, width - visibleWidth(text));
	const pad = ' '.repeat(gap);
	return align === 'right' ? `${pad}${text}` : `${text}${pad}`;
}

interface TableColumn {
	readonly header: string;
	readonly align: 'left' | 'right';
}

interface TableRow {
	/** Cell strings (may carry ANSI). A `rule` row draws a horizontal divider. */
	readonly cells?: readonly string[];
	readonly rule?: boolean;
}

/**
 * Render a bordered table. Column widths fit the widest visible cell. Body
 * rows may carry ANSI colour; the header is bold, a `rule: true` row draws an
 * internal divider (e.g. before a totals footer).
 */
function renderTable(columns: readonly TableColumn[], rows: readonly TableRow[], title?: string): string[] {
	const widths = columns.map((c, i) => {
		let w = visibleWidth(c.header);
		for (const r of rows) {
			const cell = r.cells?.[i];
			if (cell !== undefined) w = Math.max(w, visibleWidth(cell));
		}
		return w;
	});
	// Inner width = sum of columns + " │ " separators + 1 pad each edge.
	const inner = widths.reduce((a, b) => a + b, 0) + (columns.length - 1) * 3 + 2;
	const hRule = BOX.h.repeat(inner);

	const lines: string[] = [];
	lines.push(paint(SGR.dim, `${BOX.tl}${hRule}${BOX.tr}`));
	if (title !== undefined) {
		lines.push(`${paint(SGR.dim, BOX.v)} ${padCell(paint(SGR.bold, title), inner - 2, 'left')} ${paint(SGR.dim, BOX.v)}`);
		lines.push(paint(SGR.dim, `${BOX.teeL}${hRule}${BOX.teeR}`));
	}
	const renderCells = (cells: readonly string[], bold: boolean): string => {
		const painted = columns.map((c, i) => {
			const raw = cells[i] ?? '';
			const padded = padCell(raw, widths[i] ?? 0, c.align);
			return bold ? paint(SGR.bold, padded) : padded;
		});
		return `${paint(SGR.dim, BOX.v)} ${painted.join(paint(SGR.dim, ' │ '))} ${paint(SGR.dim, BOX.v)}`;
	};
	lines.push(renderCells(columns.map((c) => c.header), true));
	lines.push(paint(SGR.dim, `${BOX.teeL}${hRule}${BOX.teeR}`));
	for (const r of rows) {
		if (r.rule) {
			lines.push(paint(SGR.dim, `${BOX.teeL}${hRule}${BOX.teeR}`));
			continue;
		}
		lines.push(renderCells(r.cells ?? [], false));
	}
	lines.push(paint(SGR.dim, `${BOX.bl}${hRule}${BOX.br}`));
	return lines;
}

/** Tier colour per column: sanity green, structural yellow, content blue. */
const TIER_COLORS = { sanity: SGR.green, structural: SGR.yellow, content: SGR.blue } as const;

/** Colour for a tier name; falls back to dim for an unrecognised tier. */
function tierColor(tier: string): string {
	return tier === 'sanity' || tier === 'structural' || tier === 'content' ? TIER_COLORS[tier] : SGR.dim;
}

/**
 * Render the run plan as a bordered table. Shows the FULL coverage territory
 * (every URL across all three tiers), with a one-line note of what the
 * current invocation will actually execute.
 *
 * SANITY / STRUCT / CONTENT are the three tiers the sweep walks:
 *   - sanity   -- every URL must respond < 400
 *   - struct   -- landing + chapter pages must render real content
 *   - content  -- chapter samples must show the expected row
 */
function renderPlanTree(manifest: Manifest | null): string[] {
	if (!manifest) {
		return [
			paint(SGR.bold, 'Flightbag coverage plan'),
			paint(SGR.dim, '  manifest.json not found -- run the spec to generate it'),
		];
	}

	// Prefer the full coverage territory; fall back to `totals`/`books` for
	// manifests written before the `coverage` block existed.
	const cov = manifest.coverage ?? { totals: manifest.totals, books: manifest.books };
	const columns: readonly TableColumn[] = [
		{ header: 'DOCUMENT', align: 'left' },
		{ header: 'URLs', align: 'right' },
		{ header: 'SANITY', align: 'right' },
		{ header: 'STRUCT', align: 'right' },
		{ header: 'CONTENT', align: 'right' },
	];
	const rows: TableRow[] = [];
	for (const [kind, list] of booksByKind(cov.books)) {
		rows.push({ cells: [paint(SGR.cyan, `${kind}/`), '', '', '', ''] });
		for (const b of list) {
			rows.push({
				cells: [
					`  ${b.documentSlug}`,
					String(b.total),
					paint(TIER_COLORS.sanity, String(b.sanity)),
					paint(TIER_COLORS.structural, String(b.structural)),
					paint(TIER_COLORS.content, String(b.content)),
				],
			});
		}
	}
	rows.push({ rule: true });
	const t = cov.totals;
	rows.push({
		cells: [
			paint(SGR.bold, `TOTAL (${t.books} books)`),
			paint(SGR.bold, String(t.total)),
			paint(SGR.bold, String(t.sanity)),
			paint(SGR.bold, String(t.structural)),
			paint(SGR.bold, String(t.content)),
		],
	});

	const lines = renderTable(columns, rows, 'Flightbag coverage plan');
	// One line under the table: what THIS invocation runs vs the full plan.
	const willRun = manifest.totals.total;
	const note =
		manifest.mode === 'full'
			? `This run: full sweep -- all ${willRun} URLs.`
			: `This run: ${manifest.mode} sweep -- ${willRun} of ${t.total} URLs` +
				`${manifest.sampledPerBook ? ` (${manifest.sampledPerBook}/book)` : ''}.`;
	lines.push(paint(SGR.dim, note));
	return lines;
}

/** Build kind-grouped table rows from live book progress; `cellsFor` per book. */
function bookTableRows(
	books: Map<string, BookProgress>,
	cellsFor: (b: BookProgress) => readonly string[],
	columnCount: number,
): TableRow[] {
	const rows: TableRow[] = [];
	const blank = Array<string>(columnCount).fill('');
	for (const [kind, group] of booksByKind([...books.values()])) {
		rows.push({ cells: [paint(SGR.cyan, `${kind}/`), ...blank.slice(1)] });
		for (const b of group) rows.push({ cells: cellsFor(b) });
	}
	return rows;
}

/** Render the final per-book breakdown as a bordered table. */
function renderBookBreakdown(books: Map<string, BookProgress>): string[] {
	if (books.size === 0) return [paint(SGR.dim, '(no books)')];
	const columns: readonly TableColumn[] = [
		{ header: 'DOCUMENT', align: 'left' },
		{ header: 'DONE', align: 'right' },
		{ header: 'PASS', align: 'right' },
		{ header: 'FAIL', align: 'right' },
	];
	const rows = bookTableRows(
		books,
		(b) => {
			const expected = b.expected > 0 ? b.expected : b.done;
			const fail = b.failed > 0 ? paint(SGR.yellow, String(b.failed)) : paint(SGR.dim, '0');
			return [`  ${b.documentSlug}`, `${b.done}/${expected}`, paint(SGR.green, String(b.passed)), fail];
		},
		columns.length,
	);
	return renderTable(columns, rows);
}

/**
 * Render the live dashboard as a bordered table -- one progress bar per book,
 * percentage, and pass/fail counts. Repainted in place during the sweep.
 */
function renderDashboard(books: Map<string, BookProgress>): string[] {
	if (books.size === 0) return [paint(SGR.dim, '(no books in manifest)')];
	const columns: readonly TableColumn[] = [
		{ header: 'DOCUMENT', align: 'left' },
		{ header: 'PROGRESS', align: 'left' },
		{ header: '%', align: 'right' },
		{ header: 'PASS', align: 'right' },
		{ header: 'FAIL', align: 'right' },
	];
	const rows = bookTableRows(
		books,
		(b) => {
			const expected = b.expected > 0 ? b.expected : Math.max(b.done, 1);
			const frac = Math.min(1, b.done / expected);
			const filled = Math.round(frac * BAR_WIDTH);
			const done = frac >= 1 && b.failed === 0;
			const barColor = b.failed > 0 ? SGR.yellow : done ? SGR.green : SGR.cyan;
			const bar = paint(barColor, BAR_FILLED.repeat(filled)) + paint(SGR.dim, BAR_EMPTY.repeat(BAR_WIDTH - filled));
			const fail = b.failed > 0 ? paint(SGR.yellow, String(b.failed)) : paint(SGR.dim, '0');
			return [
				`  ${b.documentSlug}`,
				bar,
				`${Math.round(frac * 100)}%`,
				b.done > 0 ? paint(SGR.green, String(b.passed)) : paint(SGR.dim, '-'),
				b.done > 0 ? fail : paint(SGR.dim, '-'),
			];
		},
		columns.length,
	);
	return renderTable(columns, rows);
}

function groupFailuresByBook(failures: readonly FailureRecord[]): Array<[string, FailureRecord[]]> {
	const grouped = new Map<string, FailureRecord[]>();
	for (const f of failures) {
		const list = grouped.get(f.book) ?? [];
		list.push(f);
		grouped.set(f.book, list);
	}
	return [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function whatWasTestedBlurb(
	urlTestsRun: number,
	plannedTotal: number,
	skip: SkipPayload | null,
	interrupted: boolean,
): string {
	const skipped = skip?.skipped.length ?? 0;
	const planNote = plannedTotal > 0 ? ` of ${plannedTotal} planned` : '';
	const partial = interrupted ? ' (run did not finish -- counts are partial)' : '';
	return `Checked ${urlTestsRun} flightbag reader URLs${planNote}${partial}; ${skipped} rows skipped (covered-by-parent / no-route).`;
}

function renderReport(
	perTier: Record<string, { passed: number; failed: number; durationMs: number }>,
	books: Map<string, BookProgress>,
	failures: readonly FailureRecord[],
	skip: SkipPayload | null,
	overallStatus: FullResult['status'],
	interrupted: boolean,
	urlTestsRun: number,
	plannedTotal: number,
	guards: { guardPassed: number; guardFailed: number },
): string {
	const today = new Date().toISOString().slice(0, 10);
	const lines: string[] = [];
	lines.push(`# Flightbag coverage run -- ${today}`);
	lines.push('');
	lines.push(`Run status: \`${overallStatus}\``);
	lines.push('');
	if (interrupted) {
		lines.push(`> **Run did not finish** -- server likely crashed. ${urlTestsRun}/${plannedTotal} URLs checked.`);
		lines.push('> The figures below cover only what ran before the run stopped.');
		lines.push('');
	}

	lines.push('## Tier totals');
	lines.push('');
	lines.push('```text');
	for (const tier of ['sanity', 'structural', 'content'] as const) {
		const b = perTier[tier];
		if (!b) {
			lines.push(`${tier.padEnd(11)} (no results)`);
			continue;
		}
		const total = b.passed + b.failed;
		const secs = (b.durationMs / 1000).toFixed(1);
		lines.push(
			`${tier.padEnd(11)} ${b.passed} / ${total} passed  ${secs}s${b.failed > 0 ? `  (${b.failed} failed)` : ''}`,
		);
	}
	const guardTotal = guards.guardPassed + guards.guardFailed;
	if (guardTotal > 0) {
		lines.push(`Guards:     ${guards.guardPassed} passed${guards.guardFailed > 0 ? `, ${guards.guardFailed} failed` : ''}`);
	}
	lines.push('```');
	lines.push('');

	lines.push('## Per-book breakdown');
	lines.push('');
	lines.push('```text');
	for (const line of renderBookBreakdown(books)) lines.push(line);
	lines.push('```');
	lines.push('');

	lines.push(`## Failures (${failures.length})`);
	lines.push('');
	if (failures.length === 0) {
		lines.push('_None._');
		lines.push('');
	} else {
		for (const [book, recs] of groupFailuresByBook(failures)) {
			lines.push(`### ${book} (${recs.length})`);
			lines.push('');
			for (const rec of recs) {
				lines.push(`- **${rec.tier}** \`${rec.url}\``);
				lines.push(`  - ${rec.errorMessage.split('\n')[0]}`);
			}
			lines.push('');
			lines.push(`Retest: \`bun run test integration --book "${book}"\``);
			lines.push('');
		}
	}

	lines.push('## Skipped rows (covered-by-parent / no-route)');
	lines.push('');
	if (!skip) {
		lines.push('_No skip log emitted by the spec (skipped.json missing)._');
		lines.push('');
	} else if (skip.skipped.length === 0) {
		lines.push('_No rows skipped._');
		lines.push('');
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
			const sorted = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
			for (const [reason, count] of sorted) {
				lines.push(`- ${count} -- ${reason}`);
			}
			lines.push('');
		}
	}

	lines.push('## What was tested');
	lines.push('');
	lines.push(whatWasTestedBlurb(urlTestsRun, plannedTotal, skip, interrupted));

	return `${lines.join('\n')}\n`;
}
