/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
		interface Locals {
			requestId: string;
		}
		interface Error {
			message: string;
			requestId?: string;
		}
	}
}

export {};
