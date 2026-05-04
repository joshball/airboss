<script lang="ts">
import { DOCS_SEARCH_DEBOUNCE_MS, DOCS_SEARCH_MIN_QUERY_LEN, ROUTES } from '@ab/constants';
import { goto } from '$app/navigation';

/**
 * Live search box for `/docs` -- debounces user input by
 * `DOCS_SEARCH_DEBOUNCE_MS`, fires a GET to `/docs/search.json?q=`, renders
 * the top-N hits in a popover. ENTER on a hit (or click) navigates via
 * `goto`. ESC clears the query (first press) then closes the popover.
 *
 * Below `DOCS_SEARCH_MIN_QUERY_LEN` characters the popover stays closed
 * (no flicker, no premature "no matches"). The popover opens after the
 * user types two characters and a request returns.
 *
 * Race-safety:
 *   - In-flight requests are cancelled via `AbortController` whenever a
 *     new keystroke supersedes the old one. The endpoint sees a closed
 *     request; that's free server-side cancellation.
 *   - A monotonic `requestId` counter gates the apply-to-state on the
 *     response so an out-of-order non-aborted response cannot clobber
 *     newer hits.
 *
 * Snippet safety: the server post-escapes `ts_headline` output and only
 * re-injects `<mark>`/`</mark>` tags. The contract reaching the client is
 * "only `<mark>` survives; everything else is text", so `{@html}` on the
 * snippet is safe.
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
let inputEl = $state<HTMLInputElement | null>(null);

// Plain `let`s -- not template-read, no need for reactive proxies.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: AbortController | null = null;
let nextRequestId = 0;
let lastAppliedRequestId = -1;

const optionId = (idx: number): string => `docs-search-opt-${idx}`;

const activeOptionId = $derived(open && activeIndex >= 0 ? optionId(activeIndex) : undefined);

async function runSearch(q: string): Promise<void> {
	const trimmed = q.trim();
	if (trimmed === '') {
		hits = [];
		open = false;
		return;
	}
	if (trimmed.length < DOCS_SEARCH_MIN_QUERY_LEN) {
		hits = [];
		return;
	}
	// Cancel the prior in-flight request before starting a new one. The
	// server endpoint sees a closed connection and stops the FTS scan early.
	if (inflight !== null) inflight.abort();
	const controller = new AbortController();
	inflight = controller;
	const requestId = nextRequestId++;
	loading = true;
	try {
		const res = await fetch(`${ROUTES.HANGAR_DOCS}/search.json?q=${encodeURIComponent(q)}`, {
			signal: controller.signal,
		});
		if (!res.ok) {
			if (requestId > lastAppliedRequestId) {
				lastAppliedRequestId = requestId;
				hits = [];
			}
			return;
		}
		const data = (await res.json()) as { hits: Hit[] };
		// Drop late responses -- only the most recent request reaches state.
		if (requestId <= lastAppliedRequestId) return;
		lastAppliedRequestId = requestId;
		hits = data.hits ?? [];
	} catch (err) {
		// Aborted requests reach here as a `DOMException` named "AbortError"
		// or "Abort" -- silently swallow.
		if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'Abort')) return;
		if (requestId > lastAppliedRequestId) {
			lastAppliedRequestId = requestId;
			hits = [];
		}
	} finally {
		// `loading` belongs to the latest request; only flip it off when
		// this controller is still the active one.
		if (inflight === controller) {
			inflight = null;
			loading = false;
		}
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
		event.preventDefault();
		// First press clears the query if it's non-empty; second press closes.
		if (query !== '') {
			query = '';
			hits = [];
			activeIndex = -1;
			if (debounceTimer !== null) clearTimeout(debounceTimer);
			if (inflight !== null) inflight.abort();
			open = false;
			// Keep focus on the input so the user can immediately retype.
			inputEl?.focus();
			return;
		}
		open = false;
		// On the second press blur the input so focus releases out of the box.
		inputEl?.blur();
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
		activeIndex = activeIndex < hits.length - 1 ? activeIndex + 1 : 0;
	} else if (event.key === 'ArrowUp') {
		event.preventDefault();
		// Wrap from the first option to the last so the user can reach the
		// bottom from the top via one keystroke (W3C APG combobox option).
		activeIndex = activeIndex <= 0 ? hits.length - 1 : activeIndex - 1;
	} else if (event.key === 'Enter') {
		event.preventDefault();
		const target = activeIndex >= 0 ? hits[activeIndex] : hits[0];
		if (target) {
			open = false;
			void goto(ROUTES.HANGAR_DOCS_PATH(target.path));
		}
	}
}

function onFocus() {
	if (hits.length > 0 || query.trim() !== '') open = true;
}

/**
 * Suppress blur on popover mousedown so a result click runs to navigation
 * without the input losing focus first. Replaces the prior 150 ms timeout
 * (which leaked across unmount and races between handlers).
 */
function onPopoverMousedown(event: MouseEvent) {
	event.preventDefault();
}

function onResultClick() {
	open = false;
}

/**
 * Component teardown: cancel any in-flight fetch + pending debounce when
 * Svelte unmounts. Without this, a navigation away inside the debounce
 * window would dispatch a network request from a torn-down component.
 */
$effect(() => {
	return () => {
		if (debounceTimer !== null) clearTimeout(debounceTimer);
		if (inflight !== null) inflight.abort();
	};
});
</script>

<div class="search-box">
	<span class="icon" aria-hidden="true">⌕</span>
	<input
		bind:this={inputEl}
		type="search"
		placeholder="Search docs"
		value={query}
		oninput={onInput}
		onkeydown={onKeydown}
		onfocus={onFocus}
		role="combobox"
		aria-label="Search docs"
		aria-autocomplete="list"
		aria-expanded={open}
		aria-controls="docs-search-results"
		aria-activedescendant={activeOptionId}
	/>
	{#if open && (hits.length > 0 || (loading && query.trim().length >= DOCS_SEARCH_MIN_QUERY_LEN))}
		<ul
			class="results"
			id="docs-search-results"
			role="listbox"
			onmousedown={onPopoverMousedown}
		>
			{#if loading && hits.length === 0}
				<li class="state">Searching...</li>
			{:else if hits.length === 0}
				<li class="state">No matches.</li>
			{:else}
				{#each hits as hit, idx (hit.path)}
					{@const sameAsPath = hit.title === hit.path || hit.title === hit.path.split('/').pop()}
					<li
						id={optionId(idx)}
						class="hit"
						class:active={idx === activeIndex}
						role="option"
						aria-selected={idx === activeIndex}
					>
						<a href={ROUTES.HANGAR_DOCS_PATH(hit.path)} onclick={onResultClick}>
							{#if sameAsPath}
								<span class="hit-title">{hit.path}</span>
							{:else}
								<span class="hit-title">{hit.title}</span>
								<span class="hit-path">{hit.path}</span>
							{/if}
							{#if hit.snippet}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -->
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
		display: flex;
		align-items: center;
	}

	.icon {
		position: absolute;
		left: var(--space-sm);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		pointer-events: none;
	}

	input {
		width: 100%;
		padding: var(--space-2xs) var(--space-sm) var(--space-2xs) var(--space-xl);
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
