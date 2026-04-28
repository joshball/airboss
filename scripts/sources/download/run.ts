/**
 * `bun run sources download` orchestrator.
 *
 * Top-level driver: parse args -> resolve cache root -> build plans -> dispatch
 * to verify or per-corpus execute -> print summary. Returns the process exit
 * code; the dispatcher entry point in `scripts/sources.ts` runs `process.exit`.
 */

import { resolveCacheRoot } from '../../lib/cache';
import { setColorEnabled } from '../../lib/colors';
import { describeError } from '../../lib/error';
import { ALL_CORPORA, type CliArgs, HELP_TEXT, parseArgs } from './args';
import { executePlan, runVerify } from './execute';
import { buildPlans, type DownloadPlan } from './plans';
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
		for (const plan of corpusPlans) {
			await executePlan(plan, args, result);
		}
	}

	printSummary(results, cacheRoot, args.dryRun);

	const totalErrors = results.reduce((acc, r) => acc + r.errors, 0);

	// Piggyback errata discovery on a successful download. Skipped on dry-run
	// (no real download happened) and on verify-only runs (which return earlier
	// above). The freshness gate inside discovery suppresses repeat scans
	// within the 7-day window, so this is effectively free in the common case.
	if (!args.dryRun && totalErrors === 0) {
		await maybeRunDiscoveryPiggyback(cacheRoot);
	}

	return totalErrors > 0 ? 1 : 0;
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
