<script lang="ts">
import RolePill from '../../src/components/RolePill.svelte';

let {
	label = 'admin',
	ariaLabel,
	ariaHidden = false,
}: {
	label?: string;
	ariaLabel?: string;
	ariaHidden?: boolean;
} = $props();
</script>

<RolePill {ariaLabel} {ariaHidden}>{label}</RolePill>
