// @browser-globals: server-only -- never imported by client .svelte
/**
 * The sources census adapter -- a Phase-2 Layer-1 derived-state adapter.
 *
 * Walks the three FAA source-document registries -- Advisory Circulars
 * (`ac/index.json`), Information for Operators bulletins (`info/index.json`),
 * and Safety Alerts for Operators (`safo/index.json`) -- and derives a
 * `linked` / `orphan` state per document: a document is `linked` when its
 * registry `manifest_path` resolves to a real file on disk, `orphan` when
 * the registry names a manifest that is missing.
 *
 * Layer 1 only -- the gap view, intent view, and next-list are deferred to
 * Phase 3 and returned empty (no fabricated gaps); the Phase-3 task pointer
 * is carried in `docs`.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES } from '@ab/constants';
import type { CensusGap, CensusItem, CensusMetric, CensusNextItem, CorpusCensus, DocLink } from '../types';
import { repoRoot } from './repo-root.server';

/** A common source-document entry -- AC, InFO, and SAFO entries reduce to this. */
interface SourceEntry {
	id: string;
	title: string;
	publication_date?: string;
	manifest_path: string;
	registry: string;
}

/** The raw shape of an Advisory Circular entry in `ac/index.json`. */
interface RawAcEntry {
	doc_slug: string;
	doc_number: string;
	revision?: string;
	title: string;
	publication_date?: string;
	manifest_path: string;
}

/** The raw shape of an InFO / SAFO bulletin entry. */
interface RawBulletinEntry {
	bulletin_id: string;
	title: string;
	publication_date?: string;
	manifest_path: string;
}

/** The on-disk registry-index shape shared by all three registries. */
interface RegistryIndex {
	schema_version: number;
	entries: unknown[];
}

const CENSUS_WP_TASKS = 'docs/work-packages/hangar-content-census/tasks.md';

/** Read + parse a registry index, tolerating an absent file. */
function readRegistry(relativePath: string): unknown[] {
	const path = join(repoRoot(), relativePath);
	if (!existsSync(path)) return [];
	const parsed = JSON.parse(readFileSync(path, 'utf8')) as RegistryIndex;
	return parsed.entries ?? [];
}

/** Collect every AC, InFO, and SAFO entry into one common-shaped list. */
function collectSourceEntries(): SourceEntry[] {
	const entries: SourceEntry[] = [];

	for (const raw of readRegistry('ac/index.json') as RawAcEntry[]) {
		const revision = raw.revision ? raw.revision.toUpperCase() : '';
		entries.push({
			id: `AC ${raw.doc_number}${revision}`,
			title: raw.title,
			publication_date: raw.publication_date,
			manifest_path: raw.manifest_path,
			registry: 'Advisory Circular',
		});
	}
	for (const raw of readRegistry('info/index.json') as RawBulletinEntry[]) {
		entries.push({
			id: `InFO ${raw.bulletin_id}`,
			title: raw.title,
			publication_date: raw.publication_date,
			manifest_path: raw.manifest_path,
			registry: 'Information for Operators',
		});
	}
	for (const raw of readRegistry('safo/index.json') as RawBulletinEntry[]) {
		entries.push({
			id: `SAFO ${raw.bulletin_id}`,
			title: raw.title,
			publication_date: raw.publication_date,
			manifest_path: raw.manifest_path,
			registry: 'Safety Alert for Operators',
		});
	}
	return entries;
}

/** The governing documents for the source registry corpus. */
const SOURCES_DOCS: DocLink[] = [
	{
		label: 'ADR 018 -- Source artifact storage policy',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/018-source-artifact-storage-policy/decision.md'),
		role: 'Governs where the source PDFs vs the extracted markdown derivatives and manifests live.',
	},
	{
		label: 'Citations + cross-references pattern',
		href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/reference-citations-pattern.md'),
		role: 'Documents how a knowledge node or drill cites a source document and how the link resolves.',
	},
	{
		label: 'Content census -- Phase 3 tasks (gap view + intent)',
		href: ROUTES.HANGAR_DOCS_PATH(CENSUS_WP_TASKS),
		role: 'Tracks the Layer-2 intent block and the gap / next-list views still to be authored for this corpus.',
	},
];

/**
 * Build the sources census. Walks the AC / InFO / SAFO registries; derives a
 * linked / orphan state from whether each registry manifest_path resolves.
 */
