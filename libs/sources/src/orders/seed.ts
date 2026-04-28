/**
 * Phase 10 next slice -- FAA Orders manifest-based registry seeding.
 *
 * Source of truth: ADR 019 §1.2 (`orders` shape) + §2.6 (registry
 * population pattern). Companion to PR #309's first slice (locator,
 * URL formula, citation formatter, resolver), which deferred ingestion
 * until content actually cited an `airboss-ref:orders/...` URL.
 *
 * Unlike the AC / handbooks pipelines, orders are NOT extracted from
 * cached PDFs at seed time -- the FAA's order portal hides direct PDF
 * URLs behind a CMS document ID we don't have at seed time, and most
 * orders are too large to extract usefully without per-order hand-tuning.
 * Instead, we maintain a hand-curated YAML manifest of orders the airboss
 * corpus actually cites; this loader transforms it into the same
 * `SourceEntry` + `Edition` shape the deferred ingestion pipeline would
 * eventually produce.
 *
 * Idempotent: re-running with the same manifest re-applies the patch
 * (overwrite) but adds no new entries. Promotion to `accepted` runs once
 * per process; subsequent runs see the lifecycle overlay and skip the
 * promotion batch.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId, SourceLifecycle } from '../types.ts';
import { parseOrdersLocator } from './locator.ts';

export const ORDERS_SEED_REVIEWER_ID = 'phase-10-orders-manifest-seed';

const CORPUS = 'orders';
const SOURCE_ID_PREFIX = 'airboss-ref:orders/';

// ---------------------------------------------------------------------------
// Manifest schema
// ---------------------------------------------------------------------------

interface ManifestEditionRow {
	readonly id: string;
	readonly lifecycle: SourceLifecycle;
	readonly source_url?: string;
}

interface ManifestEntryRow {
	readonly id: string;
	readonly canonical_short: string;
	readonly canonical_formal: string;
	readonly canonical_title: string;
	readonly editions: readonly ManifestEditionRow[];
}

interface ManifestFile {
	readonly orders: readonly ManifestEntryRow[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface OrdersSeedReport {
	readonly entriesRegistered: number;
	readonly entriesAlreadyAccepted: number;
	readonly editionsRegistered: number;
	readonly manifestPath: string;
	readonly promotionBatchId: string | null;
	readonly skipReasons: readonly string[];
}

export interface OrdersSeedOptions {
	/** Override the manifest path. Defaults to `<libDir>/manifest.yaml`. */
	readonly manifestPath?: string;
}

/**
 * Read the orders manifest, validate every entry against the locator shape,
 * and patch the registry. Returns a report describing what landed.
 *
 * Throws when the manifest is unreadable or its top-level shape is wrong;
 * per-entry validation errors land on `report.skipReasons` rather than
 * aborting the whole batch -- one bad order shouldn't tank the seed.
 */
