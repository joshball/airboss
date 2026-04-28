/**
 * Phase 10 -- FAA Orders locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("FAA Orders") + the WP at
 * `docs/work-packages/reference-irregular-corpora/`.
 *
 * Accepts every shape ADR 019 §1.2 lists for the `orders` corpus:
 *
 *   <authority>/<order-number>                       whole order
 *   <authority>/<order-number>/vol-<N>               volume
 *   <authority>/<order-number>/vol-<N>/ch-<N>        volume + chapter
 *   <authority>/<order-number>/ch-<N>                chapter (single-volume orders)
 *   <authority>/<order-number>/par-<N(.N(.N))>       paragraph (TERPS-style hierarchical)
 *
 * Authority is `faa` for now. Order number is the FAA's catalog number
 * with optional revision letter suffix (`2150-3`, `8900-1`, `8260-3C`).
 *
 * Pin format: `?at=YYYY-MM` or `?at=YYYY`. The pin is stripped before
 * `parseOrdersLocator` is called; this module only sees the locator portion.
 */

import type { LocatorError, ParsedLocator, ParsedOrdersLocator } from '../types.ts';

const AUTHORITY_PATTERN = /^[a-z]{2,5}$/;
const ORDER_NUMBER_PATTERN = /^[0-9]{1,4}(?:-[0-9]{1,4})?[A-Z]?$/;
const VOLUME_PATTERN = /^vol-([1-9][0-9]?)$/;
const CHAPTER_PATTERN = /^ch-([1-9][0-9]?)$/;
const PARAGRAPH_PATTERN = /^par-([0-9]+(?:\.[0-9]+){0,3})$/;

const KNOWN_AUTHORITIES: ReadonlySet<string> = new Set(['faa']);

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `orders` corpus locator. The locator is the segment after
 * `airboss-ref:orders/`, stripped of `?at=...`.
 */
export function parseOrdersLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('orders locator is empty');
	}

	const segments = locator.split('/');

	const authority = segments[0] ?? '';
	if (authority.length === 0) {
		return err('orders locator missing authority (expected "faa/<order-number>")');
	}
	if (!AUTHORITY_PATTERN.test(authority)) {
		return err(
			`orders locator authority "${authority}" is malformed (expected lowercase ASCII, 2-5 chars, e.g. "faa")`,
		);
	}
	if (!KNOWN_AUTHORITIES.has(authority)) {
		return err(
			`orders locator authority "${authority}" is not yet supported (known: ${[...KNOWN_AUTHORITIES].join(', ')})`,
		);
	}

	const orderNumber = segments[1] ?? '';
	if (orderNumber.length === 0) {
		return err(
			`orders locator missing order number (expected "${authority}/<order-number>" e.g. "${authority}/2150-3")`,
		);
	}
	if (!ORDER_NUMBER_PATTERN.test(orderNumber)) {
		return err(
			`orders locator order number "${orderNumber}" is malformed (expected digits with optional dash + revision letter, e.g. "2150-3" or "8260-3C")`,
		);
	}

	if (segments.length === 2) {
		const orders: ParsedOrdersLocator = { authority, orderNumber };
		return { kind: 'ok', segments, orders };
	}

	// Sub-segments: optional vol-<N>, then optional ch-<N>, OR ch-<N> alone,
	// OR par-<...> alone. Validate left-to-right.
	const subOne = segments[2] ?? '';
	const volMatch = VOLUME_PATTERN.exec(subOne);
	const chMatchOnSubOne = CHAPTER_PATTERN.exec(subOne);
	const parMatchOnSubOne = PARAGRAPH_PATTERN.exec(subOne);

	if (volMatch !== null) {
		const volume = volMatch[1];
		if (volume === undefined) {
			return err(`orders locator volume "${subOne}" is malformed (no number captured)`);
		}
		if (segments.length === 3) {
			const orders: ParsedOrdersLocator = { authority, orderNumber, volume };
			return { kind: 'ok', segments, orders };
		}
		const subTwo = segments[3] ?? '';
		const chMatch = CHAPTER_PATTERN.exec(subTwo);
		if (chMatch === null) {
			return err(`orders locator sub-segment "${subTwo}" after vol-${volume} must be "ch-<N>"`);
		}
		const chapter = chMatch[1];
		if (chapter === undefined) {
			return err(`orders locator chapter "${subTwo}" is malformed (no number captured)`);
		}
		if (segments.length > 4) {
			return err(
				`orders locator has unexpected segments after vol-${volume}/ch-${chapter}: "${segments.slice(4).join('/')}"`,
			);
		}
		const orders: ParsedOrdersLocator = { authority, orderNumber, volume, chapter };
		return { kind: 'ok', segments, orders };
	}

	if (chMatchOnSubOne !== null) {
		const chapter = chMatchOnSubOne[1];
		if (chapter === undefined) {
			return err(`orders locator chapter "${subOne}" is malformed (no number captured)`);
		}
		if (segments.length > 3) {
			return err(`orders locator has unexpected segments after ch-${chapter}: "${segments.slice(3).join('/')}"`);
		}
		const orders: ParsedOrdersLocator = { authority, orderNumber, chapter };
		return { kind: 'ok', segments, orders };
	}

	if (parMatchOnSubOne !== null) {
		const paragraph = parMatchOnSubOne[1];
		if (paragraph === undefined) {
			return err(`orders locator paragraph "${subOne}" is malformed (no value captured)`);
		}
		if (segments.length > 3) {
			return err(`orders locator has unexpected segments after par-${paragraph}: "${segments.slice(3).join('/')}"`);
		}
		const orders: ParsedOrdersLocator = { authority, orderNumber, paragraph };
		return { kind: 'ok', segments, orders };
	}

	return err(`orders locator sub-segment "${subOne}" is malformed (expected "vol-<N>", "ch-<N>", or "par-<N(.N)*>")`);
}

/**
 * Format an Orders locator from a parsed structure. Round-trips with
 * `parseOrdersLocator`. Used by tests.
 */
export function formatOrdersLocator(parsed: ParsedOrdersLocator): string {
	const parts: string[] = [parsed.authority, parsed.orderNumber];
	if (parsed.volume !== undefined) {
		parts.push(`vol-${parsed.volume}`);
		if (parsed.chapter !== undefined) {
			parts.push(`ch-${parsed.chapter}`);
		}
	} else if (parsed.chapter !== undefined) {
		parts.push(`ch-${parsed.chapter}`);
	} else if (parsed.paragraph !== undefined) {
		parts.push(`par-${parsed.paragraph}`);
	}
	return parts.join('/');
}
