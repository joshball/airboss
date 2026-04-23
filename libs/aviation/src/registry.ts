/**
 * In-memory `Reference` registry.
 *
 * References are TypeScript data objects authored in
 * `libs/aviation/src/references/*.ts` and merged into a single registry at
 * module-load time via `registerReferences()`. The registry builds three
 * lookup maps:
 *
 *   - `byId` -- exact-id resolution (drives `[[::id]]` wiki-link resolution)
 *   - `byTerm` -- lower-cased displayName + aliases -> Reference (drives
 *     `[[Text::]]` fuzzy-match + glossary search by term)
 *   - `byTag` -- per-axis inverted index for facet filtering
 *
 * Since Phase 1 ships no references, everything starts empty. Phase 2 will
 * call `registerReferences(AVIATION_REFERENCES)` during module bootstrap so
 * consumers see a populated registry. Phase 1 `/glossary` reads the empty
 * registry and renders an empty state.
 *
 * The registry is a module-global singleton. Tests reset via
 * `__resetRegistryForTests()` (intentionally prefixed to discourage runtime
 * use).
 */

import type {
	AviationTopic,
	CertApplicability,
	FlightRules,
	KnowledgeKind,
	ReferencePhaseOfFlight,
	ReferenceSourceType,
} from '@ab/constants';
import type { Reference } from './schema/reference';

// -------- storage --------

const byIdMap = new Map<string, Reference>();
const byTermMap = new Map<string, Reference>();

const byTagMaps = {
	sourceType: new Map<ReferenceSourceType, Set<string>>(),
	aviationTopic: new Map<AviationTopic, Set<string>>(),
	flightRules: new Map<FlightRules, Set<string>>(),
	knowledgeKind: new Map<KnowledgeKind, Set<string>>(),
	phaseOfFlight: new Map<ReferencePhaseOfFlight, Set<string>>(),
	certApplicability: new Map<CertApplicability, Set<string>>(),
} as const;

function indexByTag<K>(map: Map<K, Set<string>>, key: K, id: string): void {
	const bucket = map.get(key);
	if (bucket) bucket.add(id);
	else map.set(key, new Set([id]));
}

function normalizeTerm(value: string): string {
	return value.trim().toLowerCase();
}

// -------- register + reset --------

/**
 * Register a batch of references. Idempotent on exact-equal references but
 * throws on a genuine duplicate id (two objects sharing an id). Call from
 * the `references/` module's top-level so registry is populated before any
 * route load runs.
 */
export function registerReferences(refs: readonly Reference[]): void {
	for (const ref of refs) {
		const existing = byIdMap.get(ref.id);
		if (existing && existing !== ref) {
			throw new Error(`registerReferences: duplicate id '${ref.id}'`);
		}
		byIdMap.set(ref.id, ref);

		byTermMap.set(normalizeTerm(ref.displayName), ref);
		for (const alias of ref.aliases) {
			byTermMap.set(normalizeTerm(alias), ref);
		}

		indexByTag(byTagMaps.sourceType, ref.tags.sourceType, ref.id);
		indexByTag(byTagMaps.flightRules, ref.tags.flightRules, ref.id);
		indexByTag(byTagMaps.knowledgeKind, ref.tags.knowledgeKind, ref.id);
		for (const topic of ref.tags.aviationTopic) {
			indexByTag(byTagMaps.aviationTopic, topic, ref.id);
		}
		if (ref.tags.phaseOfFlight) {
			for (const phase of ref.tags.phaseOfFlight) {
				indexByTag(byTagMaps.phaseOfFlight, phase, ref.id);
			}
		}
		if (ref.tags.certApplicability) {
			for (const cert of ref.tags.certApplicability) {
				indexByTag(byTagMaps.certApplicability, cert, ref.id);
			}
		}
	}
}

/**
 * Reset the registry. Tests only -- runtime code should never call this.
 */
export function __resetRegistryForTests(): void {
	byIdMap.clear();
	byTermMap.clear();
	for (const map of Object.values(byTagMaps)) {
		map.clear();
	}
}

// -------- lookup API --------

export function getReferenceById(id: string): Reference | undefined {
	return byIdMap.get(id);
}

export function getReferenceByTerm(term: string): Reference | undefined {
	return byTermMap.get(normalizeTerm(term));
}

export function hasReference(id: string): boolean {
	return byIdMap.has(id);
}

/** All references in the registry, iteration order is registration order. */
export function listReferences(): readonly Reference[] {
	return Array.from(byIdMap.values());
}

