// @browser-globals: server-only -- never imported by client .svelte
/**
 * The work-packages census adapter -- a Phase-2 Layer-1 adapter.
 *
 * `docs/work-packages/<slug>/spec.md` carries an ADR-025 frontmatter block
 * whose `status` field drives this census. The unit is the WORK PACKAGE.
 *
 * Derived-state rule (design.md): the derived state IS the WP `status` --
 * `draft` / `signed-off` / `in-flight` / `shipped` / `abandoned` /
 * `superseded` -- read straight from frontmatter. A spec with no valid
 * frontmatter derives `unparseable`.
 *
 * This corpus overlaps the `/roadmap` process dashboard: `/roadmap` is the
 * actionable view of WP process. This census reports the content-side fact
 * (how many WPs exist, at what status) and links to `/roadmap` for the
 * process drill-down rather than duplicating it.
 *
 * Gap view / intent view are honest Phase-3 placeholders (`census` mode).
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { ROUTES, WP_DIR, WP_SPEC_FILE, WP_STATUSES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { fileExists, frontmatterString, listDirs, parseMarkdownFile } from './markdown.server';

/** The state a WP whose frontmatter would not parse / validate derives. */
const STATE_UNPARSEABLE = 'unparseable';

const WORK_PACKAGE_DOCS: DocLink[] = [
	{
		label: 'Roadmap -- work-package process dashboard',
		href: ROUTES.HANGAR_ROADMAP,
		role: 'The actionable process view: WP status, dependencies, what is blocked, what is next. The census links here rather than duplicating it.',
	},
	{
		label: 'ADR 025 -- Work-package frontmatter contract',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/025-wp-frontmatter-contract/decision.md'),
		role: 'Defines the spec.md frontmatter schema, including the status enum this census reads.',
	},
	{
		label: 'Tracking -- the three-level model',
		href: ROUTES.HANGAR_DOCS_PATH('docs/platform/TRACKING.md'),
		role: 'Explains how work packages relate to session todos and product tasks.',
	},
];

/**
 * Build the work-packages census. Reads every `docs/work-packages/<slug>/`
 * directory's `spec.md`, derives the WP status from frontmatter, and reports
 * the status distribution. Process-side actions link to `/roadmap`.
 */
