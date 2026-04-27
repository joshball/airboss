/**
 * `extractIdentifiers` -- the entry point for `@ab/sources/render`.
 *
 * Source of truth: ADR 019 §2.5. Walks lesson body Markdown via the same
 * walker the lesson-parser uses (no duplicate regex), returns the list of
 * raw identifier strings (with pin) in source order, deduplicated.
 *
 * The renderer's adjacency analysis runs separately on the body; this
 * function is just the "what identifiers does this body cite" surface.
 */

import { parseLesson } from '../lesson-parser.ts';

/**
 * Extract every `airboss-ref:` URL referenced in `body`, in source order,
 * deduplicated by raw string (pin preserved).
 *
 * `body` is the lesson body without frontmatter. The function tolerates a
 * body that includes its own `---` frontmatter fence: `parseLesson` strips
 * frontmatter as part of its walk, so passing a full lesson is also safe
 * (just slightly more work).
 */
export function extractIdentifiers(body: string): readonly string[] {
	const result = parseLesson('<inline>', body);
	const seen = new Set<string>();
	const out: string[] = [];
	for (const occ of result.occurrences) {
		if (seen.has(occ.raw)) continue;
		seen.add(occ.raw);
		out.push(occ.raw);
	}
	return out;
}
