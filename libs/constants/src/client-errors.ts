// Constants shared by the client-error reporting pipeline:
//   - SvelteKit `handleError` hook (`apps/study/src/hooks.client.ts`) and
//     the global `window.onerror` reporter in `apps/study/src/routes/+layout.svelte`
//   - The error boundaries (`+error.svelte`, `(app)/+error.svelte`) that
//     render distinct UI for client-classified vs server-classified errors
//   - The server-side reporter endpoint (`apps/study/src/routes/api/client-error/+server.ts`)
//
// Centralising these makes the client/server contract grep-able. A
// browser-only hydration crash and a 500 from the server load function
// reach two very different boundary states; the kind tag is how the
// boundary tells them apart so it can render "App error" instead of
// "Something went wrong, status 500".

/**
 * Discriminator stamped on `error.kind` so SvelteKit error boundaries can
 * tell a client-side hydration crash apart from a thrown HTTP error.
 *
 * - `client`  -- caught by `handleError` in `hooks.client.ts`. The browser
 *                ran into something we never modeled as an HTTP status
 *                (ReferenceError, hydration failure, async exception). The
 *                boundary renders an "App error" panel that hides the HTTP
 *                status row (it isn't meaningful) and shows the requestId.
 * - `server`  -- placeholder for symmetry with future `hooks.server.ts`
 *                error classification work. The boundary renders the
 *                existing `STATUS_TITLES[status]` panel.
 */
export const CLIENT_ERROR_KINDS = {
	CLIENT: 'client',
	SERVER: 'server',
} as const;
export type ClientErrorKind = (typeof CLIENT_ERROR_KINDS)[keyof typeof CLIENT_ERROR_KINDS];

/**
 * Window (ms) during which a duplicate report (same message + leading
 * stack) is suppressed. SvelteKit's `handleError` hook fires for caught
 * load-lifecycle errors; the `window.onerror` reporter in `+layout.svelte`
 * fires for anything outside that lifecycle. Both pipelines POST to
 * `ROUTES.API_CLIENT_ERROR`; without de-dupe, a hydration crash gets
 * reported twice. 5s is long enough to suppress the double-fire on the
 * same tick and short enough that two separate failures on the same
 * page still both reach the server.
 */
export const CLIENT_ERROR_DEDUPE_WINDOW_MS = 5_000;

/**
 * Title rendered in `+error.svelte` when `page.error?.kind === 'client'`.
 * "Something went wrong" is the wrong copy for a hydration crash because
 * it implies the server failed; a client-side ReferenceError happened
 * after the server returned 200. "App error" is neutral and matches what
 * a learner would describe to support.
 */
export const CLIENT_ERROR_TITLE = 'App error';
