// @browser-globals: server-only -- never imported by client .svelte
/**
 * The vision / PRD census adapter -- a Phase-2 Layer-1 adapter.
 *
 * `docs/vision/**` holds the product vision for the 53-product index: a
 * per-category `README.md`, and per-product `PRD.md` / `VISION.md` /
 * `DESIGN.md` documents. The unit of this census is the product DOCUMENT
 * (category READMEs and the top-level INDEX are navigation, not products,
 * and are excluded from the inventory).
 *
 * Derived-state rule (design.md leaves this corpus to the adapter to
 * define; rule documented here and surfaced verbatim as `stateRule`):
 *   - `fleshed-out` -- the doc declares `prd_depth: full` or `vision`: a
 *     real worked-through product brief.
 *   - `outline`     -- the doc declares `prd_depth: light`: a captured idea
 *     with the shape sketched but not worked through.
 *   - `stub`        -- no recognised `prd_depth`, or a `status` that names a
 *     research stub / spike: the idea exists but the doc is a placeholder.
 *
 * Gap view / intent view are Phase-3 placeholders (`census` mode).
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { ROUTES, VISION_FLESHED_OUT_DEPTHS, VISION_OUTLINE_DEPTHS } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { frontmatterString, parseMarkdownFile, walkMarkdown } from './markdown.server';

const VISION_DIR = 'docs/vision';

const STATE_FLESHED_OUT = 'fleshed-out';
const STATE_OUTLINE = 'outline';
const STATE_STUB = 'stub';

/** Product-document basenames -- everything else (README, INDEX) is navigation. */
const PRODUCT_DOC_NAMES = new Set(['PRD.md', 'VISION.md', 'DESIGN.md']);

const VISION_DOCS: DocLink[] = [
	{
		label: 'Vision -- product index',
		href: ROUTES.HANGAR_DOCS_PATH('docs/vision/INDEX.md'),
		role: 'The master index of every product idea, grouped by category.',
	},
	{
		label: 'Product brainstorm -- 53 product ideas',
		href: ROUTES.HANGAR_DOCS_PATH('docs/platform/PRODUCT_BRAINSTORM.md'),
		role: 'The upstream idea funnel the vision documents are worked up from.',
	},
	{
		label: 'ADR 028 -- Content-intent frontmatter',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/028-content-intent-frontmatter.md'),
		role: 'The proposed Layer-2 intent block; once approved, each vision doc carries planned / wanted authoring intent.',
	},
];

/** Classify a vision document from its frontmatter. */
function deriveState(frontmatter: Record<string, unknown> | null): string {
	const depth = (frontmatterString(frontmatter, 'prd_depth') ?? '').toLowerCase();
	const status = (frontmatterString(frontmatter, 'status') ?? '').toLowerCase();
	if (status.includes('stub') || status.includes('spike')) return STATE_STUB;
	if ((VISION_FLESHED_OUT_DEPTHS as readonly string[]).includes(depth)) return STATE_FLESHED_OUT;
	if ((VISION_OUTLINE_DEPTHS as readonly string[]).includes(depth)) return STATE_OUTLINE;
	return STATE_STUB;
}

/**
 * Build the vision / PRD census. Walks `docs/vision/**` for every product
 * document, derives a fleshed-out / outline / stub state from its
 * `prd_depth` + `status` frontmatter, and reports the depth distribution.
 */
export function visionCensus(): CorpusCensus {
	const docPaths = walkMarkdown(VISION_DIR, (basename) => PRODUCT_DOC_NAMES.has(basename));

	const items: CensusItem[] = [];
	for (const path of docPaths) {
		const { frontmatter } = parseMarkdownFile(path);
		const name = frontmatterString(frontmatter, 'name') ?? deriveLabelFromPath(path);
		const id = frontmatterString(frontmatter, 'id') ?? path;
		const state = deriveState(frontmatter);
		const depth = frontmatterString(frontmatter, 'prd_depth') ?? 'unset';
		items.push({
			id,
			label: name,
			derivedState: state,
			detail: `prd_depth: ${depth}`,
		});
	}

	const total = items.length;
	const fleshedOut = items.filter((item) => item.derivedState === STATE_FLESHED_OUT).length;
	const outline = items.filter((item) => item.derivedState === STATE_OUTLINE).length;
	const stub = items.filter((item) => item.derivedState === STATE_STUB).length;

	const metrics: CensusMetric[] = [
		{
			key: 'docs',
			label: 'Vision documents',
			value: total,
			whatItMeasures:
				'The number of per-product vision documents on disk -- the PRD, VISION, or DESIGN file for each product idea in the index.',
			whyItMatters:
				'Every product the platform might build needs a vision document before it can be specced or scheduled. The count is the size of the captured product pipeline.',
			whatToDo: {
				text: 'Capture a new product idea as a PRD.md under its category in docs/vision/products/.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/vision/INDEX.md'),
			},
		},
		{
			key: 'fleshed-out',
			label: 'Fleshed-out documents',
			value: `${fleshedOut} / ${total}`,
			whatItMeasures:
				'How many vision documents declare `prd_depth: full` or `vision` -- a product brief worked through enough to spec from.',
			whyItMatters:
				'A fleshed-out vision doc is ready to become a work package. An outline or stub is not -- speccing from a thin doc means re-deriving the product shape, which is where scope drift starts.',
			whatToDo: {
				text: 'Deepen outline documents to full depth before promoting a product into a work package.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/vision/INDEX.md'),
			},
		},
		{
			key: 'outline',
			label: 'Outline documents',
			value: outline,
			whatItMeasures:
				'How many vision documents declare `prd_depth: light` -- the product shape is sketched but not worked through.',
			whyItMatters:
				'An outline is enough to triage and prioritise a product, but not to build it. These documents are the middle of the funnel: captured, not yet ready.',
			whatToDo: {
				text: 'Promote high-priority outlines to full depth; leave low-priority ones as captured ideas.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/vision/INDEX.md'),
			},
		},
		{
			key: 'stub',
			label: 'Stub documents',
			value: stub,
			whatItMeasures:
				'How many vision documents carry no recognised `prd_depth`, or a `status` naming a research stub or spike -- the document is a placeholder.',
			whyItMatters:
				'A stub vision doc reserves a slot in the index without describing a product. It signals an idea exists but warns that nothing buildable has been written down yet.',
			whatToDo: {
				text: 'Either flesh a stub into an outline, or mark the idea dropped if it is no longer wanted.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/vision/INDEX.md'),
			},
		},
	];

	return {
		id: 'vision',
		label: 'Vision / PRD docs',
		whatItIs:
			'Product vision documents and PRDs across the 53-product index -- one PRD, VISION, or DESIGN file per product idea, grouped by category.',
		whyItExists:
			'Vision documents are the product pipeline. Before a product can be specced into a work package or scheduled on a roadmap, its shape, audience, and value have to be written down here.',
		location: `${VISION_DIR}/**`,
		mode: 'census',
		stateRule:
			'A vision doc is "fleshed-out" when its frontmatter declares prd_depth: full or vision; "outline" when prd_depth: light; "stub" when no recognised prd_depth is set, or its status names a research stub or spike. Category READMEs and the index are navigation and are not inventoried.',
		docs: VISION_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Vision / PRD docs'),
	};
}

/** Fallback label for a doc with no `name` frontmatter -- its product-dir slug. */
function deriveLabelFromPath(path: string): string {
	const segments = path.split('/');
	// `.../products/<category>/<product>/<DOC>.md` -> the <product> segment.
	return segments.length >= 2 ? segments[segments.length - 2] : path;
}
