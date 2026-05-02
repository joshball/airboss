/**
 * Parse + validate the raw FormData posted by /glossary/sources forms.
 * Centralised so create + edit share one pipeline.
 */

import { type ReferenceSourceType, SOURCE_KIND_BY_TYPE, SOURCE_KINDS } from '@ab/constants';
import { type OutboundUrlResult, type ValidateOutboundUrlOptions, validateOutboundUrl } from '@ab/utils';
import type { z } from 'zod';
import { type FieldErrors, getString, parseJsonObject, zodIssuesToFieldErrors } from './form-helpers';
import { binaryVisualLocatorSchema, sourceSchema } from './form-schemas';
import type { SourceInput } from './registry';
import type { SourceFormInitial } from './source-form-types';

export function sourceFormDataToInitial(form: FormData): SourceFormInitial {
	return {
		id: getString(form, 'id'),
		type: getString(form, 'type'),
		title: getString(form, 'title'),
		version: getString(form, 'version'),
		url: getString(form, 'url'),
		path: getString(form, 'path'),
		format: getString(form, 'format'),
		checksum: getString(form, 'checksum'),
		downloadedAt: getString(form, 'downloadedAt'),
		sizeBytes: getString(form, 'sizeBytes'),
		locatorShapeJson: getString(form, 'locatorShape') || '{}',
		bvRegion: getString(form, 'bv_region'),
		bvCadenceDays: getString(form, 'bv_cadence_days'),
		bvIndexUrl: getString(form, 'bv_index_url'),
	};
}

export interface ValidatedSource {
	ok: true;
	input: SourceInput;
	locatorShape: Record<string, unknown> | null;
}

export interface SourceValidationFailure {
	ok: false;
	errors: FieldErrors;
}

export function validateSourceForm(form: FormData): ValidatedSource | SourceValidationFailure {
	const initial = sourceFormDataToInitial(form);

	const sizeBytesRaw = initial.sizeBytes.trim();
	let sizeBytes: number | undefined;
	if (sizeBytesRaw.length > 0) {
		const n = Number.parseInt(sizeBytesRaw, 10);
		if (!Number.isFinite(n) || n < 0) {
			return {
				ok: false,
				errors: { fieldErrors: { sizeBytes: 'Size must be a non-negative integer' }, formError: null },
			};
		}
		sizeBytes = n;
	}

	const candidate = {
		id: initial.id,
		type: initial.type,
		title: initial.title,
		version: initial.version,
		url: initial.url,
		path: initial.path,
		format: initial.format,
		checksum: initial.checksum,
		downloadedAt: initial.downloadedAt,
		sizeBytes,
	};

	const parsed = sourceSchema.safeParse(candidate);
	if (!parsed.success) {
		return { ok: false, errors: zodIssuesToFieldErrors(parsed.error) };
	}

	const sourceKind = SOURCE_KIND_BY_TYPE[initial.type as ReferenceSourceType] ?? SOURCE_KINDS.TEXT;
	let locatorShape: Record<string, unknown> | null;

	if (sourceKind === SOURCE_KINDS.BINARY_VISUAL) {
		// Binary-visual sources build locator_shape from structured fields,
		// not from the raw JSON textarea (which the form hides for this kind).
		// Run the same Zod schema the text branch uses for the main URL so
		// `bv_index_url` cannot bypass the http(s) regex / length cap that
		// `sourceSchema.url` enforces.
		const region = (initial.bvRegion ?? '').trim();
		const indexUrl = (initial.bvIndexUrl ?? '').trim();
		const cadenceRaw = (initial.bvCadenceDays ?? '').trim();
		let cadenceDays: number | undefined;
		const cadenceFieldErrors: Record<string, string> = {};
		if (cadenceRaw.length > 0) {
			const n = Number.parseInt(cadenceRaw, 10);
			if (!Number.isFinite(n) || n < 1) {
				cadenceFieldErrors.bv_cadence_days = 'Cadence must be a positive integer';
			} else {
				cadenceDays = n;
			}
		}
		const bvParsed = binaryVisualLocatorSchema.safeParse({
			region,
			index_url: indexUrl,
			...(cadenceDays !== undefined ? { cadence_days: cadenceDays } : {}),
		});
		if (!bvParsed.success || Object.keys(cadenceFieldErrors).length > 0) {
			const fieldErrors: Record<string, string> = { ...cadenceFieldErrors };
			if (!bvParsed.success) {
				for (const issue of bvParsed.error.issues) {
					const top = issue.path[0];
					const key =
						top === 'region'
							? 'bv_region'
							: top === 'index_url'
								? 'bv_index_url'
								: top === 'cadence_days'
									? 'bv_cadence_days'
									: String(top);
					if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
				}
			}
			return { ok: false, errors: { fieldErrors, formError: null } };
		}
		locatorShape = {
			kind: 'binary-visual',
			region: bvParsed.data.region,
			index_url: bvParsed.data.index_url,
			...(bvParsed.data.cadence_days !== undefined ? { cadence_days: bvParsed.data.cadence_days } : {}),
		};
	} else {
		const locatorRaw = initial.locatorShapeJson.trim();
		locatorShape = locatorRaw.length > 0 && locatorRaw !== '{}' ? parseJsonObject(locatorRaw) : null;
	}

	return {
		ok: true,
		input: parsed.data as unknown as z.infer<typeof sourceSchema> & SourceInput,
		locatorShape,
	};
}

export interface OutboundUrlValidationFailure {
	ok: false;
	errors: FieldErrors;
}

export interface OutboundUrlValidationOk {
	ok: true;
}

export type OutboundUrlValidationResult = OutboundUrlValidationOk | OutboundUrlValidationFailure;

/**
 * SSRF gate for the operator-typed URLs on a `ValidatedSource`.
 *
 * Runs `validateOutboundUrl` against the main `url` and (for binary-visual
 * sources) the locator's `index_url`, rejecting RFC1918 / loopback /
 * link-local / cloud-metadata destinations. Async because the validator
 * resolves DNS; the synchronous `validateSourceForm` covers shape +
 * scheme, this covers the network layer.
 *
 * Tests inject `resolveAll` to keep DNS off the wire.
 */
export async function validateSourceFormUrls(
	validated: ValidatedSource,
	options: ValidateOutboundUrlOptions = {},
): Promise<OutboundUrlValidationResult> {
	const fieldErrors: Record<string, string> = {};
	const urlResult: OutboundUrlResult = await validateOutboundUrl(validated.input.url, options);
	if (!urlResult.ok) {
		fieldErrors.url = urlResult.reason;
	}

	const locator = validated.locatorShape;
	if (locator && typeof locator.index_url === 'string') {
		const bvResult: OutboundUrlResult = await validateOutboundUrl(locator.index_url, options);
		if (!bvResult.ok) {
			fieldErrors.bv_index_url = bvResult.reason;
		}
	}

	if (Object.keys(fieldErrors).length > 0) {
		return { ok: false, errors: { fieldErrors, formError: null } };
	}
	return { ok: true };
}
