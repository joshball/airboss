/**
 * BC reads + writes for the hangar invitation flow.
 *
 * Mirrors the dual-gate pattern in `user-writes.ts`: the form action
 * runs `requireRole(ADMIN)` and threads actor identity, the BC helper
 * does the actual mutation, and an audit row lands after the mutation
 * succeeds. Audit metadata carries `subKind` from the closed
 * `HANGAR_INVITATION_OP_SUBKINDS` set.
 *
 * Token + password handling:
 *
 *   - `crypto.getRandomValues` -> base64url for the bearer token; the
 *     length is `INVITATION_TOKEN_BYTES` (decision (b)).
 *   - Accept-time user creation hashes the password with
 *     `better-auth/crypto`'s `hashPassword` and inserts straight into
 *     `bauth_user` + `bauth_account` (the same direct-DB pattern dev
 *     seeding uses, because better-auth's `auth.api.signUpEmail` is
 *     gated by `disableSignUp: true` on this product). The BC then
 *     leaves session-creation to the page-server form action, which
 *     forwards a synthetic POST to `auth.handler` -- the same path
 *     `/login` uses.
 *
 * See `docs/work-packages/hangar-invite-flow/spec.md` decisions
 * (a)-(j) for the spec contract.
 */

import { AUDIT_OPS } from '@ab/audit';
import { auditWrite } from '@ab/audit/server';
import { bauthAccount, bauthUser } from '@ab/auth';
import {
	AUDIT_TARGETS,
	BETTER_AUTH_PROVIDERS,
	HANGAR_INVITATION_OP_SUBKINDS,
	type HangarInvitationOpSubkind,
	INVITATION_DEFAULT_EXPIRY_DAYS,
	INVITATION_TOKEN_BYTES,
	ROLES,
	type Role,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createId, generateAuthId } from '@ab/utils';
import { and, desc, eq, gt, isNotNull, isNull, lte } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	INVITATION_STATUS,
	INVITATIONS_LIST_LIMIT,
	type InvitationStatus,
	type InvitationStatusFilter,
} from './invitation-status';
import { type HangarInvitationRow, hangarInvitation } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// Pure status constants moved to ./invitation-status.ts so the runtime barrel
// can re-export them without dragging in @ab/db/connection.
export {
	INVITATION_DETAIL_AUDIT_LIMIT,
	INVITATION_STATUS,
	INVITATION_STATUS_VALUES,
	INVITATIONS_LIST_LIMIT,
	type InvitationStatus,
	type InvitationStatusFilter,
} from './invitation-status';

/** Compute the derived status of an invitation row at `now`. */
export function deriveInvitationStatus(row: HangarInvitationRow, now: Date = new Date()): InvitationStatus {
	if (row.acceptedAt != null) return INVITATION_STATUS.ACCEPTED;
	if (row.revokedAt != null) return INVITATION_STATUS.REVOKED;
	if (row.expiresAt.getTime() <= now.getTime()) return INVITATION_STATUS.EXPIRED;
	return INVITATION_STATUS.PENDING;
}

export interface InvitationListRow extends HangarInvitationRow {
	status: InvitationStatus;
	/** `bauth_user.name` of the inviter, falling back to email; null when
	 * the inviting user has been deleted (FK is `set null`). */
	invitedByName: string | null;
	invitedByEmail: string | null;
}

export interface ListInvitationsOptions {
	status?: InvitationStatusFilter;
	limit?: number;
}

export interface ListInvitationsResult {
	rows: readonly InvitationListRow[];
	counts: Record<InvitationStatus, number>;
	truncated: boolean;
}

/**
 * List invitations, joining the inviter's name/email so the table can
 * render "Invited by" without a second round trip. Status filtering is
 * pushed into the query so the LIMIT applies to the active tab only.
 */
