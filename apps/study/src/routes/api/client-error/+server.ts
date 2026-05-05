/**
 * Client-side error reporter endpoint.
 *
 * `POST /api/client-error` body
 *   `{ message: string, source?: string, stack?: string, url?: string,
 *      kind: 'error' | 'unhandledrejection' }`
 * logs the payload via the same `createLogger('study')` pipeline that
 * carries server-side errors. The root `+layout.svelte` wires
 * `window.onerror` / `window.onunhandledrejection` to this endpoint so
 * a `ReferenceError: Buffer is not defined` at hydration is no longer
 * invisible -- the previous gap let a browser-only crash slip past every
 * server log line because the originating request returned 200.
 *
 * Anonymous callers permitted: an error on `/login` itself is exactly
 * what we need to see.
 *
 * Defenses:
 * - Body size capped at 8 KiB. Stacks longer than that are truncated.
 * - Per-IP token bucket: 30 reports per 60s rolling window. Anything
 *   beyond returns 429 without logging the body (we still log the
 *   throttle event so a hostile flood is itself visible).
 */

import { createLogger } from '@ab/utils';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const log = createLogger('study');

const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELD_LENGTH = 4 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;

const bodySchema = z.object({
	kind: z.enum(['error', 'unhandledrejection']),
	message: z.string().min(1).max(MAX_FIELD_LENGTH),
	source: z.string().max(MAX_FIELD_LENGTH).optional(),
	stack: z.string().max(MAX_FIELD_LENGTH).optional(),
	url: z.string().max(2048).optional(),
	userAgent: z.string().max(512).optional(),
});

interface BucketEntry {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, BucketEntry>();

function rateLimitKey(event: Parameters<RequestHandler>[0]): string {
	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded !== null && forwarded.length > 0) {
		const first = forwarded.split(',')[0];
		if (first !== undefined) return first.trim();
	}
	return event.getClientAddress();
}

function isRateLimited(key: string, now: number): boolean {
	const entry = buckets.get(key);
	if (entry === undefined || entry.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return false;
	}
	if (entry.count >= RATE_LIMIT) return true;
	entry.count += 1;
	return false;
}

// Garbage-collect expired buckets opportunistically when the map grows.
function maybeSweepBuckets(now: number): void {
	if (buckets.size < 1024) return;
	for (const [key, entry] of buckets) {
		if (entry.resetAt <= now) buckets.delete(key);
	}
}

export const POST: RequestHandler = async (event) => {
	const now = Date.now();
	maybeSweepBuckets(now);

	const ip = rateLimitKey(event);
	if (isRateLimited(ip, now)) {
		log.warn('client-error report throttled', {
			requestId: event.locals.requestId,
			metadata: { ip },
		});
		throw error(429, 'too many client error reports');
	}

	// Cap the request size before parsing so a hostile peer cannot OOM us
	// by streaming a multi-MB body. SvelteKit's body parser will accept
	// any size by default.
	const contentLength = Number(event.request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_BODY_BYTES) throw error(413, 'payload too large');

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'invalid JSON body');
	}
	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'invalid body shape');

	const { kind, message, source, stack, url, userAgent } = parsed.data;
	// Reconstruct an Error so the logger threads `message` and `stack`
	// through its server-error stack-handling path.
	const err = new Error(message);
	if (stack !== undefined) err.stack = stack;
	log.error(
		'client-side error',
		{
			requestId: event.locals.requestId,
			userId: event.locals.user?.id ?? null,
			metadata: {
				kind,
				source: source ?? null,
				url: url ?? null,
				userAgent: userAgent ?? null,
				ip,
			},
		},
		err,
	);
	return json({ ok: true });
};
