/**
 * Keyboard shortcuts help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MINOR "New card form Cmd+Enter submits, Enter does not - undocumented"
 *   - MINOR "Reps session '/' '[' ']' shortcuts undocumented"
 *   - Central reference for every kbd binding in the app.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const keyboardShortcutsIndex: HelpPageIndex = {
	id: 'keyboard-shortcuts',
	title: 'Keyboard shortcuts',
	summary: 'Every keyboard binding across memory review, reps sessions, the search palette, and forms.',
	tags: {
		appSurface: [APP_SURFACES.GLOBAL],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['keyboard', 'shortcuts', 'hotkeys', 'palette', 'cmd-k', 'slash'],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'memory-review-shortcuts', title: 'Memory review' },
		{ id: 'reps-session-shortcuts', title: 'Reps session' },
		{ id: 'new-card-form-shortcuts', title: 'New card form' },
		{ id: 'search-palette-shortcuts', title: 'Search palette' },
		{ id: 'dashboard-shortcuts', title: 'Dashboard' },
		{ id: 'global-browser-shortcuts', title: 'Global browser shortcuts' },
	],
	searchHaystack:
		'every keyboard binding across memory review, reps sessions, the search palette, and forms. airboss ships keyboard shortcuts on the surfaces that benefit from fast repeat input: memory review, rep sessions, the search palette, and the new-card form. all keydown handlers guard against ime composition events (korean / japanese / chinese input methods) so composing characters never triggers shortcuts by accident.\n\non macos `cmd` is the modifier key; on windows / linux `ctrl` is the equivalent. the table columns use `cmd`; substitute `ctrl` off macos. at `/memory/review`:\n\n| key     | action                          |\n| ------- | ------------------------------- |\n| `space` | reveal answer                   |\n| `1`     | rate again                      |\n| `2`     | rate hard                       |\n| `3`     | rate good                       |\n| `4`     | rate easy                       |\n\nsee [memory review](/help/memory-review) for what the four ratings mean for scheduling. at `/session/start` or inside a session at `/sessions/[id]`:\n\n| key       | action                                                                   |\n| --------- | ------------------------------------------------------------------------ |\n| `space`   | reveal / continue to next rep                                            |\n| `a`-`e`   | pick option by on-screen position (shuffled, not database order)         |\n| `1`-`5`   | rate confidence (when the prompt is shown)                               |\n| `escape`  | close confidence prompt without rating (counts as skip)                  |\n\nthe shuffle seed is in the url as `?s=<number>`; reload preserves the option order so a-e keys map to the same options across refreshes. see [reps session](/help/reps-session). at `/memory/new`:\n\n| key                  | action                                                  |\n| -------------------- | ------------------------------------------------------- |\n| `cmd+enter`          | submit the form (save card)                             |\n| `cmd+shift+enter`    | save card and immediately open a fresh new-card form    |\n\n`enter` alone inserts a newline in multiline fields and does not submit. plain `enter` was not bound to submit because card front/back fields are multiline by intent (mathematical notation, code blocks, longer prose), and single-line submission would fight that. the cross-library search palette spans aviation references and help pages. from any page in the `(app)` group:\n\n| key       | action                                                         |\n| --------- | -------------------------------------------------------------- |\n| `/`       | focus / open the palette                                       |\n| `cmd+k`   | also opens the palette (alt path, same component)              |\n| `[`       | jump focus to the aviation-results section                     |\n| `]`       | jump focus to the help-results section                         |\n| `enter`   | activate the focused result (open its detail route)            |\n| `escape`  | close the palette                                              |\n\nthe two invocation paths (`/` and `cmd+k`) exist because the ux review flagged search discoverability problems. both work; both open the same component. the dashboard has no surface-specific shortcuts. every panel is clickable or links to its deep-target route, and the search palette is reachable with `/` or `cmd+k` like any other page. if you want to start the cta action from the keyboard, `tab` to the cta button and `enter`. standard browser shortcuts work everywhere:\n\n- `cmd+r` - reload. rep sessions are server-derived, so reload resumes at the current slot without losing progress.\n- `cmd+[` / `cmd+]` - browser back / forward. back from a rep mid-session lands on the previous rep with prior answer preserved.\n- `cmd+f` - native browser find. useful on help pages and glossary detail pages where the full content is rendered. keyboard shortcuts hotkeys palette cmd-k slash',
	related: ['memory-review', 'reps-session', 'getting-started'],
	reviewedAt: '2026-04-22',
};
