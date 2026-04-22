import { requireAuth } from '@ab/auth';
import { getActivePlan, NoActivePlanError, previewSession, startSession } from '@ab/bc-study';
import {
	CERT_VALUES,
	type Cert,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODE_VALUES,
	type SessionMode,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:session-start');

function parseMode(raw: string | null): SessionMode | undefined {
	if (!raw) return undefined;
	return (SESSION_MODE_VALUES as readonly string[]).includes(raw) ? (raw as SessionMode) : undefined;
}

function parseFocus(raw: string | null): Domain | undefined {
	if (!raw) return undefined;
	return (DOMAIN_VALUES as readonly string[]).includes(raw) ? (raw as Domain) : undefined;
}

function parseCert(raw: string | null): Cert | undefined {
	if (!raw) return undefined;
	return (CERT_VALUES as readonly string[]).includes(raw) ? (raw as Cert) : undefined;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const plan = await getActivePlan(user.id);
	if (!plan) {
		return { needsPlan: true as const };
	}

	const mode = parseMode(event.url.searchParams.get(QUERY_PARAMS.SESSION_MODE));
	const focus = parseFocus(event.url.searchParams.get(QUERY_PARAMS.SESSION_FOCUS));
	const cert = parseCert(event.url.searchParams.get(QUERY_PARAMS.SESSION_CERT));
	const seed = event.url.searchParams.get(QUERY_PARAMS.SESSION_SEED) ?? undefined;

	try {
		const preview = await previewSession(user.id, { mode, focus, cert, seed });
		return { needsPlan: false as const, preview };
	} catch (err) {
		if (err instanceof NoActivePlanError) return { needsPlan: true as const };
		log.error(
			'previewSession threw',
			{ requestId: event.locals.requestId, userId: user.id },
			err instanceof Error ? err : undefined,
		);
		throw err;
	}
};

export const actions: Actions = {
	start: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;
		const form = await request.formData();
		const mode = parseMode(String(form.get('mode') ?? ''));
		const focus = parseFocus(String(form.get('focus') ?? ''));
		const cert = parseCert(String(form.get('cert') ?? ''));
		const seed = String(form.get('seed') ?? '') || undefined;

		try {
			const { session } = await startSession(user.id, { mode, focus, cert, seed });
			throw redirect(303, ROUTES.SESSION(session.id));
		} catch (err) {
			// SvelteKit's `redirect` throw is itself captured here; rethrow.
			if (err instanceof Response || (err && typeof err === 'object' && 'status' in err && 'location' in err)) {
				throw err;
			}
			if (err instanceof NoActivePlanError) {
				throw redirect(303, ROUTES.PLANS_NEW);
			}
			log.error(
				'startSession threw',
				{ requestId: locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not start session. Try again.' });
		}
	},
} satisfies Actions;
