/**
 * Phase 9 -- runtime registry hydration from on-disk derivatives.
 *
 * Source of truth: ADR 019 §2.5 ("Registry availability and consistency") +
 * §2.6 ("Registry population"). The Phase 2 registry ships an empty
 * `SOURCES` table; Phase 3+ ingestion runs populate it in-process. That works
 * for tests (they call `runIngest` directly) but breaks for production
 * callers like `bun run airboss-ref` (the validator) and the SvelteKit
 * server-load helper, which spawn a fresh process and have nothing to
 * hydrate from.
 *
 * Phase 9 closes the gap. This module reads the on-disk derivative manifests
 * (`regulations/cfr-<title>/<edition>/manifest.json` + `sections.json`) and
 * synthesizes the same `SourceEntry` + `Edition` records the ingestion
 * pipeline would produce, then promotes them to `accepted` under reviewer
 * `phase-9-bootstrap`.
 *
 * Hydration is idempotent: re-running against the same on-disk state is a
 * no-op (already-accepted entries are skipped).
 *
 * Scope (Phase 9):
 *
 *   - `regs` corpus (CFR Title 14 + 49) -- the only corpus this PR's lesson
 *     migration touches.
 *
 * Other corpora (handbooks, AIM, AC, ACS) ship their own ingestion pipelines
 * and on-disk derivatives; extending bootstrap to cover them is a follow-on
 * (one row per corpus, same shape as `hydrateRegsFromDerivatives`).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { __editions_internal__ } from './registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from './registry/lifecycle.ts';
import { __sources_internal__ } from './registry/sources.ts';
import type { Edition, EditionId, SourceEntry, SourceId } from './types.ts';

export const PHASE_9_BOOTSTRAP_REVIEWER_ID = 'phase-9-bootstrap';

interface ManifestRecord {
	readonly schemaVersion: number;
	readonly title: '14' | '49';
	readonly editionSlug: string;
	readonly editionDate: string;
	readonly sourceUrl: string;
}

interface SectionsRecord {
	readonly schemaVersion: number;
	readonly edition: string;
	readonly sectionsByPart: Record<string, readonly SectionRow[]>;
}

interface SectionRow {
	readonly id: string;
	readonly canonical_short: string;
	readonly canonical_title: string;
	readonly last_amended_date: string;
	readonly body_path: string;
	readonly body_sha256: string;
}

export interface BootstrapReport {
	readonly editionsHydrated: number;
	readonly entriesAdded: number;
	readonly entriesAlreadyAccepted: number;
	readonly skipped: readonly { readonly path: string; readonly reason: string }[];
}

export interface BootstrapOptions {
	/** Override the working directory. Defaults to `process.cwd()`. */
	readonly cwd?: string;
	/** Override the regulations root. Defaults to `<cwd>/regulations`. */
	readonly regsRoot?: string;
}

/**
 * Hydrate the runtime registry from on-disk CFR derivatives.
 *
 * Walks `<cwd>/regulations/cfr-<title>/<edition>/` for every Title that has
 * a `manifest.json` + `sections.json`, then:
 *
 *   1. Synthesizes a Part-level `SourceEntry` for each Part referenced in
 *      `sectionsByPart` (the on-disk derivatives don't store the Part's
 *      authoritative `canonical_title`, so we use a placeholder; the renderer
 *      can read `<part>/index.md` if it needs the human-friendly heading).
 *   2. Inserts a Section-level `SourceEntry` for every row in `sectionsByPart`.
 *   3. Records the edition under each entry.
 *   4. Promotes the new entries to `accepted` in a single batch under reviewer
 *      `phase-9-bootstrap`.
 *
 * Idempotent: re-runs against the same on-disk state add zero new entries
 * and create no new promotion batches.
 */
export function hydrateRegsFromDerivatives(opts: BootstrapOptions = {}): BootstrapReport {
	const cwd = opts.cwd ?? process.cwd();
	const regsRoot = opts.regsRoot ?? join(cwd, 'regulations');
	const skipped: { path: string; reason: string }[] = [];

	if (!existsSync(regsRoot)) {
		return { editionsHydrated: 0, entriesAdded: 0, entriesAlreadyAccepted: 0, skipped };
	}

	let editionsHydrated = 0;
	let entriesAdded = 0;
	let entriesAlreadyAccepted = 0;

	const titleDirs = readDirSafe(regsRoot).filter((name) => name.startsWith('cfr-'));
	for (const titleDir of titleDirs) {
		const titleAbs = join(regsRoot, titleDir);
		if (!isDirectory(titleAbs)) continue;
		const editionDirs = readDirSafe(titleAbs);
		for (const editionDir of editionDirs) {
			const editionAbs = join(titleAbs, editionDir);
			if (!isDirectory(editionAbs)) continue;

			const manifestPath = join(editionAbs, 'manifest.json');
			const sectionsPath = join(editionAbs, 'sections.json');
			if (!existsSync(manifestPath) || !existsSync(sectionsPath)) {
				skipped.push({
					path: `${titleDir}/${editionDir}`,
					reason: 'manifest.json or sections.json missing',
				});
				continue;
			}

			let manifest: ManifestRecord;
			let sections: SectionsRecord;
			try {
				manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ManifestRecord;
				sections = JSON.parse(readFileSync(sectionsPath, 'utf-8')) as SectionsRecord;
			} catch (err) {
				skipped.push({
					path: `${titleDir}/${editionDir}`,
					reason: `parse failed: ${(err as Error).message}`,
				});
				continue;
			}

			const result = hydrateOneEdition(manifest, sections);
			editionsHydrated += 1;
			entriesAdded += result.entriesAdded;
			entriesAlreadyAccepted += result.entriesAlreadyAccepted;
		}
	}

	return { editionsHydrated, entriesAdded, entriesAlreadyAccepted, skipped };
}

