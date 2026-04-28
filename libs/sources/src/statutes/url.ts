/**
 * Phase 10 -- Federal statutes live URL builder.
 *
 * Source of truth: ADR 019 §1.2 (`statutes` corpus URL conventions).
 *
 * The Office of the Law Revision Counsel hosts the US Code at
 * uscode.house.gov. The browse path keys on title number; the section
 * and subsection (when present) anchor onto the title page through the
 * `path=` and section-anchor combination. The formula composes a deep
 * link to the section page; subsections render as page anchors that the
 * site's own JS handles.
 *
 * URL form:
 *   https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title<title>-section<section>
 *
 * This is the FAA's standard "preliminary release" granuleid scheme
 * (reflects the latest enacted laws not yet in the official Code).
 */

import { stripPin } from '../registry/query.ts';
import type { EditionId, SourceId } from '../types.ts';
import { parseStatutesLocator } from './locator.ts';

const SOURCE_ID_PREFIX = 'airboss-ref:statutes/';
const USCODE_BASE = 'https://uscode.house.gov/view.xhtml';

/**
 * Build the uscode.house.gov section URL for a `statutes` entry.
 */
export function getStatutesLiveUrl(id: SourceId, _edition: EditionId): string | null {
	const stripped = stripPin(id);
	if (!stripped.startsWith(SOURCE_ID_PREFIX)) return null;
	const locator = stripped.slice(SOURCE_ID_PREFIX.length);

	const parsed = parseStatutesLocator(locator);
	if (parsed.kind !== 'ok' || parsed.statutes === undefined) return null;

	const granuleId = `USC-prelim-title${parsed.statutes.titleNumber}-section${parsed.statutes.section}`;
	const url = new URL(USCODE_BASE);
	url.searchParams.set('req', `granuleid:${granuleId}`);
	const base = url.toString();
	if (parsed.statutes.subsection !== undefined) {
		return `${base}#${parsed.statutes.subsection}`;
	}
	return base;
}
