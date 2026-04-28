/**
 * Promise-based sleep used by retry/backoff loops in `scripts/`.
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
