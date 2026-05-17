// @browser-globals: server-only -- never imported by client .svelte
/**
 * The glossary census adapter -- a Phase-2 Layer-1 derived-state adapter.
 *
 * Inventories the aviation-term glossary seed at `libs/db/seed/glossary.toml`
 * (the TOML-hybrid registry that mirrors into the `reference` DB table) and
 * derives a `defined` / `skeleton` state per term: a term is `defined` when
 * it carries an authored teaching paraphrase, `skeleton` when its paraphrase
 * is still a placeholder awaiting authoritative content.
 *
 * It also reports the separate page-help / UI-term glossary
 * (`libs/help/src/glossary/`) as a metric, since the spec scopes this corpus
 * as "Help library + glossary".
 *
 * Gap view / intent view are honest Phase-3 placeholders (`census` mode):
 * the `layerTwoPending` block carries the labelled message, `gaps` and
 * `next` stay genuinely empty.
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeReferences, type Reference } from '@ab/aviation';
import { ROUTES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { repoRoot } from './repo-root.server';

const GLOSSARY_TOML = 'libs/db/seed/glossary.toml';
const HELP_GLOSSARY_CONTENT_DIR = 'libs/help/src/glossary/content';

/**
 * The marker prefix a placeholder paraphrase carries. A term whose paraphrase
 * starts with this is awaiting authoritative content -- it is a `skeleton`.
 */
const SKELETON_PARAPHRASE_PREFIX = 'Skeleton entry';

/** Read + decode the aviation-term glossary seed, tolerating an absent file. */
function readGlossaryReferences(): Reference[] {
	const path = join(repoRoot(), GLOSSARY_TOML);
	if (!existsSync(path)) return [];
	const body = readFileSync(path, 'utf8');
	if (!body.trim()) return [];
	try {
		return [...decodeReferences(body)];
	} catch {
		// A malformed seed yields no inventory rather than a crash; the
		// drift detector in libs/hangar-sync flags the malformed file.
		return [];
	}
}

/** Count the long-form markdown bodies behind the page-help UI glossary. */
function helpGlossaryTermCount(): number {
	const dir = join(repoRoot(), HELP_GLOSSARY_CONTENT_DIR);
	if (!existsSync(dir)) return 0;
	return readdirSync(dir).filter((name) => name.endsWith('.md')).length;
}

/** A term whose paraphrase is still a placeholder is a skeleton. */
function isSkeleton(reference: Reference): boolean {
	return reference.paraphrase.trimStart().startsWith(SKELETON_PARAPHRASE_PREFIX);
}

/** The governing documents for the glossary corpus. */
const GLOSSARY_DOCS: DocLink[] = [
	{
		label: 'glossary.toml -- the aviation-term seed',
		href: ROUTES.HANGAR_DOCS_PATH(GLOSSARY_TOML),
		role: 'The on-disk authoritative source for aviation-term references; mirrors into the reference DB table.',
	},
	{
		label: 'Citations + cross-references pattern',
		href: ROUTES.HANGAR_DOCS_PATH('docs/ingestion-pipeline/reference-citations-pattern.md'),
		role: 'Documents how a glossary term is cited from a knowledge node and how the wiki-link resolves.',
	},
];

/**
 * Build the glossary census. Decodes `glossary.toml`; derives a defined /
 * skeleton state per term from whether its paraphrase is authored.
 */
export function glossaryCensus(): CorpusCensus {
	const references = readGlossaryReferences();

	const items: CensusItem[] = references.map((reference) => {
		const skeleton = isSkeleton(reference);
		return {
			id: reference.id,
			label: reference.displayName,
			derivedState: skeleton ? 'skeleton' : 'defined',
			detail: skeleton
				? 'Paraphrase is a placeholder -- authoritative content not yet captured.'
				: 'Carries an authored teaching paraphrase.',
		};
	});

	const termCount = items.length;
	const definedCount = items.filter((item) => item.derivedState === 'defined').length;
	const skeletonCount = termCount - definedCount;
	const uiGlossaryCount = helpGlossaryTermCount();

	const metrics: CensusMetric[] = [
		{
			key: 'aviation-terms',
			label: 'Aviation-term entries',
			value: termCount,
			whatItMeasures:
				'The number of aviation-term references in the glossary seed -- the citable, wiki-linkable terms (Va, ADM, SRM, and the rest) that the knowledge graph and the explain-everything surfaces resolve against.',
			whyItMatters:
				'Every `[[term]]` wiki-link in a knowledge node resolves through this seed. A term not in the seed renders as an unresolved link, so the seed size is the ceiling on what authors can safely cross-reference.',
			whatToDo: {
				text: 'Add an aviation term by appending a [[reference]] block to glossary.toml; the hangar sync mirrors it into the reference table.',
				href: ROUTES.HANGAR_DOCS_PATH(GLOSSARY_TOML),
			},
		},
		{
			key: 'defined-terms',
			label: 'Fully-defined terms',
			value: `${definedCount} / ${termCount}`,
			whatItMeasures:
				'How many aviation-term entries carry an authored teaching paraphrase. A "skeleton" entry exists as a citable id but its paraphrase is still a placeholder awaiting authoritative content.',
			whyItMatters:
				skeletonCount === 0
					? 'Every aviation term is fully defined -- any wiki-link to one resolves to a real teaching explanation.'
					: `${skeletonCount} term${skeletonCount === 1 ? ' is' : 's are'} a skeleton: the id resolves, but a learner who follows the wiki-link sees a placeholder, not a teaching explanation. The cross-reference looks complete while teaching nothing.`,
			whatToDo: {
				text: 'Author the placeholder paraphrases from their cited primary sources (the skeleton text names which AC / PHAK chapter / CFR to draw from).',
				href: ROUTES.HANGAR_DOCS_PATH(GLOSSARY_TOML),
			},
		},
		{
			key: 'ui-glossary-terms',
			label: 'Page-help glossary terms',
			value: uiGlossaryCount,
			whatItMeasures:
				'The number of UI / platform-term entries in the page-help glossary (IA, CTA, calibration, FIKI, and so on) -- the separate glossary that backs hover tooltips and the help drawer.',
			whyItMatters:
				'The page-help glossary teaches the product vocabulary, not the aviation vocabulary. It is what makes the dashboards and study surfaces self-explanatory; a missing term leaves a UI label opaque.',
			whatToDo: {
				text: 'Add a page-help term by adding an entry to libs/help/src/glossary/entries.ts plus its long-form markdown body.',
				href: ROUTES.HANGAR_DOCS_PATH('libs/help/src/glossary/entries.ts'),
			},
		},
	];

	return {
		id: 'glossary',
		label: 'Help library + glossary',
		whatItIs:
			'Two term stores: the aviation-term glossary seed (citable references like Va and ADM that knowledge nodes wiki-link to) and the page-help glossary (product-vocabulary terms that back tooltips and the help drawer).',
		whyItExists:
			'The platform’s promise is that everything explains itself. The aviation glossary lets a node cross-reference a term without re-teaching it; the page-help glossary makes every UI label and metric self-describing.',
		location: 'libs/help/, libs/db/seed/glossary.toml',
		mode: 'census',
		stateRule:
			'An aviation term is "defined" when it carries an authored teaching paraphrase; "skeleton" when its paraphrase still begins with the "Skeleton entry" placeholder marker awaiting authoritative content.',
		docs: GLOSSARY_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Help library + glossary'),
	};
}
