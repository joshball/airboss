/**
 * TOML codec -- round-trip serialization for `Reference[]` and `Source[]`.
 *
 * Drives the TOML-hybrid content registry: `libs/db/seed/glossary.toml` and
 * `libs/db/seed/sources.toml` are the on-disk authoritative sources, DB
 * tables are the runtime mirror, and `hangar` writes changes back through
 * this codec.
 *
 * Determinism requirements (spec -- hangar-registry):
 *   - Stable key order: fields emitted in the same order every time.
 *   - Stable array order: references/sources sorted by id.
 *   - Deterministic whitespace: no trailing spaces, single blank line
 *     between top-level array-of-tables entries.
 *   - Round-trip byte-identical when the input was produced by a prior
 *     `encode` call (idempotent).
 *
 * Uses `smol-toml` for parsing. Encoding is hand-rolled so we can guarantee
 * key order + section layout (most TOML libs alphabetise keys, which would
 * defeat our "minimal diff" goal).
 */

import { parse as tomlParse } from 'smol-toml';
import type { Reference, VerbatimBlock } from './schema/reference';
import type { Source, SourceCitation } from './schema/source';
import type { ReferenceTags } from './schema/tags';

// -------- encoding --------

/**
 * Escape a string for inclusion in a TOML basic string literal ("..."):
 * quote, backslash, and control characters.
 */
function escapeBasic(value: string): string {
	let out = '';
	for (const ch of value) {
		const code = ch.codePointAt(0) ?? 0;
		if (ch === '"') out += '\\"';
		else if (ch === '\\') out += '\\\\';
		else if (ch === '\b') out += '\\b';
		else if (ch === '\f') out += '\\f';
		else if (ch === '\n') out += '\\n';
		else if (ch === '\r') out += '\\r';
		else if (ch === '\t') out += '\\t';
		else if (code < 0x20 || code === 0x7f) {
			out += `\\u${code.toString(16).padStart(4, '0')}`;
		} else {
			out += ch;
		}
	}
	return out;
}

/**
 * Encode a scalar string as a TOML basic string. Prefer the single-line
 * "..." form; callers who need multiline explicitly use `encodeMultiline`.
 */
function encodeString(value: string): string {
	return `"${escapeBasic(value)}"`;
}

/**
 * Encode a string value as a multiline TOML literal when it contains a
 * newline. Falls back to a single-line basic string otherwise so the diff
 * stays tight on short paraphrases.
 *
 * Multiline basic strings start with `"""` immediately followed by a
 * newline (the leading newline is discarded by the TOML parser). We use
 * basic form rather than literal (triple-single-quote) so `\\`, `\n` and
 * `"` escapes still work.
 */
function encodeMultiline(value: string): string {
	if (!value.includes('\n')) return encodeString(value);
	// Inside a multiline basic string: escape backslashes + quotes, but
	// preserve literal \n so the content reads as the author wrote it.
	const escaped = value.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
	return `"""\n${escaped}"""`;
}

function encodeNumber(value: number): string {
	if (!Number.isFinite(value)) {
		throw new Error(`encodeNumber: non-finite value ${String(value)}`);
	}
	return String(value);
}

function encodeScalar(value: string | number | boolean): string {
	if (typeof value === 'string') return encodeString(value);
	if (typeof value === 'number') return encodeNumber(value);
	return value ? 'true' : 'false';
}

function encodeStringArray(values: readonly string[]): string {
	if (values.length === 0) return '[]';
	return `[${values.map(encodeString).join(', ')}]`;
}

/**
 * Encode a single-depth inline object (used for locators). Values are
 * emitted in the order they appear in the input -- TOML spec says inline
 * tables are unordered but smol-toml preserves insertion order on parse
 * and we preserve it on write.
 */
function encodeInlineObject(value: Readonly<Record<string, string | number>>): string {
	const entries = Object.entries(value);
	if (entries.length === 0) return '{}';
	const rendered = entries.map(([k, v]) => `${k} = ${encodeScalar(v)}`).join(', ');
	return `{ ${rendered} }`;
}

// -------- reference encoding --------

/**
 * Stable field order for the `tags` inline block. Required axes first,
 * conditional + optional axes after, matching the schema's natural reading
 * order. Keywords trail because they're long.
 */
const TAG_KEY_ORDER: readonly (keyof ReferenceTags)[] = [
	'sourceType',
	'aviationTopic',
	'flightRules',
	'knowledgeKind',
	'phaseOfFlight',
	'certApplicability',
	'keywords',
];

function encodeTagsBlock(prefix: string, tags: ReferenceTags): string {
	const lines: string[] = [];
	for (const key of TAG_KEY_ORDER) {
		const value = tags[key];
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			lines.push(`${prefix}.${key} = ${encodeStringArray(value)}`);
		} else {
			lines.push(`${prefix}.${key} = ${encodeString(value as string)}`);
		}
	}
	return lines.join('\n');
}