export async function listInvitations(
	options: ListInvitationsOptions = {},
	db: Db = defaultDb,
): Promise<ListInvitationsResult> {
	const limit = Math.min(options.limit ?? INVITATIONS_LIST_LIMIT, INVITATIONS_LIST_LIMIT);
	const now = new Date();

	const baseQuery = db
		.select({
			invitation: hangarInvitation,
			invitedByName: bauthUser.name,
			invitedByEmail: bauthUser.email,
		})
		.from(hangarInvitation)
		.leftJoin(bauthUser, eq(hangarInvitation.invitedByUserId, bauthUser.id));

	const status = options.status ?? 'all';
	const where = statusWhereClause(status, now);
	const ordered = where
		? baseQuery.where(where).orderBy(desc(hangarInvitation.invitedAt))
		: baseQuery.orderBy(desc(hangarInvitation.invitedAt));

	const raw = await ordered.limit(limit);

	const rows: InvitationListRow[] = raw.map((r) => ({
		...r.invitation,
		status: deriveInvitationStatus(r.invitation, now),
		invitedByName: r.invitedByName ?? null,
		invitedByEmail: r.invitedByEmail ?? null,
	}));

	// Pull a fresh count-per-status independent of the active filter so
	// the tabs can show "(3 pending) (12 accepted)" tallies even when the
	// filter narrows the table. One round trip; the hangar invite set is
	// small.
	const allRows = await db.select().from(hangarInvitation);
	const counts: Record<InvitationStatus, number> = {
		[INVITATION_STATUS.PENDING]: 0,
		[INVITATION_STATUS.ACCEPTED]: 0,
		[INVITATION_STATUS.REVOKED]: 0,
		[INVITATION_STATUS.EXPIRED]: 0,
	};
	for (const r of allRows) counts[deriveInvitationStatus(r, now)] += 1;

	return {
		rows,
		counts,
		truncated: rows.length === limit,
	};
}

/** Build the status WHERE clause; null when the filter is `'all'`. */
function statusWhereClause(status: InvitationStatusFilter, now: Date) {
	switch (status) {
		case INVITATION_STATUS.PENDING:
			return and(
				isNull(hangarInvitation.acceptedAt),
				isNull(hangarInvitation.revokedAt),
				gt(hangarInvitation.expiresAt, now),
			);
		case INVITATION_STATUS.EXPIRED:
			return and(
				isNull(hangarInvitation.acceptedAt),
				isNull(hangarInvitation.revokedAt),
				lte(hangarInvitation.expiresAt, now),
			);
		case INVITATION_STATUS.ACCEPTED:
			return isNotNull(hangarInvitation.acceptedAt);
		case INVITATION_STATUS.REVOKED:
			return isNotNull(hangarInvitation.revokedAt);
		default:
			return null;
	}
}

/** Read a single invitation by id. Null if not found. */
export async function getInvitation(id: string, db: Db = defaultDb): Promise<HangarInvitationRow | null> {
	const [row] = await db.select().from(hangarInvitation).where(eq(hangarInvitation.id, id)).limit(1);
	return row ?? null;
}

/**
 * Read a single invitation by token. Null if the token doesn't match a
 * row. The accept route uses this for its server-load lookup; the route
 * still re-checks status + expiry server-side at form-submit time so
 * the returned row CAN be in any state.
 */
export async function getInvitationByToken(token: string, db: Db = defaultDb): Promise<HangarInvitationRow | null> {
	const [row] = await db.select().from(hangarInvitation).where(eq(hangarInvitation.token, token)).limit(1);
	return row ?? null;
}

/**
 * Read the most recent N rows where the inviter is `userId` -- used by
 * the user-detail page to surface "invitations you've sent". Optional;
 * not exposed today but cheap to leave for the next iteration.
 */
export async function listInvitationsBySender(
	userId: string,
	limit = INVITATIONS_LIST_LIMIT,
	db: Db = defaultDb,
): Promise<readonly HangarInvitationRow[]> {
	return db
		.select()
		.from(hangarInvitation)
		.where(eq(hangarInvitation.invitedByUserId, userId))
		.orderBy(desc(hangarInvitation.invitedAt))
		.limit(limit);
}

/* ----------------------------------------------------------------------------
 * Errors
 * -------------------------------------------------------------------------- */

/** Recipient already exists in `bauth_user`. The form action redirects to
 * `/users/[existingUserId]` instead of creating a fresh invitation. */
export class EmailAlreadyExistsError extends Error {
	constructor(
		public readonly email: string,
		public readonly existingUserId: string,
	) {
		super(`A user with email ${email} already exists.`);
		this.name = 'EmailAlreadyExistsError';
	}
}

/** A pending invitation already exists for this email. Decision (f). */
export class PendingInvitationExistsError extends Error {
	constructor(
		public readonly email: string,
		public readonly existingInvitationId: string,
	) {
		super(`A pending invitation for ${email} already exists.`);
		this.name = 'PendingInvitationExistsError';
	}
}

