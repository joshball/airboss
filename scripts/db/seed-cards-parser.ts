/**
 * Scan a `node.md` body for every `:::cards ... :::` directive block,
 * concatenate the payloads, and validate each card through the shared
 * `parseCardsYaml` validator. Used by `seed-cards.ts` to materialise
 * `study.card` rows at `bun run db seed cards` time.
 *
 * The validator lives in `libs/bc/study/src/cards-yaml.ts` so the
 * markdown parser (`libs/help/src/markdown/block.ts`) and the seeder
 * share a single source of truth for the card payload shape. Authoring
 * slips fail loud here AND at parse time on the rendered page.
 *
 * The historical `` ```yaml-cards `` fenced-block syntax is gone --
 * the migration script `scripts/migrations/.archive/2026-05-yaml-cards-to-directive.ts`
 * replaced every occurrence in the corpus with `:::cards ... :::` and the
 * `bun run check` step `cards-directive` blocks any new `yaml-cards`
 * fences from sneaking back in. If you're staring at a "no cards found"
 * count and the corpus still has cards, re-grep for `:::cards`.
 */

import { type ParsedCard, parseCardsYaml } from '@ab/bc-study';

export type { ParsedCard } from '@ab/bc-study';
export { parseAcsCodes, parseQuestionTier, parseSourceAuthority } from '@ab/bc-study';

const CARDS_DIRECTIVE_OPEN = /^:::cards(?:\s.*)?$/;
const DIRECTIVE_CLOSE = /^:::\s*$/;

/**
 * Locate every `:::cards` block in a node.md body, parse the inner YAML
 * via the shared validator, and return the flat list of parsed cards
 * across every block in document order. `relPath` flows into the
 * validator's per-card error messages so authoring slips surface with a
 * clear pointer.
 */
export function extractCardsFromBody(body: string, relPath: string): ParsedCard[] {
	const lines = body.split(/\r?\n/);
	const cards: ParsedCard[] = [];
	let i = 0;
	while (i < lines.length) {
		if (!CARDS_DIRECTIVE_OPEN.test(lines[i])) {
			i++;
			continue;
		}
		const start = i + 1;
		let end = start;
		while (end < lines.length && !DIRECTIVE_CLOSE.test(lines[end])) end++;
		if (end >= lines.length) {
			throw new Error(`${relPath}: unclosed ':::cards' directive (no terminating ':::' line)`);
		}
		const payload = lines.slice(start, end).join('\n');
		const parsed = parseCardsYaml(payload, relPath);
		cards.push(...parsed);
		i = end + 1;
	}
	return cards;
}