export function sourcesCensus(): CorpusCensus {
	const entries = collectSourceEntries();

	const items: CensusItem[] = entries.map((entry) => {
		const manifestResolves = existsSync(join(repoRoot(), entry.manifest_path));
		return {
			id: entry.id,
			label: `${entry.id} -- ${entry.title}`,
			derivedState: manifestResolves ? 'linked' : 'orphan',
			detail: manifestResolves
				? `${entry.registry}; manifest resolves at ${entry.manifest_path}.`
				: `${entry.registry}; registry names ${entry.manifest_path} but no manifest is on disk.`,
		};
	});

	const sourceCount = items.length;
	const linkedCount = items.filter((item) => item.derivedState === 'linked').length;
	const orphanCount = sourceCount - linkedCount;
	const acCount = entries.filter((e) => e.registry === 'Advisory Circular').length;
	const infoCount = entries.filter((e) => e.registry === 'Information for Operators').length;
	const safoCount = entries.filter((e) => e.registry === 'Safety Alert for Operators').length;

	const metrics: CensusMetric[] = [
		{
			key: 'source-documents',
			label: 'Registered source documents',
			value: sourceCount,
			whatItMeasures:
				'The total count of FAA source documents in the three registries the platform tracks -- Advisory Circulars, Information for Operators bulletins, and Safety Alerts for Operators.',
			whyItMatters:
				'These are the primary-source documents a knowledge node, drill, or scenario cites for authority. The registry is the universe of sources the citation picker can reach; a document not registered cannot be cited.',
			whatToDo: {
				text: 'Register a new source by ingesting it through the source pipeline; each registry has an index.json.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/reference-citations-pattern.md'),
			},
		},
		{
			key: 'registry-breakdown',
			label: 'Documents by registry',
			value: `${acCount} AC / ${infoCount} InFO / ${safoCount} SAFO`,
			whatItMeasures:
				'How the registered source documents split across the three registry types -- Advisory Circulars (durable guidance), InFOs (operator information), and SAFOs (time-sensitive safety alerts).',
			whyItMatters:
				'The three registry types serve different pedagogical roles. ACs back durable knowledge nodes; SAFOs and InFOs are operationally current and date faster. A lopsided mix signals where the source base is thin.',
			whatToDo: {
				text: 'Balance the registries by ingesting under-represented document types; the per-document list is in the inventory below.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/reference-citations-pattern.md'),
			},
		},
		{
			key: 'linked-sources',
			label: 'Linked source documents',
			value: `${linkedCount} / ${sourceCount}`,
			whatItMeasures:
				'How many registered documents have a manifest_path that resolves to a real file on disk. An "orphan" is a registry entry whose manifest is missing.',
			whyItMatters:
				orphanCount === 0
					? 'Every registered source resolves -- any citation the picker offers lands on a document that actually exists.'
					: `${orphanCount} registered document${orphanCount === 1 ? ' is' : 's are'} an orphan: the registry names a manifest that is not on disk. A citation to an orphan resolves to nothing and renders as a broken reference.`,
			whatToDo: {
				text: 'Either re-ingest the orphan documents so their manifests exist, or remove the dangling registry entries so the citation picker stops offering them.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/reference-citations-pattern.md'),
			},
		},
	];

	// Layer 1 only. The gap view, intent view, and next-list are deferred to
	// Phase 3 -- returned empty (no fabricated gaps); the Phase-3 task pointer
	// is carried in `docs` so the placeholder is honest and labelled.
	const gaps: CensusGap[] = [];
	const next: CensusNextItem[] = [];

	return {
		id: 'sources',
		label: 'Source registry',
		whatItIs:
			'The canonical FAA source-document registry -- Advisory Circulars, Information for Operators bulletins, and Safety Alerts for Operators, each ingested with an extracted manifest.',
		whyItExists:
			'Every authoritative claim in the learning graph traces back to a primary source. The registry is the citable universe: it is what the citation picker draws from and what a node, drill, or scenario links to for authority.',
		location: 'ac/, info/, safo/ + libs/sources/',
		mode: 'full',
		stateRule:
			'A source document is "linked" when its registry manifest_path resolves to a real file on disk; "orphan" when the registry names a manifest that is missing -- a citation to it would resolve to nothing.',
		docs: SOURCES_DOCS,
		items,
		metrics,
		gaps,
		next,
	};
}
