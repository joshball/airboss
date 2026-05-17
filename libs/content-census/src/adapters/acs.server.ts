// @browser-globals: server-only -- never imported by client .svelte
/**
 * The ACS census adapter -- a Phase-2 Layer-1 derived-state adapter.
 *
 * Reads the Airman Certification Standards registry at `acs/index.json` and,
 * for each ACS document, derives a `current` / `stale` state by comparing
 * the document's `publication_date` against the known-latest FAA edition
 * recorded in `ACS_KNOWN_LATEST_PUBLICATION`.
 *
 * Layer 1 only -- the gap view, intent view, and next-list are deferred to
 * Phase 3 and returned empty (no fabricated gaps); the Phase-3 task pointer
 * is carried in `docs`.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACS_KNOWN_LATEST_PUBLICATION, ROUTES } from '@ab/constants';
import type { CensusGap, CensusItem, CensusMetric, CensusNextItem, CorpusCensus, DocLink } from '../types';
import { repoRoot } from './repo-root.server';

/** One ACS document entry in `acs/index.json`. */
interface AcsIndexEntry {
	slug: string;
	title: string;
	publication_date: string;
	manifest_path: string;
}

/** The on-disk `acs/index.json` shape. */
interface AcsIndex {
	schema_version: number;
	entries: AcsIndexEntry[];
}

/** One ACS area block in a per-document `manifest.json`. */
interface AcsArea {
	area: string;
	title: string;
	tasks?: unknown[];
}

/** The slice of an ACS `manifest.json` this adapter reads. */
interface AcsManifest {
	areas?: AcsArea[];
	page_count?: number;
}

const ACS_DIR = 'acs';
const ACS_INDEX = 'acs/index.json';
const CENSUS_WP_TASKS = 'docs/work-packages/hangar-content-census/tasks.md';

/** Read + parse the ACS registry index, tolerating an absent file. */
function readAcsIndex(): AcsIndexEntry[] {
	const path = join(repoRoot(), ACS_INDEX);
	if (!existsSync(path)) return [];
	const parsed = JSON.parse(readFileSync(path, 'utf8')) as AcsIndex;
	return parsed.entries ?? [];
}

/** Read a per-document ACS manifest, tolerating an absent file. */
function readAcsManifest(manifestPath: string): AcsManifest | null {
	const path = join(repoRoot(), manifestPath);
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, 'utf8')) as AcsManifest;
}

/** The governing documents for the ACS corpus. */
const ACS_DOCS: DocLink[] = [
	{
		label: 'ADR 018 -- Source artifact storage policy',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/018-source-artifact-storage-policy/decision.md'),
		role: 'Governs where the ACS source PDFs vs the extracted task-table derivatives live.',
	},
	{
		label: 'acs/index.json -- the ACS registry',
		href: ROUTES.HANGAR_DOCS_PATH(ACS_INDEX),
		role: 'The machine-readable list of every ingested ACS document, its publication date, and its manifest.',
	},
	{
		label: 'Content census -- Phase 3 tasks (gap view + intent)',
		href: ROUTES.HANGAR_DOCS_PATH(CENSUS_WP_TASKS),
		role: 'Tracks the Layer-2 intent block and the gap / next-list views still to be authored for this corpus.',
	},
];

/**
 * Build the ACS census. Reads `acs/index.json`; derives a current / stale
 * state per document from its publication date vs the known-latest edition.
 */
