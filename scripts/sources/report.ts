/**
 * `bun run sources report` -- source-corpus drift report.
 *
 * Walks every catalogued document the downloader knows about (AC, ACS, AIM,
 * handbooks, CFR -- the same plan set `bun run sources download` builds) and
 * runs the existing freshness check (HEAD only -- no body fetch) against each.
 * Prints a per-document verdict table to stdout.
 *
 * This command does NOT download. It is the read-only answer to "is anything
 * in the local cache out of date?". Detecting drift and deciding to update are
 * separate actions by design -- a new FAA edition can renumber sections, so an
 * update is a reviewed change, never silent. The operator runs the report;
 * a human runs `bun run sources download` + the citation re-verification.
 *
 * Exit code:
 *   - 0 by default (it is a report, not a gate).
 *   - With `--strict`: 0 when every document is fresh, 1 when any document is
 *     non-fresh. The monthly `source-corpus-drift` scheduled job uses `--strict`.
 *
 * NOT in CI -- network dependent (HEAD-checks live FAA / eCFR URLs).
 */

import { basename } from 'node:path';
import { resolveCacheRoot } from '../lib/cache';
import { dim, green, red, setColorEnabled, yellow } from '../lib/colors';
import { describeError } from '../lib/error';
import { parseArgs } from './download/args';
import { evaluateFreshness } from './download/freshness';
import { readManifestEntry } from './download/manifest';
import { buildPlans, type DownloadPlan } from './download/plans';

/** The `--strict` flag turns the report into an exit-code gate for the scheduled job. */
export const STRICT_FLAG = '--strict';

/**
 * Per-document drift verdicts. `fresh` is the only non-drift state; every
 * other value means the cached bytes are out of date or could not be
 * checked. `no-cache` is split out from drift because it means the document
 * was never downloaded (a fresh checkout), not that an upstream revision
 * landed -- the operator's action is the same (`download`), the cause differs.
 */
export const DRIFT_VERDICTS = {
	FRESH: 'fresh',
	NEWER_REVISION: 'newer revision available',
	NO_CACHE: 'not cached',
	HEAD_FAILED: 'HEAD failed',
} as const;

export type DriftVerdict = (typeof DRIFT_VERDICTS)[keyof typeof DRIFT_VERDICTS];

interface DocReport {
	readonly label: string;
	readonly verdict: DriftVerdict;
	readonly reason: string;
}

/**
 * Map a `FreshnessDecision` reason onto a drift verdict. The freshness check
 * returns `fresh: false` for several distinct causes; the report collapses
 * them into the three drift states the operator cares about.
 */
function verdictFor(decision: { fresh: boolean; reason: string }): DriftVerdict {
	if (decision.fresh) return DRIFT_VERDICTS.FRESH;
	if (decision.reason === 'no manifest' || decision.reason === 'cached file missing') {
		return DRIFT_VERDICTS.NO_CACHE;
	}
	// A transport-level failure or a non-2xx HTTP status (403 rate-limit, 404,
	// 5xx) is a failed check, not evidence of a new revision -- the report
	// could not learn anything about the upstream document.
	if (decision.reason.startsWith('HEAD failed') || decision.reason.startsWith('HEAD HTTP')) {
		return DRIFT_VERDICTS.HEAD_FAILED;
	}
	// size drift / content-length drift / no metadata match all mean the cached
	// bytes no longer agree with the upstream document.
	return DRIFT_VERDICTS.NEWER_REVISION;
}

/** A short, stable per-document label for the table. */
function planLabel(plan: DownloadPlan): string {
	const edition = plan.edition !== null ? `@${plan.edition}` : '';
	if (plan.kind === 'chapter-pdf' && plan.ordinal !== null) {
		return `${plan.corpus}/${plan.doc}${edition} ch${plan.ordinal}`;
	}
	if (plan.kind === 'aim-section' && plan.ordinal !== null && plan.section !== null) {
		return `${plan.corpus}/${plan.doc}`;
	}
	if (plan.kind === 'ancillary-pdf' && plan.ancillaryKind !== null) {
		// Multiple appendices share the `appendix` ancillary kind; the cache
		// filename is the only thing that distinguishes them. Use the basename
		// (without extension) so each row is unambiguous.
		const file = basename(plan.destPath).replace(/\.pdf$/, '');
		return `${plan.corpus}/${plan.doc}${edition} ${file}`;
	}
	return `${plan.corpus}/${plan.doc}${edition}`;
}

