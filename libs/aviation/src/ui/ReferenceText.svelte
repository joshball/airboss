<script lang="ts">
import { getReferenceById, getReferenceByTerm } from '../registry';
import { parseWikilinks } from '../wikilink/parser';
import ReferenceTerm from './ReferenceTerm.svelte';

/**
 * Render a prose string that may contain `[[DISPLAY::id]]` wiki-links.
 *
 * Plain-text segments are emitted as-is. Each wiki-link node resolves
 * through the in-memory registry:
 *   - `[[display::id]]`   -- if id resolves, render ReferenceTerm with that
 *                             reference + the authored display; otherwise
 *                             render unresolved (dev-highlighted) display.
 *   - `[[::id]]`          -- if id resolves, render the reference's
 *                             displayName via ReferenceTerm; otherwise raw.
 *   - `[[display::]]`     -- render display as unresolved; dev-highlight
 *                             when `devMode`.
 *
 * This component does NOT re-run the broader validation (that's the build
 * gate's job). It renders what it can and leaves broken links visible so
 * authors see them during dev.
 */

let {
	source,
	devMode = false,
}: {
	source: string;
	devMode?: boolean;
} = $props();

const nodes = $derived(parseWikilinks(source).nodes);
</script>

{#each nodes as node, i (i)}
	{#if node.kind === 'text'}
		{node.text}
	{:else if node.id}
		{@const resolved = getReferenceById(node.id)}
		{#if resolved}
			<ReferenceTerm reference={resolved} display={node.display} {devMode} />
		{:else}
			<ReferenceTerm display={node.display ?? node.id} {devMode} />
		{/if}
	{:else if node.display}
		{@const fuzzy = getReferenceByTerm(node.display)}
		{#if fuzzy}
			<ReferenceTerm reference={fuzzy} display={node.display} {devMode} />
		{:else}
			<ReferenceTerm display={node.display} {devMode} />
		{/if}
	{/if}
{/each}