export function acsCensus(): CorpusCensus {
	const entries = readAcsIndex();

	const items: CensusItem[] = entries.map((entry) => {
		const knownLatest = ACS_KNOWN_LATEST_PUBLICATION[entry.slug];
		// "current" when the ingested edition is on or after the known-latest
		// FAA edition; "stale" when a newer edition has since been published.
		// A slug with no known-latest entry is treated as current -- the census
		// cannot claim staleness it has no reference point for.
		const isStale = knownLatest !== undefined && entry.publication_date < knownLatest;
		const manifest = readAcsManifest(entry.manifest_path);
		const areaCount = manifest?.areas?.length ?? 0;
		return {
			id: entry.slug,
			label: entry.title,
			derivedState: isStale ? 'stale' : 'current',
			detail: isStale
				? `Ingested edition dated ${entry.publication_date}; FAA latest is ${knownLatest}.`
				: `Ingested edition dated ${entry.publication_date}; ${areaCount} areas of operation.`,
		};
	});

	const acsCount = items.length;
	const currentCount = items.filter((item) => item.derivedState === 'current').length;
	const staleCount = acsCount - currentCount;
	const totalAreas = entries.reduce((sum, entry) => {
		const manifest = readAcsManifest(entry.manifest_path);
		return sum + (manifest?.areas?.length ?? 0);
	}, 0);
	const totalTasks = entries.reduce((sum, entry) => {
		const manifest = readAcsManifest(entry.manifest_path);
		const areaTasks = (manifest?.areas ?? []).reduce((s, area) => s + (area.tasks?.length ?? 0), 0);
		return sum + areaTasks;
	}, 0);

	const metrics: CensusMetric[] = [
		{
			key: 'acs-documents',
			label: 'ACS documents',
			value: acsCount,
			whatItMeasures:
				'The number of Airman Certification Standards documents ingested -- one per certificate or rating (Private, Instrument, Commercial, ATP, CFI).',
			whyItMatters:
				'The ACS is the legal definition of what a checkride tests. Each ingested document lets the platform map a learner’s study back to the exact ACS area, task, and element a Designated Pilot Examiner will assess.',
			whatToDo: {
				text: 'Ingest a missing ACS document through the source pipeline; the registry lives at acs/index.json.',
				href: ROUTES.HANGAR_DOCS_PATH(ACS_INDEX),
			},
		},
		{
			key: 'current-acs',
			label: 'Current-edition documents',
			value: `${currentCount} / ${acsCount}`,
			whatItMeasures:
				'How many ingested ACS documents match the known-latest FAA edition. A "stale" document is an edition the FAA has since superseded with a change.',
			whyItMatters:
				staleCount === 0
					? 'Every ingested ACS is the current FAA edition -- a learner studying against it is studying against what the examiner will actually use.'
					: `${staleCount} ACS document${staleCount === 1 ? ' is' : 's are'} a superseded edition. A learner studying a stale ACS may prepare for tasks or elements the current checkride has dropped, renamed, or added.`,
			whatToDo: {
				text: 'Re-ingest the stale documents from the FAA’s current ACS PDFs, then bump ACS_KNOWN_LATEST_PUBLICATION so the census reflects the new edition.',
				href: ROUTES.HANGAR_DOCS_PATH(ACS_INDEX),
			},
		},
		{
			key: 'areas',
			label: 'Areas of operation',
			value: totalAreas,
			whatItMeasures:
				'The total count of ACS areas of operation across every ingested document -- the top-level groupings (Preflight Preparation, Airport Operations, Navigation, and so on).',
			whyItMatters:
				'Areas of operation are the coarse map of a checkride. They are the anchor points a study plan or progress tracker hangs each topic onto.',
			whatToDo: {
				text: 'Area counts are fixed by the FAA per ACS edition; the per-document breakdown is in the inventory below.',
				href: ROUTES.HANGAR_DOCS_PATH(`${ACS_DIR}/`),
			},
		},
		{
			key: 'tasks',
			label: 'ACS tasks',
			value: totalTasks,
			whatItMeasures:
				'The total count of individual ACS tasks across every ingested document -- the testable units within each area (Pilot Qualifications, Weather Information, Steep Turns, and the rest).',
			whyItMatters:
				'Tasks carry the knowledge, risk-management, and skill elements a checkride grades. They are the finest-grained anchor the platform can map a knowledge node, drill, or sim scenario back to.',
			whatToDo: {
				text: 'Task counts come from the per-document manifests; cross-referencing nodes to ACS task codes is tracked on the knowledge-graph roadmap.',
				href: ROUTES.HANGAR_DOCS_PATH(`${ACS_DIR}/`),
			},
		},
	];

	// Layer 1 only. The gap view, intent view, and next-list are deferred to
	// Phase 3 -- returned empty (no fabricated gaps); the Phase-3 task pointer
	// is carried in `docs` so the placeholder is honest and labelled.
	const gaps: CensusGap[] = [];
	const next: CensusNextItem[] = [];

	return {
		id: 'acs',
		label: 'ACS documents',
		whatItIs:
			'The ingested Airman Certification Standards documents -- the FAA task tables that define, area by area and task by task, exactly what a practical test for each certificate and rating assesses.',
		whyItExists:
			'The ACS is the legal blueprint of every checkride. Ingesting it lets the platform anchor study, drills, and progress tracking to the exact areas, tasks, and elements a Designated Pilot Examiner will test.',
		location: `${ACS_DIR}/**`,
		mode: 'full',
		stateRule:
			'An ACS document is "current" when its publication_date is on or after the known-latest FAA edition recorded in ACS_KNOWN_LATEST_PUBLICATION; "stale" when a newer edition has since superseded it.',
		docs: ACS_DOCS,
		items,
		metrics,
		gaps,
		next,
	};
}
