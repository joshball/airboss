/**
 * Form-data parsing helpers.
 *
 * The SvelteKit action pattern `Number(formData.get(key))` silently coerces
 * `null` to `0`, so a missing integer field reads as a valid slot index of 0.
 * That footgun corrupted rep / card submissions in the session runner.
 *
 * `requireInt` narrows to the "field present and parses to a finite integer"
 * case explicitly, returning a typed error when either check fails. Callers
 * can surface the error message directly to the user -- it names the missing
 * or malformed field.
 */

export type RequireIntResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Read a `FormData` entry and narrow it to a finite integer. Returns an
 * error result when the field is missing, empty, non-numeric, or a float.
 *
 * @example
 *   const parsed = requireInt(form, 'slotIndex');
 *   if (!parsed.ok) return fail(400, { error: parsed.error });
 *   const slotIndex = parsed.value;
 */
export function requireInt(formData: FormData, key: string): RequireIntResult {
	const raw = formData.get(key);
	if (raw === null) return { ok: false, error: `${key} is required` };
	const str = typeof raw === 'string' ? raw : String(raw);
	if (str.trim().length === 0) return { ok: false, error: `${key} is required` };
	const n = Number(str);
	if (!Number.isFinite(n) || !Number.isInteger(n)) {
		return { ok: false, error: `${key} must be an integer` };
	}
	return { ok: true, value: n };
}
