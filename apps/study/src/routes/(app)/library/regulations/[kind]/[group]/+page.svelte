<script lang="ts">
import AcCard from '@ab/aviation/ui/cards/AcCard.svelte';
import AimCorpusCard from '@ab/aviation/ui/cards/AimCorpusCard.svelte';
import CfrSectionRow from '@ab/aviation/ui/cards/CfrSectionRow.svelte';
import NtsbCard from '@ab/aviation/ui/cards/NtsbCard.svelte';
import UmbrellaCard from '@ab/aviation/ui/cards/UmbrellaCard.svelte';
import { type LibraryRegulationsKind, REFERENCE_KINDS, ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const kind = $derived(data.kind as LibraryRegulationsKind);
const kindLabel = $derived(data.kindLabel);

// Drives the CfrSectionRow `expanded` prop. The Expand all / Collapse all
// toolbar at the top of the section list flips this; per-row toggles
// override locally (the row tracks its own state once toggled).
let expandAll = $state(false);

// Per-Subpart collapse state: when `true`, the Subpart's child section
// rows are hidden. Defaults to all open. A future preference could persist
// this per-user; for now it's session-local.
const subpartCollapsed = $state<Record<string, boolean>>({});
function toggleSubpart(id: string): void {
	subpartCollapsed[id] = !subpartCollapsed[id];
}

const totalSubpartSections = $derived(data.subparts.reduce((acc, sp) => acc + sp.sections.length, 0));

function bodyUrlFor(code: string): string {
	return `${ROUTES.LIBRARY_REGULATIONS_GROUP(kind, data.group)}/section-body/${encodeURIComponent(code)}`;
}
</script>

<svelte:head>
	<title>{data.groupLabel} -- airboss</title>
</svelte:head>

<PageHeader title={data.groupLabel} subtitle={data.officialTitle ?? undefined}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS}>Regulations & policy</a> &raquo;
			<a href={ROUTES.LIBRARY_REGULATIONS_KIND(kind)}>{kindLabel}</a> &raquo;
			{#if data.chapterId}
				<span class="crumb-static">Chapter {data.chapterId}{data.chapterName ? ` (${data.chapterName})` : ''}</span> &raquo;
				{#if data.subchapterId}
					<span class="crumb-static">Subchapter {data.subchapterId}{data.subchapterName ? ` (${data.subchapterName})` : ''}</span> &raquo;
				{/if}
			{/if}
			<span>{data.groupLabel}</span>
		</nav>
	{/snippet}
</PageHeader>

{#if data.description || data.whyItMatters || data.external}
	<section aria-label="About this part" class="group-overview">
		{#if data.external}
			<p class="group-external">
				<a href={data.external.url} target="_blank" rel="noopener noreferrer">
					<span aria-hidden="true">↗</span>
					View at {data.external.label}
				</a>
			</p>
		{/if}
		{#if data.description}
			<p class="group-description">{data.description}</p>
		{/if}
		{#if data.whyItMatters}
			<p class="group-why">
				<span class="group-why-label">Why pilots care</span>
				<span>{data.whyItMatters}</span>
			</p>
		{/if}
	</section>
{/if}

{#if data.subparts.length > 0}
	<section aria-label="Subparts">
		<div class="section-toolbar">
			<span class="section-count">{data.subparts.length} subparts &middot; {totalSubpartSections} sections</span>
			<button type="button" class="section-toolbar-button" onclick={() => (expandAll = !expandAll)}>
				{expandAll ? 'Collapse all' : 'Expand all'}
			</button>
		</div>
		<div class="subpart-tree">
			{#each data.subparts as subpart (subpart.id)}
				<section class="subpart-group" aria-label={subpart.title}>
					<button
						type="button"
						class="subpart-header"
						aria-expanded={!subpartCollapsed[subpart.id]}
						onclick={() => toggleSubpart(subpart.id)}
					>
						<span class="subpart-twisty" aria-hidden="true">{subpartCollapsed[subpart.id] ? '+' : '–'}</span>
						<span class="subpart-title">{subpart.title}</span>
						<span class="subpart-meta">{subpart.sections.length} sections</span>
					</button>
					{#if !subpartCollapsed[subpart.id]}
						<ul class="section-list subpart-children">
							{#each subpart.sections as section (section.id)}
								<CfrSectionRow
									code={section.code}
									title={section.title}
									bodyUrl={bodyUrlFor(section.code)}
									href={ROUTES.LIBRARY_REGULATIONS_SECTION(kind, data.group, section.code)}
									external={section.external ?? { url: '#', label: 'eCFR' }}
									expanded={expandAll}
								/>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	</section>
{:else if data.sections.length > 0}
	<section aria-label="Sections">
		<div class="section-toolbar">
			<span class="section-count">{data.sections.length} sections</span>
			<button type="button" class="section-toolbar-button" onclick={() => (expandAll = !expandAll)}>
				{expandAll ? 'Collapse all' : 'Expand all'}
			</button>
		</div>
		<ul class="section-list">
			{#each data.sections as section (section.id)}
				<CfrSectionRow
					code={section.code}
					title={section.title}
					bodyUrl={bodyUrlFor(section.code)}
					href={ROUTES.LIBRARY_REGULATIONS_SECTION(kind, data.group, section.code)}
					external={section.external ?? { url: '#', label: 'eCFR' }}
					expanded={expandAll}
				/>
			{/each}
		</ul>
	</section>
{:else if data.umbrellas.length > 0}
	<section aria-label="Umbrella references">
		<ul class="grid">
			{#each data.umbrellas as ref (ref.id)}
				<li>
					{#if ref.kind === REFERENCE_KINDS.AIM || ref.kind === REFERENCE_KINDS.PCG}
						<AimCorpusCard
							title={ref.officialTitle ?? ref.title}
							description={ref.description ?? ''}
							whyItMatters={ref.whyItMatters ?? ''}
							edition={ref.edition}
							kindBadge={ref.kind === REFERENCE_KINDS.PCG ? 'PCG' : 'AIM'}
							external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
						/>
					{:else if ref.kind === REFERENCE_KINDS.NTSB}
						<NtsbCard
							reportNumber={ref.documentSlug}
							reportTitle={ref.title}
							summary={ref.description ?? null}
							external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
						/>
					{:else if ref.kind === REFERENCE_KINDS.AC}
						<AcCard
							acNumber={ref.documentSlug.replace(/^ac-/, '')}
							acTitle={ref.title}
							edition={ref.edition}
							description={ref.description ?? null}
							external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
						/>
					{:else}
						<UmbrellaCard
							title={ref.officialTitle ?? ref.title}
							description={ref.description ?? null}
							whyItMatters={ref.whyItMatters ?? null}
							kindBadge={ref.kindLabel}
							identifier={ref.edition && ref.edition !== '-' ? ref.edition : null}
							external={ref.externalUrl ? { url: ref.externalUrl, label: ref.publisher } : null}
						/>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{:else}
	<EmptyState title="No content yet" body="This group exists but no section data has been ingested." />
{/if}

<style>
	.section-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-md);
	}
	.section-count {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}
	.section-toolbar-button {
		appearance: none;
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		font: inherit;
		font-size: var(--font-size-sm);
		color: var(--action-default);
		cursor: pointer;
		transition: all var(--motion-fast) ease;
	}
	.section-toolbar-button:hover,
	.section-toolbar-button:focus-visible {
		background: var(--surface-sunken);
		border-color: var(--action-default-edge);
	}
	.section-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.subpart-tree {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.subpart-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
	.subpart-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font: inherit;
		font-weight: var(--font-weight-semibold);
		text-align: left;
		cursor: pointer;
		color: inherit;
		transition: background var(--motion-fast) ease, border-color var(--motion-fast) ease;
	}
	.subpart-header:hover,
	.subpart-header:focus-visible {
		background: var(--surface-raised, var(--surface-sunken));
		border-color: var(--action-default-edge);
	}
	.subpart-header:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.subpart-twisty {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		width: 1.25rem;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}
	.subpart-title {
		flex: 1 1 auto;
	}
	.subpart-meta {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		font-weight: var(--font-weight-regular);
	}
	.subpart-children {
		padding-left: var(--space-md);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	.group-overview {
		margin-top: var(--space-md);
		margin-bottom: var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		max-width: 70ch;
	}
	.group-description {
		margin: 0;
		font-size: var(--font-size-base);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.group-why {
		margin: 0;
		padding: var(--space-md) var(--space-lg);
		border-left: 3px solid var(--action-default-edge);
		background: var(--surface-sunken, var(--surface-raised));
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		border-radius: var(--radius-sm);
	}
	.group-why-label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
	.group-external {
		margin: 0;
		font-size: var(--font-size-sm);
	}
	.group-external a {
		color: var(--action-default);
		text-decoration: none;
	}
	.group-external a:hover,
	.group-external a:focus-visible {
		text-decoration: underline;
	}
	:global(.crumb-static) {
		color: var(--ink-muted);
	}
</style>
