<script lang="ts">
import KbdHint from '../../src/components/KbdHint.svelte';

let { label = 'Space', ariaLabel }: { label?: string; ariaLabel?: string } = $props();
</script>

<KbdHint {ariaLabel}>{label}</KbdHint>
