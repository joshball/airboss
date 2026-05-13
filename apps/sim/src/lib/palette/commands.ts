/**
 * Sim-app palette commands (Phase 4 of the command-palette WP).
 *
 * Per the WP brief ("be honest about what's wired"), commands without a
 * concrete target route are dropped here with a TODO comment rather than
 * shipped with an invented destination.
 */

import { APP_IDS, ROUTES } from '@ab/constants';
import { type PaletteCommand, paletteCommands } from '@ab/help';
import { goto } from '$app/navigation';

const COMMANDS: readonly PaletteCommand[] = [
	{
		// `SIM_HOME` is the scenario picker -- the entry surface for starting
		// a new sim attempt. No dedicated "/new" route today.
		id: 'sim.pick-scenario',
		type: 'cmd.goto',
		label: 'Pick scenario',
		subtitle: 'Sim / Home',
		keywords: ['scenario', 'pick', 'choose', 'select', 'start', 'new', 'sim'],
		surface: APP_IDS.SIM,
		handler: () => {
			void goto(ROUTES.SIM_HOME);
		},
	},
	{
		id: 'sim.history',
		type: 'cmd.goto',
		label: 'Open attempt history',
		subtitle: 'Sim / History',
		keywords: ['history', 'past', 'attempts', 'replay'],
		surface: APP_IDS.SIM,
		handler: () => {
			void goto(ROUTES.SIM_HISTORY);
		},
	},
	{
		id: 'sim.glass-pfd',
		type: 'cmd.goto',
		label: 'Open glass PFD',
		subtitle: 'Sim / Glass PFD',
		keywords: ['pfd', 'glass', 'cockpit', 'instruments', 'primary'],
		surface: APP_IDS.SIM,
		handler: () => {
			void goto(ROUTES.SIM_GLASS_PFD);
		},
	},
	// TODO(phase-5): "Resume last sim" -- needs an API surface that knows
	// the user's last in-flight attempt id. Reintroduce when sim attempts
	// persist a "last-active" pointer per user (likely under
	// `@ab/bc-sim/server`); the command would `goto(SIM_SCENARIO(lastId))`.
	// TODO(phase-5): "Start new sim" -- distinct from "Pick scenario" only
	// if we add a quick-launch shortcut that picks the most-recent or
	// default scenario without showing the picker. Skip until product
	// signal.
];

export function registerSimCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
	for (const cmd of COMMANDS) paletteCommands.register(cmd);
}

export function unregisterSimCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
}

export { COMMANDS as SIM_PALETTE_COMMANDS };
