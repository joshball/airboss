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

/**
 * Strip common Markdown syntax from a string, leaving plain text. Removes
 * emphasis markers, inline code backticks, link/image syntax (keeping the
 * link label), heading hashes, list bullets, and blockquote markers. Not a
 * full Markdown parser -- a lightweight pass for building preview teasers
 * where rendering live Markdown is undesirable.
 */
export function stripMarkdown(md: string): string {
	return (
		md
			// Images: ![alt](url) -> alt
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
			// Links: [label](url) -> label
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			// Fenced + inline code: drop the backticks, keep the content
			.replace(/```+/g, '')
			.replace(/`([^`]*)`/g, '$1')
			// Bold / italic markers
			.replace(/(\*\*|__|\*|_)/g, '')
			// Leading heading hashes, list bullets, blockquote markers
			.replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
			.replace(/^[ \t]*[-*+][ \t]+/gm, '')
			.replace(/^[ \t]*>[ \t]?/gm, '')
			// Collapse runs of whitespace (incl. the newlines the list/quote
			// strips left behind) into single spaces
			.replace(/\s+/g, ' ')
			.trim()
	);
}

/**
 * Truncate `text` to at most `max` code points, breaking at a word boundary
 * when the cut lands mid-word and appending an ellipsis. Slices by code
 * point (`Array.from`) so an astral-plane character (emoji) at the boundary
 * is never split into a lone surrogate. Returns the input unchanged when it
 * is already within the cap.
 */
export function truncatePlainText(text: string, max: number): string {
	const trimmed = text.trim();
	const points = Array.from(trimmed);
	if (points.length <= max) return trimmed;
	const slice = points.slice(0, max).join('');
	const lastSpace = slice.lastIndexOf(' ');
	const head = lastSpace > max / 2 ? slice.slice(0, lastSpace) : slice;
	return `${head.trimEnd()}...`;
}
