/**
 * Flightbag-app palette commands (Phase 4 of the command-palette WP).
 *
 * Flightbag commands are "open this canonical reference" -- the surface
 * is a deep-link reader, so most commands are `cmd.goto` pointing at the
 * handbook / CFR / AIM landings. Per the WP brief, edition strings use
 * the short form (`8083-28B`, not `FAA-H-8083-28B`) -- the route grammar
 * mirrors the `airboss-ref:` URI shape via `shortHandbookEdition()`.
 */

import { APP_IDS, ROUTES } from '@ab/constants';
import { type PaletteCommand, paletteCommands } from '@ab/help';
import { goto } from '$app/navigation';

const COMMANDS: readonly PaletteCommand[] = [
	{
		id: 'flightbag.open-avwx',
		type: 'cmd.goto',
		label: 'Open Aviation Weather Handbook',
		subtitle: 'FAA-H-8083-28B',
		keywords: ['avwx', 'weather', 'handbook', '8083-28', 'wx', 'aviation weather'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_HANDBOOK('avwx', '8083-28B'));
		},
	},
	{
		id: 'flightbag.open-phak',
		type: 'cmd.goto',
		label: 'Open Pilot Handbook of Aeronautical Knowledge',
		subtitle: 'FAA-H-8083-25C',
		keywords: ['phak', 'pilot handbook', '8083-25', 'aeronautical'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_HANDBOOK('phak', '8083-25C'));
		},
	},
	{
		id: 'flightbag.open-afh',
		type: 'cmd.goto',
		label: 'Open Airplane Flying Handbook',
		subtitle: 'FAA-H-8083-3C',
		keywords: ['afh', 'airplane flying', '8083-3', 'flight'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_HANDBOOK('afh', '8083-3C'));
		},
	},
	{
		id: 'flightbag.open-ifh',
		type: 'cmd.goto',
		label: 'Open Instrument Flying Handbook',
		subtitle: 'FAA-H-8083-15B',
		keywords: ['ifh', 'instrument flying', '8083-15', 'instrument'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_HANDBOOK('ifh', '8083-15B'));
		},
	},
	{
		id: 'flightbag.open-14-cfr-91',
		type: 'cmd.goto',
		label: 'Open 14 CFR Part 91',
		subtitle: 'General Operating Rules',
		keywords: ['91', '14 cfr', 'part 91', 'cfr', 'rules', 'general'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_CFR_PART('14', '91'));
		},
	},
	{
		id: 'flightbag.open-14-cfr-61',
		type: 'cmd.goto',
		label: 'Open 14 CFR Part 61',
		subtitle: 'Certification of Pilots',
		keywords: ['61', '14 cfr', 'part 61', 'cfr', 'certification', 'pilots'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_CFR_PART('14', '61'));
		},
	},
	{
		id: 'flightbag.open-aim-7',
		type: 'cmd.goto',
		label: 'Open AIM Chapter 7',
		subtitle: 'Safety of Flight',
		keywords: ['aim', '7-1', 'chapter 7', 'safety', 'weather'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_AIM_CHAPTER('7'));
		},
	},
	{
		id: 'flightbag.open-aim-4',
		type: 'cmd.goto',
		label: 'Open AIM Chapter 4',
		subtitle: 'Air Traffic Control',
		keywords: ['aim', '4-1', 'chapter 4', 'atc', 'air traffic'],
		surface: APP_IDS.FLIGHTBAG,
		handler: () => {
			void goto(ROUTES.FLIGHTBAG_AIM_CHAPTER('4'));
		},
	},
];

export function registerFlightbagCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
	for (const cmd of COMMANDS) paletteCommands.register(cmd);
}

export function unregisterFlightbagCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
}

export { COMMANDS as FLIGHTBAG_PALETTE_COMMANDS };
