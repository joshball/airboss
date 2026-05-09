// Pure invitation status constants -- extracted from `./invitations.ts`
// so they can be re-exported from the runtime barrel without dragging the
// postgres driver into the browser bundle. Used by the invitation UI
// (`+page.svelte`) to render status badges + filter chips.

export const INVITATION_STATUS = {
	PENDING: 'pending',
	ACCEPTED: 'accepted',
	REVOKED: 'revoked',
	EXPIRED: 'expired',
} as const;

export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export const INVITATION_STATUS_VALUES: readonly InvitationStatus[] = Object.values(INVITATION_STATUS);

/** Status filter accepted by `listInvitations`. `'all'` means no filter. */
export type InvitationStatusFilter = InvitationStatus | 'all';

/** Hard cap on `listInvitations`. */
export const INVITATIONS_LIST_LIMIT = 200;

/** Recent audit rows shown on the invitation-detail page. */
export const INVITATION_DETAIL_AUDIT_LIMIT = 20;
