<script lang="ts">
import '@ab/themes/generated/tokens.css';
import NavIndicator from '@ab/ui/components/NavIndicator.svelte';
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<NavIndicator />
{@render children()}
