/**
 * `bun run sources discover-errata` orchestrator.
 *
 * Pipeline:
 *
 *   1. Read per-handbook metadata from Python (plugin patterns +
 *      YAML applied/dismissed lists).
 *   2. For each handbook in the catalogue, scrape the FAA parent page,
 *      classify findings, and merge against the prior state file.
 *   3. Persist updated state files + the aggregated `_pending.md`.
 *   4. Update `_last_run.json` (so the freshness gate skips on next call).
 *   5. When `GH_TOKEN` is set and there are NEW candidates (status
 *      transitioned this run), open one issue per candidate (idempotent).
 *
 * Network failures are tolerated per-handbook: a handbook that fails to
 * scrape is logged and skipped; other handbooks still write state. The
 * exit code reflects whether any candidates were found (2) or not (0);
 * a hard failure (no handbook scraped) returns 1.
 */

import { DISCOVERY_GITHUB_TOKEN_ENV, DISCOVERY_STATUSES } from '@ab/constants';
import { resolveCacheRoot } from '../../lib/cache';
import { describeError } from '../../lib/error';
import { ArgParseError, DISCOVER_HELP_TEXT, type DiscoverArgs, parseDiscoverArgs } from './args';
import { ALL_HANDBOOK_SLUGS, getCatalogueEntry, HANDBOOK_CATALOGUE, type HandbookCatalogueEntry } from './catalogue';
import { isStale, lastRunPath, writeLastRun } from './freshness';
import { openIssuesForCandidates } from './github';
import { writePendingReport } from './pending';
import { type HandbookDiscoveryMeta, readPythonDiscoveryMeta } from './python-meta';
import { HandbookScrapeError, scrapeHandbookPage } from './scrape';
import {
	type DiscoveryCandidate,
	type DiscoveryState,
	emptyState,
	loadState,
	mergeScrapeResult,
	saveState,
} from './state';

export interface RunDiscoverOptions {
	readonly argv?: readonly string[];
	readonly cacheRoot?: string;
	readonly fetchImpl?: typeof fetch;
	readonly readMeta?: typeof readPythonDiscoveryMeta;
	readonly now?: () => Date;
	readonly env?: Record<string, string | undefined>;
	readonly logger?: (line: string) => void;
}

export interface RunDiscoverSummary {
	readonly handbooksScanned: number;
	readonly handbooksFailed: number;
	readonly newCandidates: number;
	readonly totalCandidates: number;
	readonly skippedByFreshness: boolean;
}

