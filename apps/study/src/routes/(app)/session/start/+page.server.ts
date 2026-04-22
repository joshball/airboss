import { requireAuth } from '@ab/auth';
import {
	createPlan,
	DuplicateActivePlanError,
	getActivePlan,
	NoActivePlanError,
	previewSession,
	startSession,
} from '@ab/bc-study';
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
import { fail, isRedirect, redirect } from '@sveltejs/kit';
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
		const preview = await previewSession(user.id, { mode, focus, cert, seed }, new Date());
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
			if (isRedirect(err)) throw err;
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
			// `createPlan` archives any existing active plan inside its own
			// transaction, so there's no need for a pre-emptive archive here --
			// that just widened the race window and duplicated work. The partial
			// UNIQUE index on study_plan is the backstop; DuplicateActivePlanError
			// surfaces only when a concurrent writer inserts between our archive
			// and insert (another tab submitting a plan, back-to-back double
			// submit). Handle it explicitly instead of collapsing to a 500.
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
			if (isRedirect(err)) throw err;
			if (err instanceof DuplicateActivePlanError) {
				return fail(409, {
					error: 'Another active plan was set up in another tab. Refresh the page and try again.',
				});
			}
			if (err instanceof NoActivePlanError) {
				// Shouldn't happen on this path (we just created the plan), but
				// guard for the window where the plan is archived by a concurrent
				// writer between createPlan and startSession.
				return fail(409, { error: 'Your active plan changed. Refresh the page and try again.' });
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
