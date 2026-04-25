/**
 * Deck-spec encoder/decoder + canonical hash for review-sessions-url layer (b)
 * "Redo". A deck spec is the reproducible filter that defines a memory-review
 * run; it travels through the URL as `?deck=<base64url(canonical JSON)>` and
 * is bucketed for analytics + Saved-Decks lookups via an 8-char SHA-1 prefix
 * over the canonical JSON.
 *
 * "Canonical" means the JSON form is independent of input key insertion order
 * and of array order for fields whose ordering is not semantically meaningful
 * (currently only `tags`). Two requests with the same logical filter MUST
 * therefore land on the same `deck_hash` regardless of how they were
 * constructed.
 *
 * See `docs/work-packages/review-sessions-url/spec.md` product decision (2).
 */

import { createHash } from 'node:crypto';
import { DECK_HASH_LENGTH } from '@ab/constants';
import type { ReviewSessionDeckSpec } from './schema';

// ---------- Errors ----------

export class DeckSpecDecodeError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = 'DeckSpecDecodeError';
	}
}

// ---------- Canonical JSON ----------

/**
 * Serialize a deck spec to canonical JSON. Properties are emitted in
 * alphabetical key order, `undefined` fields are dropped, and the only
 * unordered array we currently support (`tags`) is sorted ascending so two
 * inputs with the same set of tags produce the same string.
 *
 * The schema-level `ReviewSessionDeckSpec` shape is open-ended (Layer (a)
 * only required `domain`). This walker handles arbitrary nested objects /
 * arrays so future filter dimensions added to the spec land canonically
 * without code changes here.
 */
function canonicalize(value: unknown, path: readonly string[] = []): unknown {
	if (value === null) return null;
	if (Array.isArray(value)) {
		const items = value.map((item, idx) => canonicalize(item, [...path, String(idx)]));
		// `tags` is the one array whose ordering is not semantic. Other arrays
		// (e.g. an explicit ordered card_id_list, were one to land here) keep
		// their input order.
		const last = path.at(-1);
		if (last === 'tags') {
			return [...items].sort((a, b) => {
				if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
				return 0;
			});
		}
		return items;
	}
	if (typeof value === 'object') {
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj)
			.filter((k) => obj[k] !== undefined)
			.sort();
		const out: Record<string, unknown> = {};
		for (const k of keys) {
			out[k] = canonicalize(obj[k], [...path, k]);
		}
		return out;
	}
	return value;
}

/**
 * Canonical JSON string for a deck spec. Public so tests + callers that need
 * the underlying bytes (e.g. for debug logging) can re-derive them.
 */
export function canonicalDeckSpecJson(spec: ReviewSessionDeckSpec): string {
	return JSON.stringify(canonicalize(spec));
}

// ---------- Public API ----------

/**
 * Encode a deck spec for the `?deck=` query parameter. Output is base64url
 * of the canonical JSON, i.e. URL-safe and free of padding so the value can
 * be dropped into a URL without further escaping.
 */
export function encodeDeckSpec(spec: ReviewSessionDeckSpec): string {
	const json = canonicalDeckSpecJson(spec);
	return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Decode a `?deck=` value back into a deck spec. Throws
 * {@link DeckSpecDecodeError} on malformed base64url / malformed JSON / a
 * top-level value that isn't an object. Callers (the resolver route) should
 * treat that as a 400.
 */
export function decodeDeckSpec(encoded: string): ReviewSessionDeckSpec {
	if (!encoded) {
		throw new DeckSpecDecodeError('Empty deck spec');
	}
	let json: string;
	try {
		json = Buffer.from(encoded, 'base64url').toString('utf8');
	} catch (cause) {
		throw new DeckSpecDecodeError('Deck spec is not valid base64url', cause);
	}
	if (!json) {
		throw new DeckSpecDecodeError('Deck spec decoded to an empty string');
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch (cause) {
		throw new DeckSpecDecodeError('Deck spec is not valid JSON', cause);
	}
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new DeckSpecDecodeError('Deck spec must be a JSON object');
	}
	return parsed as ReviewSessionDeckSpec;
}

/**
 * Deterministic 8-char hash of a deck spec. Two specs that canonicalise to
 * the same JSON land on the same hash regardless of input key order or
 * unordered-array order.
 */
export function computeDeckHash(spec: ReviewSessionDeckSpec): string {
	const canonical = canonicalDeckSpecJson(spec);
	return createHash('sha1').update(canonical).digest('hex').slice(0, DECK_HASH_LENGTH);
}
