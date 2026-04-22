<script lang="ts">
import {
	BLOOM_LEVEL_LABELS,
	CERT_LABELS,
	DOMAIN_LABELS,
	KNOWLEDGE_PHASE_LABELS,
	NODE_LIFECYCLE_LABELS,
	RELEVANCE_PRIORITY_LABELS,
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
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function phaseLabel(phase: string): string {
	return (KNOWLEDGE_PHASE_LABELS as Record<string, string>)[phase] ?? humanize(phase);
}

function certLabel(slug: string): string {
	return (CERT_LABELS as Record<string, string>)[slug] ?? slug;
}

function bloomLabel(slug: string): string {
	return (BLOOM_LEVEL_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function priorityLabel(slug: string): string {
	return (RELEVANCE_PRIORITY_LABELS as Record<string, string>)[slug] ?? humanize(slug);
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
		gap: 1.25rem;
	}

	.crumb {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #64748b;
	}

	.crumb a {
		color: #1d4ed8;
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.hd h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.625rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		font-size: 0.6875rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1px solid #e2e8f0;
		color: #475569;
		background: #f8fafc;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge.domain {
		color: #1d4ed8;
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.badge.cross-domain {
		color: #5b21b6;
		background: #f5f3ff;
		border-color: #ddd6fe;
	}

	.badge.lifecycle-skeleton {
		color: #4b5563;
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.badge.lifecycle-started {
		color: #a16207;
		background: #fefce8;
		border-color: #fde047;
	}

	.badge.lifecycle-complete {
		color: #15803d;
		background: #f0fdf4;
		border-color: #86efac;
	}

	.mastery-panel {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.125rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.mastery-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.mastery-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #475569;
		font-weight: 600;
	}

	.mastery-pct {
		font-size: 0.9375rem;
		color: #0f172a;
		font-weight: 600;
	}

	.mastery-bar {
		width: 100%;
		height: 8px;
		background: #e2e8f0;
		border-radius: 999px;
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: #2563eb;
	}

	.gates {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 0.25rem 0 0;
	}

	.gate {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.gate dt {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
		font-weight: 600;
	}

	.gate dd {
		margin: 0;
		font-size: 0.875rem;
		color: #0f172a;
	}

	.gate-pass {
		color: #15803d;
	}

	.gate-fail {
		color: #b91c1c;
	}

	.gate-insufficient_data {
		color: #a16207;
	}

	.gate-not_applicable {
		color: #64748b;
	}

	.ctas {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.btn {
		padding: 0.625rem 1.125rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		border: 1px solid transparent;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		transition: background 120ms, border-color 120ms;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover {
		background: #e2e8f0;
	}

	.section h2 {
		margin: 0 0 0.625rem;
		font-size: 1.125rem;
		color: #0f172a;
		letter-spacing: -0.01em;
	}

	.relevance {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.relevance th,
	.relevance td {
		padding: 0.5rem 0.625rem;
		text-align: left;
		border-bottom: 1px solid #e2e8f0;
	}

	.relevance th {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #475569;
		background: #f8fafc;
	}

	.priority-core {
		color: #b91c1c;
		font-weight: 600;
	}

	.priority-supporting {
		color: #a16207;
	}

	.priority-elective {
		color: #4b5563;
	}

	.edge-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.375rem;
	}

	.edge-list a {
		color: #1d4ed8;
		text-decoration: none;
	}

	.edge-list a:hover {
		text-decoration: underline;
	}

	.gap {
		color: #64748b;
	}

	.gap-note {
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.phases {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.phase {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.125rem;
	}

	.phase-title {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		color: #0f172a;
	}

	.gap-body {
		margin: 0;
		color: #94a3b8;
		font-style: italic;
	}

	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5) {
		margin: 1rem 0 0.5rem;
		color: #0f172a;
	}

	.prose :global(p) {
		margin: 0 0 0.75rem;
		line-height: 1.55;
		color: #1e293b;
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 0.75rem 1.25rem;
		line-height: 1.55;
		color: #1e293b;
	}

	.prose :global(li) {
		margin-bottom: 0.25rem;
	}

	.prose :global(code) {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.875em;
		background: #f1f5f9;
		padding: 0.05em 0.35em;
		border-radius: 4px;
	}

	.prose :global(pre) {
		background: #0f172a;
		color: #e2e8f0;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		overflow-x: auto;
		font-size: 0.875rem;
	}

	.prose :global(pre code) {
		background: transparent;
		padding: 0;
		color: inherit;
	}

	.prose :global(a) {
		color: #1d4ed8;
	}

	.refs {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.refs li {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.625rem 0.875rem;
		font-size: 0.9375rem;
	}

	.ref-detail {
		color: #64748b;
		margin-left: 0.25rem;
	}

	.ref-note {
		margin: 0.375rem 0 0;
		color: #475569;
		font-size: 0.875rem;
		line-height: 1.45;
	}
</style>
