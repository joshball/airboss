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

interface Manifest {
	readonly generatedAt: string;
	readonly mode: string;
	readonly sampledPerBook: number | null;
	readonly totals: {
		readonly sanity: number;
		readonly structural: number;
		readonly content: number;
		readonly total: number;
		readonly books: number;
	};
	readonly books: readonly ManifestBook[];
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
		// expected URL count per book before any test finishes.
		if (this.manifest) {
			for (const b of this.manifest.books) {
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

	/** Planned URL count: prefer the manifest total, else the seeded books. */
	private plannedUrlTotal(): number {
		if (this.manifest) return this.manifest.totals.total;
		let sum = 0;
		for (const b of this.books.values()) sum += b.expected;
		return sum;
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
		const bar = '='.repeat(72);
		process.stdout.write(`\n${bar}\n`);
		process.stdout.write(
			`⚠ RUN DID NOT FINISH -- server likely crashed. ${this.urlTestsRun}/${plannedTotal} URLs checked. Partial results below.\n`,
		);
		process.stdout.write(`${bar}\n`);
	}

	// --- Terminal summary -------------------------------------------------

	private printSummary(skip: SkipPayload | null, interrupted: boolean, plannedTotal: number): void {
		const out: string[] = [];
		out.push('');
		out.push('Flightbag coverage sweep');
		out.push(`  mode: ${this.sweepMode}${this.manifest?.sampledPerBook ? ` (${this.manifest.sampledPerBook}/book)` : ''}`);
		out.push('');

		// Per-tier counts + timings.
		out.push('Tiers');
		for (const tier of ['sanity', 'structural', 'content'] as const) {
			const b = this.perTier[tier];
			if (!b) continue;
			const total = b.passed + b.failed;
			const secs = (b.durationMs / 1000).toFixed(1);
			const failNote = b.failed > 0 ? `  ${b.failed} failed` : '';
			out.push(`  ${tier.padEnd(11)} ${String(b.passed).padStart(5)} / ${total} passed  ${secs}s${failNote}`);
		}
		const guardTotal = this.guardPassed + this.guardFailed;
		if (guardTotal > 0) {
			out.push(`  Guards: ${this.guardPassed} passed${this.guardFailed > 0 ? `, ${this.guardFailed} failed` : ''}`);
		}
		out.push('');

		// Tree-grouped per-book breakdown.
		out.push('Books');
		for (const line of renderBookBreakdown(this.books)) out.push(`  ${line}`);
		out.push('');

		// Failures grouped by book, each with a retest command.
		if (this.failures.length === 0) {
			out.push('No failures.');
		} else {
			out.push(`Failures (${this.failures.length})`);
			const byBook = groupFailuresByBook(this.failures);
			for (const [book, recs] of byBook) {
				out.push(`  ${book}  (${recs.length})`);
				for (const rec of recs) {
					out.push(`    [${rec.tier}] ${rec.url}`);
					out.push(`      ${rec.errorMessage.split('\n')[0]}`);
				}
				out.push(`    retest: bun run test integration --book "${book}"`);
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

/**
 * Render the compact tree-grouped plan table from the manifest. A kind with
 * exactly one book is one-lined (`aim/  aim  545  ...`); kinds with more than
 * one book nest their books under the kind header.
 */
function renderPlanTree(manifest: Manifest | null): string[] {
	if (!manifest) {
		return ['Flightbag coverage plan', '  (manifest.json not found -- run the spec to generate it)'];
	}
	const lines: string[] = [];
	lines.push(`Flightbag coverage plan -- mode: ${manifest.mode}, ${manifest.totals.books} books, ${manifest.totals.total} URLs`);
	const grouped = booksByKind(manifest.books);
	// Column widths over all books for tidy alignment.
	const slugWidth = Math.max(4, ...manifest.books.map((b) => b.documentSlug.length));
	const totalWidth = Math.max(5, ...manifest.books.map((b) => String(b.total).length));
	for (const [kind, list] of grouped) {
		if (list.length === 1) {
			const b = list[0] as ManifestBook;
			lines.push(
				`${kind}/  ${b.documentSlug.padEnd(slugWidth)}  ${String(b.total).padStart(totalWidth)}   ${b.sanity} / ${b.structural} / ${b.content}`,
			);
			continue;
		}
		lines.push(`${kind}/`);
		for (const b of list) {
			lines.push(
				`  ${b.documentSlug.padEnd(slugWidth)}  ${String(b.total).padStart(totalWidth)}   ${b.sanity} / ${b.structural} / ${b.content}`,
			);
		}
	}
	lines.push(`(counts: sanity / structural / content)`);
	return lines;
}

/** Render the per-book breakdown tree for the terminal summary + report. */
function renderBookBreakdown(books: Map<string, BookProgress>): string[] {
	if (books.size === 0) return ['(no books)'];
	const list = [...books.values()];
	const slugWidth = Math.max(4, ...list.map((b) => b.documentSlug.length));
	const doneWidth = Math.max(4, ...list.map((b) => String(b.done).length));
	const lines: string[] = [];
	for (const [kind, group] of booksByKind(list)) {
		lines.push(`${kind}/`);
		for (const b of group) {
			const expected = b.expected > 0 ? b.expected : b.done;
			const failNote = b.failed > 0 ? `  ${b.failed} failed` : '';
			lines.push(
				`  ${b.documentSlug.padEnd(slugWidth)}  ${String(b.done).padStart(doneWidth)}/${expected}  ${b.passed} passed${failNote}`,
			);
		}
	}
	return lines;
}

/**
 * Render the live dashboard: a tree of books, each with a progress bar,
 * percentage, and pass/fail counts once results land.
 */
function renderDashboard(books: Map<string, BookProgress>): string[] {
	const list = [...books.values()];
	if (list.length === 0) return ['(no books in manifest)'];
	const nameWidth = Math.max(4, ...list.map((b) => b.documentSlug.length));
	const lines: string[] = [];
	for (const [kind, group] of booksByKind(list)) {
		lines.push(`${kind}/`);
		for (const b of group) {
			const expected = b.expected > 0 ? b.expected : Math.max(b.done, 1);
			const frac = Math.min(1, b.done / expected);
			const filled = Math.round(frac * BAR_WIDTH);
			const bar = BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(BAR_WIDTH - filled);
			const pct = `${Math.round(frac * 100)}%`.padStart(4);
			const counts = b.done > 0 ? `  ${b.passed} ok${b.failed > 0 ? ` / ${b.failed} fail` : ''}` : '';
			lines.push(`  ${b.documentSlug.padEnd(nameWidth)}  ${bar} ${pct}${counts}`);
		}
	}
	return lines;
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