export function workPackagesCensus(): CorpusCensus {
	const slugs = listDirs(WP_DIR);

	const items: CensusItem[] = [];
	for (const slug of slugs) {
		const specPath = `${WP_DIR}/${slug}/${WP_SPEC_FILE}`;
		if (!fileExists(specPath)) {
			// A directory with no spec.md is not a work package; skip it.
			continue;
		}
		const { frontmatter } = parseMarkdownFile(specPath);
		const status = frontmatterString(frontmatter, 'status');
		const validStatus = status !== null && (WP_STATUSES as readonly string[]).includes(status);
		const title = frontmatterString(frontmatter, 'title') ?? slug;
		items.push({
			id: slug,
			label: title,
			derivedState: validStatus && status !== null ? status : STATE_UNPARSEABLE,
			detail: validStatus ? `status: ${status}` : 'no valid frontmatter status',
			href: ROUTES.HANGAR_ROADMAP_DETAIL(slug),
		});
	}

	const total = items.length;
	const countOf = (state: string): number => items.filter((item) => item.derivedState === state).length;
	const shipped = countOf('shipped');
	const inFlight = countOf('in-flight');
	const signedOff = countOf('signed-off');
	const draft = countOf('draft');
	const unparseable = countOf(STATE_UNPARSEABLE);
	const open = signedOff + inFlight + draft;

	const statusBreakdown = WP_STATUSES.map((status) => `${countOf(status)} ${status}`).join(', ');

	const metrics: CensusMetric[] = [
		{
			key: 'total',
			label: 'Work packages',
			value: total,
			whatItMeasures:
				'The number of work-package directories carrying a spec.md -- every feature effort the platform has scoped, at any lifecycle status.',
			whyItMatters:
				'This is the size of the planned-feature backlog plus everything already shipped. It is the denominator for every process question on the roadmap.',
			whatToDo: {
				text: 'See the roadmap for the actionable process view -- what is blocked, what is next.',
				href: ROUTES.HANGAR_ROADMAP,
			},
		},
		{
			key: 'open',
			label: 'Open work packages',
			value: `${open} / ${total}`,
			whatItMeasures:
				'How many work packages are still open -- draft, signed-off, or in-flight -- as opposed to shipped, abandoned, or superseded.',
			whyItMatters:
				'Open WPs are the live commitment surface: work that is planned or under way and still owed. A large open count against a small in-flight count signals a backlog that is queued but not moving.',
			whatToDo: {
				text: 'Triage and sequence open work packages on the roadmap dashboard.',
				href: ROUTES.HANGAR_ROADMAP,
			},
		},
		{
			key: 'in-flight',
			label: 'In-flight work packages',
			value: inFlight,
			whatItMeasures:
				'How many work packages are at status `in-flight` -- actively being built right now, not merely planned.',
			whyItMatters:
				"In-flight count is the platform's real concurrency. A high number means attention is split across many efforts; a low one against a large backlog means most planned work is stalled.",
			whatToDo: {
				text: 'Review in-flight work and its blockers on the roadmap.',
				href: ROUTES.HANGAR_ROADMAP,
			},
		},
		{
			key: 'shipped',
			label: 'Shipped work packages',
			value: `${shipped} / ${total}`,
			whatItMeasures:
				'How many work packages have reached status `shipped` -- delivered, reviewed, and signed off by the user.',
			whyItMatters:
				'Shipped count is delivered scope. Tracked against the total it shows how much of the planned platform actually exists versus how much is still ahead.',
			whatToDo: {
				text: 'The shipped transition is user-controlled; see the roadmap for sign-off state.',
				href: ROUTES.HANGAR_ROADMAP,
			},
		},
		{
			key: 'status-breakdown',
			label: 'Status distribution',
			value: statusBreakdown,
			whatItMeasures:
				'The full count of work packages at each lifecycle status -- draft, signed-off, in-flight, shipped, abandoned, superseded.',
			whyItMatters:
				'The shape of the distribution is the health of the pipeline: many drafts and few shipped means a planning-heavy phase; the reverse means a delivery-heavy one. Abandoned and superseded counts show how much scope was reconsidered.',
			whatToDo: {
				text: 'The roadmap renders this distribution as an actionable board with per-WP detail.',
				href: ROUTES.HANGAR_ROADMAP,
			},
		},
		{
			key: 'unparseable',
			label: 'Unparseable specs',
			value: unparseable,
			whatItMeasures:
				'How many work-package spec.md files carry no frontmatter, or a status the ADR-025 enum does not recognise.',
			whyItMatters:
				'An unparseable spec is invisible to every status-driven view -- the roadmap cannot place it, the lint cannot validate it. It is a work package the tracking system effectively cannot see.',
			whatToDo: {
				text: 'Fix the frontmatter of any unparseable spec so it carries a valid ADR-025 status block.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/025-wp-frontmatter-contract/decision.md'),
			},
		},
	];

	return {
		id: 'work-packages',
		label: 'Work packages',
		whatItIs:
			'Feature work packages -- one spec.md per scoped feature effort, carrying an ADR-025 frontmatter status block. Process metadata also surfaced on the roadmap dashboard.',
		whyItExists:
			'A work package is how a feature moves from a vision document to shipped code: spec, tasks, test plan, and a status that the roadmap tracks. This census reports the content-side fact; the roadmap is the process view.',
		location: `${WP_DIR}/<slug>/${WP_SPEC_FILE}`,
		mode: 'census',
		stateRule:
			'A work package\'s derived state is its frontmatter `status` read straight from spec.md -- draft, signed-off, in-flight, shipped, abandoned, or superseded. A spec with no valid frontmatter status derives "unparseable".',
		docs: WORK_PACKAGE_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('Work packages'),
	};
}
