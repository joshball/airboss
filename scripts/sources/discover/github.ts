/**
 * Auto-open a GitHub issue per new errata candidate.
 *
 * Idempotency: existing open issues with the candidate URL in the body are
 * detected via `gh issue list --search` and not reopened. The discovery
 * dispatcher only invokes this for candidates whose state transitioned
 * from missing -> `candidate` in the current run, so re-runs against an
 * unchanged FAA page produce zero API calls.
 *
 * This module shells `gh` (GitHub CLI). Pre-condition: `GH_TOKEN` is set.
 * Callers gate on the token before invoking.
 */

import {
	DISCOVERY_GITHUB_LABEL,
	DISCOVERY_GITHUB_TITLE_PREFIX,
	DISCOVERY_TIERS,
	type DiscoveryTier,
	DRS_SEARCH_URL_TEMPLATE,
} from '@ab/constants';
import type { HandbookCatalogueEntry } from './catalogue';
import type { DiscoveryCandidate } from './state';

export interface IssueRequest {
	readonly entry: HandbookCatalogueEntry;
	readonly candidate: DiscoveryCandidate;
}

export interface GhRunner {
	readonly run: (
		args: readonly string[],
	) => Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }>;
}

export interface OpenIssueOptions {
	readonly runner?: GhRunner;
	readonly dryRun?: boolean;
	readonly logger?: (line: string) => void;
}

export interface OpenIssueResult {
	readonly created: number;
	readonly skipped: number;
	readonly dryRun: boolean;
}

const DEFAULT_RUNNER: GhRunner = {
	async run(args: readonly string[]) {
		const proc = Bun.spawn(['gh', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
		const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
		const code = await proc.exited;
		return { code, stdout, stderr };
	},
};

export async function openIssuesForCandidates(
	requests: readonly IssueRequest[],
	options: OpenIssueOptions = {},
): Promise<OpenIssueResult> {
	const runner = options.runner ?? DEFAULT_RUNNER;
	const dryRun = options.dryRun ?? false;
	const log = options.logger ?? ((line) => console.log(line));

	let created = 0;
	let skipped = 0;
	for (const req of requests) {
		const exists = await issueAlreadyOpen(runner, req.candidate.url);
		if (exists) {
			skipped += 1;
			log(`  - issue already open for ${req.candidate.url}; skipping.`);
			continue;
		}
		if (dryRun) {
			log(`  - [dry-run] would open issue for ${req.candidate.url}`);
			created += 1;
			continue;
		}
		await createIssue(runner, req);
		created += 1;
	}
	return { created, skipped, dryRun };
}

async function issueAlreadyOpen(runner: GhRunner, url: string): Promise<boolean> {
	const result = await runner.run([
		'issue',
		'list',
		'--state',
		'open',
		'--label',
		DISCOVERY_GITHUB_LABEL,
		'--search',
		url,
		'--json',
		'number',
	]);
	if (result.code !== 0) {
		// Treat lookup failures as "issue does not exist" so the caller can
		// still attempt creation. The create step will fail loud if the
		// `gh` CLI is broken, surfacing the error to the operator.
		return false;
	}
	try {
		const parsed: unknown = JSON.parse(result.stdout || '[]');
		return Array.isArray(parsed) && parsed.length > 0;
	} catch {
		return false;
	}
}

async function createIssue(runner: GhRunner, req: IssueRequest): Promise<void> {
	const title = `${DISCOVERY_GITHUB_TITLE_PREFIX}: ${req.entry.title} (${req.candidate.layoutHint})`;
	const body = renderIssueBody(req);
	const result = await runner.run([
		'issue',
		'create',
		'--title',
		title,
		'--body',
		body,
		'--label',
		DISCOVERY_GITHUB_LABEL,
	]);
	if (result.code !== 0) {
		throw new Error(`gh issue create failed (${result.code}): ${result.stderr.trim()}`);
	}
}

export function renderIssueBody(req: IssueRequest): string {
	const tier = req.candidate.tier;
	const tierNote = describeTier(tier);
	const drs = drsSearchUrl(req.candidate.url);
	return [
		`A new ${req.candidate.layoutHint} candidate was detected on the FAA parent page for ${req.entry.title}.`,
		'',
		'## Candidate',
		'',
		`- Handbook: \`${req.entry.slug}\` (${req.entry.title})`,
		`- Edition: \`${req.entry.currentEdition}\``,
		`- Tier: \`${tier}\` ${tierNote}`,
		`- Parent page: <${req.entry.parentPageUrl}>`,
		`- Detected URL: <${req.candidate.url}>`,
		`- Layout hint: \`${req.candidate.layoutHint}\``,
		`- First seen: ${req.candidate.firstSeenAt}`,
		`- DRS sanity-check: <${drs}>`,
		'',
		'## Triage',
		'',
		'- To apply: add an `errata:` entry under',
		`  \`tools/handbook-ingest/ingest/config/${req.entry.slug}.yaml\` and run`,
		`  \`bun run sources extract handbooks ${req.entry.slug} --apply-errata <id>\`.`,
		'- To dismiss: add a one-line entry under `dismissed_errata:` in the same YAML.',
		'  The dismissal is honored across re-runs; this issue should be closed manually.',
		'',
		'_Auto-opened by `bun run sources discover-errata`. See',
		'`docs/work-packages/apply-errata-and-afh-mosaic/` for the full design._',
	].join('\n');
}

function describeTier(tier: DiscoveryTier): string {
	if (tier === DISCOVERY_TIERS.ACTIONABLE) {
		return '(handbook is ingested; apply path exists)';
	}
	return '(handbook is not ingested; signal-only until onboarded)';
}

function drsSearchUrl(url: string): string {
	const filename = filenameFromUrl(url);
	const q = encodeURIComponent(filename);
	return DRS_SEARCH_URL_TEMPLATE.replace('{q}', q);
}

function filenameFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname;
		const idx = path.lastIndexOf('/');
		return idx === -1 ? path : path.slice(idx + 1);
	} catch {
		return url;
	}
}
