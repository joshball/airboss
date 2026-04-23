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
		gap: var(--space-lg);
		padding: var(--space-md) var(--space-xl);
		border-bottom: 1px solid var(--edge-default);
		background: var(--surface-panel);
	}

	.brand {
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-body);
	}

	.spacer {
		flex: 1;
	}

	.identity {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.signout {
		margin: 0;
	}

	.signout button {
		background: transparent;
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		font: inherit;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.signout button:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.page {
		max-width: 56rem;
		margin: 0 auto;
		padding: var(--space-2xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.page:focus {
		outline: none;
	}

	.hd h1 {
		margin: 0 0 var(--space-xs);
		font-size: var(--type-heading-1-size);
	}

	.sub {
		margin: 0;
		color: var(--ink-muted);
	}

	.card {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.card h2 {
		margin: 0;
		font-size: var(--type-reading-lead-size);
	}

	.empty {
		color: var(--ink-muted);
		font-style: italic;
	}

	.audit-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	.audit-table th,
	.audit-table td {
		padding: var(--space-xs) var(--space-sm);
		text-align: left;
		border-bottom: 1px solid var(--edge-default);
	}

	.audit-table th {
		color: var(--ink-muted);
		font-weight: var(--type-heading-3-weight);
		text-transform: uppercase;
		letter-spacing: var(--type-ui-badge-tracking);
		font-size: var(--type-ui-caption-size);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	code {
		font-family: var(--type-code-inline-family);
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-code-inline-size);
	}
</style>
