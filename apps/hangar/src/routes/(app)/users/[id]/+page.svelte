<script lang="ts">
import { ROLE_LABELS, ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const displayName = $derived(data.user.name.trim() || data.user.email);

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
				<span class="role-pill">{ROLE_LABELS[data.user.role]}</span>
			{/if}
			{#if data.user.banned}
				<span class="badge banned">Banned</span>
			{/if}
		</div>
	</header>

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
		</dl>
	</section>

	<section aria-labelledby="sessions-heading" class="card">
		<h2 id="sessions-heading">Recent sessions</h2>
		{#if data.sessions.length === 0}
			<p class="empty">No sessions on record.</p>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th scope="col">Session ID</th>
							<th scope="col">IP</th>
							<th scope="col">User agent</th>
							<th scope="col">Created</th>
							<th scope="col">Expires</th>
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
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section aria-labelledby="audits-heading" class="card">
		<h2 id="audits-heading">Recent audit activity</h2>
		{#if data.audits.length === 0}
			<p class="empty">No audit rows for this user.</p>
		{:else}
			<div class="table-wrap">
				<table>
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
				</table>
			</div>
		{/if}
	</section>
</section>

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

	.badge {
		display: inline-block;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
	}

	.badge.banned {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
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

	.empty {
		color: var(--ink-muted);
		font-style: italic;
		padding: var(--space-md);
		margin: 0;
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
