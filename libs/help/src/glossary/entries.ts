/**
 * Glossary entries -- the typed map that backs every "explain everything"
 * surface in the study app (hover tooltips, the right-cluster glossary
 * drawer, the `/reference/glossary` page, the number `?` popovers).
 *
 * One source of truth. The short strings are cheap to load and ride
 * alongside the JS bundle so tooltips have no async cost. Long-form
 * markdown lives in `./content/<key>.md` and is loaded lazily by the
 * drawer + reference page.
 *
 * See [docs/work-packages/study-app-ia-cleanup/design.md](../../../../docs/work-packages/study-app-ia-cleanup/design.md)
 * "Content model -- libs/help/" for the contract.
 */

/** A glossary key (lower-kebab-case) and its short + lazy-loaded long form. */
export interface GlossaryEntry {
	/** Stable lookup key. lower-kebab-case. Never repurposed. */
	key: string;
	/** Display term. Title-cased UI label. */
	term: string;
	/** One-line plain-English definition. Used in tooltips. <= 160 chars. */
	short: string;
	/**
	 * Path-suffix under `./content/` for the long-form markdown body
	 * (without leading slash, with `.md` extension). The `getGlossaryEntry`
	 * loader resolves this at call time.
	 */
	longRef: string;
	/** Other keys that complement this entry. Drives "Related" links. */
	related: ReadonlyArray<string>;
}

/**
 * Seed glossary -- one entry per term in the IA-cleanup spec. Adding a
 * term requires a matching `./content/<key>.md` file; the loader test
 * walks every `longRef` and asserts the file exists.
 */