/** Email send returned false; insert rolled back. Decision (c). */
export class InvitationEmailSendFailedError extends Error {
	constructor(public readonly email: string) {
		super(`Failed to send the invitation email to ${email}.`);
		this.name = 'InvitationEmailSendFailedError';
	}
}

/** Invitation cannot be revoked / resent / accepted in its current state. */
export class InvitationStateError extends Error {
	constructor(
		public readonly invitationId: string,
		public readonly status: InvitationStatus,
		public readonly attemptedOp: 'revoke' | 'resend' | 'accept',
	) {
		super(`Cannot ${attemptedOp} an invitation in '${status}' state.`);
		this.name = 'InvitationStateError';
	}
}

/** Invite-to-admin is forbidden by spec (decision (e)). The Zod parse
 * already rejects this server-side; the BC also asserts so a programmatic
 * caller can't bypass the form layer. */
export class InvitationRoleForbiddenError extends Error {
	constructor(public readonly proposedRole: Role) {
		super(`Cannot invite a user with role '${proposedRole}'.`);
		this.name = 'InvitationRoleForbiddenError';
	}
}

/* ----------------------------------------------------------------------------
 * Token generation
 * -------------------------------------------------------------------------- */

/**
 * Generate a base64url-encoded random token. base64url avoids `+` / `/`
 * (which would need percent-encoding in URLs) and `=` padding (which is
 * cosmetic for our fixed length).
 */
export function generateInvitationToken(byteLength = INVITATION_TOKEN_BYTES): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
	const base64 = btoa(binary);
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Last 8 chars of the token, for audit metadata (`tokenSuffix`). */
function tokenSuffix(token: string): string {
	return token.slice(-8);
}

/* ----------------------------------------------------------------------------
 * Email transport seam
 *
 * The BC accepts a `sendEmail`-shaped function so unit tests can inject a
 * mock without touching the real Resend client. Production callers pass
 * the canonical `sendEmail` from `@ab/auth` (which logs to console in
 * dev when `RESEND_API_KEY` is missing).
 * -------------------------------------------------------------------------- */

export interface InvitationEmailContent {
	subject: string;
	html: string;
}

export interface InvitationEmailContext {
	email: string;
	role: Role;
	acceptUrl: string;
	expiryDays: number;
	invitedByName: string;
	invitedByEmail: string;
}

export type InvitationEmailRenderer = (ctx: InvitationEmailContext) => InvitationEmailContent;

export type InvitationEmailSender = (message: { to: string; subject: string; html: string }) => Promise<boolean>;

/* ----------------------------------------------------------------------------
 * Password hash seam
 *
 * Same reasoning as the email seam -- the unit tests provide a fake
 * hasher so they don't import better-auth's scrypt module. Production
 * callers pass a thin wrapper around `better-auth/crypto`'s
 * `hashPassword`.
 * -------------------------------------------------------------------------- */

export type PasswordHasher = (password: string) => Promise<string>;

/* ----------------------------------------------------------------------------
 * Create
 * -------------------------------------------------------------------------- */

export interface CreateInvitationInput {
	actorId: string;
	actorEmail: string;
	actorName: string;
	email: string;
	proposedRole: Role;
	acceptUrlBuilder: (token: string) => string;
	renderEmail: InvitationEmailRenderer;
	sendEmail: InvitationEmailSender;
	now?: Date;
	requestId: string | null;
	userAgent: string | null;
	expiryDays?: number;
}

export interface CreateInvitationResult {
	invitation: HangarInvitationRow;
	emailSent: true;
}

/**
 * Create a new invitation row, send the email, audit. The DB insert and
 * email send share a single transaction (decision (c)): if the email
 * send returns false (or throws) the row is rolled back. Audit emission
 * happens AFTER the email confirms so an email-send failure leaves no
 * audit row.
 */
