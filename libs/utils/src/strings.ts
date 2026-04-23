/**
 * Small string helpers shared across surface apps.
 */

/**
 * Convert a kebab, snake, or camel-case slug into a space-separated,
 * title-cased string:
 *
 *   `emergency-procedures` -> `Emergency Procedures`
 *   `emergency_procedures` -> `Emergency Procedures`
 *   `emergencyProcedures`  -> `Emergency Procedures`
 *   `ATCClearance`         -> `ATC Clearance`
 *
 * Used as a fallback label when a constant doesn't ship a curated
 * human-readable name for an enum value. Consolidates 9 inline copies
 * previously duplicated across the study routes (memory/+page.svelte,
 * memory/review, memory/new, memory/[id], memory/browse, calibration,
 * sessions/[id], sessions/[id]/summary, session/start).
 */
export function humanize(slug: string): string {
	if (!slug) return '';
	// Split camelCase / PascalCase boundaries first so `fooBar` -> `foo Bar`
	// and consecutive caps (`ATCClearance`) stay grouped as one word
	// (`ATC Clearance`).
	const withBoundaries = slug.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

	return withBoundaries
		.split(/[\s\-_]+/)
		.filter((w) => w.length > 0)
		.map((w) => (w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
		.join(' ');
}
