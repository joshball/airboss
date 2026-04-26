<script lang="ts">
import Badge, { type BadgeSize, type BadgeTone } from '../../src/components/Badge.svelte';

let {
	tone = 'default',
	size = 'md',
	ariaLabel,
	label = 'badge',
}: { tone?: BadgeTone; size?: BadgeSize; ariaLabel?: string; label?: string } = $props();
</script>

<Badge {tone} {size} {ariaLabel}>{label}</Badge>
