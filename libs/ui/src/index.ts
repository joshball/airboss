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

// Tone vocabulary lives in `@ab/themes`; consumers import it directly to
// avoid two import paths for one identity (which previously produced
// inconsistent grep results during refactors).
export type { AppHeaderProps, AppHeaderUser } from './components/AppHeader.svelte';
export type { BadgeSize, BadgeTone } from './components/Badge.svelte';
export type { BadgeStatusState } from './components/BadgeStatus.svelte';
export type { BannerTone } from './components/Banner.svelte';
export type { BreadcrumbItem } from './components/Breadcrumbs.svelte';
export type { BrowseListGroup, BrowseListProps } from './components/BrowseList.svelte';
export type { BrowseListItemProps } from './components/BrowseListItem.svelte';
export type { BrowseViewControlsOption, BrowseViewControlsProps } from './components/BrowseViewControls.svelte';
export type { ButtonSize, ButtonType, ButtonVariant } from './components/Button.svelte';
export type { CheckboxSize } from './components/Checkbox.svelte';
export type { DialogSize } from './components/Dialog.svelte';
export type { DividerOrientation } from './components/Divider.svelte';
export type { DrawerSide, DrawerSize } from './components/Drawer.svelte';
export type { FilterBarProps } from './components/FilterBar.svelte';
export type { FilterCardProps } from './components/FilterCard.svelte';
export type { FilterChipDef, FilterChipsProps } from './components/FilterChips.svelte';
export type { PagerProps } from './components/Pager.svelte';
export type { RadioGroupOrientation, RadioOption } from './components/RadioGroup.svelte';
export type { ResultSummaryProps } from './components/ResultSummary.svelte';
export type { ScoreCardSize } from './components/ScoreCard.svelte';
export type { ScoreMetaItem } from './components/ScoreMeta.svelte';
export type { SelectOption, SelectSize } from './components/Select.svelte';
export type { SpinnerSize, SpinnerTone } from './components/Spinner.svelte';
export type { StatTileTone } from './components/StatTile.svelte';
export type { TabItem } from './components/Tabs.svelte';
export type { TextFieldSize, TextFieldType } from './components/TextField.svelte';
export type { ToastShape, ToastTone } from './components/Toast.svelte';
