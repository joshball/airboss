/**
 * Phase 10 next slice -- NTSB report manifest-based registry seeding.
 *
 * Source of truth: ADR 019 §1.2 (`ntsb` shape) + §2.6 (registry
 * population pattern). Companion to PR #309's first slice (locator,
 * URL formula, citation formatter, resolver), which deferred ingestion
 * until content actually cited an `airboss-ref:ntsb/...` URL.
 *
 * NTSB reports are immutable post-publication: each entry has exactly
 * one edition representing the report's release date. The locator
 * does not use `?at=...` pinning; the validator's row-3 pin check is
 * a no-op because authors never write a pin for ntsb references.
 *
 * Demand-driven status: the airboss content corpus does not yet cite
 * any NTSB reports directly. The manifest ships empty so the loader
 * wiring is exercised end-to-end without inventing fictional reports.
 * Populate as content authors begin citing NTSB IDs.
 *
 * Idempotent: re-running with the same manifest re-applies the patch
 * but adds no new entries.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId, SourceLifecycle } from '../types.ts';
import { parseNtsbLocator } from './locator.ts';

export const NTSB_SEED_REVIEWER_ID = 'phase-10-ntsb-manifest-seed';

const CORPUS = 'ntsb';
const SOURCE_ID_PREFIX = 'airboss-ref:ntsb/';

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
	readonly ntsb: readonly ManifestEntryRow[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NtsbSeedReport {
	readonly entriesRegistered: number;
	readonly entriesAlreadyAccepted: number;
	readonly editionsRegistered: number;
	readonly manifestPath: string;
	readonly promotionBatchId: string | null;
	readonly skipReasons: readonly string[];
}

export interface NtsbSeedOptions {
	readonly manifestPath?: string;
}

/**
 * Read the NTSB manifest, validate every entry against the locator shape,
 * and patch the registry. Returns a report describing what landed.
 *
 * Empty-manifest case is supported: returns a zero-entry report without
 * recording a promotion batch.
 */
export async function seedNtsbFromManifest(opts: NtsbSeedOptions = {}): Promise<NtsbSeedReport> {
	const manifestPath = opts.manifestPath ?? defaultManifestPath();
	if (!existsSync(manifestPath)) {
		throw new Error(`ntsb seed: manifest not found at ${manifestPath}`);
	}

	const raw = readFileSync(manifestPath, 'utf-8');
	const parsed = parseYaml(raw) as Partial<ManifestFile> | null;
	if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.ntsb)) {
		throw new Error(`ntsb seed: manifest at ${manifestPath} must have a top-level "ntsb:" list (may be empty)`);
	}

	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	const skipReasons: string[] = [];
	const entriesToPromote: SourceId[] = [];
	let entriesRegistered = 0;
	let entriesAlreadyAccepted = 0;
	let editionsRegistered = 0;

	for (const row of parsed.ntsb) {
		const validation = validateRow(row);
		if (!validation.ok) {
			skipReasons.push(`ntsb manifest entry "${row.id ?? '<missing id>'}": ${validation.error}`);
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
			reviewerId: NTSB_SEED_REVIEWER_ID,
			scope: entriesToPromote,
			inputSource: manifestPath,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			throw new Error(`ntsb seed batch promotion failed: ${result.error}`);
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
	return join(dirname(fileURLToPath(import.meta.url)), 'manifest.yaml');
}

function validateRow(row: Partial<ManifestEntryRow> | undefined): { ok: true } | { ok: false; error: string } {
	if (row === undefined || row === null || typeof row !== 'object') {
		return { ok: false, error: 'entry is not an object' };
	}
	if (typeof row.id !== 'string' || row.id.length === 0) {
		return { ok: false, error: 'missing string "id"' };
	}

	const parsed = parseNtsbLocator(row.id);
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
	const latestEdition = [...row.editions].sort((a, b) => b.id.localeCompare(a.id))[0];
	const latestEditionId = latestEdition?.id ?? new Date().toISOString().slice(0, 10);
	const lastAmended = parseEditionDate(latestEditionId);
	return {
		id,
		corpus: CORPUS,
		canonical_short: row.canonical_short,
		canonical_formal: row.canonical_formal,
		canonical_title: row.canonical_title,
		last_amended_date: lastAmended,
		lifecycle: 'pending',
	};
}

function buildEdition(row: ManifestEditionRow, fallback: Date): Edition {
	const date = parseEditionDate(row.id, fallback);
	return {
		id: row.id,
		published_date: date,
		source_url: row.source_url ?? '',
	};
}

function parseEditionDate(editionId: string, fallback?: Date): Date {
	// NTSB publication dates are typically `YYYY-MM-DD`; accept that plus the
	// looser forms the orders manifest uses for symmetry.
	const yyyymmdd = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(editionId);
	if (yyyymmdd !== null) {
		return new Date(`${editionId}T00:00:00.000Z`);
	}
	const yyyymm = /^([0-9]{4})-([0-9]{2})$/.exec(editionId);
	if (yyyymm !== null) {
		return new Date(`${editionId}-01T00:00:00.000Z`);
	}
	const yyyy = /^([0-9]{4})$/.exec(editionId);
	if (yyyy !== null) {
		return new Date(`${yyyy[1]}-01-01T00:00:00.000Z`);
	}
	const parsed = new Date(editionId);
	if (!Number.isNaN(parsed.getTime())) return parsed;
	return fallback ?? new Date();
}
