import { requireAuth } from '@ab/auth';
import { getScenarios } from '@ab/bc-study';
import {
	BROWSE_PAGE_SIZE,
	CONTENT_SOURCE_VALUES,
	type ContentSource,
	DIFFICULTY_VALUES,
	type Difficulty,
	DOMAIN_VALUES,
	type Domain,
	PHASE_OF_FLIGHT_VALUES,
	type PhaseOfFlight,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
	type ScenarioStatus,
} from '@ab/constants';
import type { PageServerLoad } from './$types';

function narrow<T extends string>(value: string | null, allowed: readonly string[]): T | undefined {
	if (!value) return undefined;
	return allowed.includes(value) ? (value as T) : undefined;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrow<Domain>(url.searchParams.get('domain'), DOMAIN_VALUES);
	const difficulty = narrow<Difficulty>(url.searchParams.get('difficulty'), DIFFICULTY_VALUES);
	const phaseOfFlight = narrow<PhaseOfFlight>(url.searchParams.get('phase'), PHASE_OF_FLIGHT_VALUES);
	const sourceType = narrow<ContentSource>(url.searchParams.get('source'), CONTENT_SOURCE_VALUES);
	const status =
		narrow<ScenarioStatus>(url.searchParams.get('status'), SCENARIO_STATUS_VALUES) ?? SCENARIO_STATUSES.ACTIVE;

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	// Fetch one extra row to know whether another page exists.
	const scenarios = await getScenarios(user.id, {
		domain,
		difficulty,
		phaseOfFlight,
		sourceType,
		status,
		limit: BROWSE_PAGE_SIZE + 1,
		offset: (pageNum - 1) * BROWSE_PAGE_SIZE,
	});

	const hasMore = scenarios.length > BROWSE_PAGE_SIZE;
	const visible = hasMore ? scenarios.slice(0, BROWSE_PAGE_SIZE) : scenarios;

	// Project scenarios for the browse card. The full `options` array (with
	// `isCorrect`, `outcome`, `whyNot`) and the `teachingPoint` body never
	// need to reach the client here -- a learner peeking at the page data
	// payload could otherwise see the answer before attempting. Only the
	// option count is surfaced on the card.
	const visibleForClient = visible.map((s) => {
		const { options, teachingPoint: _teachingPoint, ...rest } = s;
		return { ...rest, optionsCount: options.length };
	});

	return {
		scenarios: visibleForClient,
		filters: { domain, difficulty, phaseOfFlight, sourceType, status },
		page: pageNum,
		hasMore,
		pageSize: BROWSE_PAGE_SIZE,
	};
};
