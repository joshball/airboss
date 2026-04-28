/**
 * Dev demo route for the ADR 019 Phase 4 renderer.
 *
 * Loads three fixture lessons (happy-path, adjacency, acknowledgment), runs
 * each through the render pipeline at the requested mode (default `web`,
 * override via `?mode=`), and returns the data for the page component.
 *
 * Fixture priming: the route primes a small synthetic `SOURCES` table so the
 * demo works without requiring `bun run cfr-ingest` to have populated the
 * registry. Production lesson rendering uses the real registry; this is a
 * dev surface only (lives under `(dev)/`, not in the app shell).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUERY_PARAMS } from '@ab/constants';
import type { LessonAcknowledgment, RenderMode, SerializableResolvedMap, SourceEntry, SourceId } from '@ab/sources';
import { __sources_internal__ } from '@ab/sources/registry';
import { parse as parseYaml } from 'yaml';
import { loadLessonReferences } from '$lib/server/references';
import type { PageServerLoad } from './$types';

// ---------------------------------------------------------------------------
// Fixture entries -- primed once at module load
// ---------------------------------------------------------------------------

interface FixtureEntry {
	readonly id: string;
	readonly corpus: string;
	readonly canonical_short: string;
	readonly canonical_formal: string;
	readonly canonical_title: string;
	readonly last_amended_date: string;
	readonly superseded_by?: string;
}

const FIXTURE_ENTRIES: readonly FixtureEntry[] = [
	{
		id: 'airboss-ref:regs/cfr-14/91/103',
		corpus: 'regs',
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: '2009-08-21',
	},
	{
		id: 'airboss-ref:regs/cfr-14/91/167',
		corpus: 'regs',
		canonical_short: '§91.167',
		canonical_formal: '14 CFR § 91.167',
		canonical_title: 'Fuel requirements for flight in IFR conditions',
		last_amended_date: '2009-08-21',
	},
	{
		id: 'airboss-ref:regs/cfr-14/91/168',
		corpus: 'regs',
		canonical_short: '§91.168',
		canonical_formal: '14 CFR § 91.168',
		canonical_title: '[Reserved]',
		last_amended_date: '1989-08-18',
	},
	{
		id: 'airboss-ref:regs/cfr-14/91/169',
		corpus: 'regs',
		canonical_short: '§91.169',
		canonical_formal: '14 CFR § 91.169',
		canonical_title: 'IFR flight plan: Information required',
		last_amended_date: '2009-08-21',
	},
	{
		id: 'airboss-ref:regs/cfr-14/91/171',
		corpus: 'regs',
		canonical_short: '§91.171',
		canonical_formal: '14 CFR § 91.171',
		canonical_title: 'VOR equipment check for IFR operations',
		last_amended_date: '2009-08-21',
	},
	{
		id: 'airboss-ref:interp/chief-counsel/walker-2017',
		corpus: 'interp',
		canonical_short: 'Walker (2017)',
		canonical_formal: 'Chief Counsel, Walker letter (2017)',
		canonical_title: 'Walker -- active investigation standard',
		last_amended_date: '2017-01-15',
		superseded_by: 'airboss-ref:interp/chief-counsel/smith-2030',
	},
	{
		id: 'airboss-ref:interp/chief-counsel/smith-2030',
		corpus: 'interp',
		canonical_short: 'Smith (2030)',
		canonical_formal: 'Chief Counsel, Smith letter (2030)',
		canonical_title: 'Smith -- narrows Walker scope',
		last_amended_date: '2030-04-12',
	},
];

let primed = false;
function ensurePrimed(): void {
	if (primed) return;
	const table = __sources_internal__.getActiveTable();
	const next: Record<SourceId, SourceEntry> = { ...table };
	for (const e of FIXTURE_ENTRIES) {
		const id = e.id as SourceId;
		if (next[id] !== undefined) continue;
		next[id] = {
			id,
			corpus: e.corpus,
			canonical_short: e.canonical_short,
			canonical_formal: e.canonical_formal,
			canonical_title: e.canonical_title,
			last_amended_date: new Date(e.last_amended_date),
			superseded_by: e.superseded_by as SourceId | undefined,
			lifecycle: 'accepted',
		};
	}
	__sources_internal__.setActiveTable(next);
	primed = true;
}

// ---------------------------------------------------------------------------
// Lesson loading
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixtures');

interface LoadedFixture {
	readonly slug: string;
	readonly title: string;
	readonly body: string;
	readonly resolved: SerializableResolvedMap;
	readonly mode: RenderMode;
}

interface FixtureFrontmatter {
	readonly title?: string;
	readonly historical_lens?: boolean;
	readonly acknowledgments?: readonly LessonAcknowledgment[];
}

function splitFrontmatter(source: string): { frontmatter: FixtureFrontmatter; body: string } {
	if (!source.startsWith('---\n')) {
		return { frontmatter: {}, body: source };
	}
	const close = source.indexOf('\n---', 4);
	if (close === -1) return { frontmatter: {}, body: source };
	const yaml = source.slice(4, close);
	const body = source.slice(close + 4).replace(/^\n/, '');
	const parsed = parseYaml(yaml) as FixtureFrontmatter | null;
	return { frontmatter: parsed ?? {}, body };
}

async function loadFixture(slug: string, mode: RenderMode): Promise<LoadedFixture> {
	const path = join(FIXTURE_DIR, `${slug}.md`);
	const source = readFileSync(path, 'utf-8');
	const { frontmatter, body } = splitFrontmatter(source);
	const acks = frontmatter.acknowledgments ?? [];
	const lensFlag = frontmatter.historical_lens === true;
	const out = await loadLessonReferences(body, acks, { historicalLens: lensFlag, mode });
	return {
		slug,
		title: frontmatter.title ?? slug,
		body: out.body,
		resolved: out.resolved,
		mode: out.mode,
	};
}

// ---------------------------------------------------------------------------
// Page load
// ---------------------------------------------------------------------------

const SUPPORTED_MODES: readonly RenderMode[] = [
	'web',
	'plain-text',
	'print',
	'tts',
	'screen-reader',
	'rss',
	'share-card',
	'rag',
	'slack-unfurl',
	'transclusion',
	'tooltip',
];

function pickMode(raw: string | null): RenderMode {
	if (raw === null) return 'web';
	for (const mode of SUPPORTED_MODES) {
		if (mode === raw) return mode;
	}
	return 'web';
}

export const load: PageServerLoad = async ({ url }) => {
	ensurePrimed();
	const mode = pickMode(url.searchParams.get(QUERY_PARAMS.MODE));
	const slugs = ['happy-path', 'adjacency', 'acknowledgment'];
	const fixtures = await Promise.all(slugs.map((slug) => loadFixture(slug, mode)));
	return {
		fixtures,
		mode,
		modes: SUPPORTED_MODES,
	};
};
