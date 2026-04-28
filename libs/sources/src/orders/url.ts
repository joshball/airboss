/**
 * Phase 10 -- FAA Orders live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`orders` corpus URL conventions).
 *
 * The FAA hosts orders at the regulations_policies/orders_notices index;
 * direct PDF URLs use a CMS document ID we don't have at parse time, so
 * the live URL formula uses the search-by-number landing page. Authors
 * who want to deep-link to a specific PDF can record `source_url` on the
 * registry entry; the resolver surfaces that via `Edition.source_url`
 * (Phase 10 ingestion is deferred -- this URL is the offline fallback).
 *
 * URL form:
 *   https://www.faa.gov/regulations_policies/orders_notices/?searchedQuery=<orderNumber>
 *
 * Volume/chapter/paragraph segments don't survive the formula -- the
 * FAA's site uses CMS-managed anchors. Authors should rely on the
 * canonical short-form citation ("FAA Order 8900.1, Vol 5 Ch 1") to
 * convey the locator after the URL opens.
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseOrdersLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:orders/';

const FAA_ORDERS_SEARCH_BASE = 'https://www.faa.gov/regulations_policies/orders_notices';

/**
 * Build the FAA URL for a given `orders` entry. The edition argument is
 * accepted for `CorpusResolver` interface conformance; authors pin via
 * `?at=YYYY-MM` but the search page itself is edition-agnostic.
 *
 * Order numbers like `8260-3C` are written `8260.3C` on faa.gov; the
 * formula renders the dotted form for search compatibility.
 */
export function getOrdersLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseOrdersLocator(locator);
	if (parsed.kind !== 'ok' || parsed.orders === undefined) return null;

	// Render `1234-5C` as `1234.5C` for the FAA's search syntax.
	const orderNumberDotted = parsed.orders.orderNumber.replace('-', '.');
	const url = new URL(FAA_ORDERS_SEARCH_BASE);
	url.searchParams.set('searchedQuery', orderNumberDotted);
	return url.toString();
}
