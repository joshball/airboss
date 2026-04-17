/// <reference types="@sveltejs/kit" />

import type { AuthSession, AuthUser } from '@ab/auth';

declare global {
	namespace App {
		interface Locals {
			session: AuthSession | null;
			user: AuthUser | null;
		}
		interface Error {
			message: string;
		}
	}
}
