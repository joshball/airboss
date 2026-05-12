/**
 * Pure-data yaml-cards parser used by `seed-cards.ts`.
 *
 * Extracted into its own module so the parser can be unit-tested without
 * pulling in the seed orchestrator's bun-only filesystem helpers
 * (`import { Glob } from 'bun'`) and DB-touching `@ab/bc-study/server`
 * surface. This module's only runtime dependencies are `yaml` and the
 * type-only `@ab/constants` enums; the seeder composes this parser with
 * the bun glob walk and the DB writer.
 *
 * Per the card-question-tier WP, the parser accepts three optional
 * fields beyond the core (front/back/cardType/kind/tags):
 *
 * - `question_tier:` -- audience tier (`faa-written` | `cfi-essential` | `both`)
 * - `source_authority:` -- array of `{kind, cite}` objects
 * - `acs_codes:` -- array of ACS task-element code strings
 *
 * Per-field error messages include the relpath + index of the offending
 * yaml-cards entry so authoring slips fail loud at seed time with a
 * clear pointer.
 */

import {
	ACS_CODE_PATTERN,
	ACS_CODES_MAX_PER_CARD,
	CARD_KIND_VALUES,
	CARD_KINDS,
	CARD_TYPES,
	type CardKind,
	QUESTION_TIER_VALUES,
	type QuestionTier,
	SOURCE_AUTHORITY_CITE_MAX_LENGTH,
	SOURCE_AUTHORITY_KIND_VALUES,
	SOURCE_AUTHORITY_MAX_PER_CARD,
	type SourceAuthority,
	type SourceAuthorityKind,
} from '@ab/constants';
import { parse as parseYaml } from 'yaml';

export interface ParsedCard {
	front: string;
	back: string;
	cardType: string;
	/**
	 * Knowledge-axis kind (recall vs calculation). yaml-cards authors that
	 * leave the field unset land in `recall`; explicit `kind: calculation`
	 * flips a card into the calculation partition for mastery aggregation
	 * (evidence-kind-data-layer WP).
	 */
	kind: CardKind;
	tags: string[];
	/** Audience tier (card-question-tier WP). null = unclassified. */
	questionTier: QuestionTier | null;
	/** Structured citations (card-question-tier WP). null = none authored. */
	sourceAuthority: SourceAuthority[] | null;
	/** ACS task-element codes (card-question-tier WP). null = no ACS mapping. */
	acsCodes: string[] | null;
}

const YAML_CARDS_FENCE = /^```yaml-cards\s*$/;
const FENCE_CLOSE = /^```\s*$/;

const cardTypeSet = new Set<string>(Object.values(CARD_TYPES));
const cardKindSet = new Set<string>(CARD_KIND_VALUES);
const questionTierSet = new Set<string>(QUESTION_TIER_VALUES);
const sourceAuthorityKindSet = new Set<string>(SOURCE_AUTHORITY_KIND_VALUES);

/**
 * Pull the optional `question_tier:` field from a yaml-cards entry.
 * Returns `null` when omitted; throws with a per-card path when the
 * value is present but not in `QUESTION_TIER_VALUES`.
 */
export function parseQuestionTier(rec: Record<string, unknown>, relPath: string, j: number): QuestionTier | null {
	const raw = rec.question_tier;
	if (raw === undefined || raw === null) return null;
	if (typeof raw !== 'string' || !questionTierSet.has(raw)) {
		throw new Error(
			`${relPath}: yaml-cards[${j}].question_tier '${String(raw)}' is not in QUESTION_TIER_VALUES (${[...questionTierSet].join(', ')})`,
		);
	}
	return raw as QuestionTier;
}

/**
 * Pull the optional `source_authority:` array from a yaml-cards entry.
 * Each element must be an object with `kind` (in
 * `SOURCE_AUTHORITY_KIND_VALUES`) and a non-empty trimmed `cite` string
 * bounded by `SOURCE_AUTHORITY_CITE_MAX_LENGTH`. Returns `null` when
 * omitted.
 */
export function parseSourceAuthority(
	rec: Record<string, unknown>,
	relPath: string,
	j: number,
): SourceAuthority[] | null {
	const raw = rec.source_authority;
	if (raw === undefined || raw === null) return null;
	if (!Array.isArray(raw)) {
		throw new Error(`${relPath}: yaml-cards[${j}].source_authority must be an array of {kind, cite} objects`);
	}
	if (raw.length > SOURCE_AUTHORITY_MAX_PER_CARD) {
		throw new Error(
			`${relPath}: yaml-cards[${j}].source_authority has ${raw.length} entries; maximum is ${SOURCE_AUTHORITY_MAX_PER_CARD}`,
		);
	}
	const out: SourceAuthority[] = [];
	for (let k = 0; k < raw.length; k++) {
		const entry = raw[k];
		if (typeof entry !== 'object' || entry === null) {
			throw new Error(`${relPath}: yaml-cards[${j}].source_authority[${k}] must be an object`);
		}
		const e = entry as Record<string, unknown>;
		const kind = e.kind;
		const cite = e.cite;
		if (typeof kind !== 'string' || !sourceAuthorityKindSet.has(kind)) {
			throw new Error(
				`${relPath}: yaml-cards[${j}].source_authority[${k}].kind '${String(kind)}' is not in SOURCE_AUTHORITY_KIND_VALUES (${[...sourceAuthorityKindSet].join(', ')})`,
			);
		}
		if (typeof cite !== 'string' || cite.trim() === '') {
			throw new Error(`${relPath}: yaml-cards[${j}].source_authority[${k}].cite must be a non-empty string`);
		}
		const trimmed = cite.trim();
		if (trimmed.length > SOURCE_AUTHORITY_CITE_MAX_LENGTH) {
			throw new Error(
				`${relPath}: yaml-cards[${j}].source_authority[${k}].cite is ${trimmed.length} chars; maximum is ${SOURCE_AUTHORITY_CITE_MAX_LENGTH}`,
			);
		}
		out.push({ kind: kind as SourceAuthorityKind, cite: trimmed });
	}
	return out;
}