export const GLOSSARY_ENTRIES: ReadonlyArray<GlossaryEntry> = [
	{
		key: 'cta',
		term: 'CTA',
		short: 'Call-To-Action. The button or link that is the obvious next thing to click on a page.',
		longRef: 'cta.md',
		related: ['ia'],
	},
	{
		key: 'ia',
		term: 'IA',
		short: 'Information Architecture. How the product is organized into pages and sections.',
		longRef: 'ia.md',
		related: ['cta'],
	},
	{
		key: 'bc',
		term: 'BC',
		short: 'Bounded Context (DDD). A backend module that owns one model and its rules.',
		longRef: 'bc.md',
		related: ['goal', 'plan'],
	},
	{
		key: 'qual',
		term: 'Qual',
		short: 'Qualifications -- the certificates you are working toward (PPL, IR, CPL, CFI).',
		longRef: 'qual.md',
		related: ['syllabus', 'goal'],
	},
	{
		key: 'goal',
		term: 'Goal',
		short: 'What slice of study you are focused on right now (e.g. "Pass PPL written by July").',
		longRef: 'goal.md',
		related: ['plan', 'qual', 'syllabus'],
	},
	{
		key: 'plan',
		term: 'Plan',
		short: 'The schedule and session shape for your goal -- how long, how often, what to focus on.',
		longRef: 'plan.md',
		related: ['goal', 'session'],
	},
	{
		key: 'syllabus',
		term: 'Syllabus',
		short: 'An ACS or PTS document. Structured list of areas/tasks/elements published by the FAA.',
		longRef: 'syllabus.md',
		related: ['qual', 'goal'],
	},
	{
		key: 'knowledge-node',
		term: 'Knowledge node',
		short: 'One atomic teachable concept in the airboss knowledge graph.',
		longRef: 'knowledge-node.md',
		related: ['cards', 'syllabus'],
	},
	{
		key: 'cards',
		term: 'Cards',
		short: 'Memory review (spaced repetition). Short-form recall.',
		longRef: 'cards.md',
		related: ['session', 'reps'],
	},
	{
		key: 'reps',
		term: 'Reps',
		short: 'Scenario reps. Decision-making mini-scenarios.',
		longRef: 'reps.md',
		related: ['cards', 'session'],
	},
	{
		key: 'session',
		term: 'Session',
		short: 'One contiguous study sitting. The session engine picks slices from your active plan.',
		longRef: 'session.md',
		related: ['plan', 'cards', 'reps'],
	},
	{
		key: 'domain',
		term: 'Domain',
		short: 'One of the FAA knowledge areas (Weather, Aerodynamics, Navigation, ...).',
		longRef: 'domain.md',
		related: ['plan'],
	},
	{
		key: 'lens',
		term: 'Lens',
		short: 'A reading mode that overlays the handbook with study annotations and citations.',
		longRef: 'lens.md',
		related: ['knowledge-node'],
	},
	{
		key: 'calibration',
		term: 'Calibration',
		short: 'Confidence calibration. How well your "I know this" matches your actual hit rate.',
		longRef: 'calibration.md',
		related: ['cards', 'session'],
	},
	{
		key: 'first-run',
		term: 'First-run',
		short: 'A user with no goal, no plan, no decks, no history.',
		longRef: 'first-run.md',
		related: ['goal'],
	},
	{
		key: 'e2e',
		term: 'E2E',
		short: 'End-to-end test. A Playwright test that drives a real browser through real pages.',
		longRef: 'e2e.md',
		related: ['testid', 'page-anchor'],
	},
	{
		key: 'testid',
		term: 'testid',
		short: 'data-testid="..." -- a stable hook for tests, separate from CSS classes and visible text.',
		longRef: 'testid.md',
		related: ['e2e', 'page-anchor'],
	},
	{
		key: 'page-anchor',
		term: 'Page anchor',
		short: 'The single data-testid="page-anchor" element on each page. Flow tests use it as proof the page rendered.',
		longRef: 'page-anchor.md',
		related: ['e2e', 'testid'],
	},
	{
		key: 'explainer',
		term: 'Explainer',
		short: 'The collapsible "Why am I here?" block at the top of a page.',
		longRef: 'explainer.md',
		related: ['ia'],
	},
	{
		key: 'glossary-drawer',
		term: 'Glossary drawer',
		short: 'A right-cluster ? button that opens the glossary as an overlay.',
		longRef: 'glossary-drawer.md',
		related: ['explainer', 'ia'],
	},
	{
		key: 'surface-analysis-chart',
		term: 'Surface analysis chart',
		short:
			'Hand-drawn synoptic map of surface pressure, fronts, and station observations. Issued every 3 hours by the Weather Prediction Center.',
		longRef: 'surface-analysis-chart.md',
		related: ['knowledge-node'],
	},
	{
		key: 'metar-cloud-cover',
		term: 'METAR cloud cover',
		short: 'METAR sky-cover codes -- FEW, SCT (scattered), BKN (broken), OVC (overcast) -- in eighths of sky covered.',
		longRef: 'metar-cloud-cover.md',
		related: ['ceiling', 'flight-rule-tiers', 'metar-weather-phenomena'],
	},
	{
		key: 'flight-rule-tiers',
		term: 'Flight-rule tiers (VFR / MVFR / IFR / LIFR)',
		short:
			'The four flight-rule categories -- VFR, MVFR, IFR, LIFR -- computed from the more restrictive of ceiling and visibility.',
		longRef: 'flight-rule-tiers.md',
		related: ['ceiling', 'metar-visibility', 'metar-cloud-cover'],
	},
	{
		key: 'ceiling',
		term: 'Ceiling',
		short:
			'Height AGL of the lowest broken or overcast cloud layer (or vertical visibility into an obscuration). Scattered/few do not count.',
		longRef: 'ceiling.md',
		related: ['metar-cloud-cover', 'flight-rule-tiers', 'metar-visibility'],
	},
	{
		key: 'metar-visibility',
		term: 'Visibility (METAR field)',
		short:
			'The surface prevailing visibility reported on a METAR in statute miles -- the reported field, not the broader phenomenon.',
		longRef: 'metar-visibility.md',
		related: ['ceiling', 'flight-rule-tiers', 'metar-weather-phenomena'],
	},
	{
		key: 'metar-weather-phenomena',
		term: 'METAR weather phenomena codes',
		short:
			'Present-weather codes on a METAR -- TSRA, FZRA, SHRA, FG (fog), BR (mist) -- built from intensity + descriptor + phenomenon.',
		longRef: 'metar-weather-phenomena.md',
		related: ['metar-cloud-cover', 'metar-visibility', 'ceiling'],
	},
	{
		key: 'foreflight',
		term: 'ForeFlight',
		short:
			'The most widely used general-aviation electronic flight bag (EFB) app -- charts, planning, weather, in-flight navigation.',
		longRef: 'foreflight.md',
		related: ['garmin-pilot', 'skyvector', 'flight-service-1800wxbrief'],
	},
	{
		key: 'garmin-pilot',
		term: 'Garmin Pilot',
		short:
			"Garmin's electronic flight bag (EFB) app for iOS and Android -- charts, planning, weather, avionics integration.",
		longRef: 'garmin-pilot.md',
		related: ['foreflight', 'skyvector', 'flight-service-1800wxbrief'],
	},
	{
		key: 'skyvector',
		term: 'SkyVector',
		short:
			'A free browser-based flight-planning website -- charts and weather overlay for pre-flight route planning. Not a mobile EFB.',
		longRef: 'skyvector.md',
		related: ['foreflight', 'garmin-pilot', 'flight-service-1800wxbrief'],
	},
	{
		key: 'flight-service-1800wxbrief',
		term: '1800wxbrief / Flight Service',
		short:
			'Leidos Flight Service portal -- the official, logged source for pilot weather briefings and flight-plan filing.',
		longRef: 'flight-service-1800wxbrief.md',
		related: ['foreflight', 'garmin-pilot', 'skyvector'],
	},
	{
		key: 'fiki',
		term: 'FIKI / non-FIKI',
		short:
			'FIKI = Flight Into Known Icing: an aircraft certificated for known-icing operations. Non-FIKI aircraft must avoid icing entirely.',
		longRef: 'fiki.md',
		related: [],
	},
	{
		key: 'cfr',
		term: '14 CFR',
		short: 'Title 14 of the Code of Federal Regulations: the binding aviation rules. "FAR" is the colloquial name.',
		longRef: 'cfr.md',
		related: ['advisory-circular', 'airworthiness-directive', 'aim'],
	},
	{
		key: 'advisory-circular',
		term: 'AC',
		short: 'Advisory Circular. FAA guidance showing one acceptable means of complying with a rule. Not itself binding.',
		longRef: 'advisory-circular.md',
		related: ['cfr', 'aim', 'faa-handbook'],
	},
	{
		key: 'aim',
		term: 'AIM',
		short: "Aeronautical Information Manual. The FAA's operational how-to: procedures, phraseology, hazards. Advisory.",
		longRef: 'aim.md',
		related: ['pcg', 'cfr', 'advisory-circular'],
	},
	{
		key: 'pcg',
		term: 'P/CG',
		short: 'Pilot/Controller Glossary. The shared vocabulary that backs the AIM and ATC phraseology.',
		longRef: 'pcg.md',
		related: ['aim'],
	},
	{
		key: 'acs',
		term: 'ACS',
		short: 'Airman Certification Standards. What a checkride tests, task by task. Replaced the older PTS.',
		longRef: 'acs.md',
		related: ['aim', 'cfr', 'faa-handbook'],
	},
	{
		key: 'faa-handbook',
		term: 'FAA Handbook',
		short: 'The training-depth references: PHAK, AFH, IFH, the Aviation Weather Handbook, and others. Advisory.',
		longRef: 'faa-handbook.md',
		related: ['advisory-circular', 'acs', 'aim'],
	},
	{
		key: 'faa-order',
		term: 'FAA Order',
		short: 'Internal FAA direction (8900.1, JO 7110.65). Binds the agency and its inspectors, not pilots directly.',
		longRef: 'faa-order.md',
		related: ['cfr', 'aim'],
	},
	{
		key: 'tso',
		term: 'TSO',
		short: 'Technical Standard Order. Minimum performance standards an article (avionics, equipment) must meet.',
		longRef: 'tso.md',
		related: ['airworthiness-directive', 'cfr'],
	},
	{
		key: 'airworthiness-directive',
		term: 'AD',
		short: 'Airworthiness Directive. A binding, mandatory corrective action on a specific aircraft or article.',
		longRef: 'airworthiness-directive.md',
		related: ['cfr', 'tso', 'safo'],
	},
	{
		key: 'safo',
		term: 'SAFO',
		short: 'Safety Alert for Operators. A time-sensitive FAA safety message. Advisory but high-priority.',
		longRef: 'safo.md',
		related: ['info', 'airworthiness-directive'],
	},
	{
		key: 'info',
		term: 'InFO',
		short: 'Information for Operators. An FAA notice sharing non-urgent operational information. Advisory.',
		longRef: 'info.md',
		related: ['safo'],
	},
	{
		key: 'notam',
		term: 'NOTAM',
		short: 'Notice to Air Missions. A binding, time-critical notice of a change to the National Airspace System.',
		longRef: 'notam.md',
		related: ['cfr', 'chart-supplement', 'aim'],
	},
	{
		key: 'chart-supplement',
		term: 'Chart Supplement',
		short: 'Airport and facility data, formerly the Airport/Facility Directory. Issued on a 56-day cycle.',
		longRef: 'chart-supplement.md',
		related: ['notam', 'aim'],
	},
];

/** Index keyed by `entry.key` for O(1) lookup. */
export const GLOSSARY_BY_KEY: ReadonlyMap<string, GlossaryEntry> = new Map(GLOSSARY_ENTRIES.map((e) => [e.key, e]));
