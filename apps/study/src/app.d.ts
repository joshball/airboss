/// <reference types="@sveltejs/kit" />

import type { AuthSession, AuthUser } from '@ab/auth';
import type { AppearancePreference } from '@ab/themes';

declare global {
	namespace App {
		interface Locals {
			session: AuthSession | null;
			user: AuthUser | null;
			requestId: string;
			appearance: AppearancePreference;
		}
		interface Error {
			message: string;
			requestId?: string;
		}
	}
}
