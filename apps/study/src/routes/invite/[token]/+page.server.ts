import { bauthUser } from '@ab/auth';
import {
	AcceptInvitationInputSchema,
	acceptInvitation,
	deriveInvitationStatus,
	getInvitationByToken,
	INVITATION_STATUS,
	InvitationStateError,
} from '@ab/bc-hangar';
import { AUTH_INTERNAL_ORIGIN, BETTER_AUTH_ENDPOINTS, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { forwardAuthCookies } from '$lib/server/cookies';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:invite-accept');

/**
 * Public invite-acceptance route. Sits outside the `(app)` group so the
 * layout-level `requireAuth` doesn't apply -- the URL token IS the
 * credential. The hangar admin who created the invite has already
 * passed the auth gate; the recipient needs the link to land here, set
 * a password, and walk straight into the (app) shell.
 *
 * Server-load fetches the invitation row by token; 404s on every non-
 * pending status (no leakage between "doesn't exist", "expired",
 * "already accepted", "revoked"). Pending rows return the recipient's
 * email + role + inviter name so the form can render with the email
 * pre-filled (read-only per decision (g)) and the role visible.
 */
export const load: PageServerLoad = async (event) => {
	const token = event.params.token;
	const invitation = await getInvitationByToken(token);
	if (!invitation) error(404, 'Invitation not found');

	const status = deriveInvitationStatus(invitation);
	if (status !== INVITATION_STATUS.PENDING) {
		// Decision (i): no leakage. Same 404 for every dead-end state.
		error(404, 'Invitation not found');
	}

	let inviterName: string | null = null;
	if (invitation.invitedByUserId) {
		const [row] = await db
			.select({ name: bauthUser.name, email: bauthUser.email })
			.from(bauthUser)
			.where(eq(bauthUser.id, invitation.invitedByUserId))
			.limit(1);
		inviterName = row?.name?.trim() || row?.email || null;
	}

	return {
		invitation: {
			email: invitation.email,
			proposedRole: invitation.proposedRole,
			expiresAt: invitation.expiresAt.toISOString(),
		},
		inviterName,
		signedInAs: event.locals.user ? { id: event.locals.user.id, email: event.locals.user.email } : null,
	};
};

/** Hashed-password helper backed by better-auth's scrypt. */
async function hashPassword(plain: string): Promise<string> {
	const { hashPassword: hp } = await import('better-auth/crypto');
	return hp(plain);
}

export const actions: Actions = {
	accept: async (event) => {
		const formData = await event.request.formData();
		const parsed = AcceptInvitationInputSchema.safeParse({
			token: event.params.token,
			password: formData.get('password'),
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Invalid input' });
		}

		const requestId = event.locals.requestId ?? null;
		const userAgent = event.request.headers.get('user-agent');

		let acceptedEmail: string;
		try {
			const result = await acceptInvitation({
				token: parsed.data.token,
				password: parsed.data.password,
				hashPassword,
				requestId,
				userAgent,
			});
			acceptedEmail = result.user.email;
		} catch (err) {
			if (err instanceof InvitationStateError) {
				log.warn('invite accept rejected', {
					requestId,
					metadata: { invitationId: err.invitationId, status: err.status },
				});
				// 404 the public surface -- treat any non-pending state the
				// same as "no such invitation" to avoid leaking the row's
				// timeline.
				error(404, 'Invitation not found');
			}
			throw err;
		}

		// Issue the new session by forwarding to better-auth's sign-in
		// endpoint, mirroring the `/login` flow. We don't reuse the live
		// session header on this request because the user is signing in
		// anew; better-auth's rate-limiter sees the origin x-forwarded-for
		// for proper bucketing.
		const signInHeaders = new Headers({
			'content-type': 'application/json',
			'x-forwarded-for': event.getClientAddress(),
		});
		const signInRequest = new Request(
			`${AUTH_INTERNAL_ORIGIN}${ROUTES.API_AUTH}${BETTER_AUTH_ENDPOINTS.SIGN_IN_EMAIL}`,
			{
				method: 'POST',
				headers: signInHeaders,
				body: JSON.stringify({ email: acceptedEmail, password: parsed.data.password }),
			},
		);
		const signInResponse = await auth.handler(signInRequest);
		if (!signInResponse.ok) {
			log.error('post-accept sign-in failed', {
				requestId,
				metadata: { status: signInResponse.status, email: acceptedEmail },
			});
			// The accept already landed -- the user can sign in via /login
			// directly. Surface a clear redirect rather than 500-ing.
			redirect(303, ROUTES.LOGIN);
		}

		forwardAuthCookies(signInResponse, event.cookies, event.url.host);
		redirect(303, ROUTES.DASHBOARD);
	},
};
