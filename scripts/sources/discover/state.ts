/**
 * Per-handbook discovery state file.
 *
 * Layout: `<cache>/discovery/handbooks/<slug>.json`. One file per catalogued
 * handbook. Records the last scrape time, every URL ever observed on the
 * parent page, and per-URL status (`candidate`, `applied`, `dismissed`,
 * `withdrawn`, `unmatched`). Idempotent across re-runs: the merge step in
 * `mergeScrapeResult` preserves prior status values for known URLs, only
 * adding new candidates for unseen URLs.
 *
 * Storage shape and rationale: research dossier section C. Cache-side, not
 * DB, not committed. The file evolves weekly.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	DISCOVERY_CACHE,
	DISCOVERY_LAYOUT_HINT_VALUES,
	DISCOVERY_LAYOUT_HINTS,
	DISCOVERY_STATUS_VALUES,
	DISCOVERY_STATUSES,
	DISCOVERY_TIER_VALUES,
	type DiscoveryLayoutHint,
	type DiscoveryStatus,
	type DiscoveryTier,
} from '@ab/constants';

export interface DiscoveryCandidate {
	readonly url: string;
	readonly firstSeenAt: string;
	readonly lastSeenAt: string;
	readonly tier: DiscoveryTier;
	readonly layoutHint: DiscoveryLayoutHint;
	readonly status: DiscoveryStatus;
	/** Filled when status transitions to `dismissed` (audit trail). */
	readonly dismissedAt?: string;
	/** Filled when status transitions to `withdrawn` (URL stopped resolving). */
	readonly withdrawnAt?: string;
	/** Filled when status transitions to `applied` (mirrors YAML errata id). */
	readonly errataId?: string;
}

export interface DiscoveryState {
	readonly slug: string;
	readonly title: string;
	readonly parentPageUrl: string;
	readonly tier: DiscoveryTier;
	readonly lastScannedAt: string | null;
	readonly candidates: readonly DiscoveryCandidate[];
}

export class DiscoveryStateError extends Error {}

/**
 * Build the path for a handbook's state file. Creates the parent directory
 * lazily; callers that just want the path (e.g. tests) get a no-side-effect
 * read by passing `ensureDir = false`.
 */
export function stateFilePath(cacheRoot: string, slug: string, ensureDir = false): string {
	const dir = join(cacheRoot, DISCOVERY_CACHE.HANDBOOKS_DIR);
	if (ensureDir) mkdirSync(dir, { recursive: true });
	return join(dir, `${slug}.json`);
}

export function loadState(cacheRoot: string, slug: string): DiscoveryState | null {
	const path = stateFilePath(cacheRoot, slug);
	if (!existsSync(path)) return null;
	let raw: string;
	try {
		raw = readFileSync(path, 'utf8');
	} catch (error) {
		throw new DiscoveryStateError(`failed to read ${path}: ${describe(error)}`);
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		return validateState(parsed, path);
	} catch (error) {
		throw new DiscoveryStateError(`failed to parse ${path}: ${describe(error)}`);
	}
}

export function saveState(cacheRoot: string, state: DiscoveryState): void {
	const path = stateFilePath(cacheRoot, state.slug, true);
	mkdirSync(dirname(path), { recursive: true });
	const ordered: Record<string, unknown> = {
		slug: state.slug,
		title: state.title,
		parent_page_url: state.parentPageUrl,
		tier: state.tier,
		last_scanned_at: state.lastScannedAt,
		candidates: state.candidates.map(serializeCandidate),
	};
	writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
}

function serializeCandidate(c: DiscoveryCandidate): Record<string, unknown> {
	const out: Record<string, unknown> = {
		url: c.url,
		first_seen_at: c.firstSeenAt,
		last_seen_at: c.lastSeenAt,
		tier: c.tier,
		layout_hint: c.layoutHint,
		status: c.status,
	};
	if (c.dismissedAt !== undefined) out.dismissed_at = c.dismissedAt;
	if (c.withdrawnAt !== undefined) out.withdrawn_at = c.withdrawnAt;
	if (c.errataId !== undefined) out.errata_id = c.errataId;
	return out;
}

interface RawCandidate {
	url?: unknown;
	first_seen_at?: unknown;
	last_seen_at?: unknown;
	tier?: unknown;
	layout_hint?: unknown;
	status?: unknown;
	dismissed_at?: unknown;
	withdrawn_at?: unknown;
	errata_id?: unknown;
}

