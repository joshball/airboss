/**
 * Render an unknown thrown value as a string for log output.
 *
 * Centralized so every script reports errors the same way. Prefers
 * `error.message` for `Error` instances; falls back to `String(value)`.
 */
export function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