interface OneEditionResult {
	readonly entriesAdded: number;
	readonly entriesAlreadyAccepted: number;
}

function hydrateOneEdition(manifest: ManifestRecord, sections: SectionsRecord): OneEditionResult {
	const editionSlug = manifest.editionSlug;
	const publishedDate = new Date(`${manifest.editionDate}T00:00:00.000Z`);
	const sourceUrl = manifest.sourceUrl;

	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	const newEntries: SourceEntry[] = [];
	let entriesAlreadyAccepted = 0;

	const seenParts = new Set<string>();

	for (const [part, rows] of Object.entries(sections.sectionsByPart)) {
		// Synthesize the Part-level entry once per Part.
		if (!seenParts.has(part)) {
			seenParts.add(part);
			const partId = `airboss-ref:regs/cfr-${manifest.title}/${part}` as SourceId;
			const partEntry = makePartEntry(manifest.title, part, publishedDate);
			const partOverlay = getEntryLifecycle(partId);
			if (sourcesPatch[partId] !== undefined && partOverlay === 'accepted') {
				entriesAlreadyAccepted += 1;
			} else {
				sourcesPatch[partId] = partEntry;
				newEntries.push(partEntry);
			}
			addEditionTo(editionsPatch, partId, editionSlug, publishedDate, sourceUrl);
		}

		for (const row of rows) {
			const id = row.id as SourceId;
			const entry = makeSectionEntryFromRow(row, publishedDate);
			const overlay = getEntryLifecycle(id);
			if (sourcesPatch[id] !== undefined && overlay === 'accepted') {
				entriesAlreadyAccepted += 1;
			} else {
				sourcesPatch[id] = entry;
				newEntries.push(entry);
			}
			addEditionTo(editionsPatch, id, editionSlug, publishedDate, sourceUrl);
		}
	}

	__sources_internal__.setActiveTable(sourcesPatch as Record<SourceId, SourceEntry>);
	__editions_internal__.setActiveTable(editionsPatch);

	if (newEntries.length > 0) {
		const scopeIds = newEntries.filter((e) => getEntryLifecycle(e.id) !== 'accepted').map((e) => e.id);
		if (scopeIds.length > 0) {
			const result = recordPromotion({
				corpus: 'regs',
				reviewerId: PHASE_9_BOOTSTRAP_REVIEWER_ID,
				scope: scopeIds,
				inputSource: sourceUrl,
				targetLifecycle: 'accepted',
			});
			if (!result.ok) {
				throw new Error(`bootstrap batch promotion failed: ${result.error}`);
			}
		}
	}

	return { entriesAdded: newEntries.length, entriesAlreadyAccepted };
}

function makePartEntry(title: '14' | '49', part: string, publishedDate: Date): SourceEntry {
	const id = `airboss-ref:regs/cfr-${title}/${part}` as SourceId;
	const canonicalShort = `${title} CFR Part ${part}`;
	return {
		id,
		corpus: 'regs',
		canonical_short: canonicalShort,
		canonical_formal: canonicalShort,
		// Authoritative title is in `<part>/index.md` on disk; bootstrap synthesizes
		// a placeholder so the validator can resolve. Renderer surfaces the real
		// title via the derivative reader when it needs `@title` substitution.
		canonical_title: `Part ${part}`,
		last_amended_date: publishedDate,
		lifecycle: 'pending',
	};
}

function makeSectionEntryFromRow(row: SectionRow, fallbackDate: Date): SourceEntry {
	const id = row.id as SourceId;
	const lastAmended = parseIsoDateOrFallback(row.last_amended_date, fallbackDate);
	const formal = deriveFormalFromId(id, row.canonical_short);
	return {
		id,
		corpus: 'regs',
		canonical_short: row.canonical_short,
		canonical_formal: formal,
		canonical_title: row.canonical_title,
		last_amended_date: lastAmended,
		lifecycle: 'pending',
	};
}

function deriveFormalFromId(id: SourceId, canonicalShort: string): string {
	// id shape: airboss-ref:regs/cfr-<title>/<part>/<section>(/<paragraph...>)?
	const match = /^airboss-ref:regs\/cfr-(\d{1,2})\/(\d+)\/(\d+[a-z]?)/u.exec(id);
	if (match === null) return canonicalShort;
	const title = match[1];
	const part = match[2];
	const section = match[3];
	return `${title} CFR § ${part}.${section}`;
}

function parseIsoDateOrFallback(value: string, fallback: Date): Date {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return fallback;
	return parsed;
}

function addEditionTo(
	editionsPatch: Map<SourceId, readonly Edition[]>,
	id: SourceId,
	editionSlug: EditionId,
	publishedDate: Date,
	sourceUrl: string,
): void {
	const existing = editionsPatch.get(id) ?? [];
	if (existing.some((e) => e.id === editionSlug)) return;
	const edition: Edition = { id: editionSlug, published_date: publishedDate, source_url: sourceUrl };
	editionsPatch.set(id, [...existing, edition]);
}

function readDirSafe(path: string): readonly string[] {
	try {
		return readdirSync(path);
	} catch {
		return [];
	}
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
