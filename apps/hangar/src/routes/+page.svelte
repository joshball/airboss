<script lang="ts">
import { ROUTES } from '@ab/constants';
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import { enhance } from '$app/forms';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();
let submitting = $state(false);

const user = $derived(data.user);
</script>

<svelte:head>
	<title>Hangar -- airboss</title>
</svelte:head>

<ThemeProvider theme="airboss/default">
	<nav aria-label="Primary" class="nav">
		<span class="brand">airboss / hangar</span>
		<span class="spacer"></span>
		<span class="identity">{user.name || user.email}{user.role ? ` -- ${user.role}` : ''}</span>
		<form method="POST" action={ROUTES.LOGOUT} class="signout">
			<button type="submit">Sign out</button>
		</form>
	</nav>

	<main id="main" tabindex="-1" class="page">
		<header class="hd">
			<h1>Hangar</h1>
			<p class="sub">Admin surface for airboss data-management. Scaffold-only today.</p>
		</header>

		{#if form?.ok}
			<Banner variant="success">Ping recorded. Reload to see it in the log.</Banner>
		{/if}

		<section class="card">
			<h2>Scaffold heartbeat</h2>
			<p>
				Clicking the button below calls a form action that runs the role gate,
				writes one <code>audit.audit_log</code> row tagged
				<code>hangar.ping</code>, and returns success. The table underneath shows
				the last 10 <code>hangar.ping</code> rows from the database.
			</p>
			<form
				method="POST"
				action="?/ping"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						submitting = false;
						await update();
					};
				}}
			>
				<Button
					type="submit"
					variant="primary"
					size="md"
					loading={submitting}
					loadingLabel="Recording..."
				>
					Record a test audit event
				</Button>
			</form>
		</section>

		<section class="card">
			<h2>Recent audit events</h2>
			{#if data.audits.length === 0}
				<p class="empty">No <code>hangar.ping</code> rows yet. Click the button above.</p>
			{:else}
				<table class="audit-table">
					<thead>
						<tr>
							<th scope="col">Timestamp</th>
							<th scope="col">Actor</th>
							<th scope="col">Op</th>
							<th scope="col">Target</th>
						</tr>
					</thead>
					<tbody>
						{#each data.audits as row (row.id)}
							<tr>
								<td class="mono">{row.timestamp}</td>
								<td class="mono">{row.actorId ?? '—'}</td>
								<td>{row.op}</td>
								<td class="mono">{row.targetType}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
	</main>
</ThemeProvider>

<style>
	.nav {
		display: flex;
		align-items: center;
		gap: var(--ab-space-lg);
		padding: var(--ab-space-md) var(--ab-space-xl);
		border-bottom: 1px solid var(--ab-color-border);
		background: var(--ab-color-surface);
	}

	.brand {
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg);
	}

	.spacer {
		flex: 1;
	}

	.identity {
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-muted);
	}

	.signout {
		margin: 0;
	}

	.signout button {
		background: transparent;
		border: 1px solid var(--ab-color-border);
		color: var(--ab-color-fg-muted);
		font: inherit;
		padding: var(--ab-space-2xs) var(--ab-space-sm);
		border-radius: var(--ab-radius-sm);
		cursor: pointer;
	}

	.signout button:hover {
		color: var(--ab-color-fg);
		background: var(--ab-color-surface-sunken);
	}

	.page {
		max-width: 56rem;
		margin: 0 auto;
		padding: var(--ab-space-2xl) var(--ab-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xl);
	}

	.page:focus {
		outline: none;
	}

	.hd h1 {
		margin: 0 0 var(--ab-space-xs);
		font-size: var(--ab-font-size-2xl);
	}

	.sub {
		margin: 0;
		color: var(--ab-color-fg-muted);
	}

	.card {
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
	}

	.card h2 {
		margin: 0;
		font-size: var(--ab-font-size-lg);
	}

	.empty {
		color: var(--ab-color-fg-muted);
		font-style: italic;
	}

	.audit-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--ab-font-size-sm);
	}

	.audit-table th,
	.audit-table td {
		padding: var(--ab-space-xs) var(--ab-space-sm);
		text-align: left;
		border-bottom: 1px solid var(--ab-color-border);
	}

	.audit-table th {
		color: var(--ab-color-fg-muted);
		font-weight: var(--ab-font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--ab-letter-spacing-caps);
		font-size: var(--ab-font-size-xs);
	}

	.mono {
		font-family: var(--ab-font-family-mono);
	}

	code {
		font-family: var(--ab-font-family-mono);
		background: var(--ab-color-surface-sunken);
		padding: 0 var(--ab-space-2xs);
		border-radius: var(--ab-radius-sm);
		font-size: 0.9em;
	}
</style>
