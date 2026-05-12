// Server-only entry point for `@ab/audit`. Everything here either opens the
// DB pool (`@ab/db/connection`) or returns a value that does. Importing this
// module from `.svelte` or any client-bundled `.ts` file drags the postgres
// driver into the browser bundle and crashes hydration with `ReferenceError:
// Buffer is not defined` (postgres' `bytes.js` evaluates `Buffer.allocUnsafe`
// at module top).
//
// `+page.server.ts`, `+server.ts`, `apps/*/src/lib/server/**`, scripts, and
// per-BC server-side code import from here. The runtime barrel
// (`@ab/audit`) keeps only the schema constants, types, and Drizzle table
// objects -- everything else lives here.

export {
	AUTH_LOGIN_FAILED_OUTCOMES,
	type AuthEventContext,
	type AuthEventEmitter,
	type AuthLoginFailedOutcome,
} from './auth-events-types';
export { createAuditAuthEventEmitter } from './auth-events';
export { auditRecent, auditWrite, countAuditEntriesSince, InvalidAuditTargetError } from './log';
