/// <reference types="@sveltejs/kit" />

import type { AppearancePreference, ThemePreference } from '@ab/themes';

declare global {
	namespace App {
		interface Locals {
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