function encodeVerbatim(prefix: string, verbatim: VerbatimBlock): string {
	const lines: string[] = [
		`[${prefix}]`,
		`text = ${encodeMultiline(verbatim.text)}`,
		`sourceVersion = ${encodeString(verbatim.sourceVersion)}`,
		`extractedAt = ${encodeString(verbatim.extractedAt)}`,
	];
	return lines.join('\n');
}

function encodeCitation(citation: SourceCitation): string {
	const parts: string[] = [
		`sourceId = ${encodeString(citation.sourceId)}`,
		`locator = ${encodeInlineObject(citation.locator)}`,
	];
	if (citation.url !== undefined) parts.push(`url = ${encodeString(citation.url)}`);
	return parts.join('\n');
}

function encodeReference(reference: Reference): string {
	const lines: string[] = [];
	lines.push('[[reference]]');
	lines.push(`id = ${encodeString(reference.id)}`);
	lines.push(`displayName = ${encodeString(reference.displayName)}`);
	lines.push(`aliases = ${encodeStringArray(reference.aliases)}`);
	lines.push(`paraphrase = ${encodeMultiline(reference.paraphrase)}`);
	if (reference.author !== undefined) lines.push(`author = ${encodeString(reference.author)}`);
	if (reference.reviewedAt !== undefined) lines.push(`reviewedAt = ${encodeString(reference.reviewedAt)}`);
	lines.push(`related = ${encodeStringArray(reference.related)}`);

	lines.push('');
	lines.push(encodeTagsBlock('tags', reference.tags));

	if (reference.verbatim !== undefined) {
		lines.push('');
		lines.push(encodeVerbatim('verbatim', reference.verbatim));
	}

	for (const citation of reference.sources) {
		lines.push('');
		lines.push('[[reference.sources]]');
		lines.push(encodeCitation(citation));
	}

	return lines.join('\n');
}

/**
 * Encode an array of references as a deterministic TOML document. Sorted
 * by id ascending. Each reference produces a `[[reference]]` array-of-
 * tables entry.
 */
export function encodeReferences(references: readonly Reference[]): string {
	const sorted = [...references].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const blocks = sorted.map(encodeReference);
	return `${blocks.join('\n\n')}\n`;
}

// -------- source encoding --------

function encodeSource(source: Source): string {
	const lines: string[] = [];
	lines.push('[[source]]');
	lines.push(`id = ${encodeString(source.id)}`);
	lines.push(`type = ${encodeString(source.type)}`);
	lines.push(`title = ${encodeString(source.title)}`);
	lines.push(`version = ${encodeString(source.version)}`);
	lines.push(`format = ${encodeString(source.format)}`);
	lines.push(`path = ${encodeString(source.path)}`);
	lines.push(`url = ${encodeString(source.url)}`);
	lines.push(`downloadedAt = ${encodeString(source.downloadedAt)}`);
	lines.push(`checksum = ${encodeString(source.checksum)}`);
	return lines.join('\n');
}

/**
 * Encode an array of sources as a deterministic TOML document. Sorted by
 * id ascending.
 */
export function encodeSources(sources: readonly Source[]): string {
	const sorted = [...sources].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const blocks = sorted.map(encodeSource);
	return `${blocks.join('\n\n')}\n`;
}

// -------- decoding --------

interface ParsedDocument {
	reference?: unknown[];
	source?: unknown[];
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`toml-codec: expected table at ${where}, got ${typeof value}`);
	}
	return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
	if (typeof value !== 'string') {
		throw new Error(`toml-codec: expected string at ${where}, got ${typeof value}`);
	}
	return value;
}

function asOptionalString(value: unknown, where: string): string | undefined {
	if (value === undefined) return undefined;
	return asString(value, where);
}

function asStringArray(value: unknown, where: string): readonly string[] {
	if (value === undefined) return [];
	if (!Array.isArray(value)) {
		throw new Error(`toml-codec: expected string[] at ${where}, got ${typeof value}`);
	}
	return value.map((v, i) => asString(v, `${where}[${i}]`));
}

function asLocator(value: unknown, where: string): Readonly<Record<string, string | number>> {
	const rec = asRecord(value, where);
	const out: Record<string, string | number> = {};
	for (const [k, v] of Object.entries(rec)) {
		if (typeof v === 'string') {
			out[k] = v;
		} else if (typeof v === 'number' && Number.isFinite(v)) {
			out[k] = v;
		} else if (typeof v === 'bigint') {
			// smol-toml returns integers as bigint; narrow safely.
			if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
				throw new Error(`toml-codec: locator integer out of safe range at ${where}.${k}`);
			}
			out[k] = Number(v);
		} else {
			throw new Error(`toml-codec: locator value must be string or number at ${where}.${k}`);
		}
	}
	return out;
}

