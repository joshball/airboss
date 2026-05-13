<script lang="ts">
import { ROLE_LABELS, ROLE_VALUES, ROUTES, type Role } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Badge from '@ab/ui/components/Badge.svelte';
import Button from '@ab/ui/components/Button.svelte';
import ConfirmDialog from '@ab/ui/components/ConfirmDialog.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import RolePill from '@ab/ui/components/RolePill.svelte';
import Table from '@ab/ui/components/Table.svelte';
import type { PageData } from './$types';

/**
 * The shape returned by the form actions in `+page.server.ts`. SvelteKit's
 * `ActionData` infers from the actions union but loses the discriminated
 * shape across `fail` / `redirect`; we restate it here so the alert block
 * type-checks. Keep in sync with the action returns server-side.
 */
type UserActionResult =
	| {
			ok: true;
			op: 'set-role' | 'ban' | 'unban' | 'revoke-session' | 'revoke-all-sessions';
			revokedCount?: number;
	  }
	| { error: string }
	| null
	| undefined;

let { data, form }: { data: PageData; form: UserActionResult } = $props();

const displayName = $derived(data.user.name.trim() || data.user.email);

let pendingRole = $state<Role | ''>('');

$effect(() => {
	pendingRole = data.user.role ?? '';
});

const roleDirty = $derived(pendingRole !== '' && pendingRole !== data.user.role);

let banDialogOpen = $state(false);
let banReason = $state('');
let banExpiresAt = $state('');

let unbanDialogOpen = $state(false);

let revokeSessionId = $state<string | null>(null);
let revokeAllOpen = $state(false);

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

function truncate(value: string | null, max: number): string {
	if (!value) return '-';
	return value.length <= max ? value : `${value.slice(0, max)}...`;
}

function openBanDialog() {
	banReason = '';
	banExpiresAt = '';
	banDialogOpen = true;
}

function openRevokeSession(sessionId: string) {
	revokeSessionId = sessionId;
}
</script>

<svelte:head>
	<title>{displayName} -- Users -- hangar</title>
</svelte:head>

