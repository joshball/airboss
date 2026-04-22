<script lang="ts">
import '@ab/themes/tokens.css';
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

{@render children()}
