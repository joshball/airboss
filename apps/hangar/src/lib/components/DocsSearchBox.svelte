<script lang="ts">
import { DOCS_SEARCH_DEBOUNCE_MS, ROUTES } from '@ab/constants';
import { goto } from '$app/navigation';

/**
 * Live search box for `/docs` -- debounces user input by
 * `DOCS_SEARCH_DEBOUNCE_MS`, fires a GET to `/docs/search.json?q=`, renders
 * the top-N hits in a popover. ENTER on a hit (or click) navigates via
 * `goto`. ESC clears the popover.
 *
 * Uses a `fetch` to a `+server.ts` JSON endpoint rather than a form action
 * because typeahead UI wants per-keystroke results, not a submit cycle.
 *
 * Snippet bracketing in `ts_headline` returns `<mark>...</mark>` tags. We
 * render those via `{@html}` after sanitising on the server (see
 * `/docs/search.json/+server.ts`'s contract -- only `<mark>`/`</mark>` and
 * the bracketed body fragment are emitted).
 */

interface Hit {
	readonly path: string;
	readonly title: string;
	readonly snippet: string;
}

let query = $state('');
let hits = $state<readonly Hit[]>([]);
let loading = $state(false);
let open = $state(false);
let activeIndex = $state(-1);
let debounceTimer = $state<ReturnType<typeof setTimeout> | null>(null);
let inputEl = $state<HTMLInputElement | null>(null);

async function runSearch(q: string): Promise<void> {
	if (q.trim() === '') {
		hits = [];
		return;
	}
	loading = true;
	try {
		const res = await fetch(`${ROUTES.HANGAR_DOCS}/search.json?q=${encodeURIComponent(q)}`);
		if (!res.ok) {
			hits = [];
			return;
		}
		const data = (await res.json()) as { hits: Hit[] };
		hits = data.hits ?? [];
	} catch {
		hits = [];
	} finally {
		loading = false;
	}
}

function onInput(event: Event) {
	const target = event.currentTarget;
	if (!(target instanceof HTMLInputElement)) return;
	query = target.value;
	open = true;
	activeIndex = -1;
	if (debounceTimer !== null) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		void runSearch(query);
	}, DOCS_SEARCH_DEBOUNCE_MS);
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		open = false;
		return;
	}
	if (!open || hits.length === 0) {
		if (event.key === 'Enter') {
			// Allow Enter to trigger an immediate search even without a hit list.
			if (debounceTimer !== null) clearTimeout(debounceTimer);
			void runSearch(query);
			open = true;
		}
		return;
	}
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		activeIndex = Math.min(activeIndex + 1, hits.length - 1);
	} else if (event.key === 'ArrowUp') {
		event.preventDefault();
		activeIndex = Math.max(activeIndex - 1, 0);
	} else if (event.key === 'Enter') {
		event.preventDefault();
		const target = activeIndex >= 0 ? hits[activeIndex] : hits[0];
		if (target) {
			open = false;
			void goto(ROUTES.HANGAR_DOCS_PATH(target.path));
		}
	}
}

function onBlur() {
	// Defer close so a click on a result still navigates before blur kills the popover.
	setTimeout(() => {
		open = false;
	}, 150);
}

function onFocus() {
	if (hits.length > 0 || query.trim() !== '') open = true;
}
</script>

<div class="search-box" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="docs-search-results" aria-owns="docs-search-results">
	<input
		bind:this={inputEl}
		type="search"
		placeholder="Search docs"
		value={query}
		oninput={onInput}
		onkeydown={onKeydown}
		onblur={onBlur}
		onfocus={onFocus}
		aria-label="Search docs"
		aria-autocomplete="list"
		aria-controls="docs-search-results"
	/>
	{#if open && (loading || hits.length > 0 || query.trim() !== '')}
		<ul class="results" id="docs-search-results" role="listbox">
			{#if loading && hits.length === 0}
				<li class="state">Searching…</li>
			{:else if hits.length === 0}
				<li class="state">No matches.</li>
			{:else}
				{#each hits as hit, idx (hit.path)}
					<li class="hit" class:active={idx === activeIndex} role="option" aria-selected={idx === activeIndex}>
						<a href={ROUTES.HANGAR_DOCS_PATH(hit.path)} onclick={() => (open = false)}>
							<span class="hit-title">{hit.title}</span>
							<span class="hit-path">{hit.path}</span>
							{#if hit.snippet}
								<span class="hit-snippet">{@html hit.snippet}</span>
							{/if}
						</a>
					</li>
				{/each}
			{/if}
		</ul>
	{/if}
</div>

<style>
	.search-box {
		position: relative;
		flex: 0 1 24rem;
	}

	input {
		width: 100%;
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
		font: inherit;
	}

	input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.results {
		position: absolute;
		top: calc(100% + var(--space-2xs));
		left: 0;
		right: 0;
		max-height: 70vh;
		overflow-y: auto;
		list-style: none;
		padding: var(--space-2xs);
		margin: 0;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 60;
	}

	.state {
		padding: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.hit {
		border-radius: var(--radius-sm);
	}

	.hit.active {
		background: var(--surface-sunken);
	}

	.hit a {
		display: block;
		padding: var(--space-sm);
		text-decoration: none;
		color: inherit;
	}

	.hit a:hover {
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}

	.hit-title {
		display: block;
		color: var(--ink-body);
		font-weight: var(--type-ui-control-weight);
	}

	.hit-path {
		display: block;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}

	.hit-snippet {
		display: block;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		margin-top: var(--space-2xs);
	}

	.hit-snippet :global(mark) {
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
	}
</style>
