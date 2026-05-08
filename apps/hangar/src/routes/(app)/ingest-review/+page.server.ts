/**
 * `/ingest-review` queue page loader.
 *
 * Lists every issue grouped by `(corpus, source)` with a status badge
 * and link to the detail page. Filter chips are URL-driven so the page
 * is bookmark-able. The "Run producers" form action lets an
 * AUTHOR / OPERATOR / ADMIN refresh the queue from disk without a CLI
 * round-trip.
 */

import { requireRole } from '@ab/auth';
import { getStatusCounts, listIssues, listSources, runProducers } from '@ab/bc-ingest-review/server';
import {
	CORPUS_VALUES,
	type Corpus,
	INGEST_ISSUE_KIND_VALUES,
	INGEST_STATUS_VALUES,
	type IngestIssueKind,
	type IngestStatus,
	QUERY_PARAMS,
	ROLES,
} from '@ab/constants';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function parseCorpus(raw: string | null): Corpus | undefined {
	if (raw === null) return undefined;
	if (!(CORPUS_VALUES as readonly string[]).includes(raw)) return undefined;
	return raw as Corpus;
}

function parseKind(raw: string | null): IngestIssueKind | undefined {
	if (raw === null) return undefined;
	if (!(INGEST_ISSUE_KIND_VALUES as readonly string[]).includes(raw)) return undefined;
	return raw as IngestIssueKind;
}

function parseStatus(raw: string | null): IngestStatus | undefined {
	if (raw === null) return undefined;
	if (!(INGEST_STATUS_VALUES as readonly string[]).includes(raw)) return undefined;
	return raw as IngestStatus;
}

export const load: PageServerLoad = async (event) => {
	const url = event.url;
	const corpus = parseCorpus(url.searchParams.get(QUERY_PARAMS.CORPUS));
	const sourceId = url.searchParams.get(QUERY_PARAMS.SOURCE) ?? undefined;
	const kind = parseKind(url.searchParams.get(QUERY_PARAMS.KIND));
	const statusParam = parseStatus(url.searchParams.get(QUERY_PARAMS.STATUS));
	const status = statusParam ?? 'unresolved';

	const filters = {
		...(corpus ? { corpus } : {}),
		...(sourceId ? { sourceId } : {}),
		...(kind ? { kind } : {}),
		status,
	};
	const [issues, statusCounts, sources] = await Promise.all([
		listIssues(filters),
		getStatusCounts({ ...(corpus ? { corpus } : {}), ...(sourceId ? { sourceId } : {}) }),
		listSources(corpus),
	]);

	return {
		issues,
		statusCounts,
		sources,
		filters: {
			corpus: corpus ?? null,
			sourceId: sourceId ?? null,
			kind: kind ?? null,
			status,
		},
	};
};

export const actions: Actions = {
	runProducers: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const formData = await event.request.formData();
		const corpus = parseCorpus(formData.get('corpus') as string | null) ?? 'handbook';
		const sourceId = (formData.get('source') as string | null) ?? undefined;
		try {
			const result = await runProducers({
				corpus,
				repoRoot: process.cwd(),
				...(sourceId !== undefined && sourceId.length > 0 ? { sourceId } : {}),
			});
			return {
				ok: true,
				summary: result,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return fail(500, { ok: false, error: message });
		}
	},
};
