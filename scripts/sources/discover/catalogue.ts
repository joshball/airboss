/**
 * Catalogue of FAA aviation handbooks scanned by `bun run sources discover-errata`.
 *
 * Covers all 17 handbooks the FAA publishes today, even though airboss only
 * ingests a subset (PHAK, AFH, AvWX). The discovery scan is cheap (one HTML
 * GET per parent page on a weekly trigger) and the cost of missing a handbook
 * onboarding signal is far higher than the cost of one extra HTTP request.
 *
 * Each entry indicates `actionable` (handbook has an ingestion plugin under
 * `tools/handbook-ingest/ingest/handbooks/<slug>.py`) or `signal-only` (no
 * plugin yet -- discovery flags the URL so we know when to onboard).
 *
 * Sources: cross-referenced against
 *   https://www.faa.gov/regulations_policies/handbooks_manuals/aviation
 * and the per-handbook parent pages indexed there. Last verified 2026-04-28.
 *
 * Future: hangar UI wraps this catalogue via dispatcher; the data is shaped
 * so a future `apps/hangar/` route can render this list as a table.
 */

import { DISCOVERY_TIERS, type DiscoveryTier } from '@ab/constants';

export interface HandbookCatalogueEntry {
	/** Lowercase slug used as the filesystem key (`<cache>/discovery/handbooks/<slug>.json`). */
	readonly slug: string;
	/** Human-readable handbook title. */
	readonly title: string;
	/** FAA publication identifier (`FAA-H-8083-NN`-shape, where stable). */
	readonly docId: string;
	/** Currently published edition tag. */
	readonly currentEdition: string;
	/** Parent page on faa.gov used as the discovery scrape target. */
	readonly parentPageUrl: string;
	/**
	 * `actionable` when airboss has an ingestion plugin for this slug;
	 * `signal-only` when discovery surfaces the artifact but we cannot apply
	 * it until a plugin lands.
	 */
	readonly tier: DiscoveryTier;
	/**
	 * Optional: case-insensitive substring tokens that, when present in a PDF
	 * filename or URL on the parent page, classify the link as a discovery
	 * candidate. Three legacy URL prefixes coexist (see research dossier
	 * Section 2). The scraper matches on either the slug-anchored prefix OR
	 * one of these tokens to survive FAA naming drift.
	 */
	readonly filenameTokens: readonly string[];
}

/**
 * Filename tokens shared by every handbook. The scraper combines per-handbook
 * tokens with these and treats any anchor whose href matches at least one as
 * a candidate worth recording.
 */
export const COMMON_ERRATA_TOKENS: readonly string[] = ['addendum', 'errata', 'change', 'summary_of_changes'];

/**
 * The 17 FAA aviation handbooks. Order is alphabetical by slug; insertion
 * order is preserved when the discovery scan iterates the catalogue.
 */
