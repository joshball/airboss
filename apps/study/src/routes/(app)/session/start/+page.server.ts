import { requireAuth } from '@ab/auth';
import { archivePlan, createPlan, getActivePlan, NoActivePlanError, previewSession, startSession } from '@ab/bc-study';
import {
	CERT_VALUES,
	type Cert,
	DOMAIN_VALUES,
	type Domain,
	getPreset,
	isPresetId,
	PRESET_VALUES,
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
		return { needsPlan: true as const, presets: PRESET_VALUES };
	}

	const mode = parseMode(event.url.searchParams.get(QUERY_PARAMS.SESSION_MODE));
	const focus = parseFocus(event.url.searchParams.get(QUERY_PARAMS.SESSION_FOCUS));
	const cert = parseCert(event.url.searchParams.get(QUERY_PARAMS.SESSION_CERT));
	const seed = event.url.searchParams.get(QUERY_PARAMS.SESSION_SEED) ?? undefined;

	try {
		const preview = await previewSession(user.id, { mode, focus, cert, seed });
		return { needsPlan: false as const, preview };
	} catch (err) {
		if (err instanceof NoActivePlanError) return { needsPlan: true as const, presets: PRESET_VALUES };
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
				// Plan was archived between load and submit. Send the user back
				// to the gallery rather than the full plan builder -- the preset
				// flow is the right empty-state now.
				throw redirect(303, ROUTES.SESSION_START);
			}
			log.error(
				'startSession threw',
				{ requestId: locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not start session. Try again.' });
		}
	},

	/**
	 * Create a plan from a preset and start a session in one submit. Replaces
	 * the old empty-state flow where a user had to hand-author a plan before
	 * they could run a rep. The gallery only renders when no active plan
	 * exists, but this action archives any existing active plan defensively
	 * so it remains correct as the source of truth. See ADR 012 (Phase 2).
	 */
	startFromPreset: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;
		const form = await request.formData();
		const rawPresetId = String(form.get('presetId') ?? '');
		if (!isPresetId(rawPresetId)) {
			return fail(400, { error: 'Unknown preset. Pick one from the gallery and try again.' });
		}

		const preset = getPreset(rawPresetId);
		if (!preset) {
			return fail(400, { error: 'Unknown preset. Pick one from the gallery and try again.' });
		}

		try {
			// Archive any active plan first so the preset-created plan is the
			// one active plan. `createPlan` also archives inside its own tx;
			// this is belt-and-braces for the case where the gallery was
			// rendered stale (active plan created after the page loaded).
			const existing = await getActivePlan(user.id);
			if (existing) {
				await archivePlan(existing.id, user.id);
			}

			await createPlan({
				userId: user.id,
				title: preset.label,
				certGoals: preset.certGoals,
				focusDomains: preset.focusDomains,
				skipDomains: preset.skipDomains,
				depthPreference: preset.depthPreference,
				sessionLength: preset.sessionLength,
				defaultMode: preset.defaultMode,
			});

			const { session } = await startSession(user.id, { mode: preset.defaultMode });
			throw redirect(303, ROUTES.SESSION(session.id));
		} catch (err) {
			// Rethrow SvelteKit redirects so the browser actually follows them.
			if (err instanceof Response || (err && typeof err === 'object' && 'status' in err && 'location' in err)) {
				throw err;
			}
			log.error(
				'startFromPreset threw',
				{ requestId: locals.requestId, userId: user.id, presetId: rawPresetId },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not start the session from that preset. Try again.' });
		}
	},
} satisfies Actions;
