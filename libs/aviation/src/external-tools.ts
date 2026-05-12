/**
 * Curated list of off-platform web tools the palette surfaces in the
 * External Tools column.
 *
 * Two tiers (Decision #2 of `docs/work-packages/command-palette/spec.md`):
 *   - `validated` -- FAA / industry standard. Trusted by default. Adding a
 *     row requires a PR; intentional friction.
 *   - `community` -- broader / unofficial. Useful but caveat the user.
 *
 * Both tiers are visible by default; `kind:web` shows both,
 * `kind:web.validated` narrows to the trusted tier.
 */

export type WebToolTier = 'validated' | 'community';

export interface ExternalTool {
	readonly id: string;
	readonly label: string;
	readonly url: string;
	readonly tier: WebToolTier;
	readonly description: string;
	/** Keywords for matching beyond label / description. */
	readonly keywords: readonly string[];
}

export const EXTERNAL_TOOLS: readonly ExternalTool[] = [
	// --- Validated tier ---
	{
		id: 'web-aviationweather-gov',
		label: 'aviationweather.gov',
		url: 'https://aviationweather.gov',
		tier: 'validated',
		description: 'NWS Aviation Weather Center -- official weather products (METAR, TAF, AIRMET, SIGMET).',
		keywords: ['weather', 'wx', 'metar', 'taf', 'airmet', 'sigmet', 'awc', 'nws'],
	},
	{
		id: 'web-1800wxbrief',
		label: '1800wxbrief.com',
		url: 'https://www.1800wxbrief.com',
		tier: 'validated',
		description: 'Leidos Flight Service -- official VFR / IFR briefings, flight plans, NOTAMs.',
		keywords: ['weather', 'wx', 'briefing', 'brief', 'flight plan', 'notam', 'leidos', 'fss'],
	},
	{
		id: 'web-faa-notams',
		label: 'faa.gov/notams',
		url: 'https://notams.aim.faa.gov',
		tier: 'validated',
		description: 'FAA NOTAM Search -- official Notices to Air Missions.',
		keywords: ['notam', 'notams', 'faa'],
	},
	{
		id: 'web-skyvector',
		label: 'skyvector.com',
		url: 'https://skyvector.com',
		tier: 'validated',
		description: 'SkyVector -- VFR / IFR charts, flight planning.',
		keywords: ['charts', 'sectional', 'low', 'high', 'planning', 'route'],
	},
	// --- Community tier ---
	{
		id: 'web-foreflight',
		label: 'foreflight.com',
		url: 'https://foreflight.com',
		tier: 'community',
		description: 'ForeFlight -- commercial EFB.',
		keywords: ['efb', 'foreflight', 'app'],
	},
	{
		id: 'web-windy',
		label: 'windy.com',
		url: 'https://www.windy.com',
		tier: 'community',
		description: 'Windy.com -- consumer weather visualisation (ECMWF / GFS models).',
		keywords: ['weather', 'wx', 'model', 'ecmwf', 'gfs'],
	},
	{
		id: 'web-ventusky',
		label: 'ventusky.com',
		url: 'https://www.ventusky.com',
		tier: 'community',
		description: 'Ventusky -- consumer weather visualisation.',
		keywords: ['weather', 'wx', 'model'],
	},
];

/** Lookup map for explicit-id access. */
const BY_ID = new Map(EXTERNAL_TOOLS.map((t) => [t.id, t]));

export function getExternalToolById(id: string): ExternalTool | undefined {
	return BY_ID.get(id);
}

/**
 * Lowercase substring match over label + description + keywords. Tier order
 * (validated first) is preserved in the source array; callers can re-sort.
 */
export function findExternalTools(query: string): readonly ExternalTool[] {
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) return EXTERNAL_TOOLS;
	const out: ExternalTool[] = [];
	for (const tool of EXTERNAL_TOOLS) {
		const haystack = `${tool.label} ${tool.description} ${tool.keywords.join(' ')}`.toLowerCase();
		if (haystack.includes(needle)) out.push(tool);
	}
	return out;
}
