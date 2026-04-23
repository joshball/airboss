// UI component library -- populated as components are built.
//
// Svelte components are imported by path (e.g.
// `import Dialog from '@ab/ui/components/Dialog.svelte'`); this barrel
// only re-exports types + lightweight utilities. Re-exporting
// components here would pull the full svelte runtime into non-UI
// consumers.

// Shared tone vocabulary re-exported so callers don't have to import
// from two packages for a single prop.
export { type LegacyNeutralTone, resolveTone, TONES, type Tone, type ToneInput } from '@ab/themes';
export type { BadgeSize, BadgeTone, BadgeVariant } from './components/Badge.svelte';
export type { BannerTone, BannerVariant } from './components/Banner.svelte';
export type { ButtonSize, ButtonType, ButtonVariant } from './components/Button.svelte';
export type { CheckboxSize } from './components/Checkbox.svelte';
export type { DialogSize } from './components/Dialog.svelte';
export type { DividerOrientation } from './components/Divider.svelte';
export type { RadioGroupOrientation, RadioOption } from './components/RadioGroup.svelte';
export type { SelectOption, SelectSize } from './components/Select.svelte';
export type { SpinnerSize, SpinnerTone } from './components/Spinner.svelte';
export type { StatTileTone } from './components/StatTile.svelte';
export type { TabItem } from './components/Tabs.svelte';
export type { TextFieldSize, TextFieldType } from './components/TextField.svelte';
