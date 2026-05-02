<script lang="ts">
import Badge, { type BadgeSize, type BadgeTone } from '../../src/components/Badge.svelte';

let {
	tone = 'default',
	size = 'md',
	glyph = true,
	ariaLabel,
	label = 'badge',
}: {
	tone?: BadgeTone;
	size?: BadgeSize;
	glyph?: boolean;
	ariaLabel?: string;
	label?: string;
} = $props();
</script>

<Badge {tone} {size} {glyph} {ariaLabel}>{label}</Badge>
