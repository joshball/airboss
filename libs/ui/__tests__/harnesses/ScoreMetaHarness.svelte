<script lang="ts">
import ScoreMeta, { type ScoreMetaItem } from '../../src/components/ScoreMeta.svelte';

let {
	items,
	ariaLabel,
}: {
	items: readonly ScoreMetaItem[];
	ariaLabel?: string;
} = $props();
</script>

<ScoreMeta {items} {ariaLabel} />
