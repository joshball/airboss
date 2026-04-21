/**
 * Small string helpers shared across surface apps.
 */

/**
 * Convert a kebab- or snake-case slug into a space-separated, title-cased
 * string: `emergency-procedures` -> `Emergency Procedures`. Used as a
 * fallback label when a constant doesn't ship a curated human-readable
 * name for an enum value.
 */
export function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}
