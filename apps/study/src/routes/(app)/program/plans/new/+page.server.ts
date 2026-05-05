import { requireAuth } from '@ab/auth';
import { createPlan, getPrimaryGoal } from '@ab/bc-study';
import {
	DEFAULT_SESSION_MODE,
	DEPTH_PREFERENCE_VALUES,
	type DepthPreference,
	DOMAIN_VALUES,
	type Domain,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	PLAN_TITLE_MAX_LENGTH,
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
		const focusDomainsRaw = form.getAll('focusDomains').map((v) => String(v));
		const skipDomainsRaw = form.getAll('skipDomains').map((v) => String(v));
		const depthRaw = String(form.get('depthPreference') ?? 'working');
		const modeRaw = String(form.get('defaultMode') ?? DEFAULT_SESSION_MODE);
		const lengthRaw = String(form.get('sessionLength') ?? '10');

		// Cert intent moved to the goal model post engine-goal-cutover. The
		// plan UI no longer surfaces a cert chooser; after the plan is saved
		// the learner is redirected to the goal composer to pick what they're
		// studying for. The plan owns session shape only.
		const focusDomains: Domain[] = focusDomainsRaw.filter((v): v is Domain => DOMAIN_VALUES.includes(v as Domain));
		const skipDomains: Domain[] = skipDomainsRaw.filter((v): v is Domain => DOMAIN_VALUES.includes(v as Domain));

		if (title.length > PLAN_TITLE_MAX_LENGTH) {
			return fail(400, {
				error: `Title must be ${PLAN_TITLE_MAX_LENGTH} characters or fewer.`,
				values: { title, focusDomains: focusDomainsRaw, skipDomains: skipDomainsRaw },
			});
		}

		// focus/skip disjointness is enforced by the BC schema, but catching it
		// here lets us hand the user a readable error without round-tripping.
		const focusSet = new Set(focusDomains);
		const overlap = skipDomains.filter((d) => focusSet.has(d));
		if (overlap.length > 0) {
			return fail(400, {
				error: 'A domain can be in focus or skip, not both.',
				values: { title, focusDomains: focusDomainsRaw, skipDomains: skipDomainsRaw },
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
		const defaultMode = coerceEnum<SessionMode>(modeRaw, SESSION_MODE_VALUES as SessionMode[], DEFAULT_SESSION_MODE);

		try {
			await createPlan({
				userId: user.id,
				title: title.length > 0 ? title : undefined,
				focusDomains,
				skipDomains,
				skipNodes: [],
				depthPreference,
				sessionLength,
				defaultMode,
			});
		} catch (err) {
			log.error(
				'create plan failed',
				{ requestId: locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, {
				error: 'Could not create plan.',
				values: { title, focusDomains: focusDomainsRaw, skipDomains: skipDomainsRaw },
			});
		}

		// Land on the goal composer so the learner can pick cert intent.
		// If they already have a primary goal, edit it; otherwise create one.
		const primary = await getPrimaryGoal(user.id);
		const target = primary ? ROUTES.PROGRAM_GOAL_EDIT(primary.id) : ROUTES.PROGRAM_GOALS_NEW;
		throw redirect(303, target);
	},
} satisfies Actions;
