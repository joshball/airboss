<script lang="ts">
/**
 * CFR section row. One row per section in a Part's TOC. Click the row to
 * expand the section body inline (lazy-fetched via the section-body
 * endpoint). The two-link footer carries:
 *   - `Read in airboss →`  (deep link to the dedicated section page in a
 *                           new tab so the user keeps their place in the
 *                           Part).
 *   - `↗ eCFR`             (canonical eCFR section URL).
 *
 * The row body is non-clickable text -- only the chevron / row-toggle
 * affordance triggers expand. Body text is selectable and copyable.
 *
 * Inline body fidelity: identical to the dedicated section page (same
 * `renderMarkdown` output). The dedicated page survives for full study
 * chrome (read-progress, citing nodes, errata, comprehended toggle,
 * notes).
 */

import { untrack } from 'svelte';

interface CardLink {
	readonly url: string;
	readonly label: string;
}

let {
	code,
	title,
	bodyUrl,
	href,
	external,
	expanded = false,
}: {
	code: string;
	title: string;
	/** Endpoint that returns `{ html, code, title }` for this section. */
	bodyUrl: string;
	/** Deep link to the dedicated section page. */
	href: string;
	external: CardLink;
	expanded?: boolean;
} = $props();

// Capture the initial value of `expanded`; the `$effect` below keeps `open`
// in sync when the parent flips Expand all / Collapse all. `untrack` makes
// the initial-only read explicit and silences the `state_referenced_locally`
// warning Svelte emits when a `$state(...)` initializer reads a reactive
// value directly.
let open = $state(untrack(() => expanded));
let html = $state<string | null>(null);
let loading = $state(false);
let loadError = $state<string | null>(null);

async function ensureBody(): Promise<void> {
	if (html !== null || loading) return;
	loading = true;
	loadError = null;
	try {
		const res = await fetch(bodyUrl, { headers: { Accept: 'application/json' } });
		if (!res.ok) {
			loadError = `Failed to load (${res.status})`;
			return;
		}
		const data = (await res.json()) as { html: string };
		html = data.html;
	} catch (err) {
		loadError = err instanceof Error ? err.message : 'Failed to load';
	} finally {
		loading = false;
	}
}

async function toggle(): Promise<void> {
	open = !open;
	if (open) await ensureBody();
}

// Drive open state from the parent's `expanded` prop. Re-read each tick
// so a parent-side "Expand all" / "Collapse all" toggle reaches us.
$effect(() => {
	const want = expanded;
	if (want && !open) {
		open = true;
		void ensureBody();
	} else if (!want && open) {
		open = false;
	}
});
</script>

<li class="row" class:row-open={open}>
	<button
		type="button"
		class="row-header"
		aria-expanded={open}
		aria-controls={`body-${code}`}
		onclick={toggle}
	>
		<span class="row-code">{code}</span>
		<span class="row-title">{title}</span>
		<span class="row-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
	</button>

	{#if open}
		<div class="row-body" id={`body-${code}`}>
			{#if loading}
				<p class="row-status">Loading…</p>
			{:else if loadError}
				<p class="row-status row-error">{loadError}</p>
			{:else if html !== null}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- server-rendered + sanitised by renderMarkdown -->
				{@html html}
			{/if}
			<div class="row-footer">
				<a class="row-link row-link-local" href={href} target="_blank" rel="noopener noreferrer">
					Read in airboss <span aria-hidden="true">→</span>
				</a>
				<a class="row-link row-link-external" href={external.url} target="_blank" rel="noopener noreferrer">
					<span aria-hidden="true">↗</span>
					{external.label}
				</a>
			</div>
		</div>
	{/if}
</li>

<style>
	.row {
		list-style: none;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		transition: border-color var(--motion-fast) ease;
	}
	.row:hover {
		border-color: var(--edge-strong, var(--action-default-edge));
	}
	.row-open {
		border-color: var(--action-default-edge);
	}
	.row-header {
		appearance: none;
		background: transparent;
		border: none;
		width: 100%;
		display: grid;
		grid-template-columns: minmax(4.5rem, max-content) 1fr auto;
		gap: var(--space-md);
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
		border-radius: var(--radius-md);
	}
	.row-header:hover,
	.row-header:focus-visible {
		background: var(--surface-sunken);
	}
	.row-header:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}
	.row-code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.row-title {
		font-size: var(--font-size-base);
	}
	.row-chevron {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.row-body {
		padding: var(--space-md) var(--space-lg);
		border-top: 1px solid var(--edge-subtle);
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed, 1.55);
	}
	.row-body :global(p) {
		margin: 0 0 var(--space-sm);
	}
	.row-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.row-status {
		margin: 0;
		color: var(--ink-muted);
	}
	.row-error {
		color: var(--signal-danger);
	}
	.row-footer {
		margin-top: var(--space-md);
		padding-top: var(--space-sm);
		border-top: 1px solid var(--edge-subtle);
		display: flex;
		justify-content: flex-end;
		gap: var(--space-md);
		font-size: var(--font-size-sm);
	}
	.row-link {
		text-decoration: none;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
	}
	.row-link-local {
		color: var(--action-default);
		font-weight: var(--font-weight-semibold);
	}
	.row-link-external {
		color: var(--ink-muted);
	}
	.row-link:hover,
	.row-link:focus-visible {
		background: var(--surface-sunken);
	}
</style>