export async function createInvitation(
	input: CreateInvitationInput,
	db: Db = defaultDb,
): Promise<CreateInvitationResult> {
	if (input.proposedRole === ROLES.ADMIN) {
		throw new InvitationRoleForbiddenError(input.proposedRole);
	}

	const email = input.email.trim().toLowerCase();
	const now = input.now ?? new Date();
	const expiryDays = input.expiryDays ?? INVITATION_DEFAULT_EXPIRY_DAYS;

	// Pre-flight checks outside the transaction so a 409-shaped failure
	// doesn't ride a round trip through the email transport.
	const [existingUser] = await db
		.select({ id: bauthUser.id })
		.from(bauthUser)
		.where(eq(bauthUser.email, email))
		.limit(1);
	if (existingUser) {
		throw new EmailAlreadyExistsError(email, existingUser.id);
	}

	const [existingPending] = await db
		.select({ id: hangarInvitation.id })
		.from(hangarInvitation)
		.where(
			and(eq(hangarInvitation.email, email), isNull(hangarInvitation.acceptedAt), isNull(hangarInvitation.revokedAt)),
		)
		.limit(1);
	if (existingPending) {
		throw new PendingInvitationExistsError(email, existingPending.id);
	}

	const token = generateInvitationToken();
	const invitedAt = now;
	const expiresAt = new Date(invitedAt.getTime() + expiryDays * 24 * 60 * 60 * 1000);
	const acceptUrl = input.acceptUrlBuilder(token);

	const inserted = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(hangarInvitation)
			.values({
				id: createId('inv'),
				email,
				proposedRole: input.proposedRole,
				token,
				invitedByUserId: input.actorId,
				invitedAt,
				expiresAt,
			})
			.returning();
		if (!row) {
			throw new Error('Failed to insert invitation row.');
		}

		const { subject, html } = input.renderEmail({
			email,
			role: input.proposedRole,
			acceptUrl,
			expiryDays,
			invitedByName: input.actorName,
			invitedByEmail: input.actorEmail,
		});
		const ok = await input.sendEmail({ to: email, subject, html });
		if (!ok) {
			throw new InvitationEmailSendFailedError(email);
		}

		return row;
	});

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.CREATE,
			targetType: AUDIT_TARGETS.HANGAR_INVITATION,
			targetId: inserted.id,
			before: null,
			after: snapshotForAudit(inserted),
			metadata: buildAuditMeta({
				subKind: HANGAR_INVITATION_OP_SUBKINDS.CREATE,
				email,
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
				extras: { tokenSuffix: tokenSuffix(token), expiresAt: expiresAt.toISOString() },
			}),
		},
		db,
	);

	return { invitation: inserted, emailSent: true };
}

/* ----------------------------------------------------------------------------
 * Revoke
 * -------------------------------------------------------------------------- */

export interface RevokeInvitationInput {
	actorId: string;
	actorEmail: string;
	invitationId: string;
	now?: Date;
	requestId: string | null;
	userAgent: string | null;
}

export interface RevokeInvitationResult {
	invitation: HangarInvitationRow;
	before: HangarInvitationRow;
}

/**
 * Soft-delete a pending invitation. Sets `revoked_at` + `revoked_by_user_id`.
 * The token becomes un-redeemable (the accept route's status check 404s).
 */
export async function revokeInvitation(
	input: RevokeInvitationInput,
	db: Db = defaultDb,
): Promise<RevokeInvitationResult> {
	const before = await getInvitation(input.invitationId, db);
	if (!before) {
		throw new InvitationStateError(input.invitationId, INVITATION_STATUS.EXPIRED, 'revoke');
	}
	const now = input.now ?? new Date();
	const status = deriveInvitationStatus(before, now);
	if (status !== INVITATION_STATUS.PENDING && status !== INVITATION_STATUS.EXPIRED) {
		throw new InvitationStateError(input.invitationId, status, 'revoke');
	}

	const [updated] = await db
		.update(hangarInvitation)
		.set({ revokedAt: now, revokedByUserId: input.actorId })
		.where(eq(hangarInvitation.id, input.invitationId))
		.returning();

	if (!updated) {
		throw new InvitationStateError(input.invitationId, status, 'revoke');
	}

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_INVITATION,
			targetId: updated.id,
			before: { revokedAt: null, revokedByUserId: null },
			after: { revokedAt: updated.revokedAt, revokedByUserId: updated.revokedByUserId },
			metadata: buildAuditMeta({
				subKind: HANGAR_INVITATION_OP_SUBKINDS.REVOKE,
				email: updated.email,
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
			}),
		},
		db,
	);

	return { invitation: updated, before };
}

/* ----------------------------------------------------------------------------
 * Resend
 * -------------------------------------------------------------------------- */

