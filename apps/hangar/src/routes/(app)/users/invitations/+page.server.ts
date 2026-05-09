import { inviteEmail, requireRole, sendEmail } from '@ab/auth';
import {
	CreateInvitationInputSchema,
	createInvitation,
	EmailAlreadyExistsError,
	INVITATION_STATUS,
	INVITATION_STATUS_VALUES,
	InvitationEmailSendFailedError,
	InvitationRoleForbiddenError,
	type InvitationStatusFilter,
	listInvitations,
	PendingInvitationExistsError,
} from '@ab/bc-hangar/server';
import {
	HOST_PREFIXES,
	INVITATION_DEFAULT_EXPIRY_DAYS,
	QUERY_PARAMS,
	ROLES,
	ROUTES,
	type Role,
	siblingOrigin,
} from '@ab/constants';
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const STATUS_FILTERS: readonly InvitationStatusFilter[] = [...INVITATION_STATUS_VALUES, 'all'];

function parseStatusFilter(raw: string | null): InvitationStatusFilter {
	if (!raw) return INVITATION_STATUS.PENDING;
	return STATUS_FILTERS.includes(raw as InvitationStatusFilter)
		? (raw as InvitationStatusFilter)
		: INVITATION_STATUS.PENDING;
}

/**
 * Invitation directory. Lists pending / accepted / revoked / expired
 * invitations from `hangar.invitation`. ADMIN-only -- the (app) layout
 * already gates AUTHOR | OPERATOR | ADMIN, this surface narrows the
 * floor to ADMIN to match `/users` and `/users/[id]`.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	const status = parseStatusFilter(event.url.searchParams.get(QUERY_PARAMS.STATUS));
	const result = await listInvitations({ status });
	return {
		filters: { status },
		rows: result.rows.map((r) => ({
			id: r.id,
			email: r.email,
			proposedRole: r.proposedRole as Role,
			status: r.status,
			invitedAt: r.invitedAt.toISOString(),
			expiresAt: r.expiresAt.toISOString(),
			acceptedAt: r.acceptedAt?.toISOString() ?? null,
			revokedAt: r.revokedAt?.toISOString() ?? null,
			invitedByName: r.invitedByName,
			invitedByEmail: r.invitedByEmail,
		})),
		counts: result.counts,
		truncated: result.truncated,
	};
};

function buildAcceptUrl(event: RequestEvent, token: string): string {
	const studyOrigin = siblingOrigin(event.url, HOST_PREFIXES.STUDY);
	return `${studyOrigin}${ROUTES.STUDY_INVITE_ACCEPT(token)}`;
}

function buildActorContext(event: RequestEvent) {
	const session = event.locals.session;
	const user = event.locals.user;
	if (!session || !user) {
		throw error(401, 'Not signed in');
	}
	return {
		actorId: user.id,
		actorEmail: user.email,
		actorName: user.name?.trim() || user.email,
		requestId: event.locals.requestId ?? null,
		userAgent: event.request.headers.get('user-agent'),
	};
}

export const actions: Actions = {
	createInvitation: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();
		const parsed = CreateInvitationInputSchema.safeParse({
			email: formData.get('email'),
			proposedRole: formData.get('proposedRole'),
		});
		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Invalid input',
				email: typeof formData.get('email') === 'string' ? (formData.get('email') as string) : '',
			});
		}

		try {
			const result = await createInvitation({
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				actorName: ctx.actorName,
				email: parsed.data.email,
				proposedRole: parsed.data.proposedRole as Role,
				acceptUrlBuilder: (token) => buildAcceptUrl(event, token),
				renderEmail: (input) =>
					inviteEmail({
						url: input.acceptUrl,
						role: input.role,
						inviterName: input.invitedByName,
						expiryDays: input.expiryDays,
					}),
				sendEmail,
				expiryDays: INVITATION_DEFAULT_EXPIRY_DAYS,
				requestId: ctx.requestId,
				userAgent: ctx.userAgent,
			});
			return { ok: true, op: 'create-invitation' as const, invitationId: result.invitation.id };
		} catch (err) {
			if (err instanceof EmailAlreadyExistsError) {
				return fail(409, {
					error: `User ${err.email} already exists. Use the role picker on /users/[id] to change their role.`,
					existingUserId: err.existingUserId,
					email: parsed.data.email,
				});
			}
			if (err instanceof PendingInvitationExistsError) {
				return fail(409, {
					error: 'A pending invitation for this email already exists. Revoke or resend it from the detail page.',
					existingInvitationId: err.existingInvitationId,
					email: parsed.data.email,
				});
			}
			if (err instanceof InvitationRoleForbiddenError) {
				return fail(400, {
					error: 'Invites cannot grant the admin role. Use the role picker on /users/[id] to promote an existing user.',
					email: parsed.data.email,
				});
			}
			if (err instanceof InvitationEmailSendFailedError) {
				return fail(502, {
					error: 'Failed to send the invitation email. Please retry.',
					email: parsed.data.email,
				});
			}
			throw err;
		}
	},
};
