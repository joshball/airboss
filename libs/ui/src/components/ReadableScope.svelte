<script lang="ts" module>
import {
	type ReadingDensity,
	type ReadingFontFamily,
	type ReadingFontScale,
	type ReadingHeadingScale,
	type ReadingMeasure,
} from '@ab/constants';
import type { Snippet } from 'svelte';

/**
 * `<ReadableScope>` -- emits the five `--reader-*` CSS variables on a
 * wrapper div so reader components (`<RenderedSection>`, `<TOCDrawer>`,
 * `<TOCRender>`, knowledge-node bodies) inherit the user's typography
 * preferences via the cascade.
 *
 * Usage: mount once at the top of any layout that should adopt the user's
 * reading prefs. The five values come from `getUserPrefs(user, READING_PREF_KEYS)`
 * in `+layout.server.ts`, with `READING_*_DEFAULT` filled in for absent keys.
 *
 * The component is purely presentational -- no fetches, no state, no
 * effects. It maps the well-typed prop set to `style:--reader-*` bindings
 * and lets the cascade do the rest. UI surfaces (chrome, forms, charts)
 * deliberately ignore the `--reader-*` tokens; only the prose-bearing
 * components opt in by reading `var(--reader-body-font-size, var(--font-size-base))`
 * with a fallback to the platform token.
 */

export interface ReadableScopeProps {
	readonly fontFamily: ReadingFontFamily;
	readonly fontScale: ReadingFontScale;
	readonly density: ReadingDensity;
	readonly measure: ReadingMeasure;
	readonly headingScale: ReadingHeadingScale;
	readonly children: Snippet;
}
</script>

<script lang="ts">
import { READING_DENSITY_LINE_HEIGHTS, READING_MEASURE_CH } from '@ab/constants';

let { fontFamily, fontScale, density, measure, headingScale, children }: ReadableScopeProps = $props();

const familyVar = $derived(
	fontFamily === 'sans'
		? 'var(--font-family-sans)'
		: fontFamily === 'mono'
			? 'var(--font-family-mono)'
			: 'var(--font-family-serif)',
);

const fontSizeValue = $derived(`calc(var(--font-size-base) * ${fontScale})`);
const lineHeightValue = $derived(String(READING_DENSITY_LINE_HEIGHTS[density]));
const measureValue = $derived(`${READING_MEASURE_CH[measure]}ch`);
const headingScaleValue = $derived(String(headingScale));
</script>

<div
	class="readable-scope"
	style:--reader-body-font-family={familyVar}
	style:--reader-body-font-size={fontSizeValue}
	style:--reader-body-line-height={lineHeightValue}
	style:--reader-measure-ch={measureValue}
	style:--reader-heading-scale={headingScaleValue}
>
	{@render children()}
</div>

<style>
	/*
	 * `display: contents` makes the wrapper layout-neutral -- it emits
	 * the CSS variables to its descendants without introducing a new
	 * block-level box that could fight with the host layout's grid /
	 * flex sizing. The `--reader-*` cascade still works because
	 * inheritance is layout-independent.
	 */
	.readable-scope {
		display: contents;
	}
</style>
