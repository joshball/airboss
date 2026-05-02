// Audit lib -- action logging, cross-cutting change-log substrate.
// Every app writes. Admin surfaces (hangar) read.

export {
	AUTH_LOGIN_FAILED_OUTCOMES,
	type AuthEventContext,
	type AuthEventEmitter,
	type AuthLoginFailedOutcome,
	createAuditAuthEventEmitter,
} from './auth-events';
export { auditRecent, auditWrite, countAuditEntriesSince } from './log';
export {
	AUDIT_OP_VALUES,
	AUDIT_OPS,
	type AuditLogRow,
	type AuditOp,
	auditLog,
	auditSchema,
	type NewAuditLogRow,
} from './schema';