/**
 * Pull the optional `acs_codes:` array from a yaml-cards entry. Each
 * element must match `ACS_CODE_PATTERN` (e.g. `PA.I.C.K2a`). Returns
 * `null` when omitted.
 */
export function parseAcsCodes(rec: Record<string, unknown>, relPath: string, j: number): string[] | null {
	const raw = rec.acs_codes;
	if (raw === undefined || raw === null) return null;
	if (!Array.isArray(raw)) {
		throw new Error(`${relPath}: yaml-cards[${j}].acs_codes must be an array of code strings`);
	}
	if (raw.length > ACS_CODES_MAX_PER_CARD) {
		throw new Error(
			`${relPath}: yaml-cards[${j}].acs_codes has ${raw.length} entries; maximum is ${ACS_CODES_MAX_PER_CARD}`,
		);
	}
	const out: string[] = [];
	for (let k = 0; k < raw.length; k++) {
		const entry = raw[k];
		if (typeof entry !== 'string') {
			throw new Error(`${relPath}: yaml-cards[${j}].acs_codes[${k}] must be a string`);
		}
		const trimmed = entry.trim();
		if (!ACS_CODE_PATTERN.test(trimmed)) {
			throw new Error(
				`${relPath}: yaml-cards[${j}].acs_codes[${k}] '${trimmed}' does not match ACS_CODE_PATTERN (e.g. PA.I.C.K2a)`,
			);
		}
		out.push(trimmed);
	}
	return out;
}

/**
 * Parse all yaml-cards fenced blocks out of a node.md body. `relPath`
 * is used only in error messages; pass the path of the source file so
 * authoring slips surface with a clear pointer.
 */
export function extractCardsFromBody(body: string, relPath: string): ParsedCard[] {
	const lines = body.split(/\r?\n/);
	const cards: ParsedCard[] = [];
	let i = 0;
	while (i < lines.length) {
		if (!YAML_CARDS_FENCE.test(lines[i])) {
			i++;
			continue;
		}
		const start = i + 1;
		let end = start;
		while (end < lines.length && !FENCE_CLOSE.test(lines[end])) end++;
		const block = lines.slice(start, end).join('\n');
		const parsed = parseYaml(block);
		if (!Array.isArray(parsed)) {
			throw new Error(`${relPath}: yaml-cards block did not parse to an array`);
		}
		for (let j = 0; j < parsed.length; j++) {
			const entry = parsed[j];
			if (typeof entry !== 'object' || entry === null) {
				throw new Error(`${relPath}: yaml-cards[${j}] is not an object`);
			}
			const rec = entry as Record<string, unknown>;
			if (typeof rec.front !== 'string' || rec.front.trim() === '') {
				throw new Error(`${relPath}: yaml-cards[${j}].front is required`);
			}
			if (typeof rec.back !== 'string' || rec.back.trim() === '') {
				throw new Error(`${relPath}: yaml-cards[${j}].back is required`);
			}
			const cardType = typeof rec.cardType === 'string' ? rec.cardType : CARD_TYPES.BASIC;
			if (!cardTypeSet.has(cardType)) {
				throw new Error(`${relPath}: yaml-cards[${j}].cardType '${cardType}' is not in CARD_TYPES`);
			}
			// yaml-cards `kind:` is optional; default to recall (the dominant
			// knowledge axis on PPL-flavored content). Explicit `kind: calculation`
			// flips the card into the calculation partition.
			const rawKind = typeof rec.kind === 'string' ? rec.kind : CARD_KINDS.RECALL;
			if (!cardKindSet.has(rawKind)) {
				throw new Error(`${relPath}: yaml-cards[${j}].kind '${rawKind}' is not in CARD_KIND_VALUES`);
			}
			const kind = rawKind as CardKind;
			const tags: string[] = [];
			if (Array.isArray(rec.tags)) {
				for (const tag of rec.tags) {
					if (typeof tag === 'string' && tag.trim() !== '') tags.push(tag.trim());
				}
			}
			const questionTier = parseQuestionTier(rec, relPath, j);
			const sourceAuthority = parseSourceAuthority(rec, relPath, j);
			const acsCodes = parseAcsCodes(rec, relPath, j);
			cards.push({
				front: rec.front.trim(),
				back: rec.back.trim(),
				cardType,
				kind,
				tags,
				questionTier,
				sourceAuthority,
				acsCodes,
			});
		}
		i = end + 1;
	}
	return cards;
}