export function countReferences(): number {
	return byIdMap.size;
}

export interface TagQuery {
	sourceType?: ReferenceSourceType;
	aviationTopic?: readonly AviationTopic[];
	flightRules?: FlightRules;
	knowledgeKind?: KnowledgeKind;
	phaseOfFlight?: readonly ReferencePhaseOfFlight[];
	certApplicability?: readonly CertApplicability[];
}

/**
 * AND-filter references across axes. Multi-valued axes (aviationTopic,
 * phaseOfFlight, certApplicability) are themselves ANDed: every listed
 * value must appear on the reference. Leave a key undefined to skip that
 * axis.
 */
export function findByTags(query: TagQuery): readonly Reference[] {
	const candidateSets: ReadonlySet<string>[] = [];
	if (query.sourceType) {
		const set = byTagMaps.sourceType.get(query.sourceType);
		if (!set) return [];
		candidateSets.push(set);
	}
	if (query.flightRules) {
		const set = byTagMaps.flightRules.get(query.flightRules);
		if (!set) return [];
		candidateSets.push(set);
	}
	if (query.knowledgeKind) {
		const set = byTagMaps.knowledgeKind.get(query.knowledgeKind);
		if (!set) return [];
		candidateSets.push(set);
	}

	if (query.aviationTopic) {
		for (const topic of query.aviationTopic) {
			const set = byTagMaps.aviationTopic.get(topic);
			if (!set) return [];
			candidateSets.push(set);
		}
	}
	if (query.phaseOfFlight) {
		for (const phase of query.phaseOfFlight) {
			const set = byTagMaps.phaseOfFlight.get(phase);
			if (!set) return [];
			candidateSets.push(set);
		}
	}
	if (query.certApplicability) {
		for (const cert of query.certApplicability) {
			const set = byTagMaps.certApplicability.get(cert);
			if (!set) return [];
			candidateSets.push(set);
		}
	}

	if (candidateSets.length === 0) return listReferences();

	// Intersect the smallest set against the rest -- fewer misses, early exit.
	const sorted = [...candidateSets].sort((a, b) => a.size - b.size);
	const seed = sorted[0];
	if (!seed) return [];

	const rest = sorted.slice(1);
	const result: Reference[] = [];
	for (const id of seed) {
		let match = true;
		for (const set of rest) {
			if (!set.has(id)) {
				match = false;
				break;
			}
		}
		if (match) {
			const ref = byIdMap.get(id);
			if (ref) result.push(ref);
		}
	}
	return result;
}

export interface SearchQuery {
	/** Plain-text haystack; matches displayName + aliases + keywords. */
	text?: string;
	tags?: TagQuery;
}

/**
 * A single ranked search hit. Carries match provenance so the UI can render
 * highlight marks and show the user which field matched.
 */
export interface SearchHit {
	reference: Reference;
	matchedField: 'displayName' | 'alias' | 'keyword';
	/** The actual alias / keyword that hit (or displayName when field is displayName). */
	matchedText: string;
	/** [start, end) offsets into matchedText where the needle matched. */
	matchRange: readonly [number, number];
	score: number;
}

/**
 * Word-boundary prefix: needle appears at the start of `haystack`, or
 * immediately after a non-word character.
 */
function wordBoundaryIndex(haystack: string, needle: string): number {
	if (needle.length === 0) return -1;
	let from = 0;
	while (from <= haystack.length - needle.length) {
		const idx = haystack.indexOf(needle, from);
		if (idx === -1) return -1;
		const prev = idx === 0 ? '' : haystack.charAt(idx - 1);
		if (idx === 0 || /[^a-z0-9]/i.test(prev)) return idx;
		from = idx + 1;
	}
	return -1;
}

interface Scored {
	hit: SearchHit;
	order: number;
}

/**
 * Score a single reference against a lowercased needle. Returns the best
 * (highest-score) hit for that reference, or `null` if no field matched.
 *
 * Scoring tiers (see work package):
 *   100 displayName exact, 90 alias exact, 80 displayName word-boundary
 *   prefix, 70 alias word-boundary prefix, 50 displayName substring, 40
 *   alias substring at word boundary, 30 alias substring mid-word, 20
 *   keyword substring.
 */
