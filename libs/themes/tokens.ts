/**
 * Type-safe token catalogue.
 *
 * Every CSS custom property defined in `tokens.css` is listed here so
 * components can reference tokens by name without typos and so tooling
 * (autocomplete, refactors) knows the full surface.
 *
 * Usage in component style:
 *   background: var(--ab-color-surface);
 *
 * Usage in TypeScript (rare -- reading a token from JS is a design smell,
 * but it's here for cases like charts that need the literal hex):
 *   getComputedStyle(el).getPropertyValue(TOKENS.colorPrimary);
 */

export const TOKENS = {
	// Color -- foreground
	colorFg: '--ab-color-fg',
	colorFgMuted: '--ab-color-fg-muted',
	colorFgSubtle: '--ab-color-fg-subtle',
	colorFgFaint: '--ab-color-fg-faint',
	colorFgInverse: '--ab-color-fg-inverse',

	// Color -- background / surface
	colorBg: '--ab-color-bg',
	colorSurface: '--ab-color-surface',
	colorSurfaceRaised: '--ab-color-surface-raised',
	colorSurfaceSunken: '--ab-color-surface-sunken',
	colorSurfaceMuted: '--ab-color-surface-muted',

	// Color -- border
	colorBorder: '--ab-color-border',
	colorBorderStrong: '--ab-color-border-strong',
	colorBorderSubtle: '--ab-color-border-subtle',

	// Color -- primary
	colorPrimary: '--ab-color-primary',
	colorPrimaryHover: '--ab-color-primary-hover',
	colorPrimaryActive: '--ab-color-primary-active',
	colorPrimarySubtle: '--ab-color-primary-subtle',
	colorPrimarySubtleBorder: '--ab-color-primary-subtle-border',
	colorPrimaryFg: '--ab-color-primary-fg',

	// Color -- danger
	colorDanger: '--ab-color-danger',
	colorDangerHover: '--ab-color-danger-hover',
	colorDangerActive: '--ab-color-danger-active',
	colorDangerSubtle: '--ab-color-danger-subtle',
	colorDangerSubtleBorder: '--ab-color-danger-subtle-border',
	colorDangerFg: '--ab-color-danger-fg',

	// Color -- success
	colorSuccess: '--ab-color-success',
	colorSuccessHover: '--ab-color-success-hover',
	colorSuccessActive: '--ab-color-success-active',
	colorSuccessSubtle: '--ab-color-success-subtle',
	colorSuccessSubtleBorder: '--ab-color-success-subtle-border',
	colorSuccessFg: '--ab-color-success-fg',

	// Color -- warning
	colorWarning: '--ab-color-warning',
	colorWarningHover: '--ab-color-warning-hover',
	colorWarningActive: '--ab-color-warning-active',
	colorWarningSubtle: '--ab-color-warning-subtle',
	colorWarningSubtleBorder: '--ab-color-warning-subtle-border',
	colorWarningFg: '--ab-color-warning-fg',

	// Color -- info
	colorInfo: '--ab-color-info',
	colorInfoHover: '--ab-color-info-hover',
	colorInfoActive: '--ab-color-info-active',
	colorInfoSubtle: '--ab-color-info-subtle',
	colorInfoSubtleBorder: '--ab-color-info-subtle-border',
	colorInfoFg: '--ab-color-info-fg',

	// Color -- muted (neutral chip)
	colorMuted: '--ab-color-muted',
	colorMutedHover: '--ab-color-muted-hover',
	colorMutedSubtle: '--ab-color-muted-subtle',
	colorMutedSubtleBorder: '--ab-color-muted-subtle-border',
	colorMutedFg: '--ab-color-muted-fg',

	// Color -- focus
	colorFocusRing: '--ab-color-focus-ring',
	focusRing: '--ab-focus-ring',
	focusRingOffset: '--ab-focus-ring-offset',
	focusRingWidth: '--ab-focus-ring-width',
	shadowFocusRing: '--ab-shadow-focus-ring',
	shadowSuccessGlow: '--ab-shadow-success-glow',

	// Breakpoints -- canonical viewport rungs (see tokens.css top-of-file comment)
	breakpointSm: '--ab-breakpoint-sm',
	breakpointMd: '--ab-breakpoint-md',
	breakpointLg: '--ab-breakpoint-lg',
	breakpointXl: '--ab-breakpoint-xl',

	// Typography -- family
	fontFamilySans: '--ab-font-family-sans',
	fontFamilyMono: '--ab-font-family-mono',
	fontFamilyBase: '--ab-font-family-base',

	// Typography -- size
	fontSizeXs: '--ab-font-size-xs',
	fontSizeSm: '--ab-font-size-sm',
	fontSizeBase: '--ab-font-size-base',
	fontSizeLg: '--ab-font-size-lg',
	fontSizeXl: '--ab-font-size-xl',
	fontSize2xl: '--ab-font-size-2xl',

	// Typography -- weight
	fontWeightRegular: '--ab-font-weight-regular',
	fontWeightMedium: '--ab-font-weight-medium',
	fontWeightSemibold: '--ab-font-weight-semibold',
	fontWeightBold: '--ab-font-weight-bold',

	// Typography -- line-height
	lineHeightTight: '--ab-line-height-tight',
	lineHeightNormal: '--ab-line-height-normal',
	lineHeightRelaxed: '--ab-line-height-relaxed',

	// Typography -- letter-spacing
	letterSpacingTight: '--ab-letter-spacing-tight',
	letterSpacingNormal: '--ab-letter-spacing-normal',
	letterSpacingWide: '--ab-letter-spacing-wide',
	letterSpacingCaps: '--ab-letter-spacing-caps',

	// Spacing
	space2xs: '--ab-space-2xs',
	spaceXs: '--ab-space-xs',
	spaceSm: '--ab-space-sm',
	spaceMd: '--ab-space-md',
	spaceLg: '--ab-space-lg',
	spaceXl: '--ab-space-xl',
	space2xl: '--ab-space-2xl',

	// Radius
	radiusSharp: '--ab-radius-sharp',
	radiusSm: '--ab-radius-sm',
	radiusMd: '--ab-radius-md',
	radiusLg: '--ab-radius-lg',

	// Shadow
	shadowNone: '--ab-shadow-none',
	shadowSm: '--ab-shadow-sm',
	shadowMd: '--ab-shadow-md',
	shadowLg: '--ab-shadow-lg',

	// Layout
	layoutContainerMax: '--ab-layout-container-max',
	layoutContainerPadding: '--ab-layout-container-padding',
	layoutGridGap: '--ab-layout-grid-gap',
	layoutPanelPadding: '--ab-layout-panel-padding',
	layoutPanelGap: '--ab-layout-panel-gap',
	layoutPanelHeaderSize: '--ab-layout-panel-header-size',
	layoutPanelHeaderWeight: '--ab-layout-panel-header-weight',
	layoutPanelHeaderTransform: '--ab-layout-panel-header-transform',
	layoutPanelHeaderTracking: '--ab-layout-panel-header-tracking',
	layoutPanelHeaderFamily: '--ab-layout-panel-header-family',

	// Transitions
	transitionFast: '--ab-transition-fast',
	transitionNormal: '--ab-transition-normal',

	// Controls
	controlRadius: '--ab-control-radius',
	controlPaddingXSm: '--ab-control-padding-x-sm',
	controlPaddingYSm: '--ab-control-padding-y-sm',
	controlPaddingXMd: '--ab-control-padding-x-md',
	controlPaddingYMd: '--ab-control-padding-y-md',
	controlPaddingXLg: '--ab-control-padding-x-lg',
	controlPaddingYLg: '--ab-control-padding-y-lg',
	controlFontSizeSm: '--ab-control-font-size-sm',
	controlFontSizeMd: '--ab-control-font-size-md',
	controlFontSizeLg: '--ab-control-font-size-lg',
} as const;

export type TokenName = keyof typeof TOKENS;
