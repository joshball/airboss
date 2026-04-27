/**
 * Serialize / deserialize helpers for SvelteKit transport.
 *
 * SvelteKit's transport between server load and client component is JSON.
 * `Map<string, ResolvedIdentifier>` and `Date` are not JSON-safe; the
 * helpers in this module flatten Maps to Records and ISO-encode Dates,
 * preserving every field's value.
 */

import type {
	ResolvedIdentifier,
	ResolvedIdentifierMap,
	SerializableResolvedIdentifier,
	SerializableResolvedMap,
	SerializableSourceEntry,
	SourceEntry,
} from '../types.ts';

export function toSerializable(map: ResolvedIdentifierMap): SerializableResolvedMap {
	const out: SerializableResolvedMap = {};
	for (const [key, value] of map.entries()) {
		out[key] = serializeOne(value);
	}
	return out;
}

export function fromSerializable(record: SerializableResolvedMap): ResolvedIdentifierMap {
	const out = new Map<string, ResolvedIdentifier>();
	for (const [key, value] of Object.entries(record)) {
		out.set(key, deserializeOne(value));
	}
	return out;
}

function serializeOne(r: ResolvedIdentifier): SerializableResolvedIdentifier {
	return {
		raw: r.raw,
		parsed: r.parsed,
		entry: r.entry === null ? null : serializeEntry(r.entry),
		chain: r.chain.map(serializeEntry),
		liveUrl: r.liveUrl,
		indexed: r.indexed,
		annotation: r.annotation,
	};
}

function deserializeOne(r: SerializableResolvedIdentifier): ResolvedIdentifier {
	return {
		raw: r.raw,
		parsed: r.parsed,
		entry: r.entry === null ? null : deserializeEntry(r.entry),
		chain: r.chain.map(deserializeEntry),
		liveUrl: r.liveUrl,
		indexed: r.indexed,
		annotation: r.annotation,
	};
}

function serializeEntry(e: SourceEntry): SerializableSourceEntry {
	return {
		id: e.id,
		corpus: e.corpus,
		canonical_short: e.canonical_short,
		canonical_formal: e.canonical_formal,
		canonical_title: e.canonical_title,
		last_amended_date: e.last_amended_date.toISOString(),
		alternative_names: e.alternative_names,
		supersedes: e.supersedes,
		superseded_by: e.superseded_by,
		lifecycle: e.lifecycle,
	};
}

function deserializeEntry(e: SerializableSourceEntry): SourceEntry {
	return {
		id: e.id,
		corpus: e.corpus,
		canonical_short: e.canonical_short,
		canonical_formal: e.canonical_formal,
		canonical_title: e.canonical_title,
		last_amended_date: new Date(e.last_amended_date),
		alternative_names: e.alternative_names,
		supersedes: e.supersedes,
		superseded_by: e.superseded_by,
		lifecycle: e.lifecycle,
	};
}
