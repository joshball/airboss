/**
 * Credentials help page.
 *
 * Covers the cert-dashboard surface (ADR 016 phase 7): the index of
 * credentials, the per-cert detail page, and the per-Area drill. Explains
 * the mastery vs coverage distinction, the prereq DAG model, and the
 * edition pin behaviour.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const credentialsIndex: HelpPageIndex = {
	id: 'credentials',
	title: 'Credentials',
	summary:
		'How the cert dashboard surfaces mastery and coverage across the certs, ratings, and endorsements you target -- including how prereqs compose and what edition pinning means.',
	tags: {
		appSurface: [APP_SURFACES.CREDENTIALS],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: [
			'credentials',
			'cert',
			'rating',
			'endorsement',
			'acs',
			'pts',
			'mastery',
			'coverage',
			'prereq',
			'edition',
		],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'index', title: 'The index page' },
		{ id: 'detail', title: 'The detail page' },
		{ id: 'area-drill', title: 'The area drill' },
		{ id: 'mastery-vs-coverage', title: 'Mastery vs coverage' },
		{ id: 'prereqs', title: 'How prereqs compose' },
		{ id: 'edition-pin', title: 'Edition pinning' },
		{ id: 'empty-states', title: 'Empty states' },
	],
	searchHaystack:
		'how the cert dashboard surfaces mastery and coverage across the certs, ratings, and endorsements you target -- including how prereqs compose and what edition pinning means. the credentials surface is the per-cert dashboard. every active credential you target (private, instrument, commercial, cfi, cfii, mei, multi-engine, endorsements, ...) shows up as a card on the index. each card shows mastery and coverage rolled up across the credential\'s primary syllabus.\n\nthis page explains:\n\n- the three surfaces (index, detail, area drill).\n- what mastery and coverage mean, and why they\'re different.\n- how prereqs compose -- cfii isn\'t "after cfi", it\'s cfi plus instrument plus its own pts.\n- what "edition pinning" does and when to use it. `/credentials` lists every active credential in the database. when you have a primary goal set, credentials referenced by that goal are sorted to the top and tagged with a primary goal badge. without a primary goal, every active credential is shown and a banner reminds you to set one.\n\neach card shows:\n\n- the credential title (e.g. private pilot certificate).\n- the credential kind (pilot certificate, instructor certificate, rating, endorsement).\n- category and class when applicable (airplane, asel, amel, ...).\n- mastery percentage and coverage percentage (see below for the difference).\n- total leaves -- the number of k/r/s elements in the primary syllabus.\n\nclick a card to drill into the detail page. `/credentials/<slug>` is the per-credential detail. header shows the credential title, kind, and category/class. the mastery rollup shows three numbers (mastery, coverage, total leaves). below the rollup is the area list -- one row per acs area of operation.\n\nthe detail page also shows:\n\n- immediate prereqs (one hop). for ppl: empty. for cfii: cfi + ir (both required).\n- a collapsed "supplemental syllabi" disclosure when the credential has alternate syllabi (school curricula, custom).\n- an edition-pin banner when `?edition=<slug>` is active. `/credentials/<slug>/areas/<areacode>` opens one area of operation. the page lists every task in that area and expands inline to show the k/r/s elements within each task.\n\neach element shows:\n\n- the element code (e.g. v.a.k1).\n- the triad badge -- knowledge (k), risk_management (r), or skill (s).\n- the element title and description.\n- linked knowledge nodes (jump-to-learn buttons) when authored.\n- citations from the syllabus -- references to the faa wording that backs the element. two numbers, two meanings:\n\n- **coverage** = covered leaves / total leaves. "i have touched this many of the leaves." a leaf is covered when you have any cards or reps recorded against the linked knowledge nodes.\n- **mastery** = mastered leaves / total leaves. "i have demonstrated mastery on this many." a leaf is mastered when every linked knowledge node clears its mastery gates.\n\na 90%-mastered cert at 30% coverage reads "expert at the third you\'ve studied; two-thirds untouched". a 30%-mastered cert at 90% coverage reads "broadly studied but not yet drilled". the two numbers track different progress dimensions; both matter. prereqs are a dag, not a line. cfii isn\'t "after cfi" -- it\'s cfi plus instrument rating plus its own pts. mei is cfi plus a multi-engine class rating. endorsements (complex, high-performance, tailwheel, ...) are separate credentials with their own one-hop prereqs.\n\nthe detail page shows immediate prereqs only. required prereqs gate the credential; recommended prereqs are faa-suggested but not regulatory. to trace the full chain (e.g. cfii -> cfi -> commercial -> private), click each prereq in turn -- you walk one hop at a time. when the faa publishes a new acs edition, the underlying syllabus row is added (not edited in place). a learner mid-prep on the older edition wants their syllabus tree, mastery state, and citations to stay consistent against that edition.\n\n`?edition=<slug>` pins the page to a specific syllabus edition. the edition slug is the syllabus row\'s `slug` field (e.g. `ppl-acs-25`). the pin survives navigation within the credential and is signalled by a banner with a "switch to current" affordance.\n\npin only when you actually need to. default behaviour resolves the credential\'s primary syllabus\'s current active edition. several states render explicit empty messaging rather than blank pages:\n\n- **no active credentials.** "no credentials are seeded as active." run `bun run db seed credentials` if you\'re a developer.\n- **no primary syllabus.** "syllabus not yet authored." acs / pts / endorsement transcription is iterative human work per adr 016 phase 10.\n- **primary syllabus exists but no areas.** "no areas yet." the syllabus is registered but no areas of operation are transcribed.\n- **area exists but no tasks.** "no tasks authored." the area row is in the tree but no tasks have been imported.\n- **element has no linked nodes.** "no knowledge nodes linked yet." the leaf is in the syllabus but no `syllabus_node_link` rows exist.\n\neach empty state preserves navigation -- the surrounding header, breadcrumbs, and other panels render normally. credentials cert rating endorsement acs pts mastery coverage prereq edition',
	documents: '/credentials',
	related: ['knowledge-graph', 'getting-started'],
	reviewedAt: '2026-04-28',
};
