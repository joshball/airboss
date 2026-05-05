/// <reference types="@sveltejs/kit" />

import type { AuthSession, AuthUser } from '@ab/auth';
import type { AppearancePreference, ThemePreference } from '@ab/themes';

declare global {
	namespace App {
		interface Locals {
			session: AuthSession | null;
			user: AuthUser | null;
			requestId: string;
			appearance: AppearancePreference;
			theme: ThemePreference;
		}
		interface Error {
			message: string;
			requestId?: string;
			// Set by `hooks.client.ts` for browser-side errors so the
			// `+error.svelte` boundary can render distinct copy
			// ("App error") from HTTP errors ("500: Something went wrong").
			kind?: 'client' | 'server';
		}
	}
}
