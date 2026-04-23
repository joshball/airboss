/**
 * Token vocabulary registry -- Layer 0.
 *
 * Single source of truth for every CSS custom-property name the theme
 * system emits. Grouped by role family. Flattened `TokenName` gives
 * callers a typed handle on every token.
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

	// -------- scale: spacing --------
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
