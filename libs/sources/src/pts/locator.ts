/**
 * PTS corpus locator parser.
 *
 * Source of truth: cert-syllabus WP's locked Q7 format. PTS is ACS's
 * predecessor: the FAA still publishes CFII (FAA-S-8081-9E) and a few
 * other practical-test standards in the older format.
 *
 * Locator shape (locked 2026-04-27, mirrors `acs:` minus the K/R/S triad):
 *
 *   <slug>                                       whole publication
 *   <slug>/area-<NN>                             area of operation
 *   <slug>/area-<NN>/task-<x>                    task
 *   <slug>/area-<NN>/task-<x>/elem-<NN>          objective / element
 *
 * `<slug>` is the publication slug (e.g. `cfii-airplane-9e`). `<NN>` for
 * area + element is 2-digit zero-padded; `<x>` for task is a single
 * lowercase letter. PTS does not split K/R/S; an element is a flat
 * Objective with an ordinal alone.
 *
 * The `at=YYYY-MM` pin (parsed by the upstream `parseIdentifier`) is
 * belt-and-suspenders with the slug-encoded edition.
 */

import type { LocatorError, ParsedLocator, ParsedPtsLocator } from '../types.ts';

/**
 * Enumerated PTS publication slugs. Format: `<cert-and-category>-<edition>`,
 * kebab-case lowercase. Adding a new publication is non-breaking; the
 * parser rejects unknown slugs to catch typos at the earliest layer.
 */
export const PTS_PUBLICATION_SLUGS: readonly string[] = [
	'cfii-airplane-9e', // Flight Instructor Instrument (FAA-S-8081-9E, Nov 2023; covers airplane + helicopter)
];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/;
const AREA_PATTERN = /^area-(\d{2})$/;
const TASK_PATTERN = /^task-([a-z])$/;
const ELEMENT_PATTERN = /^elem-(\d{2})$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `pts` corpus locator. Input is the segment after
 * `airboss-ref:pts/`, with `?at=...` already stripped by the upstream
 * `parseIdentifier`.
 */
export function parsePtsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('pts locator is empty');
	}

	const segments = locator.split('/');

	const slug = segments[0] ?? '';
	if (slug.length === 0) {
		return err('pts locator missing publication slug');
	}
	if (!SLUG_PATTERN.test(slug)) {
		return err(`pts locator slug "${slug}" is malformed (expected lowercase kebab-case)`);
	}
	if (!PTS_PUBLICATION_SLUGS.includes(slug)) {
		return err(
			`pts locator slug "${slug}" is not a registered publication; one of: ${PTS_PUBLICATION_SLUGS.join(', ')}`,
		);
	}

	if (segments.length === 1) {
		const pts: ParsedPtsLocator = { slug };
		return { kind: 'ok', segments, pts };
	}

	const areaSeg = segments[1] ?? '';
	const areaMatch = AREA_PATTERN.exec(areaSeg);
	if (areaMatch === null) {
		return err(
			`pts locator area segment "${areaSeg}" is malformed (expected "area-NN" with 2-digit zero-padding, e.g. "area-05")`,
		);
	}
	const area = areaMatch[1];
	if (area === undefined) {
		return err(`pts locator area segment "${areaSeg}" is malformed (no ordinal captured)`);
	}

	if (segments.length === 2) {
		const pts: ParsedPtsLocator = { slug, area };
		return { kind: 'ok', segments, pts };
	}

	const taskSeg = segments[2] ?? '';
	const taskMatch = TASK_PATTERN.exec(taskSeg);
	if (taskMatch === null) {
		return err(`pts locator task segment "${taskSeg}" is malformed (expected "task-<letter>" e.g. "task-a")`);
	}
	const task = taskMatch[1];
	if (task === undefined) {
		return err(`pts locator task segment "${taskSeg}" is malformed (no letter captured)`);
	}

	if (segments.length === 3) {
		const pts: ParsedPtsLocator = { slug, area, task };
		return { kind: 'ok', segments, pts };
	}

	const elementSeg = segments[3] ?? '';
	const elementMatch = ELEMENT_PATTERN.exec(elementSeg);
	if (elementMatch === null) {
		return err(
			`pts locator element segment "${elementSeg}" is malformed (expected "elem-NN" with 2-digit zero-padding, e.g. "elem-01"; PTS has no K/R/S triad)`,
		);
	}
	const ordinal = elementMatch[1];
	if (ordinal === undefined) {
		return err(`pts locator element segment "${elementSeg}" is malformed (no ordinal captured)`);
	}

	if (segments.length > 4) {
		return err(`pts locator has unexpected segments after element: "${segments.slice(4).join('/')}"`);
	}

	const pts: ParsedPtsLocator = { slug, area, task, elementOrdinal: ordinal };
	return { kind: 'ok', segments, pts };
}

/**
 * Format a PTS locator from a parsed structure. Round-trips with
 * `parsePtsLocator`. Useful for canonicalising authored identifiers.
 */
export function formatPtsLocator(parsed: ParsedPtsLocator): string {
	const parts: string[] = [parsed.slug];
	if (parsed.area === undefined) return parts.join('/');
	parts.push(`area-${parsed.area}`);
	if (parsed.task === undefined) return parts.join('/');
	parts.push(`task-${parsed.task}`);
	if (parsed.elementOrdinal === undefined) return parts.join('/');
	parts.push(`elem-${parsed.elementOrdinal}`);
	return parts.join('/');
}
