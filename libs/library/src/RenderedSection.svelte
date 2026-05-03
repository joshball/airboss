<script lang="ts" module>
/**
 * `<RenderedSection>` -- minimal scaffold renderer for a reference section.
 *
 * Today this is a stub: it renders the supplied `body` markdown as a
 * `<pre>`-like block under the `title` heading. The downstream rendering WP
 * will replace this with full markdown -> HTML transformation, figure
 * resolution, footnote handling, adjacency-group collapse, and `airboss-ref:`
 * link rewriting via `urlForReference`.
 *
 * The component shape (props, slots, exports) is locked here so the
 * follow-on WPs can swap the implementation without touching every flightbag
 * route.
 */

export interface RenderedSectionProps {
	/** Section heading -- typically the manifest's `title` field. */
	readonly title: string;
	/** Citable identifier for this section (e.g. `airboss-ref:handbooks/phak/8083-25C/2/3`). */
	readonly id: string;
	/** Section body in markdown. May be empty when the section has no inline content. */
	readonly body: string;
}
</script>

<script lang="ts">
let { title, id, body }: RenderedSectionProps = $props();
</script>

<section data-testid="rendered-section" data-ref-id={id}>
	<h1>{title}</h1>
	{#if body.length > 0}
		<div class="body">
			{body}
		</div>
	{:else}
		<p class="empty" data-testid="rendered-section-empty">No body content for this section yet.</p>
	{/if}
</section>

<style>
section {
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
	max-width: 72ch;
}

.body {
	white-space: pre-wrap;
	font-family: var(--font-family-base);
	font-size: var(--font-size-base);
	line-height: var(--line-height-normal);
	color: var(--ink-body);
}

.empty {
	color: var(--ink-muted);
	font-style: italic;
}
</style>
