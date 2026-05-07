/**
 * Roadmap (work-package browser) help page.
 *
 * Lands as part of `docs/work-packages/tracking-system-overhaul/spec.md`
 * Phase 8 -- the page covers what `/roadmap` shows, the URL-shareable
 * filter contract, the read-only-by-design rationale, and how to mutate
 * frontmatter via `bun run wp set`.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const roadmapIndex: HelpPageIndex = {
	id: 'roadmap',
	title: 'Roadmap (WP browser)',
	summary: 'Read-only browser of every `docs/work-packages/<slug>/spec.md` frontmatter.',
	tags: {
		appSurface: [APP_SURFACES.HANGAR],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['roadmap', 'work-package', 'wp', 'tracking', 'frontmatter', 'adr-025', 'wp-loader'],
	},
	sections: [
		{ id: 'what-it-shows', title: 'What this surface shows' },
		{ id: 'filters', title: 'Filters live in the URL' },
		{ id: 'why-read-only', title: 'Read-only by design' },
		{ id: 'unparseable', title: 'Unparseable WPs' },
	],
	searchHaystack:
		'read-only browser of every `docs/work-packages/<slug>/spec.md` frontmatter. each row is one work package; click a row to land on `/roadmap/[wp_id]` for the full spec / tasks / test-plan / design / user-stories tabs plus the dependency graph and shipped-pr links.\n\nfrontmatter is the source of truth (per adr 025). the `bun run wp` cli and this surface read the same loader; what you see here is exactly what the lint validates.\n\nevery chip click updates the url search params. copy a url with filters applied, paste it in another tab, and the same view loads. the filterable facets are:\n\n- **product** -- study / hangar / sim / flightbag / avionics / platform / course / none.\n- **category** -- the closed five-value vocab (product / feature / content / docs / platform).\n- **status** -- lifecycle (draft / signed-off / in-flight / shipped / abandoned / superseded).\n- **human review** -- pending / walked / signed-off.\n- **tag** -- free-form authored tags (cross-cutting slices like references or audit).\n\nthe search box narrows the visible rows by id + title substring. search is client-side; the loader returns the full filtered set on each navigation.\n\nphase 8 of the tracking-system-overhaul wp ships the read view only. ui writebacks (status flips, review-status flips) are explicitly out of scope.\n\nto mutate frontmatter, run `bun run wp set` from a terminal. the cli lints every write against the schema, so a broken frontmatter never lands. human_review_status is user-only -- the lint rejects any agent commit that changes that field. see adr 025 for the contract.\n\na wp whose spec.md is missing a frontmatter fence, has an unparseable yaml block, or fails schema validation surfaces in a synthetic unparseable group at the top of the list. the detail page renders any sub-doc bodies that exist plus a per-field validation-error list so the breakage is fixable in one pass.\n\nthe bun run check lint catches the same class of breakage at commit time; this view is the click-through path when you need to investigate one in detail.\n\nroadmap work-package wp tracking frontmatter adr-025 wp-loader',
	documents: '/roadmap',
	reviewedAt: '2026-05-07',
};