export async function runDiscoverErrata(opts: RunDiscoverOptions = {}): Promise<number> {
	const argv = opts.argv ?? process.argv.slice(2);
	const log = opts.logger ?? ((line) => console.log(line));
	const env = opts.env ?? process.env;
	const now = (opts.now ?? (() => new Date()))();

	let args: DiscoverArgs;
	try {
		args = parseDiscoverArgs(argv);
	} catch (error) {
		if (error instanceof ArgParseError) {
			console.error(error.message);
			console.error('');
			console.error(DISCOVER_HELP_TEXT);
			return 2;
		}
		throw error;
	}
	if (args.help) {
		log(DISCOVER_HELP_TEXT);
		return 0;
	}

	const cacheRoot = opts.cacheRoot ?? args.cacheRoot ?? resolveCacheRoot();

	if (!args.force && !isStale(cacheRoot, { now: now.getTime() })) {
		log(
			`discover-errata: skipped (last run within freshness window). Pass --force to override. ` +
				`Sentinel: ${lastRunPath(cacheRoot)}`,
		);
		return 0;
	}

	const slugs = args.slugs.length > 0 ? args.slugs : ALL_HANDBOOK_SLUGS;
	const catalogueBySlug = new Map(HANDBOOK_CATALOGUE.map((e) => [e.slug, e] as const));

	let metaBySlug: Map<string, HandbookDiscoveryMeta>;
	try {
		const readMeta = opts.readMeta ?? readPythonDiscoveryMeta;
		// Always pass slugs explicitly so the Python side does not iterate
		// every YAML on disk (some agents keep stale fixtures in tests).
		const metaList = await readMeta({ slugs });
		metaBySlug = new Map(metaList.map((m) => [m.slug, m] as const));
	} catch (error) {
		console.error(`discover-errata: failed to read Python metadata: ${describeError(error)}`);
		return 1;
	}

	const sections: { entry: HandbookCatalogueEntry; state: DiscoveryState }[] = [];
	const issueRequests: { entry: HandbookCatalogueEntry; candidate: DiscoveryCandidate }[] = [];
	let handbooksScanned = 0;
	let handbooksFailed = 0;
	let newCandidatesCount = 0;
	let totalCandidates = 0;

	log(`discover-errata: scanning ${slugs.length} handbook(s).`);

	for (const slug of slugs) {
		const entry = catalogueBySlug.get(slug);
		if (entry === undefined) {
			console.error(`  - ${slug}: not in catalogue; skipping.`);
			handbooksFailed += 1;
			continue;
		}
		const priorState =
			loadState(cacheRoot, slug) ??
			emptyState({
				slug: entry.slug,
				title: entry.title,
				parentPageUrl: entry.parentPageUrl,
				tier: entry.tier,
			});
		const priorUrls = new Set(priorState.candidates.map((c) => c.url));

		try {
			const result = await scrapeHandbookPage(entry, { fetchImpl: opts.fetchImpl });
			handbooksScanned += 1;
			const meta = metaBySlug.get(slug);
			const dismissedUrls = new Set<string>();
			const appliedUrlsToId = new Map<string, string>();
			if (meta !== undefined) {
				for (const d of meta.dismissed) {
					if (d.url !== null) dismissedUrls.add(d.url);
				}
				for (const a of meta.applied) {
					appliedUrlsToId.set(a.url, a.errataId);
				}
			}
			const merged = mergeScrapeResult(priorState, result.findings, {
				now: now.toISOString(),
				tier: entry.tier,
				dismissedUrls,
				appliedUrlsToId,
			});
			saveState(cacheRoot, merged);
			sections.push({ entry, state: merged });
			totalCandidates += merged.candidates.filter(
				(c) => c.status === DISCOVERY_STATUSES.CANDIDATE || c.status === DISCOVERY_STATUSES.UNMATCHED,
			).length;

			for (const candidate of merged.candidates) {
				if (
					(candidate.status === DISCOVERY_STATUSES.CANDIDATE || candidate.status === DISCOVERY_STATUSES.UNMATCHED) &&
					!priorUrls.has(candidate.url)
				) {
					issueRequests.push({ entry, candidate });
					newCandidatesCount += 1;
				}
			}

			log(
				`  - ${slug}: ${result.findings.length} link(s) on page; ` +
					`${merged.candidates.length} tracked; ` +
					`${newCandidatesCount > 0 ? `+${newCandidatesCount} new` : 'no new candidates'}`,
			);
		} catch (error) {
			handbooksFailed += 1;
			if (error instanceof HandbookScrapeError) {
				console.error(`  - ${slug}: scrape failed: ${error.message}`);
			} else {
				console.error(`  - ${slug}: scrape failed: ${describeError(error)}`);
			}
			// Persist prior state so cleared `last_seen_at` does not flip a healthy
			// candidate to `withdrawn` because of a transient network error.
			sections.push({ entry, state: priorState });
		}
	}

	writePendingReport(cacheRoot, sections);
	if (handbooksScanned === 0) {
		log('discover-errata: no handbooks scanned successfully; skipping freshness update.');
		return 1;
	}

	writeLastRun(cacheRoot, {
		ranAt: now.toISOString(),
		handbooksScanned,
		candidatesFound: newCandidatesCount,
	});

	if (issueRequests.length > 0) {
		const token = env[DISCOVERY_GITHUB_TOKEN_ENV];
		if (typeof token === 'string' && token.length > 0) {
			try {
				const result = await openIssuesForCandidates(issueRequests, {
					dryRun: args.dryRun,
					logger: log,
				});
				log(
					`discover-errata: issues -- ${result.created} created${result.dryRun ? ' (dry-run)' : ''}, ` +
						`${result.skipped} skipped (already open).`,
				);
			} catch (error) {
				console.error(`discover-errata: gh issue creation failed: ${describeError(error)}`);
			}
		} else {
			log(
				`discover-errata: ${DISCOVERY_GITHUB_TOKEN_ENV} not set; ${issueRequests.length} candidate(s) ` +
					`logged to _pending.md without GitHub issue.`,
			);
		}
	} else {
		log('discover-errata: no new candidates this run.');
	}

	const summary: RunDiscoverSummary = {
		handbooksScanned,
		handbooksFailed,
		newCandidates: newCandidatesCount,
		totalCandidates,
		skippedByFreshness: false,
	};
	log(
		`discover-errata: summary -- scanned ${summary.handbooksScanned}, failed ${summary.handbooksFailed}, ` +
			`new ${summary.newCandidates}, pending ${summary.totalCandidates}.`,
	);

	if (summary.handbooksFailed === slugs.length) return 1;
	return summary.newCandidates > 0 ? 2 : 0;
}

export { getCatalogueEntry };
