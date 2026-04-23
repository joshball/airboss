<script lang="ts">
import {
	BLOOM_LEVEL_LABELS,
	type BloomLevel,
	CERT_LABELS,
	type Cert,
	DOMAIN_LABELS,
	type Domain,
	KNOWLEDGE_PHASE_LABELS,
	type KnowledgePhase,
	NODE_LIFECYCLE_LABELS,
	RELEVANCE_PRIORITY_LABELS,
	type RelevancePriority,
	ROUTES,
} from '@ab/constants';
import { humanize, renderMarkdown } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const node = $derived(data.node);
const phases = $derived(data.phases);
const edges = $derived(data.edges);
const mastery = $derived(data.mastery);
const lifecycle = $derived(data.lifecycle);

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
}

function phaseLabel(phase: string): string {
	return (KNOWLEDGE_PHASE_LABELS as Record<KnowledgePhase, string>)[phase as KnowledgePhase] ?? humanize(phase);
}

function certLabel(slug: string): string {
	return (CERT_LABELS as Record<Cert, string>)[slug as Cert] ?? slug;
}

function bloomLabel(slug: string): string {
	return (BLOOM_LEVEL_LABELS as Record<BloomLevel, string>)[slug as BloomLevel] ?? humanize(slug);
}

function priorityLabel(slug: string): string {
	return (RELEVANCE_PRIORITY_LABELS as Record<RelevancePriority, string>)[slug as RelevancePriority] ?? humanize(slug);
}

