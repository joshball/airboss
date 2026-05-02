<script lang="ts">
import { INVITATION_STATUS, type InvitationStatus } from '@ab/bc-hangar';
import { ROLE_LABELS, ROUTES, type Role } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import type { PageData } from './$types';

type DetailActionResult =
	| { ok: true; op: 'revoke-invitation' | 'resend-invitation' }
	| { error: string }
	| null
	| undefined;

let { data, form }: { data: PageData; form: DetailActionResult } = $props();

let revokeOpen = $state(false);
let resendOpen = $state(false);

const isPending = $derived(data.invitation.status === INVITATION_STATUS.PENDING);

function statusLabel(status: InvitationStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}
</script>

<svelte:head>
	<title>{data.invitation.email} -- invitations -- hangar</title>
</svelte:head>

<section class="page">
	<p class="back">
		<a href={ROUTES.HANGAR_USERS_INVITATIONS}>&larr; Back to invitations</a>
	</p>

	<header class="hd">
		<div class="identity">
			<h1>{data.invitation.email}</h1>
			<p class="email mono">{data.invitation.id}</p>
		</div>
		<div class="badges">
			<span class="role-pill">{ROLE_LABELS[data.invitation.proposedRole as Role]}</span>
			<span class="status-pill status-{data.invitation.status}">{statusLabel(data.invitation.status)}</span>
		</div>
	</header>

	{#if form && 'error' in form}
		<div class="alert error" role="alert">{form.error}</div>
	{:else if form && 'ok' in form}
		<div class="alert ok" role="status">
			{#if form.op === 'revoke-invitation'}Invitation revoked.{/if}
			{#if form.op === 'resend-invitation'}Invitation resent.{/if}
		</div>
	{/if}

	<section aria-labelledby="profile-heading" class="card">
		<h2 id="profile-heading">Profile</h2>
		<dl class="meta">
			<div>
				<dt>Invited at</dt>
				<dd class="mono">{formatDateTime(data.invitation.invitedAt)}</dd>
			</div>
			<div>
				<dt>Expires at</dt>
				<dd class="mono">{formatDateTime(data.invitation.expiresAt)}</dd>
			</div>
			{#if data.invitation.acceptedAt}
				<div>
					<dt>Accepted at</dt>
					<dd class="mono">{formatDateTime(data.invitation.acceptedAt)}</dd>
				</div>
				{#if data.invitation.acceptedUserId}
					<div>
						<dt>Accepted user</dt>
						<dd class="mono">
							<a href={ROUTES.HANGAR_USER_DETAIL(data.invitation.acceptedUserId)}>{data.invitation.acceptedUserId}</a>
						</dd>
					</div>
				{/if}
			{/if}
			{#if data.invitation.revokedAt}
				<div>
					<dt>Revoked at</dt>
					<dd class="mono">{formatDateTime(data.invitation.revokedAt)}</dd>
				</div>
			{/if}
			{#if data.invitation.invitedByUserId}
				<div>
					<dt>Invited by</dt>
					<dd class="mono">
						<a href={ROUTES.HANGAR_USER_DETAIL(data.invitation.invitedByUserId)}>{data.invitation.invitedByUserId}</a>
					</dd>
				</div>
			{/if}
		</dl>
	</section>

	<section aria-labelledby="admin-heading" class="card">
		<h2 id="admin-heading">Admin actions</h2>

		{#if isPending}
			<div class="action-block">
				<h3>Resend</h3>
				<p class="hint">Generate a new token + re-email the recipient. The current link stops working.</p>
				<Button variant="primary" size="sm" onclick={() => (resendOpen = true)}>Resend invite</Button>
			</div>

			<div class="action-block">
				<h3>Revoke</h3>
				<p class="hint">Make the invitation un-redeemable. The current link 404s on accept.</p>
				<Button variant="danger" size="sm" onclick={() => (revokeOpen = true)}>Revoke invite</Button>
			</div>
		{:else}
			<p class="hint">No actions available -- this invitation is in '{data.invitation.status}' state.</p>
		{/if}
	</section>

	<section aria-labelledby="audits-heading" class="card">
		<h2 id="audits-heading">Audit history</h2>
		{#if data.audits.length === 0}
			<EmptyState title="No audit activity" body="No audit rows for this invitation." />
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">When</th>
							<th scope="col">Op</th>
							<th scope="col">Sub-kind</th>
							<th scope="col">Actor</th>
						</tr>
					</thead>
					<tbody>
						{#each data.audits as audit (audit.id)}
							<tr>
								<td class="mono">{formatDateTime(audit.timestamp)}</td>
								<td class="mono">{audit.op}</td>
								<td class="mono">{audit.subKind ?? '-'}</td>
								<td class="mono">{audit.actorEmail ?? '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</section>

<ConfirmDialog
	open={revokeOpen}
	oncancel={() => (revokeOpen = false)}
	title="Revoke invitation?"
	confirmLabel="Revoke"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_INVITATION_REVOKE_ACTION}
	hiddenFields={{ invitationId: data.invitation.id }}
	typedConfirmation={{
		label: `Type the recipient's email to confirm: ${data.invitation.email}`,
		expected: data.invitation.email,
	}}
>
	<p>The current invitation link will stop working. The recipient won't be notified.</p>
</ConfirmDialog>

<ConfirmDialog
	open={resendOpen}
	oncancel={() => (resendOpen = false)}
	title="Resend invitation?"
	confirmLabel="Resend"
	dangerLevel="caution"
	formAction={ROUTES.HANGAR_INVITATION_RESEND_ACTION}
	hiddenFields={{ invitationId: data.invitation.id }}
>
	<p>We'll generate a new link and email it to {data.invitation.email}. The previous link will stop working.</p>
</ConfirmDialog>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.back {
		margin: 0;
		font-size: var(--type-ui-label-size);
	}

	.back a {
		color: var(--link-default);
		text-decoration: none;
	}

	.back a:hover {
		text-decoration: underline;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
	}

	.email {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.badges {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.alert {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	.alert.error {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
		border: 1px solid var(--signal-warning);
	}

	.alert.ok {
		background: var(--signal-success-wash, var(--surface-muted));
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
	}

	.card {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	h3 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--type-ui-control-size);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.meta {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: var(--space-md);
	}

	.meta div {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.meta dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.meta dd {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.meta dd a {
		color: var(--link-default);
		text-decoration: none;
	}

	.meta dd a:hover {
		text-decoration: underline;
	}

	.action-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding-top: var(--space-md);
		border-top: 1px solid var(--edge-default);
	}

	.action-block:first-of-type {
		padding-top: 0;
		border-top: 0;
	}

	.hint {
		margin: 0 0 var(--space-2xs);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.role-pill {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-pill);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.status-pill {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.status-pill.status-pending {
		background: var(--signal-info-wash, var(--surface-muted));
		color: var(--ink-body);
	}

	.status-pill.status-accepted {
		background: var(--signal-success-wash, var(--surface-muted));
		color: var(--ink-body);
	}

	.status-pill.status-revoked {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
	}

	.status-pill.status-expired {
		background: var(--surface-muted);
		color: var(--ink-faint);
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	th,
	td {
		padding: var(--space-sm) var(--space-md);
		text-align: left;
		border-bottom: 1px solid var(--table-row-edge);
		color: var(--ink-body);
		vertical-align: top;
	}

	th {
		background: var(--table-header-bg);
		color: var(--table-header-ink);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>
