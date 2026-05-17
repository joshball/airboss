// @browser-globals: server-only -- never imported by client .svelte
/**
 * The ADRs census adapter -- a Phase-2 Layer-1 adapter.
 *
 * Architecture decision records live under `docs/decisions/`, either as a
 * single `NNN-topic.md` file or a `NNN-topic/decision.md` directory. The
 * unit of this census is the ADR.
 *
 * ADR status is recorded inconsistently across the corpus -- some carry a
 * YAML `status:` frontmatter field, some a `## Status` section, some an
 * inline `Status: Accepted`, some a `(SUPERSEDED)` / `(PARTIALLY
 * SUPERSEDED)` suffix on the H1. The derived-state rule normalises all of
 * these to a single status vocabulary; `unknown` is itself a real finding
 * (the ADR's status cannot be read).
 *
 * This corpus is process metadata that also surfaces on the `/roadmap`
 * dashboard; the census links there for the actionable process view.
 *
 * Gap view / intent view are Phase-3 placeholders (`census` mode).
 *
 * Server-only: reads `node:fs`. Called from `+page.server.ts` and tests.
 */

import { ROUTES } from '@ab/constants';
import type { CensusItem, CensusMetric, CorpusCensus, DocLink } from '../types';
import { layerTwoPending } from './layer-two.server';
import { dirsWithPrefix, fileExists, frontmatterString, listMarkdownFiles, parseMarkdownFile } from './markdown.server';

const DECISIONS_DIR = 'docs/decisions';

/** The normalised ADR status vocabulary the census reports. */
const STATUS_ACCEPTED = 'accepted';
const STATUS_PROPOSED = 'proposed';
const STATUS_SUPERSEDED = 'superseded';
const STATUS_PARTIALLY_SUPERSEDED = 'partially-superseded';
const STATUS_UNKNOWN = 'unknown';

/** An `NNN-topic.md` single-file ADR or an `NNN-topic` directory ADR. */
const ADR_NUMBER_PREFIX = /^\d{3}-/;

const ADR_DOCS: DocLink[] = [
	{
		label: 'Architecture decisions -- README',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/README.md'),
		role: 'The ADR index and the single-file vs directory convention this census walks.',
	},
	{
		label: 'Roadmap -- process dashboard',
		href: ROUTES.HANGAR_ROADMAP,
		role: 'The actionable process view; ADRs are process metadata also surfaced there.',
	},
	{
		label: 'ADR 025 -- Work-package frontmatter contract',
		href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/025-wp-frontmatter-contract/decision.md'),
		role: 'A directory-form ADR carrying a YAML status block -- one of the status shapes this adapter normalises.',
	},
];

/**
 * Normalise an ADR's status from however it is recorded -- frontmatter,
 * a `## Status` section, an inline `Status:` line, or an H1 suffix.
 */
