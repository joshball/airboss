/**
 * Aggregated `_pending.md` report writer.
 *
 * One section per handbook with at least one unreviewed candidate (status
 * `candidate` or `unmatched`). Each candidate row emits the metadata the
 * human reviewer needs to triage in one pass:
 *
 *   - Handbook slug + edition
 *   - Source URL (the FAA PDF)
 *   - Detected layout hint (best-effort filename heuristic)
 *   - Tier flag: `actionable` vs `signal-only`
 *   - DRS search URL (manual sanity check against the authoritative portal)
 *   - Detection timestamp (`first_seen_at`)
 *
 * Same metadata appears in the auto-opened GitHub issue body so a reviewer
 * who lives in either surface gets the same information.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DISCOVERY_CACHE, DISCOVERY_STATUSES, DRS_SEARCH_URL_TEMPLATE } from '@ab/constants';
import type { HandbookCatalogueEntry } from './catalogue';
import type { DiscoveryCandidate, DiscoveryState } from './state';

export interface PendingHandbookSection {
	readonly entry: HandbookCatalogueEntry;
	readonly state: DiscoveryState;
}

export function pendingReportPath(cacheRoot: string): string {
	return join(cacheRoot, DISCOVERY_CACHE.PENDING_REPORT_FILE);
}

export function writePendingReport(cacheRoot: string, sections: readonly PendingHandbookSection[]): void {
	const path = pendingReportPath(cacheRoot);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, renderPendingReport(sections), 'utf8');
}

export function renderPendingReport(sections: readonly PendingHandbookSection[]): string {
	const lines: string[] = [];
	lines.push('# Errata discovery: pending review');
	lines.push('');
	lines.push('Each candidate below was discovered on a FAA handbook parent page since the');
	lines.push('last triage. To dismiss a false positive, add an entry under `dismissed_errata:`');
	lines.push('in the relevant `tools/handbook-ingest/ingest/config/<slug>.yaml`. To apply an');
	lines.push('addendum, add it under `errata:` in the same YAML and run');
	lines.push('`bun run sources extract handbooks <slug> --apply-errata <id>`.');
	lines.push('');
	lines.push(`Generated at ${new Date().toISOString()}.`);
	lines.push('');

	const reviewable = sections.filter((s) => unreviewedFrom(s.state.candidates).length > 0);
	if (reviewable.length === 0) {
		lines.push('No unreviewed candidates. Discovery is up to date.');
		lines.push('');
		return lines.join('\n');
	}

	for (const section of reviewable) {
		const unreviewed = unreviewedFrom(section.state.candidates);
		lines.push(`## ${section.entry.title} (\`${section.entry.slug}\`)`);
		lines.push('');
		lines.push(`- Edition: \`${section.entry.currentEdition}\``);
		lines.push(`- Tier: \`${section.entry.tier}\``);
		lines.push(`- Parent page: <${section.entry.parentPageUrl}>`);
		lines.push('');
		for (const candidate of unreviewed) {
			lines.push(`### ${candidate.layoutHint} candidate`);
			lines.push('');
			lines.push(`- URL: <${candidate.url}>`);
			lines.push(`- Status: \`${candidate.status}\``);
			lines.push(`- First seen: ${candidate.firstSeenAt}`);
			lines.push(`- Last seen: ${candidate.lastSeenAt}`);
			lines.push(`- DRS search: <${drsSearchUrl(candidate.url)}>`);
			lines.push('');
		}
	}
	return lines.join('\n');
}

export function unreviewedFrom(candidates: readonly DiscoveryCandidate[]): readonly DiscoveryCandidate[] {
	return candidates.filter(
		(c) => c.status === DISCOVERY_STATUSES.CANDIDATE || c.status === DISCOVERY_STATUSES.UNMATCHED,
	);
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
