<script lang="ts">
import Tooltip from '../../src/components/Tooltip.svelte';

let {
	for: glossaryKey,
	term,
	definition,
	label = 'Quals',
}: {
	for?: string;
	term?: string;
	definition?: string;
	label?: string;
} = $props();
</script>

<Tooltip for={glossaryKey} {term} {definition}>
	<span data-testid="tooltip-trigger">{label}</span>
</Tooltip>