export const HANDBOOK_CATALOGUE: readonly HandbookCatalogueEntry[] = [
	{
		slug: 'afh',
		title: 'Airplane Flying Handbook',
		docId: 'FAA-H-8083-3',
		currentEdition: 'FAA-H-8083-3C',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
		tier: DISCOVERY_TIERS.ACTIONABLE,
		filenameTokens: ['afh'],
	},
	{
		slug: 'aih',
		title: "Aviation Instructor's Handbook",
		docId: 'FAA-H-8083-9',
		currentEdition: 'FAA-H-8083-9B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['aviation_instructor', 'instructors_handbook', 'aih', '8083-9'],
	},
	{
		slug: 'aim',
		title: 'Aeronautical Information Manual',
		docId: 'AIM',
		currentEdition: 'current',
		parentPageUrl: 'https://www.faa.gov/air_traffic/publications',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['aim'],
	},
	{
		slug: 'amt-airframe',
		title: 'Aviation Maintenance Technician Handbook -- Airframe',
		docId: 'FAA-H-8083-31',
		currentEdition: 'FAA-H-8083-31A',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aircraft/amt_airframe_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['airframe', 'amt', '8083-31'],
	},
	{
		slug: 'amt-general',
		title: 'Aviation Maintenance Technician Handbook -- General',
		docId: 'FAA-H-8083-30',
		currentEdition: 'FAA-H-8083-30B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aircraft/amt_general_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['amt_general', 'amt-general', '8083-30'],
	},
	{
		slug: 'amt-powerplant',
		title: 'Aviation Maintenance Technician Handbook -- Powerplant',
		docId: 'FAA-H-8083-32',
		currentEdition: 'FAA-H-8083-32B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aircraft/amt_powerplant_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['powerplant', '8083-32'],
	},
	{
		slug: 'avwx',
		title: 'Aviation Weather Handbook',
		docId: 'FAA-H-8083-28',
		currentEdition: 'FAA-H-8083-28B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_weather_handbook',
		tier: DISCOVERY_TIERS.ACTIONABLE,
		filenameTokens: ['avwx', 'aviation_weather', '8083-28'],
	},
	{
		slug: 'bfh',
		title: 'Balloon Flying Handbook',
		docId: 'FAA-H-8083-11',
		currentEdition: 'FAA-H-8083-11A',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/balloon_flying_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['balloon', '8083-11'],
	},
	{
		slug: 'gfh',
		title: 'Glider Flying Handbook',
		docId: 'FAA-H-8083-13',
		currentEdition: 'FAA-H-8083-13A',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/glider_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['glider', '8083-13'],
	},
	{
		slug: 'hfh',
		title: 'Helicopter Flying Handbook',
		docId: 'FAA-H-8083-21',
		currentEdition: 'FAA-H-8083-21B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/helicopter_flying_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['helicopter_flying', 'helicopter_handbook', '8083-21'],
	},
	{
		slug: 'ifh',
		title: 'Instrument Flying Handbook',
		docId: 'FAA-H-8083-15',
		currentEdition: 'FAA-H-8083-15B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_flying_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['ifh', 'instrument_flying', '8083-15'],
	},
	{
		slug: 'iph',
		title: 'Instrument Procedures Handbook',
		docId: 'FAA-H-8083-16',
		currentEdition: 'FAA-H-8083-16B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['iph', 'instrument_procedures', '8083-16'],
	},
	{
		slug: 'phak',
		title: "Pilot's Handbook of Aeronautical Knowledge",
		docId: 'FAA-H-8083-25',
		currentEdition: 'FAA-H-8083-25C',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
		tier: DISCOVERY_TIERS.ACTIONABLE,
		filenameTokens: ['phak', '8083-25'],
	},
	{
		slug: 'pphb',
		title: 'Powered Parachute Flying Handbook',
		docId: 'FAA-H-8083-29',
		currentEdition: 'FAA-H-8083-29A',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/powered_parachute_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['powered_parachute', 'ppc_hb', 'ppc-hb', '8083-29'],
	},
	{
		slug: 'rfh',
		title: 'Rotorcraft Flying Handbook',
		docId: 'FAA-H-8083-21',
		currentEdition: 'FAA-H-8083-21A',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/rotorcraft_flying_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['rotorcraft', 'rfh'],
	},
	{
		slug: 'sport-pilot',
		title: 'Light Sport Pilot Handbook',
		docId: 'FAA-H-8083-22',
		currentEdition: 'FAA-H-8083-22',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/sport_pilot_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['sport_pilot', '8083-22'],
	},
	{
		slug: 'wbh',
		title: 'Weight & Balance Handbook',
		docId: 'FAA-H-8083-1',
		currentEdition: 'FAA-H-8083-1B',
		parentPageUrl: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/weight_balance_handbook',
		tier: DISCOVERY_TIERS.SIGNAL_ONLY,
		filenameTokens: ['weight_balance', 'weight-balance', 'wbh', '8083-1'],
	},
];

if (HANDBOOK_CATALOGUE.length !== 17) {
	throw new Error(
		`HANDBOOK_CATALOGUE must contain exactly 17 entries (one per FAA aviation handbook); ` +
			`got ${HANDBOOK_CATALOGUE.length}. Update the catalogue, then update the spec / PR ` +
			`description to match.`,
	);
}

export const ALL_HANDBOOK_SLUGS: readonly string[] = HANDBOOK_CATALOGUE.map((e) => e.slug);

export function getCatalogueEntry(slug: string): HandbookCatalogueEntry | undefined {
	return HANDBOOK_CATALOGUE.find((e) => e.slug === slug);
}
