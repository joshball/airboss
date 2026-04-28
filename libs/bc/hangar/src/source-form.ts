/**
 * Parse + validate the raw FormData posted by /glossary/sources forms.
 * Centralised so create + edit share one pipeline.
 */

import { type ReferenceSourceType, SOURCE_KIND_BY_TYPE, SOURCE_KINDS } from '@ab/constants';
import type { z } from 'zod';
import { type FieldErrors, getString, parseJsonObject, zodIssuesToFieldErrors } from './form-helpers';
import { sourceSchema } from './form-schemas';
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
		const region = (initial.bvRegion ?? '').trim();
		const indexUrl = (initial.bvIndexUrl ?? '').trim();
		const cadenceRaw = (initial.bvCadenceDays ?? '').trim();
		const fieldErrors: Record<string, string> = {};
		if (region.length === 0) fieldErrors.bv_region = 'Region is required for binary-visual sources';
		if (indexUrl.length === 0) fieldErrors.bv_index_url = 'Index URL is required for binary-visual sources';
		let cadenceDays: number | undefined;
		if (cadenceRaw.length > 0) {
			const n = Number.parseInt(cadenceRaw, 10);
			if (!Number.isFinite(n) || n < 1) {
				fieldErrors.bv_cadence_days = 'Cadence must be a positive integer';
			} else {
				cadenceDays = n;
			}
		}
		if (Object.keys(fieldErrors).length > 0) {
			return { ok: false, errors: { fieldErrors, formError: null } };
		}
		locatorShape = {
			kind: 'binary-visual',
			region,
			index_url: indexUrl,
			...(cadenceDays !== undefined ? { cadence_days: cadenceDays } : {}),
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