<section class="page">
	<p class="back">
		<a href={ROUTES.HANGAR_USERS}>&larr; Back to users</a>
	</p>

	<header class="hd">
		<div class="identity">
			<h1>{displayName}</h1>
			<p class="email mono">{data.user.email}</p>
		</div>
		<div class="badges">
			{#if data.user.role}
				<RolePill>{ROLE_LABELS[data.user.role]}</RolePill>
			{/if}
			{#if data.user.banned}
				<Badge tone="danger" size="sm">Banned</Badge>
			{/if}
			<PageHelp pageId="users-detail" />
		</div>
	</header>

	{#if form && 'error' in form}
		<div class="alert error" role="alert">{form.error}</div>
	{:else if form && 'ok' in form}
		<div class="alert ok" role="status">
			{#if form.op === 'set-role'}Role updated.{/if}
			{#if form.op === 'ban'}User banned.{/if}
			{#if form.op === 'unban'}User unbanned.{/if}
			{#if form.op === 'revoke-session'}Session revoked.{/if}
			{#if form.op === 'revoke-all-sessions'}{form.revokedCount ?? 0} session(s) revoked.{/if}
		</div>
	{/if}

	<section aria-labelledby="profile-heading" class="card">
		<h2 id="profile-heading">Profile</h2>
		<dl class="meta">
			<div>
				<dt>User ID</dt>
				<dd class="mono">{data.user.id}</dd>
			</div>
			<div>
				<dt>Created</dt>
				<dd class="mono">{formatDate(data.user.createdAt)}</dd>
			</div>
			<div>
				<dt>Updated</dt>
				<dd class="mono">{formatDate(data.user.updatedAt)}</dd>
			</div>
			<div>
				<dt>Last seen</dt>
				<dd class="mono">{data.user.lastSeenAt ? formatDateTime(data.user.lastSeenAt) : 'never'}</dd>
			</div>
			{#if data.user.banned}
				<div>
					<dt>Ban reason</dt>
					<dd class="mono">{data.user.banReason ?? '-'}</dd>
				</div>
				<div>
					<dt>Ban expires</dt>
					<dd class="mono">{data.user.banExpires ? formatDateTime(data.user.banExpires) : 'permanent'}</dd>
				</div>
			{/if}
		</dl>
	</section>

	<section aria-labelledby="admin-heading" class="card">
		<h2 id="admin-heading">Admin actions</h2>

		<div class="action-block">
			<h3>Role</h3>
			<form method="post" action={ROUTES.HANGAR_USER_SET_ROLE_ACTION} class="role-form">
				<input type="hidden" name="targetUserId" value={data.user.id} />
				<label for="role-picker" class="visually-hidden">Role</label>
				<select id="role-picker" name="newRole" bind:value={pendingRole}>
					{#each ROLE_VALUES as role (role)}
						<option value={role}>{ROLE_LABELS[role as Role]}</option>
					{/each}
				</select>
				<Button type="submit" variant="primary" size="sm" disabled={!roleDirty}>
					Save role
				</Button>
			</form>
		</div>

		<div class="action-block">
			<h3>Ban status</h3>
			{#if data.user.banned}
				<p class="hint">User is banned. Unbanning lifts the block; better-auth re-honours the row at sign-in.</p>
				<Button variant="primary" size="sm" onclick={() => (unbanDialogOpen = true)}>
					Unban user
				</Button>
			{:else}
				<p class="hint">Banning prevents this user from signing in. Optional expiry restores access automatically.</p>
				<Button variant="danger" size="sm" onclick={openBanDialog}>
					Ban user
				</Button>
			{/if}
		</div>
	</section>

	<section aria-labelledby="sessions-heading" class="card">
		<header class="card-hd">
			<h2 id="sessions-heading">Recent sessions</h2>
			{#if data.sessions.length > 0}
				<Button variant="danger" size="sm" onclick={() => (revokeAllOpen = true)}>
					Revoke all sessions
				</Button>
			{/if}
		</header>
		{#if data.sessions.length === 0}
			<EmptyState title="No sessions" body="No sessions on record." />
		{:else}
			<Table ariaLabel="Active sessions">
				<thead>
					<tr>
						<th scope="col">Session ID</th>
						<th scope="col">IP</th>
						<th scope="col">User agent</th>
						<th scope="col">Created</th>
						<th scope="col">Expires</th>
						<th scope="col">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.sessions as session (session.id)}
						<tr>
							<td class="mono">{truncate(session.id, 12)}</td>
							<td class="mono">{session.ipAddress ?? '-'}</td>
							<td class="mono ua" title={session.userAgent ?? ''}>{truncate(session.userAgent, 64)}</td>
							<td class="mono">{formatDateTime(session.createdAt)}</td>
							<td class="mono">{formatDateTime(session.expiresAt)}</td>
							<td>
								<Button variant="danger" size="sm" onclick={() => openRevokeSession(session.id)}>
									Revoke
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		{/if}
	</section>

	<section aria-labelledby="audits-heading" class="card">
		<h2 id="audits-heading">Recent audit activity</h2>
		{#if data.audits.length === 0}
			<EmptyState title="No audit activity" body="No audit rows for this user." />
		{:else}
			<Table ariaLabel="Recent audit activity">
				<thead>
					<tr>
						<th scope="col">When</th>
						<th scope="col">Op</th>
						<th scope="col">Target type</th>
						<th scope="col">Target id</th>
					</tr>
				</thead>
				<tbody>
					{#each data.audits as audit (audit.id)}
						<tr>
							<td class="mono">{formatDateTime(audit.timestamp)}</td>
							<td class="mono">{audit.op}</td>
							<td class="mono">{audit.targetType}</td>
							<td class="mono">{audit.targetId ?? '-'}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
		{/if}
	</section>
</section>

<ConfirmDialog
	open={banDialogOpen}
	oncancel={() => (banDialogOpen = false)}
	title="Ban {displayName}?"
	confirmLabel="Ban user"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_USER_BAN_ACTION}
	hiddenFields={{ targetUserId: data.user.id, reason: banReason, expiresAt: banExpiresAt }}
	typedConfirmation={{ label: `Type the user's email to confirm: ${data.user.email}`, expected: data.user.email }}
>
	<p>This blocks the user from signing in until you unban them or the optional expiry passes.</p>
	<label class="modal-field">
		<span>Reason (required)</span>
		<textarea bind:value={banReason} rows="3" required></textarea>
	</label>
	<label class="modal-field">
		<span>Expires (optional)</span>
		<input type="datetime-local" bind:value={banExpiresAt} />
	</label>
</ConfirmDialog>

<ConfirmDialog
	open={unbanDialogOpen}
	oncancel={() => (unbanDialogOpen = false)}
	title="Unban {displayName}?"
	confirmLabel="Unban"
	dangerLevel="caution"
	formAction={ROUTES.HANGAR_USER_UNBAN_ACTION}
	hiddenFields={{ targetUserId: data.user.id }}
>
	<p>The user will be able to sign in again on their next attempt.</p>
</ConfirmDialog>

<ConfirmDialog
	open={revokeSessionId !== null}
	oncancel={() => (revokeSessionId = null)}
	title="Revoke session?"
	confirmLabel="Revoke"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_USER_REVOKE_SESSION_ACTION}
	hiddenFields={{ targetUserId: data.user.id, sessionId: revokeSessionId ?? '' }}
	typedConfirmation={{ label: `Type the user's email to confirm: ${data.user.email}`, expected: data.user.email }}
>
	<p>The selected session will be invalidated. Any open browser tab signed into this session will 401 on its next request.</p>
</ConfirmDialog>

<ConfirmDialog
	open={revokeAllOpen}
	oncancel={() => (revokeAllOpen = false)}
	title="Revoke ALL sessions for {displayName}?"
	confirmLabel="Revoke all ({data.sessions.length})"
	dangerLevel="danger"
	formAction={ROUTES.HANGAR_USER_REVOKE_ALL_SESSIONS_ACTION}
	hiddenFields={{ targetUserId: data.user.id }}
	typedConfirmation={{ label: `Type the user's email to confirm: ${data.user.email}`, expected: data.user.email }}
>
	<p>{data.sessions.length} session(s) will be invalidated. If your own session is in the list, you'll be redirected to /login.</p>
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

	.card-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
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

	.role-form {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		flex-wrap: wrap;
	}

	select {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		background: var(--input-default-bg);
		color: var(--ink-body);
		font: inherit;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
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

	.modal-field textarea,
	.modal-field input[type='datetime-local'] {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		background: var(--input-default-bg);
		color: var(--ink-body);
		font: inherit;
	}

	.ua {
		max-width: 24rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mono {
		font-family: var(--font-family-mono);
	}
</style>
