<script lang="ts" module>
import type {
	ReadingDensity,
	ReadingFontFamily,
	ReadingFontScale,
	ReadingHeadingScale,
	ReadingMeasure,
} from '@ab/constants';

/**
 * `<ReaderPrefsButton>` -- gear-icon disclosure that exposes the five
 * reader-preference controls (font family, font scale, density, measure,
 * heading scale).
 *
 * The component is dumb -- the host owns the optimistic-flip pattern and
 * the POST to `/reading-prefs`. The button calls `onChange(key, value)`
 * for every interaction; the host updates its `$state` immediately and
 * fires the network request, mirroring the ThemePicker contract.
 *
 * Hidden when the host passes no `onChange` callback or when the user is
 * anonymous -- there's no preference store for an anonymous session, so
 * the affordance would be a dead-end. Hosts that want the popover for
 * signed-in users only gate the snippet at mount time.
 *
 * Accessibility:
 *   - `aria-haspopup="dialog"` on the trigger; `aria-expanded` mirrors
 *     the open state.
 *   - Each control group is a fieldset with a legend so screen readers
 *     announce the purpose before the radio options.
 *   - Escape closes; focus returns to the trigger.
 *   - The popover closes on a pointerdown that lands outside it.
 */

export interface ReaderPrefsButtonProps {
	readonly fontFamily: ReadingFontFamily;
	readonly fontScale: ReadingFontScale;
	readonly density: ReadingDensity;
	readonly measure: ReadingMeasure;
	readonly headingScale: ReadingHeadingScale;
	/**
	 * Called when the user changes any of the five controls. The host is
	 * responsible for the optimistic state flip and the network round-trip.
	 */
	readonly onChange: (key: ReadingPrefKey, value: ReadingPrefValue) => void;
}

export type ReadingPrefKey = 'fontFamily' | 'fontScale' | 'density' | 'measure' | 'headingScale';
export type ReadingPrefValue =
	| ReadingFontFamily
	| ReadingFontScale
	| ReadingDensity
	| ReadingMeasure
	| ReadingHeadingScale;
</script>

<script lang="ts">
import {
	READING_DENSITIES,
	READING_DENSITY_VALUES,
	READING_FONT_FAMILIES,
	READING_FONT_FAMILY_VALUES,
	READING_FONT_SCALE_VALUES,
	READING_HEADING_SCALE_VALUES,
	READING_MEASURE_VALUES,
	READING_MEASURES,
} from '@ab/constants';

let { fontFamily, fontScale, density, measure, headingScale, onChange }: ReaderPrefsButtonProps = $props();

let menu = $state<HTMLDetailsElement | null>(null);
let isOpen = $state(false);

const instanceId = $props.id();
const panelId = `${instanceId}-panel`;

function handleToggle() {
	if (!menu) return;
	isOpen = menu.open;
}

function handleDocumentPointerDown(event: PointerEvent) {
	if (!menu?.open) return;
	const target = event.target;
	if (target instanceof Node && menu.contains(target)) return;
	menu.open = false;
	isOpen = false;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || !menu?.open) return;
	event.preventDefault();
	menu.open = false;
	isOpen = false;
	const summary = menu.querySelector('summary');
	if (summary instanceof HTMLElement) summary.focus();
}

const fontFamilyOptions: ReadonlyArray<{ value: ReadingFontFamily; label: string }> = [
	{ value: READING_FONT_FAMILIES.SERIF, label: 'Serif' },
	{ value: READING_FONT_FAMILIES.SANS, label: 'Sans' },
	{ value: READING_FONT_FAMILIES.MONO, label: 'Mono' },
];

const densityOptions: ReadonlyArray<{ value: ReadingDensity; label: string }> = [
	{ value: READING_DENSITIES.COMPACT, label: 'Compact' },
	{ value: READING_DENSITIES.COMFORTABLE, label: 'Comfortable' },
	{ value: READING_DENSITIES.SPACIOUS, label: 'Spacious' },
];

const measureOptions: ReadonlyArray<{ value: ReadingMeasure; label: string }> = [
	{ value: READING_MEASURES.NARROW, label: 'Narrow' },
	{ value: READING_MEASURES.NORMAL, label: 'Normal' },
	{ value: READING_MEASURES.WIDE, label: 'Wide' },
];

const headingOptions: ReadonlyArray<{ value: (typeof READING_HEADING_SCALE_VALUES)[number]; label: string }> = [
	{ value: 0.9, label: 'Smaller' },
	{ value: 1.0, label: 'Normal' },
	{ value: 1.15, label: 'Larger' },
];

