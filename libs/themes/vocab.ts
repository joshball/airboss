/**
 * Role-based token vocabulary -- Layer 0.
 *
 * Every CSS custom property the theme system emits is named here. Components
 * reference tokens through these constants (or directly as `var(--name)`)
 * so renames are a single-file refactor.
 *
 * See `docs/platform/theme-system/04-VOCABULARY.md` for the full rationale.
 * This file mirrors that catalog: role families ink / surface / edge /
 * action / signal / focus / accent / overlay / selection / disabled / link,
 * plus typography bundles, layout variables, and the Layer 0 scales
 * (space / radius / shadow / motion / z-index).
 */

export const TOKENS = {
	// ink -- text color
	inkBody: '--ink-body',
	inkMuted: '--ink-muted',
	inkSubtle: '--ink-subtle',
	inkFaint: '--ink-faint',
	inkStrong: '--ink-strong',
	inkInverse: '--ink-inverse',

	// surface -- fills
	surfacePage: '--surface-page',
	surfacePanel: '--surface-panel',
	surfaceRaised: '--surface-raised',
	surfaceSunken: '--surface-sunken',
	surfaceMuted: '--surface-muted',
	surfaceOverlay: '--surface-overlay',

	// edge -- borders
	edgeDefault: '--edge-default',
	edgeStrong: '--edge-strong',
	edgeSubtle: '--edge-subtle',
	edgeFocus: '--edge-focus',

	// action -- interactive intent (roles: default, hazard, caution, neutral, link)
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

	// signal -- status/feedback (roles: success, warning, danger, info)
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

	// focus -- focus indication
	focusRing: '--focus-ring',
	focusRingStrong: '--focus-ring-strong',
	focusRingShadow: '--focus-ring-shadow',

	// accent -- decorative, non-interactive
	accentCode: '--accent-code',
	accentReference: '--accent-reference',
	accentDefinition: '--accent-definition',

	// overlay -- scrims, backdrops
	overlayScrim: '--overlay-scrim',
	overlayTooltipBg: '--overlay-tooltip-bg',
	overlayTooltipInk: '--overlay-tooltip-ink',

	// selection -- text/row
	selectionBg: '--selection-bg',
	selectionInk: '--selection-ink',

	// disabled -- disabled state
	disabledSurface: '--disabled-surface',
	disabledInk: '--disabled-ink',
	disabledEdge: '--disabled-edge',

	// link -- hyperlinks (when distinct from action-link)
	linkDefault: '--link-default',
	linkHover: '--link-hover',
	linkVisited: '--link-visited',

	// Typography -- atomic (Package #2 adds bundle sub-properties)
	fontFamilySans: '--font-family-sans',
	fontFamilyMono: '--font-family-mono',
	fontFamilyBase: '--font-family-base',
	fontSizeXs: '--font-size-xs',
	fontSizeSm: '--font-size-sm',
	fontSizeBody: '--font-size-body',
	fontSizeBase: '--font-size-base',
	fontSizeLg: '--font-size-lg',
	fontSizeXl: '--font-size-xl',
	fontSize2xl: '--font-size-2xl',
	fontWeightRegular: '--font-weight-regular',
	fontWeightMedium: '--font-weight-medium',
	fontWeightSemibold: '--font-weight-semibold',
	fontWeightBold: '--font-weight-bold',
	lineHeightTight: '--line-height-tight',
	lineHeightNormal: '--line-height-normal',
	lineHeightRelaxed: '--line-height-relaxed',
	letterSpacingTight: '--letter-spacing-tight',
	letterSpacingNormal: '--letter-spacing-normal',
	letterSpacingWide: '--letter-spacing-wide',
	letterSpacingCaps: '--letter-spacing-caps',

	// Layer 0 scales -- space / radius / shadow / motion / z-index
	space2xs: '--space-2xs',
	spaceXs: '--space-xs',
	spaceSm: '--space-sm',
	spaceMd: '--space-md',
	spaceLg: '--space-lg',
	spaceXl: '--space-xl',
	space2xl: '--space-2xl',

	radiusSharp: '--radius-sharp',
	radiusXs: '--radius-xs',
	radiusSm: '--radius-sm',
	radiusMd: '--radius-md',
	radiusLg: '--radius-lg',
	radiusPill: '--radius-pill',

	shadowNone: '--shadow-none',
	shadowSm: '--shadow-sm',
	shadowMd: '--shadow-md',
	shadowLg: '--shadow-lg',

	motionFast: '--motion-fast',
	motionNormal: '--motion-normal',

	zBase: '--z-base',
	zDropdown: '--z-dropdown',
	zSticky: '--z-sticky',
	zOverlay: '--z-overlay',
	zModal: '--z-modal',
	zToast: '--z-toast',
	zTooltip: '--z-tooltip',

	// Breakpoints (documentary; @media cannot read CSS custom properties)
	breakpointSm: '--breakpoint-sm',
	breakpointMd: '--breakpoint-md',
	breakpointLg: '--breakpoint-lg',
	breakpointXl: '--breakpoint-xl',

	// Layout
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

export type TokenName = keyof typeof TOKENS;
export type TokenCssName = (typeof TOKENS)[TokenName];
