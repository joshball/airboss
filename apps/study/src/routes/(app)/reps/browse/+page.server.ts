import { requireAuth } from '@ab/auth';
import { getScenario, getScenarios, getScenariosCount, getScenariosFacetCounts } from '@ab/bc-study';
import {
	BROWSE_PAGE_SIZE,
	BROWSE_PAGE_SIZE_VALUES,
	type BrowsePageSize,
	CONTENT_SOURCE_VALUES,
	type ContentSource,
	DIFFICULTY_VALUES,
	type Difficulty,
	DOMAIN_VALUES,
	type Domain,
	PHASE_OF_FLIGHT_VALUES,
	type PhaseOfFlight,
	QUERY_PARAMS,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
	type ScenarioStatus,
} from '@ab/constants';
import { narrow } from '@ab/utils';
import { REPS_GROUP_BY_VALUES, type RepsGroupByValue } from './group-by';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const difficulty = narrow<Difficulty>(url.searchParams.get(QUERY_PARAMS.DIFFICULTY), DIFFICULTY_VALUES);
	const phaseOfFlight = narrow<PhaseOfFlight>(url.searchParams.get(QUERY_PARAMS.FLIGHT_PHASE), PHASE_OF_FLIGHT_VALUES);
	const sourceType = narrow<ContentSource>(url.searchParams.get(QUERY_PARAMS.SOURCE), CONTENT_SOURCE_VALUES);
	const status =
		narrow<ScenarioStatus>(url.searchParams.get(QUERY_PARAMS.STATUS), SCENARIO_STATUS_VALUES) ??
		SCENARIO_STATUSES.ACTIVE;
	const search = url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	const pageSizeRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE_SIZE) ?? '', 10);
	const pageSize: BrowsePageSize = (BROWSE_PAGE_SIZE_VALUES as readonly number[]).includes(pageSizeRaw)
		? (pageSizeRaw as BrowsePageSize)
		: BROWSE_PAGE_SIZE;

	const groupBy: RepsGroupByValue =
		narrow<RepsGroupByValue>(url.searchParams.get(QUERY_PARAMS.GROUP_BY), REPS_GROUP_BY_VALUES) ?? 'none';

	const filters = {
		domain,
		difficulty,
		phaseOfFlight,
		sourceType,
		status,
		search: search || undefined,
	};

	const [scenarios, total, facets] = await Promise.all([
		getScenarios(user.id, {
			...filters,
			limit: pageSize + 1,
			offset: (pageNum - 1) * pageSize,
		}),
		getScenariosCount(user.id, filters),
		getScenariosFacetCounts(user.id, filters),
	]);

	const hasMore = scenarios.length > pageSize;
	const visible = hasMore ? scenarios.slice(0, pageSize) : scenarios;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const createdId = url.searchParams.get(QUERY_PARAMS.CREATED) ?? null;
	let createdScenario: { id: string; title: string } | null = null;
	if (createdId) {
		const found = await getScenario(createdId, user.id);
		if (found) createdScenario = { id: found.id, title: found.title };
	}

	// Strip `options.isCorrect|outcome|whyNot` and `teachingPoint` so a learner
	// can't peek at the answer via view-source. Only the option count surfaces
	// on the card.
	const visibleForClient = visible.map((s) => {
		const { options, teachingPoint: _teachingPoint, ...rest } = s;
		return { ...rest, optionsCount: options.length };
	});

	return {
		scenarios: visibleForClient,
		filters: { domain, difficulty, phaseOfFlight, sourceType, status, search },
		page: pageNum,
		hasMore,
		pageSize,
		total,
		totalPages,
		groupBy,
		facets,
		createdScenario,
	};
};
