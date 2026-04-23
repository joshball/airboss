<script lang="ts">
import type { Snippet } from 'svelte';

let {
	align = 'left',
	children,
}: {
	align?: 'left' | 'center' | 'right';
	children: Snippet;
} = $props();
</script>

<td style:text-align={align}>{@render children()}</td>
