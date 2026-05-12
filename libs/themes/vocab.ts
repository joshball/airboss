/**
 * Role token registry -- Layer 0 of the layered token model.
 *
 * Catalog of *role tokens only* -- the semantic vocabulary themes
 * declare base values for (`--ink-*`, `--surface-*`, `--action-*`,
 * `--signal-*`, `--edge-*`, scales). Other layers are emitted
 * directly by `emit.ts` and are not registered here:
 *
 *   - Control tokens (`--button-*`, `--input-*`)        -- `ControlTokens` shape
 *   - Component tokens (`--dialog-*`, `--table-*`, ...) -- emitted atomic block
 *   - Typography bundles (`--type-*-*-*`)               -- `TypographyPack` shape
 *   - Sim tokens (`--sim-*`)                            -- `SimTokens` shape
 *
 * Role tokens are the surface every theme must satisfy; everything
 * else is derived or declared in narrower shapes. Keeping the
 * derived layers out of this file keeps the role vocabulary small
 * enough to eyeball.
 *
 * For a full listing of *every* emitted token (~380 per
 * theme x appearance block), see `04-VOCABULARY.md` or grep
 * `libs/themes/generated/tokens.css` directly.
 *
 * Keep additions rare and deliberate. Every new role token is a
 * migration. Prefer composing existing tokens via `var()` references.
 */

