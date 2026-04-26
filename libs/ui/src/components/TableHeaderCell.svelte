<script lang="ts">
import type { Snippet } from 'svelte';

let {
	scope = 'col',
	children,
}: {
	scope?: 'col' | 'row';
	children: Snippet;
} = $props();
</script>

<th {scope} data-testid="tableheadercell-root" data-scope={scope}>{@render children()}</th>