function colorVerdict(verdict: DriftVerdict): string {
	if (verdict === DRIFT_VERDICTS.FRESH) return green(verdict);
	if (verdict === DRIFT_VERDICTS.NO_CACHE) return dim(verdict);
	return red(verdict);
}

/**
 * Evaluate freshness for one plan. Mirrors `executePlan`'s freshness gate:
 * read the manifest entry, then run `evaluateFreshness` (HEAD only).
 */
async function reportForPlan(plan: DownloadPlan): Promise<DocReport> {
	const label = planLabel(plan);
	try {
		const manifest = readManifestEntry(plan);
		const decision = await evaluateFreshness(plan, manifest);
		return { label, verdict: verdictFor(decision), reason: decision.reason };
	} catch (error) {
		return { label, verdict: DRIFT_VERDICTS.HEAD_FAILED, reason: describeError(error) };
	}
}

export interface SourcesReportResult {
	readonly reports: readonly DocReport[];
	readonly driftCount: number;
}

/**
 * Build the drift report without printing. Exposed for the scheduled job and
 * any future programmatic caller. `driftCount` counts every non-fresh document
 * (including `not cached`).
 */
export async function buildSourcesReport(): Promise<SourcesReportResult> {
	// Parse an empty argv: every corpus, no flags. This is the same plan set
	// `bun run sources download` builds for a default (no-flag) invocation,
	// minus handbooks-extras (which the downloader also gates off by default).
	const args = parseArgs([]);
	const cacheRoot = resolveCacheRoot();
	const plans = await buildPlans(args, cacheRoot);

	const reports: DocReport[] = [];
	for (const plan of plans) {
		reports.push(await reportForPlan(plan));
	}
	reports.sort((a, b) => a.label.localeCompare(b.label));

	const driftCount = reports.filter((r) => r.verdict !== DRIFT_VERDICTS.FRESH).length;
	return { reports, driftCount };
}

/**
 * `bun run sources report` entry point. `args` is the dispatcher's `rest`
 * (everything after `report`). Returns the process exit code.
 */
export async function runSourcesReport(args: readonly string[]): Promise<number> {
	const strict = args.includes(STRICT_FLAG);

	console.log('Source-corpus drift report (HEAD only -- no downloads). NOT in CI -- network dependent.');
	console.log('');

	let result: SourcesReportResult;
	try {
		result = await buildSourcesReport();
	} catch (error) {
		console.error(`failed to build the drift report: ${describeError(error)}`);
		return 2;
	}

	const { reports, driftCount } = result;
	if (reports.length === 0) {
		console.log('No catalogued documents found.');
		return 0;
	}

	const labelWidth = Math.max(8, ...reports.map((r) => r.label.length));
	const verdictWidth = Math.max(...Object.values(DRIFT_VERDICTS).map((v) => v.length));
	for (const r of reports) {
		const verdict = colorVerdict(r.verdict).padEnd(verdictWidth + (colorVerdict(r.verdict).length - r.verdict.length));
		const note = r.verdict === DRIFT_VERDICTS.FRESH ? '' : `  ${dim(r.reason)}`;
		console.log(`  ${r.label.padEnd(labelWidth)}  ${verdict}${note}`);
	}

	const freshCount = reports.length - driftCount;
	console.log('');
	if (driftCount === 0) {
		console.log(green(`All ${reports.length} catalogued documents are fresh.`));
		return 0;
	}

	const summary = `${freshCount}/${reports.length} fresh; ${driftCount} document(s) need attention.`;
	console.log(yellow(summary));
	console.log(
		dim('Run `bun run sources download` to refresh, then re-verify any citations the new edition may have renumbered.'),
	);

	// A report exits 0 by default. `--strict` makes it a gate (scheduled-job use).
	return strict ? 1 : 0;
}

if (import.meta.main) {
	if (process.argv.includes('--no-color')) setColorEnabled(false);
	const code = await runSourcesReport(process.argv.slice(2));
	process.exit(code);
}
