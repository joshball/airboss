<script lang="ts">
import '@ab/themes/generated/tokens.css';
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

{@render children()}
