<script lang="ts">
import { INVITABLE_ROLE_VALUES, INVITATION_STATUS, type InvitationStatus } from '@ab/bc-hangar';
import { QUERY_PARAMS, ROLE_LABELS, ROLES, ROUTES, type Role } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

/**
 * Action result shape from the form actions in `+page.server.ts`.
 * SvelteKit's `ActionData` infers from the actions union but loses the
 * discriminated shape across `fail` / `redirect`; we restate it here.
 */
type CreateInvitationActionResult =
	| { ok: true; op: 'create-invitation'; invitationId: string }
	| { error: string; existingUserId?: string; existingInvitationId?: string; email?: string }
	| null
	| undefined;

let { data, form }: { data: PageData; form: CreateInvitationActionResult } = $props();

let createDialogOpen = $state(false);
let inviteEmailInput = $state('');
let inviteRoleInput = $state<Role>(ROLES.LEARNER);

function openCreateDialog() {
	inviteEmailInput = '';
	inviteRoleInput = ROLES.LEARNER;
	createDialogOpen = true;
}

const STATUS_TABS: readonly { id: InvitationStatus | 'all'; label: string }[] = [
	{ id: INVITATION_STATUS.PENDING, label: 'Pending' },
	{ id: INVITATION_STATUS.ACCEPTED, label: 'Accepted' },
	{ id: INVITATION_STATUS.REVOKED, label: 'Revoked' },
	{ id: INVITATION_STATUS.EXPIRED, label: 'Expired' },
	{ id: 'all', label: 'All' },
];

function tabHref(status: InvitationStatus | 'all'): string {
	const params = new URLSearchParams();
	params.set(QUERY_PARAMS.STATUS, status);
	return `${ROUTES.HANGAR_USERS_INVITATIONS}?${params.toString()}`;
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

function statusLabel(status: InvitationStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function totalCount(counts: PageData['counts'], filter: InvitationStatus | 'all'): number {
	if (filter === 'all') {
		return Object.values(counts).reduce((a, b) => a + b, 0);
	}
	return counts[filter] ?? 0;
}
</script>

<svelte:head>
	<title>Invitations -- hangar</title>
</svelte:head>

<section class="page">
	<PageHeader title="Invitations" subtitle="Invite a user by email; the recipient sets their own password.">
		{#snippet actions()}
			<Button variant="primary" size="sm" onclick={openCreateDialog}>Invite user</Button>
		{/snippet}
	</PageHeader>

	<p class="back">
		<a href={ROUTES.HANGAR_USERS}>&larr; Back to users</a>
	</p>

	{#if form && 'error' in form}
		<div class="alert error" role="alert">
			{form.error}
			{#if form.existingUserId}
				<a href={ROUTES.HANGAR_USER_DETAIL(form.existingUserId)}>Go to existing user</a>
			{/if}
			{#if form.existingInvitationId}
				<a href={ROUTES.HANGAR_USERS_INVITATION_DETAIL(form.existingInvitationId)}>View existing invitation</a>
			{/if}
		</div>
	{:else if form && 'ok' in form}
		<div class="alert ok" role="status">
			Invitation sent.
			<a href={ROUTES.HANGAR_USERS_INVITATION_DETAIL(form.invitationId)}>View detail</a>
		</div>
	{/if}

	<nav class="tabs" aria-label="Filter by status">
		{#each STATUS_TABS as tab (tab.id)}
			{@const active = data.filters.status === tab.id}
			<a class="tab" class:active href={tabHref(tab.id)} aria-current={active ? 'page' : undefined}>
				{tab.label}
				<span class="tab-count">{totalCount(data.counts, tab.id)}</span>
			</a>
		{/each}
	</nav>

	{#if data.rows.length === 0}
		<EmptyState
			title={`No ${data.filters.status === 'all' ? '' : `${statusLabel(data.filters.status as InvitationStatus).toLowerCase()} `}invitations`}
			body={data.filters.status === 'pending'
				? 'Click "Invite user" above to send the first invitation.'
				: 'Nothing to show under this filter.'}
		/>
	{:else}
		{#if data.truncated}
			<p class="muted">Showing the first {data.rows.length} invitations. Filter narrows the view.</p>
		{/if}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Email</th>
						<th scope="col">Role</th>
						<th scope="col">Status</th>
						<th scope="col">Invited</th>
						<th scope="col">Expires</th>
						<th scope="col">Invited by</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr>
							<td>
								<a href={ROUTES.HANGAR_USERS_INVITATION_DETAIL(row.id)}>{row.email}</a>
							</td>
							<td>
								<span class="role-pill">{ROLE_LABELS[row.proposedRole]}</span>
							</td>
							<td>
								<span class="status-pill status-{row.status}">{statusLabel(row.status)}</span>
							</td>
							<td class="mono">{formatDate(row.invitedAt)}</td>
							<td class="mono">{formatDate(row.expiresAt)}</td>
							<td class="mono">{row.invitedByName ?? row.invitedByEmail ?? '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<ConfirmDialog
	open={createDialogOpen}
	oncancel={() => (createDialogOpen = false)}
	title="Invite a user"
	confirmLabel="Send invite"
	dangerLevel="caution"
	formAction={ROUTES.HANGAR_INVITATION_CREATE_ACTION}
	hiddenFields={{ email: inviteEmailInput, proposedRole: inviteRoleInput }}
>
	<p class="modal-hint">
		We'll send the recipient a one-shot link valid for 7 days. They pick their own password on accept.
	</p>
	<label class="modal-field">
		<span>Email</span>
		<input
			type="email"
			bind:value={inviteEmailInput}
			placeholder="alice@example.com"
			required
			autocomplete="off"
			spellcheck="false"
		/>
	</label>
	<label class="modal-field">
		<span>Role</span>
		<select bind:value={inviteRoleInput}>
			{#each INVITABLE_ROLE_VALUES as role (role)}
				<option value={role}>{ROLE_LABELS[role]}</option>
			{/each}
		</select>
	</label>
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

	.alert {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
		display: flex;
		gap: var(--space-md);
		align-items: center;
		flex-wrap: wrap;
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

	.alert a {
		color: inherit;
		text-decoration: underline;
	}

	.tabs {
		display: flex;
		gap: var(--space-xs);
		border-bottom: 1px solid var(--edge-default);
		flex-wrap: wrap;
	}

	.tab {
		padding: var(--space-sm) var(--space-md);
		text-decoration: none;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
		border-bottom: 2px solid transparent;
		display: inline-flex;
		gap: var(--space-2xs);
		align-items: center;
	}

	.tab:hover {
		color: var(--ink-body);
	}

	.tab.active {
		color: var(--ink-body);
		border-bottom-color: var(--action-default);
	}

	.tab-count {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
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

	tr:hover {
		background: var(--table-row-bg-hover);
	}

	td a {
		color: var(--link-default);
		text-decoration: none;
	}

	td a:hover {
		text-decoration: underline;
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.muted {
		color: var(--ink-faint);
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

	.modal-hint {
		margin: 0 0 var(--space-md);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.modal-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		margin-top: var(--space-md);
	}

	.modal-field span {
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
	}

	.modal-field input,
	.modal-field select {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		background: var(--input-default-bg);
		color: var(--ink-body);
		font: inherit;
	}
</style>
