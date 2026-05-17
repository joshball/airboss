// @browser-globals: server-only -- never imported by client .svelte
/**
 * The handbooks census adapter -- a Phase-2 Layer-1 derived-state adapter.
 *
 * Walks every ingested FAA handbook under `handbooks/**`, reads its
 * `manifest.json`, and derives an `ingested` / `partial` state from the
 * section extraction status: a handbook is `ingested` when every one of its
 * sections carries real extracted body content, `partial` when one or more
 * sections were reached by the extractor but yielded no body content.
 *
 * Gap view / intent view are honest Phase-3 placeholders (`census` mode):
 * the `layerTwoPending` block carries the labelled message, `gaps` and
 * `next` stay genuinely empty.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HANDBOOK_EMPTY_EXTRACTION_STATUSES, ROUTES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { repoRoot } from './repo-root.server';

/** One section as it appears in a handbook `manifest.json`. */
interface HandbookSection {
	level: string;
	code: string;
	title: string;
	body_path?: string;
	metadata?: { extraction_status?: string };
}

/** The slice of a handbook `manifest.json` this adapter reads. */
interface HandbookManifest {
	document_slug?: string;
	edition?: string;
	title: string;
	publisher?: string;
	primary_cert?: string;
	sections: HandbookSection[];
	figures?: unknown[];
}

const HANDBOOKS_DIR = 'handbooks';

/** A single handbook resolved from disk -- manifest plus its slug. */
interface ResolvedHandbook {
	slug: string;
	manifest: HandbookManifest;
}

/**
 * Find every handbook `manifest.json` under `handbooks/`. Each handbook is a
 * `handbooks/<slug>/<EDITION>/manifest.json` triple; the slug is the first
 * path segment under `handbooks/`.
 */
