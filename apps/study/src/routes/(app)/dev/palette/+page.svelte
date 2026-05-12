<script lang="ts">
/**
 * Dev palette variant index.
 *
 * Phase 3 of the command-palette WP ships three visual prototypes side-
 * by-side so Joshua can A/B them against live data before committing the
 * production palette to a single shape. Variant C (wide) is the chosen
 * production default; the other two stay around as reference for the
 * Phase 3 visual review and as scaffolding for future surface variations
 * (sim's narrower scenario palette, hangar's authoring palette, etc.).
 *
 * Reach via /dev/palette. Not wired into navigation; not surfaced on the
 * production sidebar.
 */
</script>

<svelte:head>
	<title>Palette variants — airboss</title>
</svelte:head>

<header class="page-header">
	<h1>Palette visual variants</h1>
	<p class="lede">
		Phase 3 of the command-palette work package. Each link below mounts a working palette in a
		different visual shape with the same underlying ranker and loaders, so we can compare them on
		identical queries.
	</p>
</header>

<section class="variants">
	<article class="variant">
		<header>
			<h2><a href="/dev/palette/wide">Variant C — wide 4-column + detail pane</a></h2>
			<p class="badge">Production candidate</p>
		</header>
		<p>
			Four columns full-width when no row is selected; three columns + right detail pane when one
			is. Per-type accent borders, type-tag chips, banner hoist for tier-1 singletons. Detail pane
			collapses with <kbd>⌘</kbd>+<kbd>\</kbd>; auto-hides below 900px viewport.
		</p>
	</article>

	<article class="variant">
		<header>
			<h2><a href="/dev/palette/list">Variant A — Linear-style sectioned list</a></h2>
			<p class="badge">A/B</p>
		</header>
		<p>
			Single column with category dividers (FAA Resources, Airboss Content, App Help, My Stuff,
			External Tools, Commands). No detail pane. Each row carries the type tag + title +
			subtitle. Closest to how Linear's Cmd+K feels.
		</p>
	</article>

	<article class="variant">
		<header>
			<h2><a href="/dev/palette/raycast">Variant B — narrow column + always-on detail</a></h2>
			<p class="badge">A/B</p>
		</header>
		<p>
			Narrow single-column result list with a permanent right-side detail pane. Closest to
			Raycast's two-pane shape. Useful for screens that want immediate detail-on-highlight
			without the Cmd+\ toggle.
		</p>
	</article>
</section>

<section class="notes">
	<h2>Walk these queries on each variant</h2>
	<ul>
		<li><code>weather</code> — hoist banner + full multi-column fan-out</li>
		<li><code>FAA-H-8083-28</code> — doc-code autocomplete + handbook hoist</li>
		<li><code>91.103</code> — single CFR section</li>
		<li><code>wx</code> — synonym chip rewrite to weather</li>
		<li><code>Part 91</code> — CFR Part hoist</li>
		<li><code>doc:phak turbulence</code> — filter chip + inside-doc search</li>
	</ul>
</section>

<style>
	.page-header {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-lg) var(--space-xl);
	}

	.page-header h1 {
		margin: 0;
		font-size: var(--font-size-2xl);
	}

	.page-header .lede {
		color: var(--ink-muted);
		max-width: 48rem;
	}

	.variants {
		max-width: 64rem;
		margin: 0 auto;
		padding: 0 var(--space-xl);
		display: grid;
		gap: var(--space-md);
	}

	.variant {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md) var(--space-lg);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
	}

	.variant header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
	}

	.variant h2 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.variant a {
		color: var(--ink-body);
	}

	.badge {
		margin: 0;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		background: var(--surface-sunken);
		padding: var(--space-3xs) var(--space-sm);
		border-radius: var(--radius-pill);
	}

	.notes {
		max-width: 64rem;
		margin: var(--space-xl) auto;
		padding: 0 var(--space-xl);
	}

	.notes h2 {
		font-size: var(--font-size-md);
		margin: 0 0 var(--space-sm);
	}

	.notes ul {
		margin: 0;
		padding-left: var(--space-lg);
		color: var(--ink-muted);
	}

	.notes code {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		background: var(--surface-sunken);
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-xs);
		color: var(--ink-body);
	}

	kbd {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		border: 1px solid var(--edge-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-xs);
		padding: 0 var(--space-2xs);
		background: var(--surface-sunken);
	}
</style>
