/**
 * Credentials help page.
 *
 * Covers the cert-dashboard surface (ADR 016 phase 7): the index of
 * credentials, the per-cert detail page, and the per-Area drill. Explains
 * the mastery vs coverage distinction, the prereq DAG model, and the
 * edition pin behaviour.
 */

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const credentials: HelpPage = {
	id: 'credentials',
	title: 'Credentials',
	summary:
		'How the cert dashboard surfaces mastery and coverage across the certs, ratings, and endorsements you target -- including how prereqs compose and what edition pinning means.',
	documents: ROUTES.CREDENTIALS,
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
	related: ['knowledge-graph', 'getting-started'],
	reviewedAt: '2026-04-28',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `The credentials surface is the per-cert dashboard. Every active credential you target (private, instrument, commercial, CFI, CFII, MEI, multi-engine, endorsements, ...) shows up as a card on the index. Each card shows mastery and coverage rolled up across the credential's primary syllabus.

This page explains:

- The three surfaces (index, detail, area drill).
- What mastery and coverage mean, and why they're different.
- How prereqs compose -- CFII isn't "after CFI", it's CFI plus Instrument plus its own PTS.
- What "edition pinning" does and when to use it.`,
		},
		{
			id: 'index',
			title: 'The index page',
			body: `\`/credentials\` lists every active credential in the database. When you have a primary goal set, credentials referenced by that goal are sorted to the top and tagged with a Primary goal badge. Without a primary goal, every active credential is shown and a banner reminds you to set one.

Each card shows:

- The credential title (e.g. Private Pilot Certificate).
- The credential kind (pilot certificate, instructor certificate, rating, endorsement).
- Category and class when applicable (airplane, ASEL, AMEL, ...).
- Mastery percentage and coverage percentage (see below for the difference).
- Total leaves -- the number of K/R/S elements in the primary syllabus.

Click a card to drill into the detail page.`,
		},
		{
			id: 'detail',
			title: 'The detail page',
			body: `\`/credentials/<slug>\` is the per-credential detail. Header shows the credential title, kind, and category/class. The mastery rollup shows three numbers (mastery, coverage, total leaves). Below the rollup is the area list -- one row per ACS Area of Operation.

The detail page also shows:

- Immediate prereqs (one hop). For PPL: empty. For CFII: CFI + IR (both required).
- A collapsed "Supplemental syllabi" disclosure when the credential has alternate syllabi (school curricula, custom).
- An edition-pin banner when \`?edition=<slug>\` is active.`,
		},
		{
			id: 'area-drill',
			title: 'The area drill',
			body: `\`/credentials/<slug>/areas/<areaCode>\` opens one Area of Operation. The page lists every Task in that Area and expands inline to show the K/R/S elements within each Task.

Each element shows:

- The element code (e.g. V.A.K1).
- The triad badge -- knowledge (K), risk_management (R), or skill (S).
- The element title and description.
- Linked knowledge nodes (jump-to-learn buttons) when authored.
- Citations from the syllabus -- references to the FAA wording that backs the element.`,
		},
		{
			id: 'mastery-vs-coverage',
			title: 'Mastery vs coverage',
			body: `Two numbers, two meanings:

- **Coverage** = covered leaves / total leaves. "I have touched this many of the leaves." A leaf is covered when you have any cards or reps recorded against the linked knowledge nodes.
- **Mastery** = mastered leaves / total leaves. "I have demonstrated mastery on this many." A leaf is mastered when every linked knowledge node clears its mastery gates.

A 90%-mastered cert at 30% coverage reads "expert at the third you've studied; two-thirds untouched". A 30%-mastered cert at 90% coverage reads "broadly studied but not yet drilled". The two numbers track different progress dimensions; both matter.`,
		},
		{
			id: 'prereqs',
			title: 'How prereqs compose',
			body: `Prereqs are a DAG, not a line. CFII isn't "after CFI" -- it's CFI plus Instrument Rating plus its own PTS. MEI is CFI plus a multi-engine class rating. Endorsements (complex, high-performance, tailwheel, ...) are separate credentials with their own one-hop prereqs.

The detail page shows immediate prereqs only. Required prereqs gate the credential; recommended prereqs are FAA-suggested but not regulatory. To trace the full chain (e.g. CFII -> CFI -> Commercial -> Private), click each prereq in turn -- you walk one hop at a time.`,
		},
		{
			id: 'edition-pin',
			title: 'Edition pinning',
			body: `When the FAA publishes a new ACS edition, the underlying syllabus row is added (not edited in place). A learner mid-prep on the older edition wants their syllabus tree, mastery state, and citations to stay consistent against that edition.

\`?edition=<slug>\` pins the page to a specific syllabus edition. The edition slug is the syllabus row's \`slug\` field (e.g. \`ppl-acs-25\`). The pin survives navigation within the credential and is signalled by a banner with a "Switch to current" affordance.

Pin only when you actually need to. Default behaviour resolves the credential's primary syllabus's current active edition.`,
		},
		{
			id: 'empty-states',
			title: 'Empty states',
			body: `Several states render explicit empty messaging rather than blank pages:

- **No active credentials.** "No credentials are seeded as active." Run \`bun run db seed credentials\` if you're a developer.
- **No primary syllabus.** "Syllabus not yet authored." ACS / PTS / endorsement transcription is iterative human work per ADR 016 phase 10.
- **Primary syllabus exists but no Areas.** "No areas yet." The syllabus is registered but no Areas of Operation are transcribed.
- **Area exists but no tasks.** "No tasks authored." The Area row is in the tree but no tasks have been imported.
- **Element has no linked nodes.** "No knowledge nodes linked yet." The leaf is in the syllabus but no \`syllabus_node_link\` rows exist.

Each empty state preserves navigation -- the surrounding header, breadcrumbs, and other panels render normally.`,
		},
	],
};