interface RawState {
	slug?: unknown;
	title?: unknown;
	parent_page_url?: unknown;
	tier?: unknown;
	last_scanned_at?: unknown;
	candidates?: unknown;
}

function validateState(value: unknown, path: string): DiscoveryState {
	if (typeof value !== 'object' || value === null) {
		throw new DiscoveryStateError(`${path}: top-level must be an object`);
	}
	const raw = value as RawState;
	const slug = ensureString(raw.slug, `${path}.slug`);
	const title = ensureString(raw.title, `${path}.title`);
	const parentPageUrl = ensureString(raw.parent_page_url, `${path}.parent_page_url`);
	const tier = ensureTier(raw.tier, `${path}.tier`);
	const lastScannedAt =
		raw.last_scanned_at === null ? null : ensureString(raw.last_scanned_at, `${path}.last_scanned_at`);
	const rawCandidates = Array.isArray(raw.candidates) ? raw.candidates : [];
	const candidates: DiscoveryCandidate[] = rawCandidates.map((c, idx) =>
		validateCandidate(c, `${path}.candidates[${idx}]`),
	);
	return { slug, title, parentPageUrl, tier, lastScannedAt, candidates };
}

function validateCandidate(value: unknown, path: string): DiscoveryCandidate {
	if (typeof value !== 'object' || value === null) {
		throw new DiscoveryStateError(`${path}: must be an object`);
	}
	const raw = value as RawCandidate;
	const candidate: DiscoveryCandidate = {
		url: ensureString(raw.url, `${path}.url`),
		firstSeenAt: ensureString(raw.first_seen_at, `${path}.first_seen_at`),
		lastSeenAt: ensureString(raw.last_seen_at, `${path}.last_seen_at`),
		tier: ensureTier(raw.tier, `${path}.tier`),
		layoutHint: ensureLayout(raw.layout_hint, `${path}.layout_hint`),
		status: ensureStatus(raw.status, `${path}.status`),
		dismissedAt: optionalString(raw.dismissed_at, `${path}.dismissed_at`),
		withdrawnAt: optionalString(raw.withdrawn_at, `${path}.withdrawn_at`),
		errataId: optionalString(raw.errata_id, `${path}.errata_id`),
	};
	return candidate;
}

function ensureString(value: unknown, path: string): string {
	if (typeof value !== 'string') {
		throw new DiscoveryStateError(`${path}: must be a string`);
	}
	return value;
}

function optionalString(value: unknown, path: string): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') {
		throw new DiscoveryStateError(`${path}: must be a string when present`);
	}
	return value;
}

function ensureTier(value: unknown, path: string): DiscoveryTier {
	if (typeof value !== 'string' || !DISCOVERY_TIER_VALUES.includes(value as DiscoveryTier)) {
		throw new DiscoveryStateError(`${path}: must be one of ${DISCOVERY_TIER_VALUES.join(', ')}`);
	}
	return value as DiscoveryTier;
}

function ensureLayout(value: unknown, path: string): DiscoveryLayoutHint {
	if (typeof value !== 'string' || !DISCOVERY_LAYOUT_HINT_VALUES.includes(value as DiscoveryLayoutHint)) {
		throw new DiscoveryStateError(`${path}: must be one of ${DISCOVERY_LAYOUT_HINT_VALUES.join(', ')}`);
	}
	return value as DiscoveryLayoutHint;
}

