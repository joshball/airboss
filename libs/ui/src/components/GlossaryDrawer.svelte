<!--
@component
Glossary drawer (study-app-ia-cleanup Phase 3).

Right-cluster `?` button opens this drawer; the same content lives at
the canonical `/reference/glossary` page. Both surfaces consume
`@ab/help/glossary` so the corpus has one source of truth.

The trigger is rendered alongside the drawer so consumers can mount
this once in their layout and the drawer + button stay in sync. State
lives in `GlossaryDrawerState` (`.svelte.ts`) so the open / close /
selection logic is unit-testable without a DOM harness.
-->
<script lang="ts" module>
/**
 * Shape of a glossary entry consumed by `GlossaryDrawer`. Mirrors the
 * `GlossaryEntryFull` interface from `@ab/help/glossary` but is
 * declared locally so libs/ui stays a leaf in the dep graph (mirrors
 * the `helpSearch` snippet pattern in AppHeader). The study app's
 * layout passes entries in via the `entries` prop, sourced from
 * `listGlossaryEntries()`.
 */
export interface GlossaryDrawerEntry {
	key: string;
	term: string;
	short: string;
	long: string;
	related: ReadonlyArray<string>;
}
</script>

<script lang="ts">
import Drawer from './Drawer.svelte';

interface Props {
	/** Glossary entries to render. Pass the result of `listGlossaryEntries()` from the study app. */
	entries: ReadonlyArray<GlossaryDrawerEntry>;
	/** Trigger button label / aria-label. Default `Glossary`. */
	triggerLabel?: string;
}

const { entries, triggerLabel = 'Glossary' }: Props = $props();

let open = $state(false);
let query = $state('');
let selectedKey = $state<string | null>(null);

const filtered = $derived(filterEntries(entries, query));
const selectedEntry = $derived<GlossaryDrawerEntry | null>(
	selectedKey === null ? null : (entries.find((e) => e.key === selectedKey) ?? null),
);

function filterEntries(
	source: ReadonlyArray<GlossaryDrawerEntry>,
	q: string,
): ReadonlyArray<GlossaryDrawerEntry> {
	const trimmed = q.trim().toLowerCase();
	if (trimmed === '') return source;
	return source.filter((entry) => {
		if (entry.term.toLowerCase().includes(trimmed)) return true;
		if (entry.short.toLowerCase().includes(trimmed)) return true;
		return entry.long.toLowerCase().includes(trimmed);
	});
}

function handleTrigger() {
	open = !open;
	if (!open) {
		// Reset selection on close so the next open shows the index, not
		// whatever entry the user expanded last visit.
		selectedKey = null;
	}
}

function handleClose() {
	open = false;
	selectedKey = null;
}

function handleSelect(key: string) {
	selectedKey = key;
}

function handleBack() {
	selectedKey = null;
}

function handleQueryInput(value: string) {
	query = value;
	// Typing clears any expanded entry so the filtered list is what the
	// user sees as they narrow the search.
	selectedKey = null;
}

/** Strip a YAML frontmatter block (`---\n...\n---\n`) before rendering. */
function stripFrontmatter(markdown: string): string {
	if (!markdown.startsWith('---')) return markdown;
	const end = markdown.indexOf('\n---', 3);
	if (end === -1) return markdown;
	const after = markdown.indexOf('\n', end + 4);
	if (after === -1) return '';
	let i = after + 1;
	while (i < markdown.length && (markdown[i] === '\n' || markdown[i] === '\r')) i++;
	return markdown.slice(i);
}
</script>

<button
	type="button"
	class="trigger"
	aria-label={triggerLabel}
	aria-expanded={open}
	data-testid="glossary-drawer-trigger"
	onclick={handleTrigger}
>
	<span aria-hidden="true">?</span>
	<span class="trigger-label">{triggerLabel}</span>
</button>

<Drawer
	bind:open
	side="end"
	size="md"
	ariaLabel="Glossary drawer"
	onClose={handleClose}
>
	{#snippet header()}
		<div class="header">
			<h2 class="title">Glossary</h2>
			<input
				type="search"
				class="search"
				placeholder="Search glossary..."
				aria-label="Search glossary"
				value={query}
				oninput={(e) => handleQueryInput((e.currentTarget as HTMLInputElement).value)}
				data-testid="glossary-drawer-search"
			/>
		</div>
	{/snippet}
	{#snippet body()}
		{#if selectedEntry !== null}
			<article class="detail" data-testid="glossary-drawer-detail">
				<button type="button" class="back" onclick={handleBack}>← Back</button>
				<h3 class="term">{selectedEntry.term}</h3>
				<p class="short">{selectedEntry.short}</p>
				{#if selectedEntry.long !== ''}
					<pre class="long">{stripFrontmatter(selectedEntry.long)}</pre>
				{/if}
				{#if selectedEntry.related.length > 0}
					<section class="related" aria-labelledby="related-heading">
						<h4 id="related-heading">Related</h4>
						<ul>
							{#each selectedEntry.related as relatedKey (relatedKey)}
								<li>
									<button type="button" class="related-link" onclick={() => handleSelect(relatedKey)}>
										{relatedKey}
									</button>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			</article>
		{:else}
			<ul class="entries" data-testid="glossary-drawer-list">
				{#each filtered as entry (entry.key)}
					<li>
						<button
							type="button"
							class="entry"
							onclick={() => handleSelect(entry.key)}
							data-testid={`glossary-drawer-entry-${entry.key}`}
						>
							<span class="entry-term">{entry.term}</span>
							<span class="entry-short">{entry.short}</span>
						</button>
					</li>
				{/each}
				{#if filtered.length === 0}
					<li class="empty">No glossary entries match "{query}".</li>
				{/if}
			</ul>
		{/if}
	{/snippet}
</Drawer>

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-muted);
		font: inherit;
		font-weight: var(--type-ui-control-weight);
		cursor: pointer;
	}

	.trigger:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.header {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.title {
		margin: 0;
		font-size: var(--type-heading-2-size);
		font-weight: var(--type-heading-2-weight);
		color: var(--ink-body);
	}

	.search {
		width: 100%;
		padding: var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-page);
		color: var(--ink-body);
		font: inherit;
	}

	.search:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.entries {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.entry {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		width: 100%;
		text-align: left;
		padding: var(--space-sm);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.entry:hover {
		background: var(--surface-sunken);
		border-color: var(--edge-default);
	}

	.entry:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.entry-term {
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-body);
	}

	.entry-short {
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.empty {
		padding: var(--space-md);
		color: var(--ink-muted);
		text-align: center;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.back {
		align-self: flex-start;
		background: transparent;
		border: 0;
		padding: var(--space-2xs) var(--space-sm);
		color: var(--ink-muted);
		font: inherit;
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.back:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.back:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.term {
		margin: 0;
		font-size: var(--type-heading-3-size);
		font-weight: var(--type-heading-2-weight);
		color: var(--ink-body);
	}

	.short {
		margin: 0;
		color: var(--ink-muted);
	}

	.long {
		white-space: pre-wrap;
		font-family: inherit;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
		margin: 0;
	}

	.related {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding-top: var(--space-sm);
		border-top: 1px solid var(--edge-default);
	}

	.related h4 {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		font-weight: var(--type-ui-control-weight);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.related ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.related-link {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		color: var(--ink-muted);
		font: inherit;
		font-size: var(--type-ui-label-size);
		cursor: pointer;
	}

	.related-link:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.related-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.trigger-label {
		font-variant: small-caps;
		text-transform: lowercase;
		letter-spacing: var(--letter-spacing-wide);
		font-size: var(--type-ui-caption-size);
	}
</style>