function fontScaleLabel(value: number): string {
	if (value === 1.0) return 'A';
	if (value < 1.0) return `A−`;
	return `A+`;
}

function pickFamily(value: ReadingFontFamily) {
	if (value === fontFamily) return;
	onChange('fontFamily', value);
}

function pickFontScale(value: (typeof READING_FONT_SCALE_VALUES)[number]) {
	if (value === fontScale) return;
	onChange('fontScale', value);
}

function pickDensity(value: ReadingDensity) {
	if (value === density) return;
	onChange('density', value);
}

function pickMeasure(value: ReadingMeasure) {
	if (value === measure) return;
	onChange('measure', value);
}

function pickHeadingScale(value: (typeof READING_HEADING_SCALE_VALUES)[number]) {
	if (value === headingScale) return;
	onChange('headingScale', value);
}
</script>

<svelte:window onpointerdown={handleDocumentPointerDown} onkeydown={handleKeydown} />

<details class="reader-prefs" bind:this={menu} ontoggle={handleToggle}>
	<summary aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={panelId} aria-label="Reading preferences">
		<span class="gear" aria-hidden="true">⚙</span>
		<span class="visually-hidden">Reading preferences</span>
	</summary>

	<div class="panel" id={panelId} role="dialog" aria-label="Reading preferences">
		<fieldset>
			<legend>Font family</legend>
			<div class="row" role="radiogroup" aria-label="Font family">
				{#each fontFamilyOptions as opt (opt.value)}
					<button
						type="button"
						role="radio"
						aria-checked={fontFamily === opt.value}
						class="chip"
						class:active={fontFamily === opt.value}
						onclick={() => pickFamily(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Font size</legend>
			<div class="row scale" role="radiogroup" aria-label="Font size">
				{#each READING_FONT_SCALE_VALUES as scale (scale)}
					<button
						type="button"
						role="radio"
						aria-checked={fontScale === scale}
						class="chip"
						class:active={fontScale === scale}
						title={`${Math.round(scale * 100)}%`}
						aria-label={`Font scale ${Math.round(scale * 100)} percent`}
						onclick={() => pickFontScale(scale)}
					>
						<span class="scale-glyph" style:font-size={`${0.7 + scale * 0.4}rem`}>{fontScaleLabel(scale)}</span>
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Density</legend>
			<div class="row" role="radiogroup" aria-label="Density">
				{#each densityOptions as opt (opt.value)}
					<button
						type="button"
						role="radio"
						aria-checked={density === opt.value}
						class="chip"
						class:active={density === opt.value}
						onclick={() => pickDensity(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Width</legend>
			<div class="row" role="radiogroup" aria-label="Width">
				{#each measureOptions as opt (opt.value)}
					<button
						type="button"
						role="radio"
						aria-checked={measure === opt.value}
						class="chip"
						class:active={measure === opt.value}
						onclick={() => pickMeasure(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend>Heading scale</legend>
			<div class="row" role="radiogroup" aria-label="Heading scale">
				{#each headingOptions as opt (opt.value)}
					<button
						type="button"
						role="radio"
						aria-checked={headingScale === opt.value}
						class="chip"
						class:active={headingScale === opt.value}
						onclick={() => pickHeadingScale(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</fieldset>
	</div>
</details>

<style>
	.reader-prefs {
		position: relative;
	}

	.reader-prefs > summary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		cursor: pointer;
		list-style: none;
		color: var(--ink-muted);
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
		user-select: none;
		min-height: 2.75rem;
	}

	.reader-prefs > summary::-webkit-details-marker {
		display: none;
	}

	.reader-prefs > summary::marker {
		content: '';
	}

	.reader-prefs > summary:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.reader-prefs > summary:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.reader-prefs[open] > summary {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.gear {
		font-size: var(--font-size-base);
		line-height: 1;
	}

	.panel {
		position: absolute;
		right: 0;
		top: calc(100% + var(--space-2xs));
		min-width: 18rem;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: var(--space-sm);
		z-index: var(--z-dropdown);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	legend {
		padding: 0;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-medium);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.row.scale {
		align-items: baseline;
	}

	.chip {
		flex: 1 1 auto;
		min-height: 2.25rem;
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.chip:hover {
		background: var(--surface-sunken);
	}

	.chip:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.chip.active {
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		border-color: var(--action-default-edge, var(--action-default));
	}

	.scale-glyph {
		display: inline-block;
		line-height: 1;
		font-family: var(--font-family-serif);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
