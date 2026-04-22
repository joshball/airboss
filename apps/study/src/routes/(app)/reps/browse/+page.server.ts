import { requireAuth } from '@ab/auth';
import { getScenario, getScenarios, scenario } from '@ab/bc-study';
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
	QUERY_PARAMS,
	SCENARIO_STATUS_VALUES,
	SCENARIO_STATUSES,
	type ScenarioStatus,
} from '@ab/constants';
import { db } from '@ab/db';
import { createLogger } from '@ab/utils';
import { and, eq, inArray, type SQL, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const log = createLogger('study:reps-browse');

/** Legacy query-string name for `flight-phase`. Accepted for old bookmarks;
 * TODO(retire): drop after 2026-07-01 once no logs show it being hit. */
const LEGACY_PHASE_PARAM = 'phase';

function narrow<T extends string>(value: string | null, allowed: readonly string[]): T | undefined {
	if (!value) return undefined;
	return allowed.includes(value) ? (value as T) : undefined;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url, locals } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const difficulty = narrow<Difficulty>(url.searchParams.get(QUERY_PARAMS.DIFFICULTY), DIFFICULTY_VALUES);
	// Accept both the new `flight-phase` param and the legacy `phase` form so
	// old bookmarks keep working. New takes precedence when both are set. Log
	// any legacy usage so we have retirement signal; warn on mismatches.
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

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
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

	// Total count for pagination "Page X of Y" / "Showing N-M of T". Mirrors
	// the filter shape of `getScenarios` so the count matches what's listed.
	// Inline rather than promoted to BC -- single consumer at the moment.
	const countClauses: SQL[] = [eq(scenario.userId, user.id), inArray(scenario.status, [status])];
	if (domain) countClauses.push(eq(scenario.domain, domain));
	if (difficulty) countClauses.push(eq(scenario.difficulty, difficulty));
	if (phaseOfFlight) countClauses.push(eq(scenario.phaseOfFlight, phaseOfFlight));
	if (sourceType) countClauses.push(eq(scenario.sourceType, sourceType));
	const [{ total }] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(scenario)
		.where(and(...countClauses));
	const totalPages = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));

	// If the user was redirected here from /reps/new, surface the created
	// scenario's title for a confirmation banner. Only the title leaks to the
	// client -- the full scenario (with `options` + `teachingPoint`) stays
	// server-side so users can't spoil their own answers via view-source.
	// See DESIGN_PRINCIPLES.md #7.
	const createdId = url.searchParams.get(QUERY_PARAMS.CREATED) ?? null;
	let createdScenario: { id: string; title: string } | null = null;
	if (createdId) {
		const found = await getScenario(createdId, user.id);
		if (found) createdScenario = { id: found.id, title: found.title };
	}

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
		total,
		totalPages,
		createdScenario,
	};
};
