import { requireAuth } from '@ab/auth';
import {
	activatePlan,
	addSkipDomain,
	addSkipNode,
	archivePlan,
	DomainOverlapError,
	getPlan,
	KnowledgeNodeNotFoundError,
	PlanNotFoundError,
	removeSkipDomain,
	removeSkipNode,
	updatePlan,
} from '@ab/bc-study';
import {
	CERT_VALUES,
	type Cert,
	DEFAULT_SESSION_MODE,
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
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:plans-detail');

function coerceEnum<T extends string>(raw: string, values: readonly T[], fallback: T): T {
	return (values as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const plan = await getPlan(event.params.id, user.id);
	if (!plan) throw error(404, { message: 'Plan not found' });
	return { plan };
};

export const actions: Actions = {
	update: async (event) => {
		const user = requireAuth(event);
		const { request, params, locals } = event;

		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const certGoalsRaw = form.getAll('certGoals').map((v) => String(v));
		const focusDomainsRaw = form.getAll('focusDomains').map((v) => String(v));
		const skipDomainsRaw = form.getAll('skipDomains').map((v) => String(v));
		const depthRaw = String(form.get('depthPreference') ?? 'working');
		const modeRaw = String(form.get('defaultMode') ?? DEFAULT_SESSION_MODE);
		const lengthRaw = String(form.get('sessionLength') ?? '10');

		const certGoals: Cert[] = certGoalsRaw.filter((v): v is Cert => CERT_VALUES.includes(v as Cert));
		// Empty certGoals is a first-class plan state (ADR 012). Authors who want
		// a cert-agnostic plan check the "General practice" option in the form.

		const focusDomains: Domain[] = focusDomainsRaw.filter((v): v is Domain => DOMAIN_VALUES.includes(v as Domain));
		const skipDomains: Domain[] = skipDomainsRaw.filter((v): v is Domain => DOMAIN_VALUES.includes(v as Domain));

		const sessionLengthParsed = Number.parseInt(lengthRaw, 10);
		const sessionLength = Number.isFinite(sessionLengthParsed)
			? Math.min(MAX_SESSION_LENGTH, Math.max(MIN_SESSION_LENGTH, sessionLengthParsed))
			: 10;

		try {
			await updatePlan(params.id, user.id, {
				title: title.length > 0 ? title : undefined,
				certGoals,
				focusDomains,
				skipDomains,
				depthPreference: coerceEnum<DepthPreference>(depthRaw, DEPTH_PREFERENCE_VALUES as DepthPreference[], 'working'),
				defaultMode: coerceEnum<SessionMode>(modeRaw, SESSION_MODE_VALUES as SessionMode[], DEFAULT_SESSION_MODE),
				sessionLength,
			});
		} catch (err) {
			if (err instanceof PlanNotFoundError) throw error(404, { message: 'Plan not found' });
			if (err instanceof DomainOverlapError) {
				return fail(400, { error: 'A domain can be in focus or skip, not both.' });
			}
			log.error(
				'updatePlan threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { planId: params.id } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not save plan. Try again.' });
		}
		return { success: true as const };
	},

	archive: async (event) => {
		const user = requireAuth(event);
		try {
			await archivePlan(event.params.id, user.id);
		} catch (err) {
			if (err instanceof PlanNotFoundError) throw error(404, { message: 'Plan not found' });
			throw err;
		}
		throw redirect(303, ROUTES.PLANS);
	},

	activate: async (event) => {
		const user = requireAuth(event);
		try {
			await activatePlan(event.params.id, user.id);
		} catch (err) {
			if (err instanceof PlanNotFoundError) throw error(404, { message: 'Plan not found' });
			throw err;
		}
		return { success: true as const };
	},

	removeSkipNode: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const nodeId = String(form.get('nodeId') ?? '').trim();
		if (!nodeId) return fail(400, { error: 'nodeId required' });
		try {
			await removeSkipNode(event.params.id, user.id, nodeId);
		} catch (err) {
			if (err instanceof PlanNotFoundError) throw error(404, { message: 'Plan not found' });
			throw err;
		}
		return { success: true as const };
	},

	removeSkipDomain: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const domainRaw = String(form.get('domain') ?? '');
		if (!DOMAIN_VALUES.includes(domainRaw as Domain)) return fail(400, { error: 'Invalid domain' });
		try {
			await removeSkipDomain(event.params.id, user.id, domainRaw as Domain);
		} catch (err) {
			if (err instanceof PlanNotFoundError) throw error(404, { message: 'Plan not found' });
			throw err;
		}
		return { success: true as const };
	},

	addSkipDomain: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const domainRaw = String(form.get('domain') ?? '');
		if (!DOMAIN_VALUES.includes(domainRaw as Domain)) return fail(400, { error: 'Invalid domain' });
		try {
			await addSkipDomain(event.params.id, user.id, domainRaw as Domain);
		} catch (err) {
			if (err instanceof PlanNotFoundError) throw error(404, { message: 'Plan not found' });
			throw err;
		}
		return { success: true as const };
	},

	addSkipNode: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const nodeId = String(form.get('nodeId') ?? '').trim();
		if (!nodeId) return fail(400, { error: 'nodeId required' });
		try {
			await addSkipNode(event.params.id, user.id, nodeId);
		} catch (err) {
			if (err instanceof PlanNotFoundError) throw error(404, { message: 'Plan not found' });
			if (err instanceof KnowledgeNodeNotFoundError) return fail(400, { error: 'Unknown knowledge node' });
			throw err;
		}
		return { success: true as const };
	},
} satisfies Actions;