export interface ResendInvitationInput {
	actorId: string;
	actorEmail: string;
	actorName: string;
	invitationId: string;
	acceptUrlBuilder: (token: string) => string;
	renderEmail: InvitationEmailRenderer;
	sendEmail: InvitationEmailSender;
	now?: Date;
	requestId: string | null;
	userAgent: string | null;
	expiryDays?: number;
}

export interface ResendInvitationResult {
	invitation: HangarInvitationRow;
	oldTokenSuffix: string;
	newTokenSuffix: string;
}

/**
 * Regenerate the token (decision (d)), bump `invited_at` + `expires_at`,
 * re-email. Wrapped in a transaction so a send failure rolls back the
 * row update.
 */
export async function resendInvitation(
	input: ResendInvitationInput,
	db: Db = defaultDb,
): Promise<ResendInvitationResult> {
	const before = await getInvitation(input.invitationId, db);
	if (!before) {
		throw new InvitationStateError(input.invitationId, INVITATION_STATUS.EXPIRED, 'resend');
	}
	const now = input.now ?? new Date();
	const status = deriveInvitationStatus(before, now);
	if (status !== INVITATION_STATUS.PENDING && status !== INVITATION_STATUS.EXPIRED) {
		throw new InvitationStateError(input.invitationId, status, 'resend');
	}

	const expiryDays = input.expiryDays ?? INVITATION_DEFAULT_EXPIRY_DAYS;
	const newToken = generateInvitationToken();
	const newExpiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
	const acceptUrl = input.acceptUrlBuilder(newToken);

	const updated = await db.transaction(async (tx) => {
		const [row] = await tx
			.update(hangarInvitation)
			.set({ token: newToken, invitedAt: now, expiresAt: newExpiresAt })
			.where(eq(hangarInvitation.id, input.invitationId))
			.returning();
		if (!row) {
			throw new InvitationStateError(input.invitationId, status, 'resend');
		}

		const { subject, html } = input.renderEmail({
			email: row.email,
			role: row.proposedRole as Role,
			acceptUrl,
			expiryDays,
			invitedByName: input.actorName,
			invitedByEmail: input.actorEmail,
		});
		const ok = await input.sendEmail({ to: row.email, subject, html });
		if (!ok) {
			throw new InvitationEmailSendFailedError(row.email);
		}

		return row;
	});

	await auditWrite(
		{
			actorId: input.actorId,
			op: AUDIT_OPS.ACTION,
			targetType: AUDIT_TARGETS.HANGAR_INVITATION,
			targetId: updated.id,
			before: null,
			after: null,
			metadata: buildAuditMeta({
				subKind: HANGAR_INVITATION_OP_SUBKINDS.RESEND,
				email: updated.email,
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: input.actorEmail,
				extras: {
					oldTokenSuffix: tokenSuffix(before.token),
					newTokenSuffix: tokenSuffix(newToken),
					expiresAt: newExpiresAt.toISOString(),
				},
			}),
		},
		db,
	);

	return {
		invitation: updated,
		oldTokenSuffix: tokenSuffix(before.token),
		newTokenSuffix: tokenSuffix(newToken),
	};
}

/* ----------------------------------------------------------------------------
 * Accept
 * -------------------------------------------------------------------------- */

export interface AcceptInvitationInput {
	token: string;
	password: string;
	hashPassword: PasswordHasher;
	now?: Date;
	requestId: string | null;
	userAgent: string | null;
}

export interface AcceptInvitationResult {
	invitation: HangarInvitationRow;
	user: { id: string; email: string; role: Role };
}

/**
 * Redeem an invitation: validate token, create the bauth user + account,
 * mark the invitation accepted. Atomic: any step failing rolls back the
 * lot. Session creation is left to the caller (the page-server form
 * action) -- it forwards a synthetic POST to `auth.handler`'s sign-in
 * endpoint after this returns successfully, mirroring the `/login`
 * flow.
 *
 * Direct DB inserts (rather than `auth.api.signUpEmail` or
 * `auth.api.createUser`) because:
 *
 *   - `signUpEmail` is gated by `disableSignUp: true` (private product).
 *   - `createUser` requires admin-context headers which the public
 *     accept route doesn't have. The token + email are the credential.
 *
 * The seed-script `scripts/db/seed-dev-users.ts` uses the same insert
 * shape; this BC re-uses that pattern.
 */
