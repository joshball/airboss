<script lang="ts">
import type {
	ReadingDensity,
	ReadingFontFamily,
	ReadingFontScale,
	ReadingHeadingScale,
	ReadingMeasure,
} from '@ab/constants';
import ReadableScope from '../../src/components/ReadableScope.svelte';

let {
	fontFamily = 'serif' as ReadingFontFamily,
	fontScale = 1.0 as ReadingFontScale,
	density = 'comfortable' as ReadingDensity,
	measure = 'normal' as ReadingMeasure,
	headingScale = 1.0 as ReadingHeadingScale,
}: {
	fontFamily?: ReadingFontFamily;
	fontScale?: ReadingFontScale;
	density?: ReadingDensity;
	measure?: ReadingMeasure;
	headingScale?: ReadingHeadingScale;
} = $props();
</script>

<ReadableScope {fontFamily} {fontScale} {density} {measure} {headingScale}>
	{#snippet children()}
		<div data-testid="scope-child">child</div>
	{/snippet}
</ReadableScope>