export async function seedOrdersFromManifest(opts: OrdersSeedOptions = {}): Promise<OrdersSeedReport> {
	const manifestPath = opts.manifestPath ?? defaultManifestPath();
	if (!existsSync(manifestPath)) {
		throw new Error(`orders seed: manifest not found at ${manifestPath}`);
	}

	const raw = readFileSync(manifestPath, 'utf-8');
	const parsed = parseYaml(raw) as Partial<ManifestFile> | null;
	if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.orders)) {
		throw new Error(`orders seed: manifest at ${manifestPath} must have a top-level "orders:" list`);
	}

	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	const skipReasons: string[] = [];
	const entriesToPromote: SourceId[] = [];
	let entriesRegistered = 0;
	let entriesAlreadyAccepted = 0;
	let editionsRegistered = 0;

	for (const row of parsed.orders) {
		const validation = validateRow(row);
		if (!validation.ok) {
			skipReasons.push(`orders manifest entry "${row.id ?? '<missing id>'}": ${validation.error}`);
			continue;
		}

		const entry = buildSourceEntry(row);
		const overlay = getEntryLifecycle(entry.id);
		const existing = sourcesPatch[entry.id];

		if (existing !== undefined && overlay === 'accepted') {
			entriesAlreadyAccepted += 1;
		} else {
			sourcesPatch[entry.id] = entry;
			entriesRegistered += 1;
			if (overlay !== 'accepted') {
				entriesToPromote.push(entry.id);
			}
		}

		// Editions: append any not yet present. Pre-existing editions are left
		// alone so re-running doesn't reorder the chronological list.
		const existingEditions = editionsPatch.get(entry.id) ?? [];
		const merged: Edition[] = [...existingEditions];
		for (const edRow of row.editions) {
			if (merged.some((e) => e.id === edRow.id)) continue;
			merged.push(buildEdition(edRow, entry.last_amended_date));
			editionsRegistered += 1;
		}
		if (merged.length !== existingEditions.length) {
			editionsPatch.set(entry.id, merged);
		}
	}

	__sources_internal__.setActiveTable(sourcesPatch as Record<SourceId, SourceEntry>);
	__editions_internal__.setActiveTable(editionsPatch);

	let promotionBatchId: string | null = null;
	if (entriesToPromote.length > 0) {
		const result = recordPromotion({
			corpus: CORPUS,
			reviewerId: ORDERS_SEED_REVIEWER_ID,
			scope: entriesToPromote,
			inputSource: manifestPath,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			throw new Error(`orders seed batch promotion failed: ${result.error}`);
		}
		promotionBatchId = result.batch.id;
	}

	return {
		entriesRegistered,
		entriesAlreadyAccepted,
		editionsRegistered,
		manifestPath,
		promotionBatchId,
		skipReasons,
	};
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function defaultManifestPath(): string {
	// fileURLToPath + dirname resolves the orders/ directory at runtime; the
	// manifest lives alongside this module. Avoid bun-specific `import.meta.dir`
	// so the script also runs under tsc/node-style typecheck.
	return join(dirname(fileURLToPath(import.meta.url)), 'manifest.yaml');
}

function validateRow(row: Partial<ManifestEntryRow> | undefined): { ok: true } | { ok: false; error: string } {
	if (row === undefined || row === null || typeof row !== 'object') {
		return { ok: false, error: 'entry is not an object' };
	}
	if (typeof row.id !== 'string' || row.id.length === 0) {
		return { ok: false, error: 'missing string "id"' };
	}

	const parsed = parseOrdersLocator(row.id);
	if (parsed.kind === 'error') {
		return { ok: false, error: `id failed locator parse -- ${parsed.message}` };
	}

	if (typeof row.canonical_short !== 'string' || row.canonical_short.length === 0) {
		return { ok: false, error: 'missing string "canonical_short"' };
	}
	if (typeof row.canonical_formal !== 'string' || row.canonical_formal.length === 0) {
		return { ok: false, error: 'missing string "canonical_formal"' };
	}
	if (typeof row.canonical_title !== 'string' || row.canonical_title.length === 0) {
		return { ok: false, error: 'missing string "canonical_title"' };
	}
	if (!Array.isArray(row.editions) || row.editions.length === 0) {
		return { ok: false, error: 'missing non-empty "editions" list' };
	}
	for (const ed of row.editions) {
		if (typeof ed !== 'object' || ed === null) {
			return { ok: false, error: 'edition entry is not an object' };
		}
		if (typeof ed.id !== 'string' || ed.id.length === 0) {
			return { ok: false, error: 'edition entry missing "id"' };
		}
		if (ed.lifecycle !== 'accepted' && ed.lifecycle !== 'pending') {
			return {
				ok: false,
				error: `edition "${ed.id}" lifecycle must be "accepted" or "pending"; got "${String(ed.lifecycle)}"`,
			};
		}
	}
	return { ok: true };
}

function buildSourceEntry(row: ManifestEntryRow): SourceEntry {
	const id = `${SOURCE_ID_PREFIX}${row.id}` as SourceId;
	// Use the most-recent edition as `last_amended_date`. Edition ids are
	// `YYYY-MM` or `YYYY`; lexical max == publication max under that format.
	const latestEdition = [...row.editions].sort((a, b) => b.id.localeCompare(a.id))[0];
	const latestEditionId = latestEdition?.id ?? new Date().toISOString().slice(0, 7);
	const lastAmended = parseEditionDate(latestEditionId);
	return {
		id,
		corpus: CORPUS,
		canonical_short: row.canonical_short,
		canonical_formal: row.canonical_formal,
		canonical_title: row.canonical_title,
		last_amended_date: lastAmended,
		// `pending` so the promotion batch flips it to `accepted`. Manifests
		// that ship `lifecycle: pending` per-edition stay flagged for review
		// authoring even after the batch promotion (no row-4 ERROR -- entry
		// resolves to whichever lifecycle the latest batch set).
		lifecycle: 'pending',
	};
}

function buildEdition(row: ManifestEditionRow, fallback: Date): Edition {
	const date = parseEditionDate(row.id, fallback);
	return {
		id: row.id,
		published_date: date,
		// Source URL is optional in the manifest; the resolver's URL formula
		// falls back to the FAA orders search page when this is empty.
		source_url: row.source_url ?? '',
	};
}

function parseEditionDate(editionId: string, fallback?: Date): Date {
	// editionId is `YYYY-MM` or `YYYY`. Treat YYYY as January-1.
	const yyyyOnly = /^([0-9]{4})$/.exec(editionId);
	if (yyyyOnly !== null) {
		return new Date(`${yyyyOnly[1]}-01-01T00:00:00.000Z`);
	}
	const yyyymm = /^([0-9]{4})-([0-9]{2})$/.exec(editionId);
	if (yyyymm !== null) {
		return new Date(`${yyyymm[1]}-${yyyymm[2]}-01T00:00:00.000Z`);
	}
	const parsed = new Date(editionId);
	if (!Number.isNaN(parsed.getTime())) return parsed;
	return fallback ?? new Date();
}
