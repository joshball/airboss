/**
 * Aircraft selector form action.
 *
 * Writes the avionics-only `AVIONICS_AIRCRAFT_COOKIE`. The cookie is
 * scoped to `Domain=avionics.airboss.test` (per-app, NOT
 * `.airboss.test`) -- sim and avionics may diverge on which aircraft
 * they consider "current". Sim pins per-scenario; avionics pins a
 * learner-wide preference.
 *
 * Validation is two-layer:
 *
 * 1. The submitted id must be a member of `SIM_AIRCRAFT_IDS`. A
 *    tampered cookie cannot widen the type beyond what the BC already
 *    knows about.
 * 2. The id must be in `AVIONICS_SELECTABLE_AIRCRAFT`. The avionics
 *    surface ships with a strict allow-list (today: only C172) so a
 *    second aircraft drops in by editing the constant, not by
 *    discovering the absence of a guard at runtime.
 */

import {
	AVIONICS_AIRCRAFT_COOKIE,
	AVIONICS_SELECTABLE_AIRCRAFT,
	HOSTS,
	SECONDS_PER_YEAR,
	SIM_AIRCRAFT_IDS,
	type SimAircraftId,
} from '@ab/constants';
import { fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions } from './$types';

const VALID_AIRCRAFT_IDS = new Set<string>(Object.values(SIM_AIRCRAFT_IDS));
const SELECTABLE_AIRCRAFT_IDS = new Set<SimAircraftId>(AVIONICS_SELECTABLE_AIRCRAFT);

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const raw = form.get('aircraftId');
		if (typeof raw !== 'string' || !VALID_AIRCRAFT_IDS.has(raw)) {
			return fail(400, { fieldError: 'Invalid aircraft id' });
		}
		const aircraftId = raw as SimAircraftId;
		if (!SELECTABLE_AIRCRAFT_IDS.has(aircraftId)) {
			return fail(400, { fieldError: 'Aircraft is not yet available on the avionics surface' });
		}
		cookies.set(AVIONICS_AIRCRAFT_COOKIE, aircraftId, {
			path: '/',
			domain: HOSTS.AVIONICS,
			maxAge: SECONDS_PER_YEAR,
			sameSite: 'lax',
			httpOnly: true,
			secure: !dev,
		});
		return { ok: true, selectedAircraftId: aircraftId };
	},
};
