/**
 * `enqueueAndRedirect` -- shared form-action helper.
 *
 * The hangar app has ~5 form actions whose body is the same: enqueue a
 * job and redirect to its detail page so the operator can watch the
 * live log. The catch shape is also identical (rethrow redirects, log
 * the failure, return `fail(500)` with the error message).
 *
 * Closes the chunk-6 architecture-minor finding "5 copies of enqueue +
 * redirect boilerplate". Routes that need extra preflight (busy guard,
 * 409, file staging) keep their own actions; the helper is for the
 * straight-through case.
 */

import { ROUTES } from '@ab/constants';
import { type EnqueueInput, enqueueJob } from '@ab/hangar-jobs';
import { createLogger, type Logger } from '@ab/utils';
import { type ActionFailure, fail, isRedirect, type RequestEvent, redirect } from '@sveltejs/kit';

const defaultLogger = createLogger('hangar:enqueue-and-redirect');

/**
 * Enqueue a job and immediately redirect (303) to its detail page.
 *
 * On success this function never returns -- `redirect()` throws and the
 * caller's action returns control to SvelteKit, which writes the 303.
 * On failure (DB blip, worker outage) the helper logs and returns a
 * `fail(500)` shape; callers `return await enqueueAndRedirect(...)`
 * from the form action so the failure surfaces in `form.error`.
 */
export async function enqueueAndRedirect(
	event: RequestEvent,
	input: EnqueueInput,
	options: { logger?: Logger; failureMessage?: string } = {},
): Promise<ActionFailure<{ error: string }>> {
	const log = options.logger ?? defaultLogger;
	try {
		const job = await enqueueJob(input);
		redirect(303, ROUTES.HANGAR_JOB_DETAIL(job.id));
	} catch (err) {
		if (isRedirect(err)) throw err;
		log.error(
			`enqueue ${input.kind} failed`,
			{ requestId: event.locals.requestId, userId: input.actorId },
			err instanceof Error ? err : undefined,
		);
		return fail(500, {
			error: err instanceof Error ? err.message : (options.failureMessage ?? 'failed to enqueue job'),
		});
	}
}