function lifecycleLabel(slug: string): string {
	return (NODE_LIFECYCLE_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

const masteryPct = $derived(Math.round(mastery.displayScore * 100));

function gateLabel(gate: string): string {
	switch (gate) {
		case 'pass':
			return 'Pass';
		case 'fail':
			return 'Fail';
		case 'insufficient_data':
			return 'Not enough data';
		case 'not_applicable':
			return 'Not applicable';
		default:
			return gate;
	}
}

function renderPhase(body: string | null): string {
	if (!body) return '';
	return renderMarkdown(body);
}
</script>

<svelte:head>
	<title>{node.title} -- Knowledge -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.KNOWLEDGE}>Knowledge</a>
		<span aria-hidden="true">/</span>
		<span>{domainLabel(node.domain)}</span>
	</nav>

	<header class="hd">
		<h1>{node.title}</h1>
		<div class="tags">
			<span class="badge domain">{domainLabel(node.domain)}</span>
			{#each node.crossDomains as d (d)}
				<span class="badge cross-domain">{domainLabel(d)}</span>
			{/each}
			<span class="badge lifecycle lifecycle-{lifecycle}">{lifecycleLabel(lifecycle)}</span>
			{#if node.technicalDepth}
				<span class="badge depth">{humanize(node.technicalDepth)}</span>
			{/if}
			{#if node.stability}
				<span class="badge stability">{humanize(node.stability)}</span>
			{/if}
			{#each node.knowledgeTypes as t (t)}
				<span class="badge kind">{humanize(t)}</span>
			{/each}
		</div>
	</header>

	<section class="mastery-panel" aria-label="Mastery">
		<div class="mastery-head">
			<span class="mastery-label">Mastery</span>
			<span class="mastery-pct">{masteryPct}%{mastery.mastered ? ' -- Mastered' : ''}</span>
		</div>
		<div class="mastery-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={masteryPct}>
			<span class="mastery-fill" style:width="{masteryPct}%"></span>
		</div>
		<dl class="gates">
			<div class="gate">
				<dt>Card gate</dt>
				<dd class="gate-{mastery.cardGate}">
					{gateLabel(mastery.cardGate)} ({mastery.cardsMastered} / {mastery.cardsTotal} mastered)
				</dd>
			</div>
			<div class="gate">
				<dt>Rep gate</dt>
				<dd class="gate-{mastery.repGate}">
					{gateLabel(mastery.repGate)} ({mastery.repsCorrect} / {mastery.repsTotal} correct)
				</dd>
			</div>
		</dl>
	</section>

	<div class="ctas">
		<a class="btn primary" href={ROUTES.KNOWLEDGE_LEARN(node.id)}>Start learning this node</a>
		<a class="btn secondary" href={ROUTES.MEMORY_REVIEW_FOR_NODE(node.id)}>Just review cards</a>
	</div>

	{#if node.relevance.length > 0}
		<section class="section" aria-label="Cert relevance">
			<h2>Cert relevance</h2>
			<table class="relevance">
				<thead>
					<tr>
						<th>Cert</th>
						<th>Bloom</th>
						<th>Priority</th>
					</tr>
				</thead>
				<tbody>
					{#each node.relevance as rel (rel.cert + rel.bloom)}
						<tr>
							<td>{certLabel(rel.cert)}</td>
							<td>{bloomLabel(rel.bloom)}</td>
							<td class="priority priority-{rel.priority}">{priorityLabel(rel.priority)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}

	{#if edges.requires.length > 0}
		<section class="section" aria-label="Prerequisites">
			<h2>Prerequisites</h2>
			<ul class="edge-list">
				{#each edges.requires as e (e.toNodeId)}
					<li>
						{#if e.targetExists}
							<a href={ROUTES.KNOWLEDGE_SLUG(e.toNodeId)}>{e.title ?? e.toNodeId}</a>
						{:else}
							<span class="gap"
								>{e.title ?? e.toNodeId} <small class="gap-note">(not yet authored)</small></span
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if edges.appliedBy.length > 0}
		<section class="section" aria-label="Applies in">
			<h2>Applies in</h2>
			<ul class="edge-list">
				{#each edges.appliedBy as e (e.toNodeId)}
					<li><a href={ROUTES.KNOWLEDGE_SLUG(e.toNodeId)}>{e.title ?? e.toNodeId}</a></li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if edges.taughtBy.length > 0}
		<section class="section" aria-label="Taught by">
			<h2>Taught by</h2>
			<ul class="edge-list">
				{#each edges.taughtBy as e (e.toNodeId)}
					<li><a href={ROUTES.KNOWLEDGE_SLUG(e.toNodeId)}>{e.title ?? e.toNodeId}</a></li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if edges.deepens.length > 0}
		<section class="section" aria-label="Deepens">
			<h2>Deepens</h2>
			<ul class="edge-list">
				{#each edges.deepens as e (e.toNodeId)}
					<li>
						{#if e.targetExists}
							<a href={ROUTES.KNOWLEDGE_SLUG(e.toNodeId)}>{e.title ?? e.toNodeId}</a>
						{:else}
							<span class="gap"
								>{e.title ?? e.toNodeId} <small class="gap-note">(not yet authored)</small></span
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if edges.related.length > 0}
		<section class="section" aria-label="Related">
			<h2>Related</h2>
			<ul class="edge-list">
				{#each edges.related as e (e.toNodeId)}
					<li>
						{#if e.targetExists}
							<a href={ROUTES.KNOWLEDGE_SLUG(e.toNodeId)}>{e.title ?? e.toNodeId}</a>
						{:else}
							<span class="gap"
								>{e.title ?? e.toNodeId} <small class="gap-note">(not yet authored)</small></span
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="section phases" aria-label="Content phases">
		<h2>Content phases</h2>
		{#each phases as p (p.phase)}
			<article class="phase" aria-labelledby="phase-{p.phase}">
				<h3 id="phase-{p.phase}" class="phase-title">{phaseLabel(p.phase)}</h3>
				{#if p.body}
					<div class="prose">{@html renderPhase(p.body)}</div>
				{:else}
					<p class="gap-body">Not yet authored.</p>
				{/if}
			</article>
		{/each}
	</section>

	{#if node.masteryCriteria}
		<section class="section" aria-label="Mastery criteria">
			<h2>Mastery criteria</h2>
			<div class="prose">{@html renderMarkdown(node.masteryCriteria)}</div>
		</section>
	{/if}

	{#if node.references.length > 0}
		<section class="section" aria-label="References">
			<h2>References</h2>
			<ul class="refs">
				{#each node.references as ref (ref.source + ref.detail)}
					<li>
						<strong>{ref.source}</strong>
						{#if ref.detail}
							<span class="ref-detail">-- {ref.detail}</span>
						{/if}
						{#if ref.note}
							<p class="ref-note">{ref.note}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xl-alt);
	}

	.crumb {
		display: flex;
		gap: var(--ab-space-sm);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
	}

	.crumb a {
		color: var(--ab-color-primary-hover);
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--ab-font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ab-color-fg);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--ab-space-xs);
		margin-top: var(--ab-space-sm-alt);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--ab-space-3xs) var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		font-weight: 600;
		border-radius: var(--ab-radius-pill);
		border: 1px solid var(--ab-color-border);
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: var(--ab-color-primary-hover);
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.badge.cross-domain {
		color: var(--ab-color-accent-fg);
		background: var(--ab-color-accent-subtle);
		border-color: var(--ab-color-accent-subtle-border);
	}

	.badge.lifecycle-skeleton {
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-sunken);
		border-color: var(--ab-color-border-strong);
	}

	.badge.lifecycle-started {
		color: var(--ab-color-warning-hover);
		background: var(--ab-color-warning-subtle);
		border-color: var(--ab-color-warning-subtle-border);
	}

	.badge.lifecycle-complete {
		color: var(--ab-color-success-hover);
		background: var(--ab-color-success-subtle);
		border-color: var(--ab-color-success-subtle-border);
	}

	.mastery-panel {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-lg) var(--ab-space-lg-alt);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-sm-alt);
	}

	.mastery-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.mastery-label {
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ab-color-fg-muted);
		font-weight: 600;
	}

	.mastery-pct {
		font-size: var(--ab-font-size-body);
		color: var(--ab-color-fg);
		font-weight: 600;
	}

	.mastery-bar {
		width: 100%;
		height: 8px;
		background: var(--ab-color-border);
		border-radius: var(--ab-radius-pill);
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: var(--ab-color-primary);
	}

	.gates {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--ab-space-md);
		margin: var(--ab-space-2xs) 0 0;
	}

	.gate {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-3xs);
	}

	.gate dt {
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ab-color-fg-subtle);
		font-weight: 600;
	}

	.gate dd {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg);
	}

	.gate-pass {
		color: var(--ab-color-success-hover);
	}

	.gate-fail {
		color: var(--ab-color-danger-hover);
	}

	.gate-insufficient_data {
		color: var(--ab-color-warning-hover);
	}

	.gate-not_applicable {
		color: var(--ab-color-fg-subtle);
	}

	.ctas {
		display: flex;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
	}

	.btn {
		padding: var(--ab-space-sm-alt) var(--ab-space-lg-alt);
		font-size: var(--ab-font-size-body);
		font-weight: 600;
		border-radius: var(--ab-radius-md);
		border: 1px solid transparent;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: var(--ab-color-primary);
		color: white;
	}

	.btn.primary:hover {
		background: var(--ab-color-primary-hover);
	}

	.btn.secondary {
		background: var(--ab-color-surface-sunken);
		color: var(--ab-color-fg);
		border-color: var(--ab-color-border-strong);
	}

	.btn.secondary:hover {
		background: var(--ab-color-border);
	}

	.section h2 {
		margin: 0 0 var(--ab-space-sm-alt);
		font-size: var(--ab-font-size-lg);
		color: var(--ab-color-fg);
		letter-spacing: -0.01em;
	}

	.relevance {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--ab-font-size-sm);
	}

	.relevance th,
	.relevance td {
		padding: var(--ab-space-sm) var(--ab-space-sm-alt);
		text-align: left;
		border-bottom: 1px solid var(--ab-color-border);
	}

	.relevance th {
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface-muted);
	}

	.priority-core {
		color: var(--ab-color-danger-hover);
		font-weight: 600;
	}

	.priority-supporting {
		color: var(--ab-color-warning-hover);
	}

	.priority-elective {
		color: var(--ab-color-fg-muted);
	}

	.edge-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--ab-space-xs);
	}

	.edge-list a {
		color: var(--ab-color-primary-hover);
		text-decoration: none;
	}

	.edge-list a:hover {
		text-decoration: underline;
	}

	.gap {
		color: var(--ab-color-fg-subtle);
	}

	.gap-note {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
	}

	.phases {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md-alt);
	}

	.phase {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-lg) var(--ab-space-lg-alt);
	}

	.phase-title {
		margin: 0 0 var(--ab-space-sm);
		font-size: var(--ab-font-size-base);
		color: var(--ab-color-fg);
	}

	.gap-body {
		margin: 0;
		color: var(--ab-color-fg-faint);
		font-style: italic;
	}

	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5) {
		margin: var(--ab-space-lg) 0 var(--ab-space-sm);
		color: var(--ab-color-fg);
	}

	.prose :global(p) {
		margin: 0 0 var(--ab-space-md);
		line-height: 1.55;
		color: var(--ab-color-fg);
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 var(--ab-space-md) var(--ab-space-xl-alt);
		line-height: 1.55;
		color: var(--ab-color-fg);
	}

	.prose :global(li) {
		margin-bottom: var(--ab-space-2xs);
	}

	.prose :global(code) {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: var(--ab-font-size-sm);
		background: var(--ab-color-surface-sunken);
		padding: 0.05em 0.35em;
		border-radius: var(--ab-radius-xs);
	}

	.prose :global(pre) {
		background: var(--ab-color-fg);
		color: var(--ab-color-border);
		padding: var(--ab-space-md) var(--ab-space-lg);
		border-radius: var(--ab-radius-md);
		overflow-x: auto;
		font-size: var(--ab-font-size-sm);
	}

	.prose :global(pre code) {
		background: transparent;
		padding: 0;
		color: inherit;
	}

	.prose :global(a) {
		color: var(--ab-color-primary-hover);
	}

	.refs {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-sm);
	}

	.refs li {
		background: white;
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-space-sm-alt) var(--ab-space-md-alt);
		font-size: var(--ab-font-size-body);
	}

	.ref-detail {
		color: var(--ab-color-fg-subtle);
		margin-left: var(--ab-space-2xs);
	}

	.ref-note {
		margin: var(--ab-space-xs) 0 0;
		color: var(--ab-color-fg-muted);
		font-size: var(--ab-font-size-sm);
		line-height: 1.45;
	}
</style>
