/**
 * Hangar-app palette commands (Phase 4 of the command-palette WP).
 *
 * Per the WP brief ("be honest about what's wired"), commands without a
 * concrete target route are dropped here with a TODO comment.
 */

import { APP_IDS, ROUTES } from '@ab/constants';
import { type PaletteCommand, paletteCommands } from '@ab/help';
import { goto } from '$app/navigation';

const COMMANDS: readonly PaletteCommand[] = [
	{
		id: 'hangar.audit-log',
		type: 'cmd.goto',
		label: 'Open audit log',
		subtitle: 'Admin / Audit',
		keywords: ['audit', 'log', 'admin', 'history'],
		surface: APP_IDS.HANGAR,
		handler: () => {
			void goto(ROUTES.HANGAR_ADMIN_AUDIT);
		},
	},
	{
		// The invitations index hosts the "New invitation" form action; the
		// closest standing surface for the "Invite user" intent.
		id: 'hangar.invite-user',
		type: 'cmd.goto',
		label: 'Invite user',
		subtitle: 'Users / Invitations',
		keywords: ['invite', 'user', 'new', 'invitation', 'onboard'],
		surface: APP_IDS.HANGAR,
		handler: () => {
			void goto(ROUTES.HANGAR_USERS_INVITATIONS);
		},
	},
	{
		id: 'hangar.new-glossary',
		type: 'cmd.goto',
		label: 'New glossary entry',
		subtitle: 'Glossary / New',
		keywords: ['glossary', 'new', 'term', 'definition'],
		surface: APP_IDS.HANGAR,
		handler: () => {
			void goto(ROUTES.HANGAR_GLOSSARY_NEW);
		},
	},
	{
		id: 'hangar.sources',
		type: 'cmd.goto',
		label: 'Browse sources',
		subtitle: 'Sources',
		keywords: ['sources', 'ingest', 'corpus', 'docs'],
		surface: APP_IDS.HANGAR,
		handler: () => {
			void goto(ROUTES.HANGAR_SOURCES);
		},
	},
	{
		id: 'hangar.review-queue',
		type: 'cmd.goto',
		label: 'Open review queue',
		subtitle: 'Review',
		keywords: ['review', 'queue', 'qa', 'inbox'],
		surface: APP_IDS.HANGAR,
		handler: () => {
			void goto(ROUTES.HANGAR_REVIEW);
		},
	},
	// TODO(phase-5): "New doc" -- the hangar `/docs` surface is a read-only
	// markdown viewer over `docs/**`, `course/**`, `handbooks/**`,
	// `regulations/**`. Authoring new docs goes through the source code +
	// `docs/work-packages/` flow, not through a UI. Reintroduce when (and
	// if) hangar grows a browser-side authoring route.
];

export function registerHangarCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
	for (const cmd of COMMANDS) paletteCommands.register(cmd);
}

export function unregisterHangarCommands(): void {
	for (const cmd of COMMANDS) paletteCommands.unregister(cmd.id);
}

export { COMMANDS as HANGAR_PALETTE_COMMANDS };
