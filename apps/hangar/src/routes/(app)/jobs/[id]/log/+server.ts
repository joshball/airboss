import { requireRole } from '@ab/auth';
import { QUERY_PARAMS, ROLES } from '@ab/constants';
import { getJob, readJobLog } from '@ab/hangar-jobs';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const MAX_LINES_PER_POLL = 500;

/**
 * Cursor-based polling endpoint for the /jobs/[id] live log viewer.
 *
 * GET `/jobs/:id/log?sinceSeq=<n>` -> `{ status, lines: [{seq, stream, line, at}], latestSeq }`
 *
 * The client opens a 1 Hz `setInterval` while `status` is non-terminal;
 * each request sends the last `seq` it has seen so the server returns
 * only new rows. Stops polling once `status in {complete, failed, cancelled}`.
 */
export const GET: RequestHandler = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);

	const job = await getJob(event.params.id);
	if (!job) throw error(404, 'job not found');

	const sinceRaw = event.url.searchParams.get(QUERY_PARAMS.SINCE_SEQ);
	const sinceSeq = sinceRaw !== null ? Number.parseInt(sinceRaw, 10) : -1;
	const since = Number.isFinite(sinceSeq) ? sinceSeq : -1;

	const lines = await readJobLog(job.id, { sinceSeq: since, limit: MAX_LINES_PER_POLL });
	const latestSeq = lines.length === 0 ? since : (lines[lines.length - 1]?.seq ?? since);

	return json({
		status: job.status,
		progress: job.progress,
		error: job.error,
		result: job.result,
		finishedAt: job.finishedAt?.toISOString() ?? null,
		lines: lines.map((line) => ({
			seq: line.seq,
			stream: line.stream,
			line: line.line,
			at: line.at.toISOString(),
		})),
		latestSeq,
	});
};