function deriveStatus(frontmatter: Record<string, unknown> | null, body: string): string {
	// 1. YAML frontmatter `status:` (ADRs 011, 016, 018-027).
	const fmStatus = frontmatterString(frontmatter, 'status');
	if (fmStatus !== null) {
		const normalised = classifyStatusWord(fmStatus);
		if (normalised !== STATUS_UNKNOWN) return normalised;
	}

	// 2. H1 suffix: `# 001: App Boundaries (SUPERSEDED)`.
	const h1 = body.match(/^#\s+.*$/m)?.[0] ?? '';
	if (/\(\s*PARTIALLY SUPERSEDED\s*\)/i.test(h1)) return STATUS_PARTIALLY_SUPERSEDED;
	if (/\(\s*SUPERSEDED\s*\)/i.test(h1)) return STATUS_SUPERSEDED;

	// 3. A `## Status` section -- the first non-blank line under the heading.
	const statusSection = body.match(/^##\s+Status\s*\r?\n+([^\r\n]+)/im);
	if (statusSection) {
		const normalised = classifyStatusWord(statusSection[1]);
		if (normalised !== STATUS_UNKNOWN) return normalised;
	}

	// 4. An inline `Status:` / `**Status:**` line anywhere in the body.
	const inline = body.match(/\*{0,2}Status:?\*{0,2}\s*:?\s*\**([A-Za-z` ]+)/m);
	if (inline) {
		const normalised = classifyStatusWord(inline[1]);
		if (normalised !== STATUS_UNKNOWN) return normalised;
	}

	// 5. A bare `Proposed <date>` / `Accepted <date>` / `Decided <date>` line.
	if (/^Proposed\b/im.test(body)) return STATUS_PROPOSED;
	if (/^(Accepted|Decided)\b/im.test(body)) return STATUS_ACCEPTED;

	return STATUS_UNKNOWN;
}

/** Map a free-text status word onto the normalised vocabulary. */
function classifyStatusWord(raw: string): string {
	const text = raw.toLowerCase();
	if (text.includes('partially superseded')) return STATUS_PARTIALLY_SUPERSEDED;
	if (text.includes('superseded')) return STATUS_SUPERSEDED;
	if (text.includes('accepted')) return STATUS_ACCEPTED;
	if (text.includes('proposed')) return STATUS_PROPOSED;
	return STATUS_UNKNOWN;
}

/** One ADR, resolved to a repo-relative markdown path and a display label. */
interface AdrEntry {
	id: string;
	path: string;
}

/** Resolve every ADR to its canonical markdown file (single-file or dir form). */
function resolveAdrs(): AdrEntry[] {
	const entries: AdrEntry[] = [];

	// Single-file ADRs: `docs/decisions/NNN-topic.md`.
	for (const file of listMarkdownFiles(DECISIONS_DIR)) {
		if (!ADR_NUMBER_PREFIX.test(file)) continue;
		entries.push({ id: file.replace(/\.md$/, ''), path: `${DECISIONS_DIR}/${file}` });
	}

	// Directory ADRs: `docs/decisions/NNN-topic/decision.md`.
	for (const dir of dirsWithPrefix(DECISIONS_DIR, '')) {
		if (!ADR_NUMBER_PREFIX.test(dir)) continue;
		const decisionPath = `${DECISIONS_DIR}/${dir}/decision.md`;
		if (fileExists(decisionPath)) {
			entries.push({ id: dir, path: decisionPath });
		}
	}

	return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Build the ADRs census. Resolves every numbered ADR (single-file and
 * directory form), normalises its status from whichever shape it is recorded
 * in, and reports the status distribution.
 */
export function adrsCensus(): CorpusCensus {
	const adrs = resolveAdrs();

	const items: CensusItem[] = [];
	for (const adr of adrs) {
		const { frontmatter, body } = parseMarkdownFile(adr.path);
		const fmTitle = frontmatterString(frontmatter, 'title');
		const h1Title = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
		const label = fmTitle ?? h1Title ?? adr.id;
		const status = deriveStatus(frontmatter, body);
		items.push({
			id: adr.id,
			label,
			derivedState: status,
			detail: `status: ${status}`,
		});
	}

	const total = items.length;
	const countOf = (state: string): number => items.filter((item) => item.derivedState === state).length;
	const accepted = countOf(STATUS_ACCEPTED);
	const proposed = countOf(STATUS_PROPOSED);
	const superseded = countOf(STATUS_SUPERSEDED);
	const partiallySuperseded = countOf(STATUS_PARTIALLY_SUPERSEDED);
	const unknown = countOf(STATUS_UNKNOWN);
	const live = accepted + partiallySuperseded;

	const statusBreakdown = [
		`${accepted} accepted`,
		`${proposed} proposed`,
		`${partiallySuperseded} partially-superseded`,
		`${superseded} superseded`,
		`${unknown} unknown`,
	].join(', ');

	const metrics: CensusMetric[] = [
		{
			key: 'total',
			label: 'ADRs',
			value: total,
			whatItMeasures:
				'The number of numbered architecture decision records under docs/decisions/, counting both single-file and directory-form ADRs.',
			whyItMatters:
				"ADRs are the platform's decision memory. The count is the body of recorded architectural reasoning a new contributor or a future agent can rely on instead of re-deriving it.",
			whatToDo: {
				text: 'Author a new ADR when a decision is non-obvious and worth remembering; see the decisions README.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/README.md'),
			},
		},
		{
			key: 'live',
			label: 'Live ADRs',
			value: `${live} / ${total}`,
			whatItMeasures:
				'How many ADRs are still authoritative -- accepted, or partially superseded (the parts still standing remain binding).',
			whyItMatters:
				'A live ADR is a rule the codebase is expected to follow. This count is the size of the active architectural contract; a contributor should treat every live ADR as current.',
			whatToDo: {
				text: 'Keep live ADRs accurate -- when reality diverges, amend the ADR rather than letting it rot.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/README.md'),
			},
		},
		{
			key: 'proposed',
			label: 'Proposed ADRs',
			value: proposed,
			whatItMeasures:
				'How many ADRs are at status `proposed` -- a decision drafted and awaiting human ratification, not yet binding.',
			whyItMatters:
				'A proposed ADR is a decision in limbo. Code written against it is a bet; until it is accepted, the architecture it describes can still change. A growing proposed count signals ratification is lagging.',
			whatToDo: {
				text: 'Walk proposed ADRs to a decision -- ratify them to accepted, or revise and re-propose.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/README.md'),
			},
		},
		{
			key: 'superseded',
			label: 'Superseded ADRs',
			value: `${superseded + partiallySuperseded} / ${total}`,
			whatItMeasures:
				'How many ADRs are fully or partially superseded -- their decision has been replaced, in whole or in part, by a later ADR or a platform pivot.',
			whyItMatters:
				'A superseded ADR is a trap for a reader who does not notice the marker -- they may follow a rule the platform abandoned. The count shows how much of the decision record is historical rather than current.',
			whatToDo: {
				text: 'Ensure every superseded ADR names its replacement up front so a reader is redirected immediately.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/README.md'),
			},
		},
		{
			key: 'status-breakdown',
			label: 'Status distribution',
			value: statusBreakdown,
			whatItMeasures:
				'The count of ADRs at each normalised status -- accepted, proposed, partially-superseded, superseded, unknown -- after reconciling the several status shapes ADRs use.',
			whyItMatters:
				'The distribution is the health of the decision record: mostly accepted is a stable architecture; many superseded is a record that has been heavily revised; any unknown is a record that cannot be read.',
			whatToDo: {
				text: 'The roadmap surfaces ADR process state alongside work packages.',
				href: ROUTES.HANGAR_ROADMAP,
			},
		},
		{
			key: 'unknown',
			label: 'Unreadable status',
			value: unknown,
			whatItMeasures:
				'How many ADRs record their status in no recognised form -- no frontmatter, no Status section, no inline marker, no H1 suffix.',
			whyItMatters:
				'An ADR with no readable status cannot be triaged. A reader cannot tell whether it is current or abandoned, and no automated view can place it. It is a decision the system cannot account for.',
			whatToDo: {
				text: 'Add an explicit status marker to any ADR reported here -- a frontmatter status or a ## Status section.',
				href: ROUTES.HANGAR_DOCS_PATH('docs/decisions/README.md'),
			},
		},
	];

	return {
		id: 'adrs',
		label: 'ADRs',
		whatItIs:
			'Architecture decision records -- numbered, dated decisions under docs/decisions/, in single-file or directory form. Process metadata also surfaced on the roadmap dashboard.',
		whyItExists:
			"An ADR records why an architectural choice was made so it does not have to be re-litigated. The decision record is the platform's long memory; this census reports how much of it exists and how much is still current.",
		location: `${DECISIONS_DIR}/`,
		mode: 'census',
		stateRule:
			'An ADR\'s derived state is its status, normalised from whichever shape it is recorded in -- frontmatter status, a ## Status section, an inline Status line, or a (SUPERSEDED) / (PARTIALLY SUPERSEDED) H1 suffix. Recognised values: accepted, proposed, superseded, partially-superseded; an unrecognised record derives "unknown".',
		docs: ADR_DOCS,
		items,
		metrics,
		gaps: [],
		next: [],
		layerTwoPending: layerTwoPending('ADRs'),
	};
}
