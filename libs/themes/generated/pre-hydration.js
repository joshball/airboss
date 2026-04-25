(function () {
	try {
		var doc = document.documentElement;
		var path = window.location.pathname;
		var sim = path === '/sim' || path.indexOf('/sim/') === 0;
		var flightdeck = !sim && (path === '/dashboard' || path.indexOf('/dashboard/') === 0);
		// Path defaults mirror resolveThemeForPath in @ab/themes/resolve.ts.
		var pathTheme = sim ? 'sim/glass' : flightdeck ? 'study/flightdeck' : 'study/sectional';
		var layout = sim ? 'cockpit' : flightdeck ? 'dashboard' : 'reading';
		// User theme cookie. Allow-list is generated from listThemes() at
		// build time so a new theme shipping in @ab/themes is picked up
		// automatically the next time bun themes:emit runs.
		var themeCookie = document.cookie.match(/(?:^|;\s*)theme=([^;]+)/);
		var rawTheme = themeCookie ? decodeURIComponent(themeCookie[1]) : '';
		var allowed = { 'airboss/default': 1, 'sim/glass': 1, 'study/flightdeck': 1, 'study/sectional': 1 };
		var userTheme = allowed[rawTheme] ? rawTheme : '';
		// Route safety lock: /sim/* always uses sim/glass regardless of pref.
		var theme = sim ? pathTheme : (userTheme || pathTheme);
		var stored = document.cookie.match(/(?:^|;\s*)appearance=(system|light|dark)/);
		var pref = stored ? stored[1] : 'system';
		var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		// Forced-appearance themes (today: sim/glass dark-only) bypass user prefs.
		var forcedDark = theme === 'sim/glass';
		var appearance = forcedDark ? 'dark' : pref === 'system' ? system : pref;
		doc.setAttribute('data-theme', theme);
		doc.setAttribute('data-appearance', appearance);
		doc.setAttribute('data-layout', layout);
	} catch (e) {
		/* Fall through to the HTML defaults. */
	}
})();