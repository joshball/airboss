<script lang="ts">
import { NAV_LABELS, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const credential = $derived(data.credential);
const syllabus = $derived(data.syllabus);
const area = $derived(data.area);
const tasks = $derived(data.tasks);
</script>

<svelte:head>
	<title>{credential.title} -- Area {area.code} -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.CREDENTIALS}>{NAV_LABELS.CREDENTIALS}</a>
		<span aria-hidden="true">/</span>
		<a href={ROUTES.CREDENTIAL(credential.slug)}>{credential.title}</a>
		<span aria-hidden="true">/</span>
		<span>Area {area.code}</span>
	</nav>

	<PageHeader eyebrow="Area {area.code} -- {syllabus.title}" title={area.title}>
		{#snippet titleSuffix()}
			<PageHelp pageId="credentials" />
		{/snippet}
	</PageHeader>

	{#if area.description !== null && area.description !== ''}
		<p class="desc">{area.description}</p>
	{/if}

	{#if tasks.length === 0}
		<EmptyState
			title="No tasks authored"
			body="The Area exists in the syllabus tree but has no tasks transcribed yet."
		/>
	{:else}
		<ul class="tasks">
			{#each tasks as task (task.task.id)}
				<li class="task">
					<header class="task-head">
						<span class="task-code">{task.task.code}</span>
						<h2 class="task-title">{task.task.title}</h2>
					</header>
					{#if task.elements.length === 0}
						<p class="muted">No elements transcribed.</p>
					{:else}
						<ul class="elements">
							{#each task.elements as elv (elv.element.id)}
								<li class="element">
									<header class="el-head">
										<span class="el-code">{elv.element.code}</span>
										{#if elv.element.triad !== null}
											<span class="badge triad-{elv.element.triad}" data-triad={elv.element.triad}>
												{elv.element.triad}
											</span>
										{/if}
										<span class="el-title">{elv.element.title}</span>
									</header>
									{#if elv.element.description !== null && elv.element.description !== ''}
										<p class="el-desc">{elv.element.description}</p>
									{/if}

									{#if elv.linkedNodes.length > 0}
										<div class="links" aria-label="Linked knowledge nodes">
											<span class="links-label">Knowledge:</span>
											<ul class="link-list">
												{#each elv.linkedNodes as link (link.node.id)}
													<li>
														<a href={ROUTES.KNOWLEDGE_SLUG(link.node.id)}>{link.node.title}</a>
													</li>
												{/each}
											</ul>
										</div>
									{:else}
										<p class="muted small">No knowledge nodes linked yet.</p>
									{/if}

									{#if elv.citations.length > 0}
										<div class="cites" aria-label="Citations">
											<span class="links-label">Citations:</span>
											<ul class="cite-list">
												{#each elv.citations as citation, i (i)}
													<li>
														<code class="cite">{citation.kind}: {JSON.stringify(citation).slice(0, 60)}</code>
													</li>
												{/each}
											</ul>
										</div>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
	}

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
		flex-wrap: wrap;
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.desc {
		margin: 0;
		color: var(--ink-subtle);
		max-width: 60ch;
	}

	.muted {
		color: var(--ink-faint);
	}

	.muted.small {
		font-size: var(--font-size-xs);
	}

	.tasks {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.task {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
	}

	.task-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.task-code {
		color: var(--ink-faint);
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-sm);
	}

	.task-title {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}

	.elements {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.element {
		padding: var(--space-md);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		background: var(--surface-page);
	}

	.el-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.el-code {
		color: var(--ink-faint);
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
	}

	.el-title {
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.el-desc {
		margin: var(--space-xs) 0 0;
		color: var(--ink-subtle);
	}

	.badge {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-pill);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	[data-triad='knowledge'] {
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-strong);
	}

	[data-triad='risk_management'] {
		background: var(--surface-panel);
		color: var(--signal-warning-ink, var(--ink-body));
		border: 1px solid var(--signal-warning-edge, var(--edge-strong));
	}

	[data-triad='skill'] {
		background: var(--surface-panel);
		color: var(--signal-success-ink, var(--ink-body));
		border: 1px solid var(--signal-success-edge, var(--edge-strong));
	}

	.links,
	.cites {
		margin-top: var(--space-sm);
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		align-items: baseline;
		font-size: var(--font-size-sm);
	}

	.links-label {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.link-list,
	.cite-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.link-list li {
		padding: var(--space-2xs) var(--space-sm);
		background: var(--surface-panel);
		border-radius: var(--radius-pill);
	}

	.link-list a {
		color: var(--action-link);
		text-decoration: none;
	}

	.cite-list li {
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}
</style>
