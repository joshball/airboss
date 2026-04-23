<script lang="ts">
import type { Snippet } from 'svelte';

let {
	selected = false,
	children,
}: {
	selected?: boolean;
	children: Snippet;
} = $props();
</script>

<tr aria-selected={selected || undefined}>
	{@render children()}
</tr>