function scoreReference(ref: Reference, needle: string): SearchHit | null {
	let best: SearchHit | null = null;
	const consider = (candidate: SearchHit): void => {
		if (!best || candidate.score > best.score) best = candidate;
	};

	const displayLower = ref.displayName.toLowerCase();
	if (displayLower === needle) {
		consider({
			reference: ref,
			matchedField: 'displayName',
			matchedText: ref.displayName,
			matchRange: [0, ref.displayName.length],
			score: 100,
		});
	} else {
		const wb = wordBoundaryIndex(displayLower, needle);
		if (wb === 0 || wb > 0) {
			consider({
				reference: ref,
				matchedField: 'displayName',
				matchedText: ref.displayName,
				matchRange: [wb, wb + needle.length],
				score: 80,
			});
		} else {
			const idx = displayLower.indexOf(needle);
			if (idx !== -1) {
				consider({
					reference: ref,
					matchedField: 'displayName',
					matchedText: ref.displayName,
					matchRange: [idx, idx + needle.length],
					score: 50,
				});
			}
		}
	}

	for (const alias of ref.aliases) {
		const aliasLower = alias.toLowerCase();
		if (aliasLower === needle) {
			consider({
				reference: ref,
				matchedField: 'alias',
				matchedText: alias,
				matchRange: [0, alias.length],
				score: 90,
			});
			continue;
		}
		const wb = wordBoundaryIndex(aliasLower, needle);
		if (wb !== -1) {
			const score = wb === 0 ? 70 : 40;
			consider({
				reference: ref,
				matchedField: 'alias',
				matchedText: alias,
				matchRange: [wb, wb + needle.length],
				score,
			});
			continue;
		}
		const idx = aliasLower.indexOf(needle);
		if (idx !== -1) {
			consider({
				reference: ref,
				matchedField: 'alias',
				matchedText: alias,
				matchRange: [idx, idx + needle.length],
				score: 30,
			});
		}
	}

	const keywords = ref.tags.keywords;
	if (keywords) {
		for (const keyword of keywords) {
			const keywordLower = keyword.toLowerCase();
			const idx = keywordLower.indexOf(needle);
			if (idx !== -1) {
				consider({
					reference: ref,
					matchedField: 'keyword',
					matchedText: keyword,
					matchRange: [idx, idx + needle.length],
					score: 20,
				});
			}
		}
	}

	return best;
}

/**
 * Combined text + tag search. Text match scores across
 * displayName/aliases/keywords and returns hits sorted by score descending,
 * with shorter displayName and earlier registration as tiebreakers. Tag
 * filter applied before scoring. When no text is supplied, every tag-filtered
 * reference is returned as a bucket-3 SearchHit carrying the displayName as
 * matched text (so UI consumers can treat the shape uniformly).
 */
export function search(query: SearchQuery): readonly SearchHit[] {
	const tagFiltered = query.tags ? findByTags(query.tags) : listReferences();
	const text = query.text?.trim() ?? '';

	if (text.length === 0) {
		return tagFiltered.map((ref) => ({
			reference: ref,
			matchedField: 'displayName' as const,
			matchedText: ref.displayName,
			matchRange: [0, 0] as const,
			score: 0,
		}));
	}

	const needle = text.toLowerCase();
	const scored: Scored[] = [];
	tagFiltered.forEach((ref, order) => {
		const hit = scoreReference(ref, needle);
		if (hit) scored.push({ hit, order });
	});

	scored.sort((a, b) => {
		if (b.hit.score !== a.hit.score) return b.hit.score - a.hit.score;
		const nameDiff = a.hit.reference.displayName.length - b.hit.reference.displayName.length;
		if (nameDiff !== 0) return nameDiff;
		return a.order - b.order;
	});

	return scored.map((s) => s.hit);
}

/** Count per axis value for facet-sidebar rendering. */
export function axisCounts(): {
	sourceType: Readonly<Record<string, number>>;
	aviationTopic: Readonly<Record<string, number>>;
	flightRules: Readonly<Record<string, number>>;
	knowledgeKind: Readonly<Record<string, number>>;
	phaseOfFlight: Readonly<Record<string, number>>;
	certApplicability: Readonly<Record<string, number>>;
} {
	function countMap<K extends string>(map: Map<K, Set<string>>): Record<string, number> {
		const out: Record<string, number> = {};
		for (const [key, set] of map) {
			out[key] = set.size;
		}
		return out;
	}
	return {
		sourceType: countMap(byTagMaps.sourceType),
		aviationTopic: countMap(byTagMaps.aviationTopic),
		flightRules: countMap(byTagMaps.flightRules),
		knowledgeKind: countMap(byTagMaps.knowledgeKind),
		phaseOfFlight: countMap(byTagMaps.phaseOfFlight),
		certApplicability: countMap(byTagMaps.certApplicability),
	};
}
