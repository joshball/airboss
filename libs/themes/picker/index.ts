/**
 * Theme picker -- public surface.
 *
 * Apps wire the picker in five lines:
 *
 *   // app.html
 *   <script>%theme-pre-hydration%</script>
 *
 *   // hooks.server.ts
 *   event.locals.theme = readThemeFromCookies(event.cookies);
 *   // and in `resolve`, transformPageChunk: (chunk) =>
 *   //   chunk.html.replace(PRE_HYDRATION_PLACEHOLDER, PRE_HYDRATION_SCRIPT)
 *
 *   // routes/theme/+server.ts
 *   export const POST = createThemeEndpoint();
 *
 *   // +layout.svelte
 *   <ThemePicker currentThemeId={theme.id} onSelect={persist} />
 *
 * Server pieces (cookie/parser/endpoint) and client pieces (component)
 * share the same picker namespace so a host doesn't have to remember
 * which sub-path holds what.
 */

export {
	buildPreHydrationCspHash,
	buildPreHydrationScript,
	injectPreHydrationScript,
	PRE_HYDRATION_PLACEHOLDER,
} from './pre-hydration';
export {
	createThemeEndpoint,
	forcedAppearanceFor,
	isThemePreference,
	parseThemePreference,
	readThemeFromCookies,
	THEME_COOKIE,
	type ThemePreference,
} from './server';
export { default as ThemePicker } from './ThemePicker.svelte';
