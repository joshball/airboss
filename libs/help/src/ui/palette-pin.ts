/**
 * Map a palette `SearchResult` to a plan-item "pin to today" payload.
 *
 * The result types that have a meaningful pin target today are:
 *
 *   - `airboss.knode`              -> kind `knowledge_node`, target = node slug
 *   - `airboss.glossary`           -> kind `glossary`, target = slug (derived from the row's href)
 *   - `mine.card`                  -> kind `card`, target = card id
 *   - `faa.handbook.chapter`,
 *     `faa.cfr.sect`               -> kind `reference_section`, target = section id
 *
 * Result types that don't have a stable underlying-entity id today
 * (the doc-level rows like `faa.handbook` / `faa.cfr.part`, plus
 * `web.tool`, `cmd.*`, `airboss.help`, `mine.note`, `mine.plan`,
 * `mine.rep`, `airboss.course`, `airboss.lesson`) return null and the
 * caller hides the Pin to today button.
 */

import { PLAN_ITEM_KINDS, type PlanItemKind } from '@ab/constants';
import type { SearchResult } from '../schema/result-types';

export interface PinPayload {
	kind: PlanItemKind;
	targetId: string;
	title: string;
	href: string;
}

/** Derive a glossary slug from the standard `/reference/glossary/<slug>` href. */
function glossarySlugFromHref(href: string): string | null {
	const match = href.match(/\/reference\/glossary\/([^/?#]+)/);
	return match?.[1] ?? null;
}

export function pinPayloadForResult(result: SearchResult): PinPayload | null {
	switch (result.type) {
		case 'airboss.knode':
			return {
				kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
				targetId: result.id,
				title: result.title,
				href: result.href,
			};
		case 'mine.card':
			return {
				kind: PLAN_ITEM_KINDS.CARD,
				targetId: result.id,
				title: result.title,
				href: result.href,
			};
		case 'faa.handbook.chapter':
		case 'faa.cfr.sect':
			return {
				kind: PLAN_ITEM_KINDS.REFERENCE_SECTION,
				targetId: result.id,
				title: result.title,
				href: result.href,
			};
		case 'airboss.glossary': {
			const slug = glossarySlugFromHref(result.href);
			if (!slug) return null;
			return {
				kind: PLAN_ITEM_KINDS.GLOSSARY,
				targetId: slug,
				title: result.title,
				href: result.href,
			};
		}
		default:
			return null;
	}
}
