/**
 * airboss design tokens -- public API
 *
 * Tokens are CSS custom properties scoped under `[data-theme='web'|'tui']`.
 * Components read them through `var(--ab-*)`; switching the theme on an
 * ancestor re-skins every descendant without re-rendering.
 *
 * Consumers:
 *   // CSS tokens -- import once in your app's root layout
 *   import '@ab/themes/tokens.css';
 *
 *   // Component -- wrap anything you want themed
 *   import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
 *   <ThemeProvider theme="tui">...</ThemeProvider>
 *
 *   // Route-aware theme resolver
 *   import { resolveThemeForPath } from '@ab/themes';
 */

export { DEFAULT_THEME, resolveThemeForPath, THEMES, type ThemeName } from './resolve';
export { TOKENS, type TokenName } from './tokens';
