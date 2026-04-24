/**
 * Translate a raw hangar /glossary FormData into the shape expected by
 * `ReferenceForm` (for re-render on validation error) and by
 * `registry.createReference` / `updateReference` (on success).
 *
 * Split out of the route files so create + edit share one parser and
 * one validation pipeline.
 */

import type { z } from 'zod';
import {
	type FieldErrors,
	getAll,
	getOptionalString,
	getString,
	splitCommaList,
	zodIssuesToFieldErrors,
} from './form-helpers';
import type { ReferenceFormInitial } from './reference-form-types';
import type { ReferenceInput } from './registry';
import { referenceSchema } from './schemas';

export function formDataToInitial(form: FormData): ReferenceFormInitial {
	return {
		id: getString(form, 'id'),
		displayName: getString(form, 'displayName'),
		paraphrase: getString(form, 'paraphrase'),
		aliasesText: getString(form, 'aliases'),
		keywordsText: getString(form, 'keywords'),
		sourceType: getString(form, 'sourceType'),
		aviationTopic: getAll(form, 'aviationTopic'),
		flightRules: getString(form, 'flightRules'),
		knowledgeKind: getString(form, 'knowledgeKind'),
		phaseOfFlight: getAll(form, 'phaseOfFlight'),
		certApplicability: getAll(form, 'certApplicability'),
		relatedText: getString(form, 'related'),
		citationsJson: getString(form, 'citations') || '[]',
		author: getString(form, 'author'),
		reviewedAt: getString(form, 'reviewedAt'),
	};
}

/** Parse the raw citations JSON textarea into a normalized list. */
export function parseCitations(raw: string): {
	citations: ReferenceInput['sources'];
	error: string | null;
} {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return { citations: [], error: null };
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return { citations: [], error: 'Citations must be valid JSON' };
	}
	if (!Array.isArray(parsed)) {
		return { citations: [], error: 'Citations must be a JSON array' };
	}
	const out: {
		sourceId: string;
		locator: Record<string, string | number>;
		url?: string;
	}[] = [];
	for (const [idx, entry] of parsed.entries()) {
		if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
			return { citations: [], error: `Citation at position ${idx} must be an object` };
		}
		const record = entry as Record<string, unknown>;
		const sourceId = typeof record.sourceId === 'string' ? record.sourceId.trim() : '';
		if (!sourceId) {
			return { citations: [], error: `Citation ${idx}: sourceId is required` };
		}
		const locator =
			record.locator && typeof record.locator === 'object' && !Array.isArray(record.locator)
				? (record.locator as Record<string, unknown>)
				: {};
		const locatorNormalized: Record<string, string | number> = {};
		for (const [k, v] of Object.entries(locator)) {
			if (typeof v === 'string') locatorNormalized[k] = v;
			else if (typeof v === 'number' && Number.isFinite(v)) locatorNormalized[k] = v;
		}
		const url = typeof record.url === 'string' ? record.url.trim() : undefined;
		out.push({
			sourceId,
			locator: locatorNormalized,
			url: url && url.length > 0 ? url : undefined,
		});
	}
	return { citations: out, error: null };
}

export interface ValidatedReference {
	ok: true;
	input: ReferenceInput;
}

export interface ReferenceValidationFailure {
	ok: false;
	errors: FieldErrors;
}

export function validateReferenceForm(form: FormData): ValidatedReference | ReferenceValidationFailure {
	const initial = formDataToInitial(form);

	const aliases = splitCommaList(initial.aliasesText);
	const keywords = splitCommaList(initial.keywordsText);
	const related = splitCommaList(initial.relatedText);

	const { citations, error: citationError } = parseCitations(initial.citationsJson);
	if (citationError) {
		return { ok: false, errors: { fieldErrors: { sources: citationError }, formError: null } };
	}

	const candidate = {
		id: initial.id,
		displayName: initial.displayName,
		paraphrase: initial.paraphrase,
		aliases,
		tags: {
			sourceType: initial.sourceType,
			aviationTopic: initial.aviationTopic,
			flightRules: initial.flightRules,
			knowledgeKind: initial.knowledgeKind,
			phaseOfFlight: initial.phaseOfFlight,
			certApplicability: initial.certApplicability,
			keywords,
		},
		sources: citations.map((c) => ({ ...c })),
		related,
		author: getOptionalString(form, 'author'),
		reviewedAt: getOptionalString(form, 'reviewedAt'),
	};

	const parsed = referenceSchema.safeParse(candidate);
	if (!parsed.success) {
		return { ok: false, errors: zodIssuesToFieldErrors(parsed.error) };
	}
	// Zod typing widens the enum fields; re-cast to the domain shape.
	const input = parsed.data as unknown as z.infer<typeof referenceSchema> & ReferenceInput;
	return { ok: true, input };
}
