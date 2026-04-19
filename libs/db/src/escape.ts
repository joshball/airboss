/**
 * Escape special characters in a string for use in SQL LIKE/ILIKE patterns.
 * Prevents user input containing %, _, or \ from being interpreted as wildcards.
 */
export function escapeLikePattern(input: string): string {
	return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
