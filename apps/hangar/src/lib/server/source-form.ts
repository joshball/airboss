/**
 * Parse + validate the raw FormData posted by /glossary/sources forms.
 * Centralised so create + edit share one pipeline.
 */

import type { z } from 'zod';
import { type FieldErrors, getString, parseJsonObject, zodIssuesToFieldErrors } from './form-helpers';
import type { SourceInput } from './registry';
import { sourceSchema } from './schemas';
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

	const locatorRaw = initial.locatorShapeJson.trim();
	const locatorShape = locatorRaw.length > 0 && locatorRaw !== '{}' ? parseJsonObject(locatorRaw) : null;

	return {
		ok: true,
		input: parsed.data as unknown as z.infer<typeof sourceSchema> & SourceInput,
		locatorShape,
	};
}
