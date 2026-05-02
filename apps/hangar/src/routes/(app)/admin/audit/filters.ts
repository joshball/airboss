/**
 * URL-param decoders for the `/admin/audit` route.
 *
 * Extracted from `+page.server.ts` so the unit test can import these
 * helpers without dragging in SvelteKit-only `requireRole` (which throws
 * outside a request scope). The loader composes these into the BC call.
 */

import { AUDIT_OP_VALUES } from '@ab/audit';
import {
	AUDIT_TARGET_VALUES,
	AUDIT_WINDOW_DEFAULT,
	AUDIT_WINDOW_VALUES,
	AUDIT_WINDOWS,
	type AuditWindow,
	QUERY_PARAMS,
} from '@ab/constants';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ResolvedWindow {
	window: AuditWindow;
	from?: Date;
	to?: Date;
}

/**
 * Resolve a `(from, to)` pair from the URL parameters per the spec rule:
 *
 *   1. If `from` or `to` are present, treat as `custom`.
 *   2. Else if `window` is set to a known preset, derive bounds from `now`.
 *   3. Else apply the default 24h window.
 */
export function resolveAuditWindow(params: URLSearchParams, now: Date = new Date()): ResolvedWindow {
	const fromRaw = params.get(QUERY_PARAMS.AUDIT_FROM);
	const toRaw = params.get(QUERY_PARAMS.AUDIT_TO);
	const customFrom = fromRaw ? parseDate(fromRaw) : undefined;
	const customTo = toRaw ? parseDate(toRaw) : undefined;

	if (customFrom !== undefined || customTo !== undefined) {
		return { window: AUDIT_WINDOWS.CUSTOM, from: customFrom, to: customTo };
	}

	const windowParam = params.get(QUERY_PARAMS.AUDIT_WINDOW);
	const presetCandidate = (AUDIT_WINDOW_VALUES as readonly string[]).includes(windowParam ?? '')
		? (windowParam as AuditWindow)
		: AUDIT_WINDOW_DEFAULT;

	switch (presetCandidate) {
		case AUDIT_WINDOWS.HOUR_1:
			return { window: presetCandidate, from: new Date(now.getTime() - HOUR_MS) };
		case AUDIT_WINDOWS.HOUR_24:
			return { window: presetCandidate, from: new Date(now.getTime() - 24 * HOUR_MS) };
		case AUDIT_WINDOWS.DAY_7:
			return { window: presetCandidate, from: new Date(now.getTime() - 7 * DAY_MS) };
		case AUDIT_WINDOWS.DAY_30:
			return { window: presetCandidate, from: new Date(now.getTime() - 30 * DAY_MS) };
		case AUDIT_WINDOWS.ALL:
			return { window: presetCandidate };
		case AUDIT_WINDOWS.CUSTOM:
			// Window=custom but no from/to supplied -- fall back to default.
			return resolveAuditWindow(new URLSearchParams(), now);
		default:
			return { window: AUDIT_WINDOW_DEFAULT, from: new Date(now.getTime() - 24 * HOUR_MS) };
	}
}

function parseDate(raw: string): Date | undefined {
	const d = new Date(raw);
	return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Take a raw URL parameter and only return it when it matches one of the
 * allow-listed values (target type, op). Anything else collapses to
 * `undefined` so a hand-edited URL with a typo doesn't return zero rows
 * silently -- the filter is dropped instead.
 */
export function pickAllowedValue<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
	if (value === null || value === '') return undefined;
	// `includes()` proves at runtime that `value` is one of `T`; TS doesn't
	// narrow generic readonly-array membership, so we widen the array to
	// `readonly string[]` for the check and narrow `value` back to `T`.
	return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Decoded filter shape consumed by the loader (and the e2e tests). */
export interface DecodedAuditFilters {
	actorId: string | undefined;
	targetType: string | undefined;
	targetId: string | undefined;
	op: string | undefined;
	cursor: string | undefined;
	resolvedWindow: ResolvedWindow;
}

/** Decode every filter from a single URLSearchParams in one pass. */
export function decodeAuditFilters(params: URLSearchParams, now: Date = new Date()): DecodedAuditFilters {
	const resolvedWindow = resolveAuditWindow(params, now);
	const actorParam = params.get(QUERY_PARAMS.AUDIT_ACTOR);
	const actorId = actorParam !== null && actorParam !== '' ? actorParam : undefined;
	const targetType = pickAllowedValue(params.get(QUERY_PARAMS.AUDIT_TARGET_TYPE), AUDIT_TARGET_VALUES);
	const targetIdRaw = params.get(QUERY_PARAMS.AUDIT_TARGET_ID);
	const targetId = targetIdRaw !== null && targetIdRaw !== '' ? targetIdRaw : undefined;
	const op = pickAllowedValue(params.get(QUERY_PARAMS.AUDIT_OP), AUDIT_OP_VALUES);
	const cursorRaw = params.get(QUERY_PARAMS.AUDIT_CURSOR);
	const cursor = cursorRaw !== null && cursorRaw !== '' ? cursorRaw : undefined;
	return { actorId, targetType, targetId, op, cursor, resolvedWindow };
}
