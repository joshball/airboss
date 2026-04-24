// UI component library.
//
// This barrel is the **pure-TS entry** -- types and lightweight utilities
// only. Svelte components are loaded by subpath so non-svelte consumers
// don't pull the svelte runtime:
//
//   import Dialog from '@ab/ui/components/Dialog.svelte';
//
// Subpath routing is enforced by the `exports` field in `package.json`:
//   - `.`              -> this file (types + utilities, no svelte runtime)
//   - `./components/*` -> individual .svelte files by name
//   - `./lib/*`        -> shared helpers used by components
//
// Re-exporting components here would pull the full svelte runtime into
// non-UI consumers -- hence the deliberate split.

// Shared tone vocabulary re-exported so callers don't have to import
// from two packages for a single prop.
export { type LegacyNeutralTone, resolveTone, TONES, type Tone, type ToneInput } from '@ab/themes';
export type { BadgeSize, BadgeTone, BadgeVariant } from './components/Badge.svelte';
export type { BannerTone, BannerVariant } from './components/Banner.svelte';
export type { ButtonSize, ButtonType, ButtonVariant } from './components/Button.svelte';
export type { CheckboxSize } from './components/Checkbox.svelte';
export type { DialogSize } from './components/Dialog.svelte';
export type { DividerOrientation } from './components/Divider.svelte';
export type { DrawerSide, DrawerSize } from './components/Drawer.svelte';
export type { RadioGroupOrientation, RadioOption } from './components/RadioGroup.svelte';
export type { SelectOption, SelectSize } from './components/Select.svelte';
export type { SpinnerSize, SpinnerTone } from './components/Spinner.svelte';
export type { StatTileTone } from './components/StatTile.svelte';
export type { TabItem } from './components/Tabs.svelte';
export type { TextFieldSize, TextFieldType } from './components/TextField.svelte';
