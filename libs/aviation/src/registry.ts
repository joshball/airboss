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
 * Combined text + tag search. Text match is substring-any of lowercased
 * displayName/aliases/keywords. Tag filter applied after text. Returns in
 * registration order (no ranking in Phase 1 -- that's wp-help-library's
 * problem).
 */
export function search(query: SearchQuery): readonly Reference[] {
	const tagFiltered = query.tags ? findByTags(query.tags) : listReferences();
	if (!query.text || query.text.trim().length === 0) return tagFiltered;

	const needle = query.text.trim().toLowerCase();
	return tagFiltered.filter((ref) => {
		if (ref.displayName.toLowerCase().includes(needle)) return true;
		for (const alias of ref.aliases) {
			if (alias.toLowerCase().includes(needle)) return true;
		}
		const keywords = ref.tags.keywords;
		if (keywords) {
			for (const keyword of keywords) {
				if (keyword.toLowerCase().includes(needle)) return true;
			}
		}
		return false;
	});
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
