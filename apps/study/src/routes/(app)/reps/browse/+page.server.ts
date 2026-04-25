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
import { createLogger, narrow } from '@ab/utils';
import type { PageServerLoad } from './$types';

const log = createLogger('study:reps-browse');

/** Legacy query-string name for `flight-phase`. Accepted for old bookmarks;
 * TODO(retire): drop after 2026-07-01 once no logs show it being hit. */
const LEGACY_PHASE_PARAM = 'phase';

/** Subset of the shared `BROWSE_GROUP_BY_VALUES` that makes sense for scenarios.
 * Cards have `state` (FSRS), but scenarios don't, so we drop that bucket. */
const REPS_GROUP_BY_VALUES = ['none', 'domain', 'difficulty', 'phaseOfFlight', 'source', 'status'] as const;
type RepsGroupBy = (typeof REPS_GROUP_BY_VALUES)[number];

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url, locals } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const difficulty = narrow<Difficulty>(url.searchParams.get(QUERY_PARAMS.DIFFICULTY), DIFFICULTY_VALUES);
	const newPhase = narrow<PhaseOfFlight>(url.searchParams.get(QUERY_PARAMS.FLIGHT_PHASE), PHASE_OF_FLIGHT_VALUES);
	const legacyPhase = narrow<PhaseOfFlight>(url.searchParams.get(LEGACY_PHASE_PARAM), PHASE_OF_FLIGHT_VALUES);
	if (legacyPhase && !newPhase) {
		log.info('legacy ?phase= used on /reps/browse', {
			requestId: locals.requestId,
			userId: user.id,
			metadata: { legacyPhase },
		});
	} else if (legacyPhase && newPhase && legacyPhase !== newPhase) {
		log.warn('legacy ?phase= disagrees with ?flight-phase= on /reps/browse; using flight-phase', {
			requestId: locals.requestId,
			userId: user.id,
			metadata: { legacyPhase, newPhase },
		});
	}
	const phaseOfFlight = newPhase ?? legacyPhase;
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

	const groupBy: RepsGroupBy =
		narrow<RepsGroupBy>(url.searchParams.get(QUERY_PARAMS.GROUP_BY), REPS_GROUP_BY_VALUES) ?? 'none';

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

export type RepsGroupByValue = RepsGroupBy;
export const REPS_GROUP_BY_OPTIONS = REPS_GROUP_BY_VALUES;
