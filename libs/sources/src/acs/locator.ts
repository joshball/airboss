/**
 * ACS corpus locator parser.
 *
 * Source of truth: ADR 019 §1.2 + the cert-syllabus WP's locked Q7 format.
 *
 * Locator shape (post-Q7-resolution, locked 2026-04-27):
 *
 *   <slug>                                                    whole publication
 *   <slug>/area-<NN>                                          area
 *   <slug>/area-<NN>/task-<x>                                 task
 *   <slug>/area-<NN>/task-<x>/elem-<triad><NN>                element
 *
 * Where:
 *
 * - `<slug>` is the cert+class+edition slug (e.g. `ppl-airplane-6c`,
 *   `cfi-airplane-25`). One slug per FAA publication. The category and
 *   edition collapse into the slug; class scope (when present) lives on
 *   `syllabus_node.classes`, not in the locator. This matches the FAA's
 *   reality: PPL Airplane is one ACS-6C document covering ASEL + AMEL;
 *   class-restricted tasks (e.g. AMEL/AMES-only Maneuvering with One
 *   Engine Inoperative) are tagged on individual rows.
 * - `<NN>` for area is a 2-digit zero-padded number (`area-05`, `area-13`).
 * - `<x>` for task is a single lowercase letter (`task-a`, `task-g`).
 * - `<triad>` is `k`, `r`, or `s` (Knowledge / Risk management / Skill).
 * - `<NN>` for element is a 2-digit zero-padded number (`elem-k01`,
 *   `elem-s10`).
 *
 * The locked format is belt-and-suspenders with the slug-encoded edition:
 * an authored identifier always also carries `?at=YYYY-MM` (the publication
 * month) per the cert-syllabus WP's reading of ADR 019 §1.3. The parser
 * doesn't enforce `?at=` (the upstream `parseIdentifier` strips it before
 * calling here); callers that require a pin enforce it at the seed layer.
 */

import type { LocatorError, ParsedAcsLocator, ParsedLocator } from '../types.ts';

/**
 * Enumerated ACS publication slugs. Format: `<cert-and-category>-<edition>`,
 * kebab-case lowercase. The corpus name (`acs`) is the prefix; this slug
 * never carries an `acs-` prefix itself.
 *
 * Adding a new publication is non-breaking; the parser rejects unknown
 * slugs to catch typos at the earliest layer.
 */
export const ACS_PUBLICATION_SLUGS: readonly string[] = [
	'ppl-airplane-6c', // Private Pilot -- Airplane (FAA-S-ACS-6C, Nov 2023)
	'ir-airplane-8c', // Instrument Rating -- Airplane (FAA-S-ACS-8C, Nov 2023)
	'cpl-airplane-7b', // Commercial Pilot -- Airplane (FAA-S-ACS-7B, Nov 2023)
	'cfi-airplane-25', // CFI -- Airplane (FAA-S-ACS-25, Nov 2023; covers ASEL/AMEL/ASES/AMES, includes MEI scope)
	'atp-airplane-11a', // ATP -- Airplane (FAA-S-ACS-11A, Apr 2024)
];

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]+[a-z0-9]$/;
const AREA_PATTERN = /^area-(\d{2})$/;
const TASK_PATTERN = /^task-([a-z])$/;
const ELEMENT_PATTERN = /^elem-([krs])(\d{2})$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `acs` corpus locator. Input is the segment after
 * `airboss-ref:acs/`, with `?at=...` already stripped by the upstream
 * `parseIdentifier`.
 */
export function parseAcsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('acs locator is empty');
	}

	const segments = locator.split('/');

	const slug = segments[0] ?? '';
	if (slug.length === 0) {
		return err('acs locator missing publication slug');
	}
	if (!SLUG_PATTERN.test(slug)) {
		return err(`acs locator slug "${slug}" is malformed (expected lowercase kebab-case)`);
	}
	if (!ACS_PUBLICATION_SLUGS.includes(slug)) {
		return err(
			`acs locator slug "${slug}" is not a registered publication; one of: ${ACS_PUBLICATION_SLUGS.join(', ')}`,
		);
	}

	// Whole publication: <slug>
	if (segments.length === 1) {
		const acs: ParsedAcsLocator = { slug };
		return { kind: 'ok', segments, acs };
	}

	// Area: <slug>/area-<NN>
	const areaSeg = segments[1] ?? '';
	const areaMatch = AREA_PATTERN.exec(areaSeg);
	if (areaMatch === null) {
		return err(
			`acs locator area segment "${areaSeg}" is malformed (expected "area-NN" with 2-digit zero-padding, e.g. "area-05")`,
		);
	}
	const area = areaMatch[1];
	if (area === undefined) {
		return err(`acs locator area segment "${areaSeg}" is malformed (no ordinal captured)`);
	}

	if (segments.length === 2) {
		const acs: ParsedAcsLocator = { slug, area };
		return { kind: 'ok', segments, acs };
	}

	// Task: <slug>/area-<NN>/task-<x>
	const taskSeg = segments[2] ?? '';
	const taskMatch = TASK_PATTERN.exec(taskSeg);
	if (taskMatch === null) {
		return err(`acs locator task segment "${taskSeg}" is malformed (expected "task-<letter>" e.g. "task-a")`);
	}
	const task = taskMatch[1];
	if (task === undefined) {
		return err(`acs locator task segment "${taskSeg}" is malformed (no letter captured)`);
	}

	if (segments.length === 3) {
		const acs: ParsedAcsLocator = { slug, area, task };
		return { kind: 'ok', segments, acs };
	}

	// Element: <slug>/area-<NN>/task-<x>/elem-<triad><NN>
	const elementSeg = segments[3] ?? '';
	const elementMatch = ELEMENT_PATTERN.exec(elementSeg);
	if (elementMatch === null) {
		return err(
			`acs locator element segment "${elementSeg}" is malformed (expected "elem-<k|r|s>NN" with 2-digit zero-padding, e.g. "elem-k01")`,
		);
	}
	const triadLetter = elementMatch[1] as 'k' | 'r' | 's' | undefined;
	const ordinal = elementMatch[2];
	if (triadLetter === undefined || ordinal === undefined) {
		return err(`acs locator element segment "${elementSeg}" is malformed (triad or ordinal missing)`);
	}

	if (segments.length > 4) {
		return err(`acs locator has unexpected segments after element: "${segments.slice(4).join('/')}"`);
	}

	const acs: ParsedAcsLocator = {
		slug,
		area,
		task,
		elementTriad: triadLetter,
		elementOrdinal: ordinal,
	};
	return { kind: 'ok', segments, acs };
}

/**
 * Format an ACS locator from a parsed structure. Round-trips with
 * `parseAcsLocator`. Useful for canonicalising authored identifiers and for
 * tests that need to derive a locator from a triad of fields.
 */
export function formatAcsLocator(parsed: ParsedAcsLocator): string {
	const parts: string[] = [parsed.slug];
	if (parsed.area === undefined) return parts.join('/');
	parts.push(`area-${parsed.area}`);
	if (parsed.task === undefined) return parts.join('/');
	parts.push(`task-${parsed.task}`);
	if (parsed.elementTriad === undefined || parsed.elementOrdinal === undefined) return parts.join('/');
	parts.push(`elem-${parsed.elementTriad}${parsed.elementOrdinal}`);
	return parts.join('/');
}
