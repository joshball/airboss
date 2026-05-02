<script lang="ts">
import { ROUTES } from '@ab/constants';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Hangar</title>
</svelte:head>

<section class="page">
	<PageHeader title="Hangar" subtitle="Admin surface for content, people, and system operations." />

	<div class="tile-grid">
		<article class="tile" aria-labelledby="tile-content-h">
			<header class="tile-head">
				<h2 id="tile-content-h">Content</h2>
				<p class="tile-sub">Reference sources and glossary entries.</p>
			</header>
			<dl class="stats">
				<div class="stat">
					<dt>Sources</dt>
					<dd>
						<a class="stat-link" href={ROUTES.HANGAR_SOURCES}>
							<span class="stat-value">{data.counts.sources}</span>
						</a>
					</dd>
				</div>
				<div class="stat">
					<dt>Glossary</dt>
					<dd>
						<a class="stat-link" href={ROUTES.HANGAR_GLOSSARY}>
							<span class="stat-value">{data.counts.glossary}</span>
						</a>
					</dd>
				</div>
			</dl>
		</article>

		<article class="tile" aria-labelledby="tile-people-h">
			<header class="tile-head">
				<h2 id="tile-people-h">People</h2>
				<p class="tile-sub">Roles, sessions, and ban controls.</p>
			</header>
			<dl class="stats">
				<div class="stat">
					<dt>Users</dt>
					<dd>
						<a class="stat-link" href={ROUTES.HANGAR_USERS} aria-label="Open users ({data.counts.users})">
							<span class="stat-value">{data.counts.users}</span>
						</a>
					</dd>
				</div>
			</dl>
		</article>

		<article class="tile" aria-labelledby="tile-system-h">
			<header class="tile-head">
				<h2 id="tile-system-h">System</h2>
				<p class="tile-sub">Background jobs and audit activity.</p>
			</header>
			<dl class="stats">
				<div class="stat">
					<dt>Jobs</dt>
					<dd>
						<a class="stat-link" href={ROUTES.HANGAR_JOBS}>
							<span class="stat-value">{data.counts.jobs}</span>
						</a>
					</dd>
				</div>
				<div class="stat">
					<dt>Audit (last {data.auditWindowHours}h)</dt>
					<dd>
						<a class="stat-link" href={ROUTES.HANGAR_ADMIN_AUDIT}>
							<span class="stat-value">{data.counts.recentAudits}</span>
						</a>
					</dd>
				</div>
			</dl>
		</article>
	</div>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-top: var(--space-lg);
		padding-bottom: var(--space-2xl);
	}

	.tile-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--space-md);
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.tile-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.tile-head h2 {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.tile-sub {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.stats {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.stat dt {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.stat dd {
		margin: 0;
	}

	.stat-link {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-sm);
		padding: var(--space-2xs) var(--space-sm);
		margin: 0 calc(var(--space-sm) * -1);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--ink-body);
	}

	.stat-link:hover {
		background: var(--surface-sunken);
	}

	.stat-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.stat-value {
		font-family: var(--font-family-mono);
		font-weight: var(--font-weight-bold);
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

</style>