function resolveHandbooks(): ResolvedHandbook[] {
	const root = join(repoRoot(), HANDBOOKS_DIR);
	if (!existsSync(root)) return [];
	const handbooks: ResolvedHandbook[] = [];
	for (const slug of readdirSync(root)) {
		const slugDir = join(root, slug);
		if (!statSync(slugDir).isDirectory()) continue;
		for (const edition of readdirSync(slugDir)) {
			const manifestPath = join(slugDir, edition, 'manifest.json');
			if (!existsSync(manifestPath)) continue;
			const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as HandbookManifest;
			handbooks.push({ slug, manifest });
		}
	}
	return handbooks.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Count the sections of a handbook that yielded no usable body content. */
function emptySectionCount(manifest: HandbookManifest): number {
	return manifest.sections.filter((section) => {
		const status = section.metadata?.extraction_status ?? '';
		return HANDBOOK_EMPTY_EXTRACTION_STATUSES.includes(status);
	}).length;
}

/** The governing documents for the handbooks corpus. */
const HANDBOOKS_DOCS: DocLink[] = [
	{
		label: 'ADR 018 -- Source artifact storage policy',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/018-source-artifact-storage-policy/decision.md'),
		role: 'Governs where the handbook source PDFs vs the extracted markdown derivatives live.',
	},
	{
		label: 'Section-extraction prompt strategy',
		href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/section-extraction-prompt-strategy.md'),
		role: 'Documents the paste-to-Claude ingestion flow that produces the per-section markdown bodies.',
	},
];

/**
 * Build the handbooks census. Walks every handbook manifest; derives an
 * ingested / partial state from its section extraction completeness.
 */
export function handbooksCensus(): CorpusCensus {
	const handbooks = resolveHandbooks();

	const items: CensusItem[] = handbooks.map(({ slug, manifest }) => {
		const sectionCount = manifest.sections.length;
		const emptyCount = emptySectionCount(manifest);
		const isIngested = emptyCount === 0;
		const editionLabel = manifest.edition ? ` (${manifest.edition})` : '';
		return {
			id: slug,
			label: `${manifest.title}${editionLabel}`,
			derivedState: isIngested ? 'ingested' : 'partial',
			detail: isIngested
				? `${sectionCount} sections, all with extracted body content.`
				: `${sectionCount} sections; ${emptyCount} reached but with no extracted body content.`,
		};
	});

	const handbookCount = items.length;
	const ingestedCount = items.filter((item) => item.derivedState === 'ingested').length;
	const partialCount = handbookCount - ingestedCount;
	const totalSections = handbooks.reduce((sum, hb) => sum + hb.manifest.sections.length, 0);
	const totalEmptySections = handbooks.reduce((sum, hb) => sum + emptySectionCount(hb.manifest), 0);
	const totalFigures = handbooks.reduce((sum, hb) => sum + (hb.manifest.figures?.length ?? 0), 0);

	const metrics: CensusMetric[] = [
		{
			key: 'handbooks',
			label: 'Ingested handbooks',
			value: handbookCount,
			whatItMeasures:
				'The number of distinct FAA handbooks that have been run through the ingestion pipeline and have an on-disk manifest -- PHAK, the Airplane Flying Handbook, the Instrument Flying Handbook, and the rest.',
			whyItMatters:
				'Every handbook is a citable knowledge source for the learning graph and the flightbag reader. A handbook that has not been ingested cannot be deep-linked, searched, or cross-referenced from a knowledge node.',
			whatToDo: {
				text: 'Ingest a new handbook through the section-extraction pipeline; see the ingestion-pipeline prompt strategy.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/section-extraction-prompt-strategy.md'),
			},
		},
		{
			key: 'sections',
			label: 'Extracted sections',
			value: totalSections,
			whatItMeasures:
				'The total count of handbook sections extracted across every ingested handbook -- the front matter, chapters, sections, and subsections that became individual markdown files.',
			whyItMatters:
				'Sections are the unit of citation and deep-linking. A larger extracted section set means finer-grained references: a node can cite an exact subsection rather than "see PHAK chapter 12".',
			whatToDo: {
				text: 'Section counts grow as handbooks are ingested; the per-handbook breakdown is in the inventory below.',
				href: ROUTES.HANGAR_DOCS_PATH(`${HANDBOOKS_DIR}/`),
			},
		},
		{
			key: 'fully-ingested',
			label: 'Fully-ingested handbooks',
			value: `${ingestedCount} / ${handbookCount}`,
			whatItMeasures:
				'How many handbooks have every section carrying real extracted body content. A "partial" handbook has one or more sections the extractor reached but could not pull usable text from.',
			whyItMatters:
				partialCount === 0
					? 'Every ingested handbook is complete -- no section is a hollow placeholder, so any section is safe to cite.'
					: `${partialCount} handbook${partialCount === 1 ? ' is' : 's are'} partial: ${totalEmptySections} section${totalEmptySections === 1 ? '' : 's'} across the corpus were reached but yielded no body content. A citation that lands on an empty section shows the learner nothing.`,
			whatToDo: {
				text: 'Re-run extraction for the partial handbooks, or mark the empty sections as intentionally bodyless (cover pages, blank dividers) so the census stops flagging them.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/section-extraction-prompt-strategy.md'),
			},
		},
		{
			key: 'figures',
			label: 'Extracted figures',
			value: totalFigures,
			whatItMeasures:
				'The total count of figures (diagrams, photos, charts) extracted as image derivatives across every ingested handbook.',
			whyItMatters:
				'Aviation handbooks are heavily illustrated -- a sectional excerpt, an airflow diagram, a panel photo. A section that cites a figure the pipeline never extracted renders with a broken reference.',
			whatToDo: {
				text: 'Figure extraction runs alongside section extraction; gaps surface as broken figure references in the flightbag reader.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/section-extraction-prompt-strategy.md'),
			},
		},
	];

	return {
		id: 'handbooks',
		label: 'Handbooks',
		whatItIs:
			'The ingested FAA handbook corpus -- PHAK, the Airplane Flying Handbook, the Instrument Flying Handbook, the Aviation Weather Handbook, and others, each extracted into per-section markdown.',
		whyItExists:
			'Handbooks are the authoritative narrative knowledge base behind the learning graph. Ingesting them into per-section markdown makes every section individually citable, searchable, and deep-linkable from a knowledge node or the flightbag reader.',
		location: `${HANDBOOKS_DIR}/**`,
		mode: 'census',
		stateRule:
			'A handbook is "ingested" when every section in its manifest carries real extracted body content; "partial" when one or more sections were reached by the extractor but yielded no body content (extraction_status "no-body-content").',
		docs: HANDBOOKS_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Handbooks'),
	};
}
