// Audit lib -- action logging, cross-cutting change-log substrate.
// Every app writes. Admin surfaces (hangar) read.
//
// Two public entry points:
//
//   `@ab/audit`        (this file) -- browser-safe. Schema constants, types,
//                                     Drizzle table objects, the failed-login
//                                     discriminator. Importable from `.svelte`
//                                     and any client-bundled `.ts`.
//
//   `@ab/audit/server` (./server.ts) -- server-only. `auditWrite`,
//                                       `auditRecent`, `countAuditEntriesSince`,
//                                       `InvalidAuditTargetError`, and
//                                       `createAuditAuthEventEmitter` --
//                                       everything that value-imports
//                                       `@ab/db/connection` and would crash
//                                       hydration with `ReferenceError:
//                                       Buffer is not defined` if pulled
//                                       into the client bundle.
//
// Use the `/server` entry point from `+page.server.ts`, `+server.ts`,
// `apps/*/src/lib/server/**`, scripts, and per-BC server-side code. Use the
// runtime barrel for component code that only needs the constants / types.

export {
	AUTH_LOGIN_FAILED_OUTCOMES,
	type AuthEventContext,
	type AuthEventEmitter,
	type AuthLoginFailedOutcome,
} from './auth-events-types';
export {
	AUDIT_OP_VALUES,
	AUDIT_OPS,
	type AuditLogRow,
	type AuditOp,
	auditLog,
	auditSchema,
	type NewAuditLogRow,
} from './schema';
