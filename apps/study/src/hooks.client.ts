// Client-side error hook. SvelteKit dispatches every error caught inside
// the load lifecycle (load functions, hydration, action returns) here
// before rendering `+error.svelte`. The hook's return value becomes
// `page.error` for the boundary.
//
// Two responsibilities:
//
//   1. Stamp `kind: 'client'` and a fresh `requestId` so the boundary
//      can branch on the kind (`STATUS_TITLES[500]` is wrong copy for a
//      hydration crash -- the server returned 200, the failure is local).
//   2. Forward the structured payload to the same `/api/client-error`
//      endpoint the global `window.onerror` reporter uses, so a load-
//      lifecycle crash lands in the same server log stream as HTTP
//      errors. The dedupe shim in `client-error-reporter.ts` prevents
//      `+layout.svelte`'s `window.onerror` listener from re-reporting
//      the same error after SvelteKit re-throws it onto `window`.
//
// The endpoint URL is `ROUTES.API_CLIENT_ERROR`; the payload schema is
// owned by `apps/study/src/routes/api/client-error/+server.ts`.

import { CLIENT_ERROR_KINDS, type ClientErrorKind } from '@ab/constants';
import type { HandleClientError } from '@sveltejs/kit';
import { postClientErrorReport, shouldSkipDuplicate } from './lib/client-error-reporter';

interface ClientErrorPayload {
	kind: ClientErrorKind;
	message: string;
	requestId: string;
}

export const handleError: HandleClientError = ({ error, status }) => {
	const message = error instanceof Error ? error.message : String(error ?? 'unknown error');
	const stack = error instanceof Error ? error.stack : undefined;
	const requestId = crypto.randomUUID();

	if (!shouldSkipDuplicate(message, stack)) {
		void postClientErrorReport({
			kind: 'error',
			message,
			stack,
			url: typeof window !== 'undefined' ? window.location.href : undefined,
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
		});
	}

	const payload: ClientErrorPayload = {
		kind: CLIENT_ERROR_KINDS.CLIENT,
		message,
		requestId,
	};

	// SvelteKit threads this object into `page.error`. The status comes
	// from SvelteKit (defaults to 500); the boundary ignores the status
	// row when `kind === 'client'` because no HTTP status is meaningful
	// for a hydration crash. Returning the structured object preserves
	// our shape without dropping SvelteKit's `status`.
	return { ...payload, status };
};
