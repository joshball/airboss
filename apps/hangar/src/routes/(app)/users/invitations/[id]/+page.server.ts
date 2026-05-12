import { auditRecent } from '@ab/audit/server';
import { inviteEmail, requireRole, sendEmail } from '@ab/auth';
import {
	deriveInvitationStatus,
	getInvitation,
	INVITATION_DETAIL_AUDIT_LIMIT,
	InvitationEmailSendFailedError,
	InvitationStateError,
	ResendInvitationInputSchema,
	RevokeInvitationInputSchema,
	resendInvitation,
	revokeInvitation,
} from '@ab/bc-hangar/server';
import {
	AUDIT_TARGETS,
	HOST_PREFIXES,
	INVITATION_DEFAULT_EXPIRY_DAYS,
	ROLES,
	ROUTES,
	type Role,
	siblingOrigin,
} from '@ab/constants';
import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * Detail page for one invitation: full row + audit history + admin
 * actions (revoke, resend). ADMIN-only.
 */
export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);

	const id = event.params.id;
	const invitation = await getInvitation(id);
	if (!invitation) error(404, 'Invitation not found');

	const audits = await auditRecent({
		targetType: AUDIT_TARGETS.HANGAR_INVITATION,
		targetId: id,
		limit: INVITATION_DETAIL_AUDIT_LIMIT,
	});

	return {
		invitation: {
			id: invitation.id,
			email: invitation.email,
			proposedRole: invitation.proposedRole as Role,
			invitedAt: invitation.invitedAt.toISOString(),
			expiresAt: invitation.expiresAt.toISOString(),
			acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
			acceptedUserId: invitation.acceptedUserId,
			revokedAt: invitation.revokedAt?.toISOString() ?? null,
			revokedByUserId: invitation.revokedByUserId,
			invitedByUserId: invitation.invitedByUserId,
			status: deriveInvitationStatus(invitation),
		},
		audits: audits.map((a) => ({
			id: a.id,
			timestamp: a.timestamp.toISOString(),
			op: a.op,
			subKind: (a.metadata as Record<string, unknown> | null)?.subKind as string | null | undefined,
			actorEmail: ((a.metadata as Record<string, unknown> | null)?.actorEmail as string | null | undefined) ?? null,
		})),
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
	revokeInvitation: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();
		const parsed = RevokeInvitationInputSchema.safeParse({
			invitationId: formData.get('invitationId'),
			confirmEmail: formData.get('confirmedTarget') ?? formData.get('confirmEmail'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		const target = await getInvitation(parsed.data.invitationId);
		if (!target) return fail(404, { error: 'Invitation not found' });
		if (parsed.data.confirmEmail !== target.email) {
			return fail(400, { error: 'Typed confirmation does not match the recipient email' });
		}

		try {
			await revokeInvitation({
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				invitationId: parsed.data.invitationId,
				requestId: ctx.requestId,
				userAgent: ctx.userAgent,
			});
		} catch (err) {
			if (err instanceof InvitationStateError) {
				return fail(409, { error: err.message });
			}
			throw err;
		}

		return { ok: true, op: 'revoke-invitation' as const };
	},

	resendInvitation: async (event) => {
		requireRole(event, ROLES.ADMIN);
		const ctx = buildActorContext(event);
		const formData = await event.request.formData();
		const parsed = ResendInvitationInputSchema.safeParse({
			invitationId: formData.get('invitationId'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		try {
			await resendInvitation({
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				actorName: ctx.actorName,
				invitationId: parsed.data.invitationId,
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
		} catch (err) {
			if (err instanceof InvitationStateError) {
				return fail(409, { error: err.message });
			}
			if (err instanceof InvitationEmailSendFailedError) {
				return fail(502, { error: 'Failed to send the invitation email. Please retry.' });
			}
			throw err;
		}

		return { ok: true, op: 'resend-invitation' as const };
	},
};
