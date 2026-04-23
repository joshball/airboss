/**
 * Shared shapes for SvelteKit form-action failures.
 *
 * Three variants showed up across the study routes (memory/review,
 * memory/new, memory/[id], plans/new, plans/[id], reps/new, etc.). The
 * differences were cosmetic: some had `error: string`, some had
 * `fieldErrors: Record<string, string>`, and some carried an `intent`
 * discriminator to tell the UI which sub-action failed when one route
 * owns multiple actions.
 *
 * This module picks a single superset shape and documents when to reach
 * for it vs `throw error()`. Pick the variant that matches the situation;
 * the base shape is the common root.
 *
 * ## When to use `fail()` vs `throw error()`
 *
 * Use `fail(status, data: ActionFailure)` for EXPECTED user-facing errors
 * that the form should render in-place without leaving the page:
 *  - validation (missing field, invalid enum, schema rejection)
 *  - conflict (optimistic-lock collision, already-exists)
 *  - not-authorized-for-this-write but authenticated (403 on a sub-resource)
 *
 * Use `throw error(status, ...)` for route-level failures that should
 * replace the page with the SvelteKit error UI:
 *  - auth missing (401)
 *  - parent resource not found (404)
 *  - backend crash the user cannot recover from inline (500)
 *
 * Rule of thumb: if the user's next action is "fix the form and resubmit",
 * use `fail`. If it is "navigate away or hit the back button", throw.
 *
 * ## Usage
 *
 *   // Simple banner-style error
 *   return fail(400, { error: 'Missing cardId' } satisfies ActionFailure);
 *
 *   // Field-level validation with preserved values
 *   return fail(400, {
 *     values: input,
 *     fieldErrors: { front: 'Required' },
 *   } satisfies ActionFailure<NewCardInput>);
 *
 *   // Multi-action route discriminator
 *   return fail(400, {
 *     intent: 'update',
 *     values: input,
 *     fieldErrors,
 *   } satisfies ActionFailure<NewCardInput>);
 */

/**
 * Field-level error bag keyed by form field name. The sentinel `_` key
 * carries form-level errors that aren't tied to a specific input (e.g.
 * "Could not save. Please try again.").
 */
export type FieldErrors = Record<string, string>;

/**
 * Standard SvelteKit form-action failure payload.
 *
 * Fields:
 *  - `error`       -- free-text banner string. Use when the failure has no
 *                     field-level detail (auth, conflict, unexpected).
 *  - `values`      -- the submitted input, echoed back so the form can
 *                     re-render without losing the user's work.
 *  - `fieldErrors` -- per-field validation messages plus the `_` sentinel
 *                     for form-level errors.
 *  - `intent`      -- discriminator for routes that own multiple named
 *                     actions (e.g. the memory/[id] page has `update`,
 *                     `setStatus`, `delete`). Lets the UI branch on which
 *                     action failed.
 *
 * Every field is optional. Consumers choose the subset that fits the call
 * site; use the type parameter `TValues` to preserve the shape of `values`.
 */
export interface ActionFailure<TValues = unknown> {
	/** Banner-level error message. */
	error?: string;
	/** Echo of the submitted input, for rehydrating the form on failure. */
	values?: TValues;
	/** Per-field validation messages, with `_` reserved for form-level errors. */
	fieldErrors?: FieldErrors;
	/** Sub-action discriminator for multi-action routes. */
	intent?: string;
}
