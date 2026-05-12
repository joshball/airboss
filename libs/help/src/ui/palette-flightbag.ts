/**
 * Derive an `airboss-ref:` URI for a palette `SearchResult`, where one
 * exists. The detail pane uses this to expose "Open in flightbag" and
 * "Cite this" actions.
 *
 * Today the aviation-refs loader stamps every row with the registry id
 * shape (`doc-faah808325c`, `doc-cfr-14-91`, `doc-ac-00-6b`, `doc-aim-7-1`,
 * `doc-ppl-acs`, ...). This helper inverts those id shapes back to the
 * canonical `airboss-ref:` URI so the citation chip story and the
 * flightbag deep-link affordance keep working from the palette.
 *
 * Unsupported types return null and the caller hides the affordance.
 */

import { ROUTES } from '@ab/constants';
import {
	airbossRefForAcDocument,
	airbossRefForAcsPublication,
	airbossRefForAimEntry,
	airbossRefForWholeDocHandbook,
	type SourceId,
} from '@ab/sources';
import type { SearchResult } from '../schema/result-types';

/** Registry id -> airboss-ref URI, where we can derive one. */
export function airbossRefForResult(result: SearchResult): SourceId | null {
	const id = result.id;
	if (result.type === 'faa.handbook') {
		// Registry id shape: `doc-<sourceType>` where sourceType is the
		// document slug. The edition isn't carried in the id today, so we
		// can't build a fully-pinned URI; we still emit a corpus-shaped URI
		// with an empty edition, which `urlForReference` resolves to the
		// flightbag home as a safe fallback. When ingest carries edition
		// alongside, this builder can stamp the real edition slug.
		const slug = id.replace(/^doc-/, '');
		if (!slug) return null;
		return airbossRefForWholeDocHandbook(slug, '') as SourceId;
	}
	if (result.type === 'faa.cfr.part') {
		const match = id.match(/^doc-cfr-(\d+)-(.+)$/);
		if (!match) return null;
		const [, title, part] = match;
		if (!title || !part) return null;
		return `airboss-ref:regs/cfr-${title}/${part}` as SourceId;
	}
	if (result.type === 'faa.ac') {
		// Registry id shape: `doc-ac-<docNumber>-<rev>` (PR #817 seed).
		const match = id.match(/^doc-ac-([0-9a-z-]+?)-([a-z0-9]+)$/i);
		if (!match) return null;
		const [, docNumber, rev] = match;
		if (!docNumber || !rev) return null;
		return airbossRefForAcDocument(docNumber, rev) as SourceId;
	}
	if (result.type === 'faa.acs') {
		const slug = id.replace(/^doc-/, '');
		if (!slug) return null;
		return airbossRefForAcsPublication(slug) as SourceId;
	}
	if (result.type === 'faa.aim') {
		// Registry id shape: `doc-aim-<chapter>-<section>` (or similar).
		const code = id.replace(/^doc-aim-/, '').replace(/-/g, '-');
		if (!code) return null;
		return airbossRefForAimEntry(code) as SourceId;
	}
	if (result.type === 'faa.handbook.chapter' || result.type === 'faa.cfr.sect') {
		// Child rows from DB-backed loaders carry their own id shape; the
		// chapter / section URI requires fields the palette result row
		// doesn't surface today. Falls back to null -- the detail pane will
		// hide "Open in flightbag" and the row's existing `href` still works.
		return null;
	}
	return null;
}

/**
 * Does the result's existing `href` already point at a flightbag-rendered
 * route? When true, the "Open in flightbag" button is shown directly with
 * a cross-origin link to that path.
 */
export function isFlightbagHref(href: string): boolean {
	// All flightbag routes are namespaced under fixed prefixes; the
	// cross-app sibling-origin wrapper points at the flightbag host. The
	// path itself starts with one of these prefixes regardless of origin.
	const FLIGHTBAG_PATH_PREFIXES = ['/handbook/', '/cfr/', '/aim/', '/ac/', '/acs/', '/info/', '/safo/'];
	for (const prefix of FLIGHTBAG_PATH_PREFIXES) {
		if (href.startsWith(prefix)) return true;
	}
	return href === ROUTES.FLIGHTBAG_HOME;
}
