/// <reference types="@sveltejs/kit" />

import type { AuthSession, AuthUser } from '@ab/auth';
import type { AppearancePreference, ThemePreference } from '@ab/themes';

declare global {
	namespace App {
		interface Locals {
			/** Authenticated user when the cross-subdomain bauth_session cookie validates; null for anonymous visits. */
			session: AuthSession | null;
			user: AuthUser | null;
			requestId: string;
			appearance: AppearancePreference;
			theme: ThemePreference;
		}
		interface Error {
			message: string;
			requestId?: string;
		}
	}
}
