/**
 * Library help page.
 *
 * Covers `/library` -- the subject-grouped browse over every reference
 * (FAA handbooks, CFRs, ACs, ACS / PTS, AIM, PCG, NTSB, POH, other).
 * Replaced the flat `/handbooks` index in feat/library-rename. The
 * `/handbooks` route 308-redirects to `/library` so older bookmarks
 * keep working.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const libraryIndex: HelpPageIndex = {
	id: 'library',
	title: 'Library',
	summary:
		'Browse every reference (handbooks, CFRs, ACs, ACS, AIM, PCG, ...) grouped by subject. Read FAA handbooks in-app; external references open in a new tab.',
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
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'in-app-vs-external', title: 'Read in-app vs. external links' },
		{ id: 'filters', title: 'Filters and grouping' },
		{ id: 'subjects', title: 'Subjects' },
		{ id: 'where-data-lives', title: 'Where the data lives' },
	],
	searchHaystack:
		'browse every reference (handbooks, cfrs, acs, acs, aim, pcg, ...) grouped by subject. read faa handbooks in-app; external references open in a new tab. the library is the single browse surface for every authoritative reference airboss knows about: faa handbooks (phak, afh, avwx, ifh, ...), 14 cfr + 49 cfr parts, advisory circulars, acs / pts, aim, the pilot/controller glossary, ntsb report archive, and poh / afm.\n\nreferences are grouped by **subject** (aerodynamics, weather, regulations, adm, airspace, navigation, ...), not by publisher format. a handbook about weather and an ac about weather sit side-by-side in the weather group; the publisher format is a chip on the card, not a section heading. two card variants live in the library:\n\n- **read in-app** -- a handbook with sections ingested into airboss (phak, afh, avwx today; cfrs / acs are coming). the card shows a progress bar (read / reading / unread). click opens the in-app reader at `/library/<doc>/...`.\n- **external** -- everything not yet ingested. the card has an external-link icon and opens the canonical faa / ecfr url in a new tab. the url is built from a single helper (`externalurlforreference`) so a cfr slug like `14cfr91` always resolves to the right ecfr page; if a kind has no stable deep link, the yaml `url` field is the fallback.\n\nwhether a card is "in-app" or "external" is a runtime check on whether section rows exist for that reference. when a cfr or ac is later ingested, its card flips automatically -- no code change. the chip strip above the list has two filters:\n\n- **state** -- all / read in-app / external. narrows to one card variant.\n- **kind** -- multi-select chips for handbook, cfr, ac, acs, pts, aim, pcg, ntsb, poh, other. pick any combination.\n\nboth filters write to the url (`?state=in-app&kind=cfr,ac`), so a filtered view is shareable and survives reload.\n\nsubject groups are collapsible `<details>`. open / closed state persists in localstorage under `library:expanded-subjects`. defaults: any subject containing an in-app handbook is expanded; everything else is collapsed. each reference carries 1-3 subjects from the **aviation_topics** vocabulary in `libs/constants/src/reference-tags.ts` (regulations, weather, navigation, communications, airspace, aerodynamics, performance, weight & balance, aircraft systems, flight instruments, procedures, human factors, medical, certification, maintenance, airports, emergencies, training & ops).\n\na reference appears in every group whose subject it carries. phak is broad enough to land in aerodynamics + aircraft systems + weather; ac 60-22 (adm) lives only in human factors. cross-listing is intentional: it surfaces references near where you\'d actually look for them.\n\nsubjects are authored on every reference yaml entry under `course/references/` and on each ingested handbook\'s `manifest.json`. the seed validates that every reference has 1-3 valid subjects -- a typo fails the build. - **reference rows** -- one per `(document_slug, edition)` in `study.reference`. authored under `course/references/*.yaml` (cfr / ac / acs / aim / pcg / ntsb / poh / other) plus the per-handbook `manifest.json` under `handbooks/<doc>/<edition>/`.\n- **handbook section rows** -- one per chapter / section / subsection in `study.handbook_section`. seeded from the markdown tree under `handbooks/<doc>/<edition>/`.\n- **external urls** -- a single helper `externalurlforreference(kind, slug, edition, fallbackurl)` builds them from `citation_url_templates` in `libs/constants/src/study.ts`. yaml `url:` fields are fallbacks; never inline a url string in component code.\n\nadd a new reference: drop a yaml entry under `course/references/` with `slug`, `kind`, `edition`, `title`, `subjects`, optional `url`. run `bun run db seed references`. the card shows up in the library on next page load. library references handbook phak afh avwx cfr advisory circular acs aim pcg subject',
	documents: '/library',
	related: ['knowledge-graph', 'lens', 'getting-started'],
	reviewedAt: '2026-04-30',
};