export const TOKENS = {
	// -------- ink --------
	inkBody: '--ink-body',
	inkMuted: '--ink-muted',
	inkSubtle: '--ink-subtle',
	inkFaint: '--ink-faint',
	inkStrong: '--ink-strong',
	inkInverse: '--ink-inverse',
	inkInverseSubtle: '--ink-inverse-subtle',

	// -------- surface --------
	surfacePage: '--surface-page',
	surfacePanel: '--surface-panel',
	surfaceRaised: '--surface-raised',
	surfaceSunken: '--surface-sunken',
	surfaceMuted: '--surface-muted',
	surfaceOverlay: '--surface-overlay',

	// -------- edge --------
	edgeDefault: '--edge-default',
	edgeStrong: '--edge-strong',
	edgeSubtle: '--edge-subtle',
	edgeFocus: '--edge-focus',

	// -------- action (per role: default, hazard, caution, neutral, link) --------
	actionDefault: '--action-default',
	actionDefaultHover: '--action-default-hover',
	actionDefaultActive: '--action-default-active',
	actionDefaultWash: '--action-default-wash',
	actionDefaultEdge: '--action-default-edge',
	actionDefaultInk: '--action-default-ink',
	actionDefaultDisabled: '--action-default-disabled',

	actionHazard: '--action-hazard',
	actionHazardHover: '--action-hazard-hover',
	actionHazardActive: '--action-hazard-active',
	actionHazardWash: '--action-hazard-wash',
	actionHazardEdge: '--action-hazard-edge',
	actionHazardInk: '--action-hazard-ink',
	actionHazardDisabled: '--action-hazard-disabled',

	actionCaution: '--action-caution',
	actionCautionHover: '--action-caution-hover',
	actionCautionActive: '--action-caution-active',
	actionCautionWash: '--action-caution-wash',
	actionCautionEdge: '--action-caution-edge',
	actionCautionInk: '--action-caution-ink',
	actionCautionDisabled: '--action-caution-disabled',

	actionNeutral: '--action-neutral',
	actionNeutralHover: '--action-neutral-hover',
	actionNeutralActive: '--action-neutral-active',
	actionNeutralWash: '--action-neutral-wash',
	actionNeutralEdge: '--action-neutral-edge',
	actionNeutralInk: '--action-neutral-ink',
	actionNeutralDisabled: '--action-neutral-disabled',

	actionLink: '--action-link',
	actionLinkHover: '--action-link-hover',
	actionLinkActive: '--action-link-active',
	actionLinkWash: '--action-link-wash',
	actionLinkEdge: '--action-link-edge',
	actionLinkInk: '--action-link-ink',
	actionLinkDisabled: '--action-link-disabled',

	// -------- signal (success, warning, danger, info) --------
	signalSuccess: '--signal-success',
	signalSuccessWash: '--signal-success-wash',
	signalSuccessEdge: '--signal-success-edge',
	signalSuccessInk: '--signal-success-ink',

	signalWarning: '--signal-warning',
	signalWarningWash: '--signal-warning-wash',
	signalWarningEdge: '--signal-warning-edge',
	signalWarningInk: '--signal-warning-ink',

	signalDanger: '--signal-danger',
	signalDangerWash: '--signal-danger-wash',
	signalDangerEdge: '--signal-danger-edge',
	signalDangerInk: '--signal-danger-ink',

	signalInfo: '--signal-info',
	signalInfoWash: '--signal-info-wash',
	signalInfoEdge: '--signal-info-edge',
	signalInfoInk: '--signal-info-ink',

	// -------- focus --------
	focusRing: '--focus-ring',
	focusRingStrong: '--focus-ring-strong',
	focusRingShadow: '--focus-ring-shadow',

	// -------- accent (decorative) --------
	accentCode: '--accent-code',
	accentReference: '--accent-reference',
	accentDefinition: '--accent-definition',

	// -------- overlay --------
	overlayScrim: '--overlay-scrim',
	overlayTooltipBg: '--overlay-tooltip-bg',
	overlayTooltipInk: '--overlay-tooltip-ink',

	// -------- selection --------
	selectionBg: '--selection-bg',
	selectionInk: '--selection-ink',

	// -------- disabled --------
	disabledSurface: '--disabled-surface',
	disabledInk: '--disabled-ink',
	disabledEdge: '--disabled-edge',

	// -------- link (when distinct from action-link) --------
	linkDefault: '--link-default',
	linkHover: '--link-hover',
	linkVisited: '--link-visited',

	// -------- typography atomic (bundles land in package #2) --------
	fontFamilySans: '--font-family-sans',
	fontFamilyMono: '--font-family-mono',
	fontFamilyBase: '--font-family-base',
	fontFamilySerif: '--font-family-serif',

	// -------- reader-prefs (WP-FLIGHTBAG-READER-UX Phase 3) --------
	// These are component-relative tokens emitted by `<ReadableScope>`
	// from the user's reading-pref settings. They are *not* theme tokens
	// (themes don't supply them); the scope wrapper sets them via inline
	// style and reader components consume them with platform-token
	// fallbacks. Listed here so theme-lint accepts the var() references.
	readerBodyFontFamily: '--reader-body-font-family',
	readerBodyFontSize: '--reader-body-font-size',
	readerBodyLineHeight: '--reader-body-line-height',
	readerMeasureCh: '--reader-measure-ch',
	readerHeadingScale: '--reader-heading-scale',

	// -------- palette accents (WP-COMMAND-PALETTE Phase 3) --------
	// Per-type accent families consumed by the global command palette
	// (CommandPalette.svelte + variant prototypes). Five accent families
	// keyed to the result taxonomy in
	// `docs/work-packages/command-palette/spec.md`:
	//
	//   amber  -- faa.* (handbooks, CFR parts/sections, AIM, AC, ACS)
	//   violet -- airboss.knode, airboss.glossary
	//   cyan   -- airboss.course, airboss.lesson, airboss.help
	//   green  -- mine.*
	//   rose   -- web.tool
	//   cmd    -- cmd.* (no accent; ink-muted slot)
	//
	// Defined as theme-independent palette-scoped tokens in
	// `libs/themes/palette-tokens.css`. Listed here so theme-lint accepts the
	// `var(--palette-...)` references in palette UI components.
	paletteAccentAmber: '--palette-accent-amber',
	paletteAccentAmberInk: '--palette-accent-amber-ink',
	paletteAccentAmberWash: '--palette-accent-amber-wash',
	paletteAccentAmberEdge: '--palette-accent-amber-edge',
	paletteAccentViolet: '--palette-accent-violet',
	paletteAccentVioletInk: '--palette-accent-violet-ink',
	paletteAccentVioletWash: '--palette-accent-violet-wash',
	paletteAccentVioletEdge: '--palette-accent-violet-edge',
	paletteAccentCyan: '--palette-accent-cyan',
	paletteAccentCyanInk: '--palette-accent-cyan-ink',
	paletteAccentCyanWash: '--palette-accent-cyan-wash',
	paletteAccentCyanEdge: '--palette-accent-cyan-edge',
	paletteAccentGreen: '--palette-accent-green',
	paletteAccentGreenInk: '--palette-accent-green-ink',
	paletteAccentGreenWash: '--palette-accent-green-wash',
	paletteAccentGreenEdge: '--palette-accent-green-edge',
	paletteAccentRose: '--palette-accent-rose',
	paletteAccentRoseInk: '--palette-accent-rose-ink',
	paletteAccentRoseWash: '--palette-accent-rose-wash',
	paletteAccentRoseEdge: '--palette-accent-rose-edge',
	paletteAccentCmd: '--palette-accent-cmd',
	paletteAccentCmdInk: '--palette-accent-cmd-ink',
	paletteAccentCmdWash: '--palette-accent-cmd-wash',
	paletteAccentCmdEdge: '--palette-accent-cmd-edge',
	paletteMotionDurationXs: '--palette-motion-duration-xs',
	paletteMotionDurationSm: '--palette-motion-duration-sm',
	paletteMotionDurationMd: '--palette-motion-duration-md',
	paletteMotionEaseIn: '--palette-motion-ease-in',
	paletteMotionEaseOut: '--palette-motion-ease-out',
	paletteMotionEaseInOut: '--palette-motion-ease-in-out',

	// -------- highlights (WP-FLIGHTBAG-RICH-READER Phase 2) --------
	// Per-color swatch + wash pair for the rich-reader's selection
	// highlight overlays. The swatch is the opaque chip used in the picker;
	// the wash is the semi-transparent paint applied over the body. Both
	// land as light-mode tokens by default and dark-mode themes can
	// override the wash hue/lightness for legibility.
	highlightYellow: '--highlight-yellow',
	highlightYellowWash: '--highlight-yellow-wash',
	highlightBlue: '--highlight-blue',
	highlightBlueWash: '--highlight-blue-wash',
	highlightGreen: '--highlight-green',
	highlightGreenWash: '--highlight-green-wash',
	highlightPink: '--highlight-pink',
	highlightPinkWash: '--highlight-pink-wash',

	// -------- scale: spacing --------
	space4xs: '--space-4xs',
	space3xs: '--space-3xs',
	space2xs: '--space-2xs',
	spaceXs: '--space-xs',
	spaceSm: '--space-sm',
	spaceMd: '--space-md',
	spaceLg: '--space-lg',
	spaceXl: '--space-xl',
	space2xl: '--space-2xl',

	// -------- scale: radius --------
	radiusSharp: '--radius-sharp',
	radiusXs: '--radius-xs',
	radiusSm: '--radius-sm',
	radiusMd: '--radius-md',
	radiusLg: '--radius-lg',
	radiusPill: '--radius-pill',

	// -------- scale: shadow --------
	shadowNone: '--shadow-none',
	shadowSm: '--shadow-sm',
	shadowMd: '--shadow-md',
	shadowLg: '--shadow-lg',

	// -------- scale: motion --------
	motionFast: '--motion-fast',
	motionNormal: '--motion-normal',
	motionSlow: '--motion-slow',

	// -------- scale: z-index ladder (mirrors @ab/constants Z_INDEX) --------
	zBase: '--z-base',
	zSticky: '--z-sticky',
	zSidebar: '--z-sidebar',
	zDropdown: '--z-dropdown',
	zPopover: '--z-popover',
	zModal: '--z-modal',
	zCommandPalette: '--z-command-palette',
	zToast: '--z-toast',
	zTop: '--z-top',

	// -------- layout --------
	layoutContainerMax: '--layout-container-max',
	layoutContainerPadding: '--layout-container-padding',
	layoutGridGap: '--layout-grid-gap',
	layoutPanelPadding: '--layout-panel-padding',
	layoutPanelGap: '--layout-panel-gap',
	layoutPanelHeaderSize: '--layout-panel-header-size',
	layoutPanelHeaderWeight: '--layout-panel-header-weight',
	layoutPanelHeaderTransform: '--layout-panel-header-transform',
	layoutPanelHeaderTracking: '--layout-panel-header-tracking',
	layoutPanelHeaderFamily: '--layout-panel-header-family',
} as const;

export type TokenKey = keyof typeof TOKENS;
export type TokenName = (typeof TOKENS)[TokenKey];