function ensureStatus(value: unknown, path: string): DiscoveryStatus {
	if (typeof value !== 'string' || !DISCOVERY_STATUS_VALUES.includes(value as DiscoveryStatus)) {
		throw new DiscoveryStateError(`${path}: must be one of ${DISCOVERY_STATUS_VALUES.join(', ')}`);
	}
	return value as DiscoveryStatus;
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Construct an empty state record from a catalogue entry. Used when no state
 * file exists yet (first scan).
 */
export function emptyState(opts: {
	readonly slug: string;
	readonly title: string;
	readonly parentPageUrl: string;
	readonly tier: DiscoveryTier;
}): DiscoveryState {
	return {
		slug: opts.slug,
		title: opts.title,
		parentPageUrl: opts.parentPageUrl,
		tier: opts.tier,
		lastScannedAt: null,
		candidates: [],
	};
}

export interface ScrapeFinding {
	readonly url: string;
	readonly layoutHint: DiscoveryLayoutHint;
}

export interface MergeOptions {
	readonly now: string;
	readonly tier: DiscoveryTier;
	/**
	 * URLs that the YAML config dismisses. Any candidate whose URL matches an
	 * entry here is force-set to `dismissed` (idempotent across re-runs).
	 */
	readonly dismissedUrls: ReadonlySet<string>;
	/**
	 * Errata ids already applied via `--apply-errata`. The matching URL on
	 * the YAML side is what actually appears on the parent page; the merge
	 * step looks up the YAML entry by id and marks the corresponding state
	 * candidate as `applied`.
	 */
	readonly appliedUrlsToId: ReadonlyMap<string, string>;
}

/**
 * Merge a scrape result against the current state.
 *
 * Rules:
 *   1. URL not previously seen + matched a pattern -> add as `candidate`.
 *   2. URL not previously seen + did not match a pattern -> add as `unmatched`.
 *   3. URL previously seen + still on the page -> bump `lastSeenAt`; preserve
 *      status unless it transitioned (e.g., user just dismissed in YAML).
 *   4. URL in state but missing from this scrape -> mark `withdrawn`.
 *   5. Dismissed URLs in YAML -> force-set status to `dismissed`.
 *   6. Applied URLs -> force-set status to `applied`.
 *
 * The merge is intentionally pure (no I/O); call sites compose it with
 * loadState + saveState.
 */
export function mergeScrapeResult(
	prior: DiscoveryState,
	findings: readonly ScrapeFinding[],
	options: MergeOptions,
): DiscoveryState {
	const findingsByUrl = new Map<string, ScrapeFinding>();
	for (const f of findings) findingsByUrl.set(f.url, f);

	const next: DiscoveryCandidate[] = [];
	const seen = new Set<string>();

	for (const c of prior.candidates) {
		seen.add(c.url);
		const finding = findingsByUrl.get(c.url);
		const baseStatus = c.status;
		// Dismissal beats everything: a dismissed URL stays dismissed across re-runs.
		const dismissed = options.dismissedUrls.has(c.url);
		const appliedId = options.appliedUrlsToId.get(c.url);

		if (finding === undefined) {
			// URL no longer on the parent page.
			next.push({
				...c,
				status: dismissed
					? DISCOVERY_STATUSES.DISMISSED
					: appliedId !== undefined
						? DISCOVERY_STATUSES.APPLIED
						: DISCOVERY_STATUSES.WITHDRAWN,
				withdrawnAt: baseStatus === DISCOVERY_STATUSES.WITHDRAWN ? c.withdrawnAt : options.now,
				errataId: appliedId ?? c.errataId,
				dismissedAt: dismissed ? (c.dismissedAt ?? options.now) : c.dismissedAt,
			});
			continue;
		}
		// URL is still present.
		const status: DiscoveryStatus = dismissed
			? DISCOVERY_STATUSES.DISMISSED
			: appliedId !== undefined
				? DISCOVERY_STATUSES.APPLIED
				: baseStatus === DISCOVERY_STATUSES.WITHDRAWN
					? DISCOVERY_STATUSES.CANDIDATE
					: baseStatus;
		next.push({
			...c,
			lastSeenAt: options.now,
			layoutHint: finding.layoutHint,
			status,
			dismissedAt: dismissed ? (c.dismissedAt ?? options.now) : c.dismissedAt,
			errataId: appliedId ?? c.errataId,
			withdrawnAt: status === DISCOVERY_STATUSES.WITHDRAWN ? c.withdrawnAt : undefined,
		});
	}

	for (const f of findings) {
		if (seen.has(f.url)) continue;
		const dismissed = options.dismissedUrls.has(f.url);
		const appliedId = options.appliedUrlsToId.get(f.url);
		const isUnmatched = f.layoutHint === DISCOVERY_LAYOUT_HINTS.UNKNOWN;
		const status: DiscoveryStatus = dismissed
			? DISCOVERY_STATUSES.DISMISSED
			: appliedId !== undefined
				? DISCOVERY_STATUSES.APPLIED
				: isUnmatched
					? DISCOVERY_STATUSES.UNMATCHED
					: DISCOVERY_STATUSES.CANDIDATE;
		next.push({
			url: f.url,
			firstSeenAt: options.now,
			lastSeenAt: options.now,
			tier: options.tier,
			layoutHint: f.layoutHint,
			status,
			dismissedAt: dismissed ? options.now : undefined,
			errataId: appliedId,
		});
	}

	return {
		...prior,
		lastScannedAt: options.now,
		candidates: next,
	};
}
