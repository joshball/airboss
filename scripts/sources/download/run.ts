/**
 * `bun run sources download` orchestrator.
 *
 * Top-level driver: parse args -> resolve cache root -> build plans -> dispatch
 * to verify or per-corpus execute -> print summary. Returns the process exit
 * code; the dispatcher entry point in `scripts/sources.ts` runs `process.exit`.
 */

import { resolveCacheRoot } from '../../lib/cache';
import { dim, red, setColorEnabled, yellow } from '../../lib/colors';
import { describeError } from '../../lib/error';
import { ALL_CORPORA, type CliArgs, HELP_TEXT, parseArgs } from './args';
import { executePlan, runVerify } from './execute';
import { dropPartialDownloads, partialLogPath, planIdKey, readPartialDownloads } from './partial-log';
import { buildPlans, type DownloadPlan } from './plans';
import { runPlansBounded } from './pool';
import { type CorpusResult, printSummary, printVerifyTable } from './summary';

export interface RunOptions {
	readonly argv?: readonly string[];
	readonly cacheRoot?: string;
}

export async function runDownloadSources(opts: RunOptions = {}): Promise<number> {
	const argv = opts.argv ?? process.argv.slice(2);
	let args: CliArgs;
	try {
		args = parseArgs(argv);
	} catch (error) {
		console.error(describeError(error));
		console.error('');
		console.error(HELP_TEXT);
		return 2;
	}

	if (args.noColor) setColorEnabled(false);

	if (args.help) {
		console.log(HELP_TEXT);
		return 0;
	}

	const cacheRoot = opts.cacheRoot ?? resolveCacheRoot();

	let plans: DownloadPlan[];
	try {
		plans = await buildPlans(args, cacheRoot);
	} catch (error) {
		console.error(`failed to build plans: ${describeError(error)}`);
		return 2;
	}

	if (plans.length === 0) {
		console.log('No corpora selected. Use --corpus= or --include-handbooks-extras to expand.');
		return 0;
	}

	if (args.verify) {
		const { rows, ok } = await runVerify(plans);
		printVerifyTable(rows);
		return ok ? 0 : 1;
	}

	if (args.dryRun) {
		console.log(`Dry run -- ${plans.length} planned downloads (cache root ${cacheRoot}):`);
	} else {
		console.log(`Fetching ${plans.length} sources to ${cacheRoot}`);
		surfacePreviousPartialLog(cacheRoot, plans);
		// Drop only the prior records for plans this run will actually touch so
		// follow-up runs (with different `--corpus=` filtering) can still see
		// failures the current run won't address. Dry runs don't touch the log.
		const planIds = new Set(plans.map((p) => planIdKey(p)));
		dropPartialDownloads(cacheRoot, planIds);
	}

	const results: CorpusResult[] = ALL_CORPORA.filter((c) => args.corpora.has(c)).map((corpus) => ({
		corpus,
		files: 0,
		bytes: 0,
		errors: 0,
		skipped: 0,
	}));

	for (const corpus of ALL_CORPORA) {
		if (!args.corpora.has(corpus)) continue;
		const corpusPlans = plans.filter((p) => p.corpus === corpus);
		if (corpusPlans.length === 0) {
			if (corpus === 'handbooks' && !args.includeHandbooksExtras) {
				console.log(`\n${corpus}: skipped (already cached; pass --include-handbooks-extras to fetch more)`);
			}
			continue;
		}
		console.log(`\n${corpus}:`);
		const result = results.find((r) => r.corpus === corpus);
		if (result === undefined) continue;
		// Bounded-concurrency execution. Per-plan output via `describePlan` is
		// self-identifying; interleave is the trade-off for ~limit-x wall-clock.
		// Errors in one plan never cancel siblings -- `executePlan` swallows them
		// into `result.errors`, never throws. The end-of-corpus summary still
		// prints sequentially after all workers drain.
		const ctx = args.dryRun ? undefined : { cacheRoot };
		await runPlansBounded(corpusPlans, args.concurrency, (plan) => executePlan(plan, args, result, ctx));
	}

	printSummary(results, cacheRoot, args.dryRun);

	const totalErrors = results.reduce((acc, r) => acc + r.errors, 0);

	if (!args.dryRun && totalErrors > 0) {
		printFailedPlansSummary(cacheRoot);
	}

	// Piggyback errata discovery on a successful download. Skipped on dry-run
	// (no real download happened) and on verify-only runs (which return earlier
	// above). The freshness gate inside discovery suppresses repeat scans
	// within the 7-day window, so this is effectively free in the common case.
	if (!args.dryRun && totalErrors === 0) {
		await maybeRunDiscoveryPiggyback(cacheRoot);
	}

	return totalErrors > 0 ? 1 : 0;
}

/**
 * If the previous run left a partial-download log behind, surface a count and
 * (when the operator did NOT pass `--corpus=` filtering this run out) note
 * that the corpora at issue are part of this invocation. The freshness gate
 * does the actual retry: previously-successful entries skip via manifest
 * match, previously-failed entries fall through to a fresh fetch attempt.
 */
function surfacePreviousPartialLog(cacheRoot: string, plans: readonly DownloadPlan[]): void {
	const records = readPartialDownloads(cacheRoot);
	if (records.length === 0) return;
	const planIds = new Set(plans.map((p) => planIdKey(p)));
	const retrying = records.filter((r) => planIds.has(planIdKey(r)));
	const skipping = records.length - retrying.length;
	console.log('');
	console.log(yellow(`${records.length} partial downloads from previous run:`));
	console.log(`  ${dim(`(log: ${partialLogPath(cacheRoot)})`)}`);
	if (retrying.length > 0) {
		console.log(`  retrying ${retrying.length} (still in this run's plan set; freshness gate falls through)`);
	}
	if (skipping > 0) {
		console.log(
			`  skipping ${skipping} (filtered out by --corpus= or --include-handbooks-extras; pass the matching flag to retry)`,
		);
	}
}

/** End-of-run "failures by plan" block + retry hint. */
function printFailedPlansSummary(cacheRoot: string): void {
	const records = readPartialDownloads(cacheRoot);
	if (records.length === 0) return;
	console.log('');
	console.log(red(`Failed plans (${records.length}):`));
	for (const r of records) {
		const ordinal = r.ordinal !== null ? ` ord=${r.ordinal}` : '';
		const edition = r.edition !== null ? `@${r.edition}` : '';
		console.log(`  ${r.corpus}/${r.doc}${edition} ${r.kind}${ordinal}`);
		console.log(`    ${r.url}`);
		console.log(`    ${dim(r.error)}`);
	}
	console.log('');
	console.log(`(Re-run \`bun run sources download\` to retry; cached files are skipped via manifest match.)`);
	console.log(`(Log: ${partialLogPath(cacheRoot)})`);
}

async function maybeRunDiscoveryPiggyback(cacheRoot: string): Promise<void> {
	try {
		const { runDiscoverErrata } = await import('../discover');
		await runDiscoverErrata({ cacheRoot, argv: [] });
	} catch (error) {
		// Discovery is opportunistic on the download path; do not fail the
		// download because the scan blew up.
		const msg = error instanceof Error ? error.message : String(error);
		console.warn(`discover-errata (piggyback): skipped due to error: ${msg}`);
	}
}
