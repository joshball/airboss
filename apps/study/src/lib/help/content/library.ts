/**
 * Library help page.
 *
 * Covers `/library` -- the subject-grouped browse over every reference
 * (FAA handbooks, CFRs, ACs, ACS / PTS, AIM, PCG, NTSB, POH, other).
 * Replaced the flat `/handbooks` index in feat/library-rename. The
 * `/handbooks` route 308-redirects to `/library` so older bookmarks
 * keep working.
 */

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const library: HelpPage = {
	id: 'library',
	title: 'Library',
	summary:
		'Browse every reference (handbooks, CFRs, ACs, ACS, AIM, PCG, ...) grouped by subject. Read FAA handbooks in-app; external references open in a new tab.',
	documents: ROUTES.LIBRARY,
	tags: {
		appSurface: [APP_SURFACES.LIBRARY],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: [
			'library',
			'references',
			'handbook',
			'phak',
			'afh',
			'avwx',
			'cfr',
			'advisory circular',
			'acs',
			'aim',
			'pcg',
			'subject',
		],
	},
	related: ['knowledge-graph', 'lens', 'getting-started'],
	reviewedAt: '2026-04-30',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `The Library is the single browse surface for every authoritative reference airboss knows about: FAA handbooks (PHAK, AFH, AvWX, IFH, ...), 14 CFR + 49 CFR parts, advisory circulars, ACS / PTS, AIM, the Pilot/Controller Glossary, NTSB report archive, and POH / AFM.

References are grouped by **subject** (Aerodynamics, Weather, Regulations, ADM, Airspace, Navigation, ...), not by publisher format. A handbook about weather and an AC about weather sit side-by-side in the Weather group; the publisher format is a chip on the card, not a section heading.`,
		},
		{
			id: 'in-app-vs-external',
			title: 'Read in-app vs. external links',
			body: `Two card variants live in the Library:

- **Read in-app** -- a handbook with sections ingested into airboss (PHAK, AFH, AvWX today; CFRs / ACs are coming). The card shows a progress bar (read / reading / unread). Click opens the in-app reader at \`/library/<doc>/...\`.
- **External** -- everything not yet ingested. The card has an external-link icon and opens the canonical FAA / eCFR URL in a new tab. The URL is built from a single helper (\`externalUrlForReference\`) so a CFR slug like \`14cfr91\` always resolves to the right eCFR page; if a kind has no stable deep link, the YAML \`url\` field is the fallback.

Whether a card is "in-app" or "external" is a runtime check on whether section rows exist for that reference. When a CFR or AC is later ingested, its card flips automatically -- no code change.`,
		},
		{
			id: 'filters',
			title: 'Filters and grouping',
			body: `The chip strip above the list has two filters:

- **State** -- All / Read in-app / External. Narrows to one card variant.
- **Kind** -- multi-select chips for handbook, CFR, AC, ACS, PTS, AIM, PCG, NTSB, POH, other. Pick any combination.

Both filters write to the URL (\`?state=in-app&kind=cfr,ac\`), so a filtered view is shareable and survives reload.

Subject groups are collapsible \`<details>\`. Open / closed state persists in localStorage under \`library:expanded-subjects\`. Defaults: any subject containing an in-app handbook is expanded; everything else is collapsed.`,
		},
		{
			id: 'subjects',
			title: 'Subjects',
			body: `Each reference carries 1-3 subjects from the **AVIATION_TOPICS** vocabulary in \`libs/constants/src/reference-tags.ts\` (Regulations, Weather, Navigation, Communications, Airspace, Aerodynamics, Performance, Weight & Balance, Aircraft Systems, Flight Instruments, Procedures, Human Factors, Medical, Certification, Maintenance, Airports, Emergencies, Training & Ops).

A reference appears in every group whose subject it carries. PHAK is broad enough to land in Aerodynamics + Aircraft Systems + Weather; AC 60-22 (ADM) lives only in Human Factors. Cross-listing is intentional: it surfaces references near where you'd actually look for them.

Subjects are authored on every reference YAML entry under \`course/references/\` and on each ingested handbook's \`manifest.json\`. The seed validates that every reference has 1-3 valid subjects -- a typo fails the build.`,
		},
		{
			id: 'where-data-lives',
			title: 'Where the data lives',
			body: `- **Reference rows** -- one per \`(document_slug, edition)\` in \`study.reference\`. Authored under \`course/references/*.yaml\` (CFR / AC / ACS / AIM / PCG / NTSB / POH / other) plus the per-handbook \`manifest.json\` under \`handbooks/<doc>/<edition>/\`.
- **Handbook section rows** -- one per chapter / section / subsection in \`study.handbook_section\`. Seeded from the markdown tree under \`handbooks/<doc>/<edition>/\`.
- **External URLs** -- a single helper \`externalUrlForReference(kind, slug, edition, fallbackUrl)\` builds them from \`CITATION_URL_TEMPLATES\` in \`libs/constants/src/study.ts\`. YAML \`url:\` fields are fallbacks; never inline a URL string in component code.

Add a new reference: drop a YAML entry under \`course/references/\` with \`slug\`, \`kind\`, \`edition\`, \`title\`, \`subjects\`, optional \`url\`. Run \`bun run db seed references\`. The card shows up in the Library on next page load.`,
		},
	],
};
