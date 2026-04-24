<script lang="ts">
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import { enhance } from '$app/forms';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();
let submitting = $state(false);
</script>

<svelte:head>
	<title>Audit ping -- airboss hangar</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1>Audit ping</h1>
		<p class="sub">
			Scaffold-era heartbeat. Clicking below writes one
			<code>audit.audit_log</code> row tagged <code>hangar.ping</code>
			and the table refreshes.
		</p>
	</header>

	{#if form?.ok}
		<Banner variant="success">Ping recorded. Reload to see it in the log.</Banner>
	{/if}

	<section class="card">
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
			<Button type="submit" variant="primary" size="md" loading={submitting} loadingLabel="Recording...">
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
							<td class="mono">{row.actorId ?? '-'}</td>
							<td>{row.op}</td>
							<td class="mono">{row.targetType}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd h1 {
		margin: 0 0 var(--space-xs);
		font-size: var(--type-heading-1-size);
		color: var(--ink-body);
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
		color: var(--ink-body);
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
		font-family: var(--font-family-mono);
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-code-inline-size);
	}
</style>
