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
];

/** Index keyed by `entry.key` for O(1) lookup. */
export const GLOSSARY_BY_KEY: ReadonlyMap<string, GlossaryEntry> = new Map(GLOSSARY_ENTRIES.map((e) => [e.key, e]));
