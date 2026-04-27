<script lang="ts">
import {
	CERT_LABELS,
	type Cert,
	CITATION_SOURCE_LABELS,
	CITATION_SOURCE_TYPES,
	type CitationSourceType,
	DOMAIN_LABELS,
	type Domain,
	KNOWLEDGE_PHASE_LABELS,
	type KnowledgePhase,
	NODE_LIFECYCLE_LABELS,
	NODE_MASTERY_GATE_LABELS,
	type NodeMasteryGate,
	REFERENCE_KIND_LABELS,
	REFERENCE_KINDS,
	type ReferenceKind,
	ROUTES,
	STUDY_PRIORITY_LABELS,
	type StudyPriority,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import { type Citation, isStructuredCitation } from '@ab/types';
import CitedByPanel, { type CitedByItem } from '@ab/ui/components/CitedByPanel.svelte';
import { humanize, renderMarkdown } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const node = $derived(data.node);
const phases = $derived(data.phases);
const edges = $derived(data.edges);
const mastery = $derived(data.mastery);
const lifecycle = $derived(data.lifecycle);
const citedBy = $derived(data.citedBy);

function citedByHref(type: CitationSourceType, id: string): string | null {
	switch (type) {
		case CITATION_SOURCE_TYPES.CARD:
			// Public card surface: works for any reader regardless of card ownership.
			return ROUTES.CARD_PUBLIC(id);
		case CITATION_SOURCE_TYPES.REP:
		case CITATION_SOURCE_TYPES.SCENARIO:
			return ROUTES.REP_DETAIL(id);
		case CITATION_SOURCE_TYPES.NODE:
			return ROUTES.KNOWLEDGE_SLUG(id);
		default:
			return null;
	}
}

function sourceTypeLabel(type: CitationSourceType): string {
	return CITATION_SOURCE_LABELS[type];
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
}

function phaseLabel(phase: string): string {
	return (KNOWLEDGE_PHASE_LABELS as Record<KnowledgePhase, string>)[phase as KnowledgePhase] ?? humanize(phase);
}

function certLabel(slug: string): string {
	return (CERT_LABELS as Record<Cert, string>)[slug as Cert] ?? slug;
}

function priorityLabel(slug: string): string {
	return (STUDY_PRIORITY_LABELS as Record<StudyPriority, string>)[slug as StudyPriority] ?? humanize(slug);
}

function lifecycleLabel(slug: string): string {
	return (NODE_LIFECYCLE_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

const masteryPct = $derived(Math.round(mastery.displayScore * 100));

function gateLabel(gate: string): string {
	return (NODE_MASTERY_GATE_LABELS as Record<NodeMasteryGate, string>)[gate as NodeMasteryGate] ?? gate;
}

function renderPhase(body: string | null): string {
	if (!body) return '';
	return renderMarkdown(body);
}

interface CitationDisplay {
	/** Stable key for the {#each} block. */
	key: string;
	/** Primary heading -- "PHAK" / "FAR Part 91" / freeform `source`. */
	source: string;
	/** Secondary detail line -- locator string or freeform `detail`. */
	detail: string;
	/** Optional commentary -- freeform `note`. */
	note: string;
	/** Resolved URL when available; null falls back to plain text. */
	href: string | null;
	/** Structured-but-unresolved citations get the "(citation broken)" tag. */
	broken: boolean;
	/** Structured kinds get a kind chip; legacy entries don't. */
	kindLabel: string | null;
}

/** Format a structured citation's locator into a human-readable suffix. */
function formatStructuredLocator(citation: Extract<Citation, { kind: ReferenceKind }>): string {
	switch (citation.kind) {
		case REFERENCE_KINDS.HANDBOOK: {
			const parts = [`Ch. ${citation.locator.chapter}`];
			if (citation.locator.section !== undefined) parts.push(`§${citation.locator.section}`);
			if (citation.locator.subsection !== undefined) parts.push(`.${citation.locator.subsection}`);
			if (citation.locator.page_start) {
				const pages = citation.locator.page_end
					? `pp. ${citation.locator.page_start}..${citation.locator.page_end}`
					: `p. ${citation.locator.page_start}`;
				parts.push(`(${pages})`);
			}
			return parts.join(' ');
		}
		case REFERENCE_KINDS.CFR:
			return `${citation.locator.title} CFR ${citation.locator.part}.${citation.locator.section}`;
		case REFERENCE_KINDS.AC:
			return citation.locator.paragraph ? `¶${citation.locator.paragraph}` : '';
		case REFERENCE_KINDS.ACS:
		case REFERENCE_KINDS.PTS: {
			const parts: string[] = [];
			if (citation.locator.area) parts.push(`Area ${citation.locator.area}`);
			if (citation.locator.task) parts.push(`Task ${citation.locator.task}`);
			if (citation.locator.element) parts.push(`Element ${citation.locator.element}`);
			return parts.join(', ');
		}
		case REFERENCE_KINDS.AIM:
			return citation.locator.paragraph ? `¶${citation.locator.paragraph}` : '';
		case REFERENCE_KINDS.PCG:
			return citation.locator.term ?? '';
		case REFERENCE_KINDS.NTSB:
		case REFERENCE_KINDS.POH:
		case REFERENCE_KINDS.OTHER:
			return citation.locator.detail ?? '';
	}
}

function toCitationDisplay(entry: PageData['node']['references'][number], index: number): CitationDisplay {
	const { citation, resolvedUrl } = entry;
	if (isStructuredCitation(citation)) {
		const kindLabel = REFERENCE_KIND_LABELS[citation.kind];
		const detail = formatStructuredLocator(citation);
		// "Broken" = handbook citation whose `reference_id` failed to resolve.
		// Non-handbook kinds (cfr, ac, acs, ...) deliberately return null from
		// the v1 resolver because the per-kind resolvers ship in the cert-
		// syllabus WP. Those are "future kind, no link yet," not broken.
		const broken = citation.kind === REFERENCE_KINDS.HANDBOOK && resolvedUrl === null;
		return {
			key: `${citation.kind}:${citation.reference_id}:${index}`,
			source: kindLabel,
			detail,
			note: citation.note ?? '',
			href: resolvedUrl,
			broken,
			kindLabel,
		};
	}
	return {
		key: `legacy:${citation.source}:${citation.detail}:${index}`,
		source: citation.source,
		detail: citation.detail,
		note: citation.note,
		// Legacy citations never have a URL in v1 (resolver returns null) and
		// are NOT broken -- they're freeform by design.
		href: null,
		broken: false,
		kindLabel: null,
	};
}

const referenceItems = $derived<CitationDisplay[]>(node.references.map(toCitationDisplay));

const citedByItems = $derived<CitedByItem[]>(
	citedBy.map((c) => ({
		id: c.citation.id,
		typeLabel: sourceTypeLabel(c.source.type),
		label: c.source.label,
		href: c.source.exists ? citedByHref(c.source.type, c.source.id) : null,
		context: c.citation.citationContext,
	})),
);
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
		<div class="title-row">
			<h1>{node.title}</h1>
			<PageHelp pageId="knowledge-graph" />
		</div>
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

	{#if node.minimumCert || node.studyPriority}
		<section class="section relevance-row" aria-label="Cert and study priority">
			{#if node.minimumCert}
				<div class="relevance-cell">
					<dt>Minimum cert</dt>
					<dd>{certLabel(node.minimumCert)}</dd>
				</div>
			{/if}
			{#if node.studyPriority}
				<div class="relevance-cell">
					<dt>Study priority</dt>
					<dd class="priority priority-{node.studyPriority}">{priorityLabel(node.studyPriority)}</dd>
				</div>
			{/if}
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

	{#if referenceItems.length > 0}
		<section class="section" aria-label="References">
			<h2>References</h2>
			<ul class="refs">
				{#each referenceItems as ref (ref.key)}
					<li class="ref-item">
						{#if ref.href}
							<a class="ref-link" href={ref.href}>
								<strong>{ref.source}</strong>
								{#if ref.detail}
									<span class="ref-detail">-- {ref.detail}</span>
								{/if}
							</a>
						{:else}
							<span>
								<strong>{ref.source}</strong>
								{#if ref.detail}
									<span class="ref-detail">-- {ref.detail}</span>
								{/if}
								{#if ref.broken}
									<span class="ref-broken" title="Citation reference not found in this database.">
										(citation broken)
									</span>
								{/if}
							</span>
						{/if}
						{#if ref.note}
							<p class="ref-note">{ref.note}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="section">
		<CitedByPanel items={citedByItems} />
	</section>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.crumb {
		display: flex;
		gap: var(--space-sm);
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.crumb a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
		margin-top: var(--space-sm);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge.domain {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.cross-domain {
		color: var(--accent-code);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.lifecycle-skeleton {
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.badge.lifecycle-started {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.lifecycle-complete {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.mastery-panel {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.mastery-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.mastery-label {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.mastery-pct {
		font-size: var(--type-definition-body-size);
		color: var(--ink-body);
		font-weight: 600;
	}

	.mastery-bar {
		width: 100%;
		height: 8px;
		background: var(--edge-default);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.mastery-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
	}

	.gates {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		margin: var(--space-2xs) 0 0;
	}

	.gate {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.gate dt {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
		font-weight: 600;
	}

	.gate dd {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.gate-pass {
		color: var(--signal-success);
	}

	.gate-fail {
		color: var(--action-hazard-hover);
	}

	.gate-insufficient_data {
		color: var(--signal-warning);
	}

	.gate-not_applicable {
		color: var(--ink-subtle);
	}

	.ctas {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}

	.section h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-reading-lead-size);
		color: var(--ink-body);
		letter-spacing: -0.01em;
	}

	.relevance-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xl);
		font-size: var(--type-ui-label-size);
	}

	.relevance-cell {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.relevance-cell dt {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.relevance-cell dd {
		margin: 0;
		color: var(--ink-body);
		font-weight: 600;
	}

	.priority.priority-critical {
		color: var(--action-hazard-hover);
	}

	.priority.priority-standard {
		color: var(--signal-warning);
	}

	.priority.priority-stretch {
		color: var(--ink-muted);
	}

	.edge-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-xs);
	}

	.edge-list a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.edge-list a:hover {
		text-decoration: underline;
	}

	.gap {
		color: var(--ink-subtle);
	}

	.gap-note {
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
	}

	.phases {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.phase {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-lg);
	}

	.phase-title {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-reading-body-size);
		color: var(--ink-body);
	}

	.gap-body {
		margin: 0;
		color: var(--ink-faint);
		font-style: italic;
	}

	.prose :global(h3),
	.prose :global(h4),
	.prose :global(h5) {
		margin: var(--space-lg) 0 var(--space-sm);
		color: var(--ink-body);
	}

	.prose :global(p) {
		margin: 0 0 var(--space-md);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.prose :global(ul),
	.prose :global(ol) {
		margin: 0 0 var(--space-md) var(--space-xl);
		line-height: 1.55;
		color: var(--ink-body);
	}

	.prose :global(li) {
		margin-bottom: var(--space-2xs);
	}

	.prose :global(code) {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		background: var(--surface-sunken);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-xs);
	}

	.prose :global(pre) {
		background: var(--ink-body);
		color: var(--edge-default);
		padding: var(--space-md) var(--space-lg);
		border-radius: var(--radius-md);
		overflow-x: auto;
		font-size: var(--type-ui-label-size);
	}

	.prose :global(pre code) {
		background: transparent;
		padding: 0;
		color: inherit;
	}

	.prose :global(a) {
		color: var(--action-default-hover);
	}

	.refs {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.refs li {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-sm) var(--space-md);
		font-size: var(--type-definition-body-size);
	}

	.ref-detail {
		color: var(--ink-subtle);
		margin-left: var(--space-2xs);
	}

	.ref-note {
		margin: var(--space-xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		line-height: 1.45;
	}

	.ref-link {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2xs);
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.ref-link:hover {
		text-decoration: underline;
	}

	.ref-link strong {
		color: inherit;
	}

	.ref-broken {
		margin-left: var(--space-xs);
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
		font-style: italic;
	}

</style>