export async function acceptInvitation(
	input: AcceptInvitationInput,
	db: Db = defaultDb,
): Promise<AcceptInvitationResult> {
	const now = input.now ?? new Date();
	const before = await getInvitationByToken(input.token, db);
	if (!before) {
		throw new InvitationStateError('<unknown>', INVITATION_STATUS.EXPIRED, 'accept');
	}
	const status = deriveInvitationStatus(before, now);
	if (status !== INVITATION_STATUS.PENDING) {
		throw new InvitationStateError(before.id, status, 'accept');
	}

	const hashedPassword = await input.hashPassword(input.password);

	const result = await db.transaction(async (tx) => {
		// Re-check the token + status under the transaction to close the
		// "two clicks at once" race window. `bauthUser.email` is unique;
		// the insert below would fail anyway, but a typed error message
		// from the up-front check is friendlier.
		const [reCheck] = await tx.select().from(hangarInvitation).where(eq(hangarInvitation.id, before.id)).limit(1);
		if (!reCheck) {
			throw new InvitationStateError(before.id, status, 'accept');
		}
		const reStatus = deriveInvitationStatus(reCheck, now);
		if (reStatus !== INVITATION_STATUS.PENDING) {
			throw new InvitationStateError(before.id, reStatus, 'accept');
		}

		const userId = generateAuthId();
		const [insertedUser] = await tx
			.insert(bauthUser)
			.values({
				id: userId,
				email: before.email,
				name: before.email,
				firstName: '',
				lastName: '',
				emailVerified: true,
				role: before.proposedRole,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		if (!insertedUser) {
			throw new Error('Failed to insert bauth_user row.');
		}

		await tx.insert(bauthAccount).values({
			id: generateAuthId(),
			userId,
			accountId: userId,
			providerId: BETTER_AUTH_PROVIDERS.CREDENTIAL,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now,
		});

		const [updatedInvitation] = await tx
			.update(hangarInvitation)
			.set({ acceptedAt: now, acceptedUserId: userId })
			.where(eq(hangarInvitation.id, before.id))
			.returning();
		if (!updatedInvitation) {
			throw new InvitationStateError(before.id, reStatus, 'accept');
		}

		return { invitation: updatedInvitation, user: insertedUser };
	});

	await auditWrite(
		{
			// The acting user is the new account itself.
			actorId: result.user.id,
			op: AUDIT_OPS.ACTION,
			targetType: AUDIT_TARGETS.HANGAR_INVITATION,
			targetId: result.invitation.id,
			before: null,
			after: null,
			metadata: buildAuditMeta({
				subKind: HANGAR_INVITATION_OP_SUBKINDS.ACCEPT,
				email: result.invitation.email,
				requestId: input.requestId,
				userAgent: input.userAgent,
				actorEmail: null,
				extras: {
					acceptedUserId: result.user.id,
					acceptedRole: result.invitation.proposedRole,
					tokenSuffix: tokenSuffix(input.token),
				},
			}),
		},
		db,
	);

	return {
		invitation: result.invitation,
		user: { id: result.user.id, email: result.user.email, role: result.invitation.proposedRole as Role },
	};
}

/* ----------------------------------------------------------------------------
 * Audit metadata helper
 * -------------------------------------------------------------------------- */

interface BuildAuditMetaInput {
	subKind: HangarInvitationOpSubkind;
	email: string;
	requestId: string | null;
	userAgent: string | null;
	/** `null` for accept (the actor IS the new user; identity flows via acceptedUserId). */
	actorEmail: string | null;
	extras?: Record<string, unknown>;
}

function buildAuditMeta(input: BuildAuditMetaInput): Record<string, unknown> {
	return {
		subKind: input.subKind,
		email: input.email,
		requestId: input.requestId,
		userAgent: input.userAgent,
		actorEmail: input.actorEmail,
		...(input.extras ?? {}),
	};
}

/** Subset of the row appropriate for the `before`/`after` audit jsonb. */
function snapshotForAudit(row: HangarInvitationRow): Record<string, unknown> {
	return {
		id: row.id,
		email: row.email,
		proposedRole: row.proposedRole,
		invitedAt: row.invitedAt.toISOString(),
		expiresAt: row.expiresAt.toISOString(),
	};
}
