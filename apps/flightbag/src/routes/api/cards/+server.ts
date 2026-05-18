/**
 * `POST /api/cards`
 *
 * Same-origin endpoint that creates a `study.card` from the flightbag's
 * inline composer (wp-flightbag-rich-reader Phase 4). Mirrors the
 * `/memory/new` form action in the study app -- they both call
 * `createCard` -- but lets the composer stay open without navigation.
 *
 * Body shape:
 *
 *     {
 *       "front": "string",
 *       "back": "string",
 *       "domain": "<DOMAIN_VALUES>",
 *       "cardType": "basic",
 *       "kind": "recall",
 *       "tags": ["..."]
 *     }
 *
 * Returns the created card row as JSON.
 */

import { requireAuth } from '@ab/auth';
import { createCard, newCardSchema, SourceRefRequiredError } from '@ab/bc-study/server';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = newCardSchema.safeParse(body);
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path.join('.') || '_';
			if (!fieldErrors[key]) fieldErrors[key] = issue.message;
		}
		return json({ error: 'Validation failed.', fieldErrors }, { status: 400 });
	}

	try {
		const card = await createCard({
			userId: user.id,
			front: parsed.data.front,
			back: parsed.data.back,
			domain: parsed.data.domain,
			cardType: parsed.data.cardType,
			kind: parsed.data.kind,
			tags: parsed.data.tags,
		});
		return json(card, { status: 201 });
	} catch (err) {
		if (err instanceof SourceRefRequiredError) {
			return json({ error: err.message }, { status: 400 });
		}
		throw err;
	}
};
