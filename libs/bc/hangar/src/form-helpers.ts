/**
 * Shared FormData -> object helpers used by the /glossary and /glossary/sources
 * server actions. Concentrates the ad-hoc parsing (comma-splits, checkbox
 * multi-select, locator JSON) so each form action stays readable.
 */

import type { z } from 'zod';

export function splitCommaList(raw: string): string[] {
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export function splitNewlineOrComma(raw: string): string[] {
	return raw
		.split(/[\n,]/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/** Collect all values for a repeated form field (checkbox groups / multi-select). */
export function getAll(form: FormData, key: string): string[] {
	return form.getAll(key).map((v) => String(v));
}

export function getString(form: FormData, key: string): string {
	const value = form.get(key);
	return value == null ? '' : String(value);
}

export function getOptionalString(form: FormData, key: string): string | undefined {
	const value = form.get(key);
	if (value == null) return undefined;
	const trimmed = String(value).trim();
	return trimmed.length === 0 ? undefined : trimmed;
}

/** Parse a JSON object, returning `{}` on any failure. */
export function parseJsonObject(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
	} catch {
		/* fall through */
	}
	return {};
}

export interface FieldErrors {
	fieldErrors: Record<string, string>;
	formError: string | null;
}

/** Flatten Zod issues into `{ 'path.segment': 'message' }` plus a top-level `_`. */
export function zodIssuesToFieldErrors(error: z.ZodError): FieldErrors {
	const fieldErrors: Record<string, string> = {};
	let formError: string | null = null;
	for (const issue of error.issues) {
		const key = issue.path.map((p) => String(p)).join('.') || '_';
		if (key === '_') {
			if (!formError) formError = issue.message;
			continue;
		}
		if (!fieldErrors[key]) fieldErrors[key] = issue.message;
	}
	return { fieldErrors, formError };
}