function decodeCitation(value: unknown, where: string): SourceCitation {
	const rec = asRecord(value, where);
	const citation: SourceCitation = {
		sourceId: asString(rec.sourceId, `${where}.sourceId`),
		locator: asLocator(rec.locator, `${where}.locator`),
	};
	const url = asOptionalString(rec.url, `${where}.url`);
	if (url !== undefined) return { ...citation, url };
	return citation;
}

function decodeTags(value: unknown, where: string): ReferenceTags {
	const rec = asRecord(value, where);
	const tags: ReferenceTags = {
		sourceType: asString(rec.sourceType, `${where}.sourceType`) as ReferenceTags['sourceType'],
		aviationTopic: asStringArray(rec.aviationTopic, `${where}.aviationTopic`) as ReferenceTags['aviationTopic'],
		flightRules: asString(rec.flightRules, `${where}.flightRules`) as ReferenceTags['flightRules'],
		knowledgeKind: asString(rec.knowledgeKind, `${where}.knowledgeKind`) as ReferenceTags['knowledgeKind'],
	};
	if (rec.phaseOfFlight !== undefined) {
		(tags as Record<string, unknown>).phaseOfFlight = asStringArray(
			rec.phaseOfFlight,
			`${where}.phaseOfFlight`,
		) as ReferenceTags['phaseOfFlight'];
	}
	if (rec.certApplicability !== undefined) {
		(tags as Record<string, unknown>).certApplicability = asStringArray(
			rec.certApplicability,
			`${where}.certApplicability`,
		) as ReferenceTags['certApplicability'];
	}
	if (rec.keywords !== undefined) {
		(tags as Record<string, unknown>).keywords = asStringArray(
			rec.keywords,
			`${where}.keywords`,
		) as ReferenceTags['keywords'];
	}
	return tags;
}

function decodeVerbatim(value: unknown, where: string): VerbatimBlock {
	const rec = asRecord(value, where);
	return {
		text: asString(rec.text, `${where}.text`),
		sourceVersion: asString(rec.sourceVersion, `${where}.sourceVersion`),
		extractedAt: asString(rec.extractedAt, `${where}.extractedAt`),
	};
}

function decodeReference(value: unknown, index: number): Reference {
	const where = `reference[${index}]`;
	const rec = asRecord(value, where);
	const reference: Reference = {
		id: asString(rec.id, `${where}.id`),
		displayName: asString(rec.displayName, `${where}.displayName`),
		aliases: asStringArray(rec.aliases, `${where}.aliases`),
		paraphrase: asString(rec.paraphrase, `${where}.paraphrase`),
		tags: decodeTags(rec.tags, `${where}.tags`),
		sources: Array.isArray(rec.sources) ? rec.sources.map((c, i) => decodeCitation(c, `${where}.sources[${i}]`)) : [],
		related: asStringArray(rec.related, `${where}.related`),
	};
	const author = asOptionalString(rec.author, `${where}.author`);
	if (author !== undefined) (reference as Record<string, unknown>).author = author;
	const reviewedAt = asOptionalString(rec.reviewedAt, `${where}.reviewedAt`);
	if (reviewedAt !== undefined) (reference as Record<string, unknown>).reviewedAt = reviewedAt;
	if (rec.verbatim !== undefined) {
		(reference as Record<string, unknown>).verbatim = decodeVerbatim(rec.verbatim, `${where}.verbatim`);
	}
	return reference;
}

function decodeSource(value: unknown, index: number): Source {
	const where = `source[${index}]`;
	const rec = asRecord(value, where);
	return {
		id: asString(rec.id, `${where}.id`),
		type: asString(rec.type, `${where}.type`) as Source['type'],
		title: asString(rec.title, `${where}.title`),
		version: asString(rec.version, `${where}.version`),
		format: asString(rec.format, `${where}.format`) as Source['format'],
		path: asString(rec.path, `${where}.path`),
		url: asString(rec.url, `${where}.url`),
		downloadedAt: asString(rec.downloadedAt, `${where}.downloadedAt`),
		checksum: asString(rec.checksum, `${where}.checksum`),
	};
}

/**
 * Decode a TOML document into an array of `Reference`. Throws on schema
 * violations (missing required fields, wrong types) but does not apply the
 * full Zod validation -- that lives in the registry loader so the codec
 * can be reused by tooling that wants the raw parse.
 */
export function decodeReferences(toml: string): readonly Reference[] {
	const parsed = tomlParse(toml) as ParsedDocument;
	const raw = parsed.reference ?? [];
	if (!Array.isArray(raw)) {
		throw new Error('toml-codec: expected `reference` to be an array of tables');
	}
	return raw.map((item, i) => decodeReference(item, i));
}

/**
 * Decode a TOML document into an array of `Source`.
 */
export function decodeSources(toml: string): readonly Source[] {
	const parsed = tomlParse(toml) as ParsedDocument;
	const raw = parsed.source ?? [];
	if (!Array.isArray(raw)) {
		throw new Error('toml-codec: expected `source` to be an array of tables');
	}
	return raw.map((item, i) => decodeSource(item, i));
}
