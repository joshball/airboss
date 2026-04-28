/**
 * Human-readable byte counts (e.g. `12.3 MB`, `4.0 KB`, `512 B`).
 *
 * Used in download summaries and verify tables. Centralized here so the same
 * formatting reads consistently across every script that reports byte sizes.
 */
export function formatBytes(n: number): string {
	if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
	if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${n} B`;
}
