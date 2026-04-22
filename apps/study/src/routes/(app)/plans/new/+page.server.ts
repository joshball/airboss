import { requireAuth } from '@ab/auth';
import { createPlan } from '@ab/bc-study';
import {
	CERT_VALUES,
	type Cert,
	DEPTH_PREFERENCE_VALUES,
	type DepthPreference,
	DOMAIN_VALUES,
	type Domain,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	ROUTES,
	SESSION_MODE_VALUES,
	type SessionMode,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

const log = createLogger('study:plans-new');

function coerceEnum<T extends string>(raw: string, values: readonly T[], fallback: T): T {
	return (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;

		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const certGoalsRaw = form.getAll('certGoals').map((v) => String(v));
		const focusDomainsRaw = form.getAll('focusDomains').map((v) => String(v));
		const skipDomainsRaw = form.getAll('skipDomains').map((v) => String(v));
		const depthRaw = String(form.get('depthPreference') ?? 'working');
		const modeRaw = String(form.get('defaultMode') ?? 'mixed');
		const lengthRaw = String(form.get('sessionLength') ?? '10');

		const certGoals: Cert[] = certGoalsRaw.filter((v): v is Cert => CERT_VALUES.includes(v as Cert));
		if (certGoals.length === 0) {
			return fail(400, {
				error: 'Pick at least one certification.',
				values: { title, certGoals: certGoalsRaw, focusDomains: focusDomainsRaw, skipDomains: skipDomainsRaw },
			});
		}

		const focusDomains: Domain[] = focusDomainsRaw.filter((v): v is Domain => DOMAIN_VALUES.includes(v as Domain));
		const skipDomains: Domain[] = skipDomainsRaw.filter((v): v is Domain => DOMAIN_VALUES.includes(v as Domain));

		// focus/skip disjointness is enforced by the BC schema, but catching it
		// here lets us hand the user a readable error without round-tripping.
		const focusSet = new Set(focusDomains);
		const overlap = skipDomains.filter((d) => focusSet.has(d));
		if (overlap.length > 0) {
			return fail(400, {
				error: 'A domain can be in focus or skip, not both.',
				values: { title, certGoals: certGoalsRaw, focusDomains: focusDomainsRaw, skipDomains: skipDomainsRaw },
			});
		}

		const sessionLengthParsed = Number.parseInt(lengthRaw, 10);
		const sessionLength = Number.isFinite(sessionLengthParsed)
			? Math.min(MAX_SESSION_LENGTH, Math.max(MIN_SESSION_LENGTH, sessionLengthParsed))
			: 10;

		const depthPreference = coerceEnum<DepthPreference>(
			depthRaw,
			DEPTH_PREFERENCE_VALUES as DepthPreference[],
			'working',
		);
		const defaultMode = coerceEnum<SessionMode>(modeRaw, SESSION_MODE_VALUES as SessionMode[], 'mixed');

		let planId: string;
		try {
			const row = await createPlan({
				userId: user.id,
				title: title.length > 0 ? title : undefined,
				certGoals,
				focusDomains,
				skipDomains,
				skipNodes: [],
				depthPreference,
				sessionLength,
				defaultMode,
			});
			planId = row.id;
		} catch (err) {
			log.error(
				'createPlan threw',
				{ requestId: locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, {
				error: 'Could not create plan. Try again.',
				values: { title, certGoals: certGoalsRaw, focusDomains: focusDomainsRaw, skipDomains: skipDomainsRaw },
			});
		}

		// Land on the plan detail with `?created=1` so the page can surface a
		// success banner. Confirmation, not guesswork -- see DESIGN_PRINCIPLES.md #7.
		throw redirect(303, `${ROUTES.PLAN(planId)}?created=1`);
	},
} satisfies Actions;
