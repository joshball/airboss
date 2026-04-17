// Auth lib -- better-auth setup
// Will be populated when auth is wired up

export interface AuthSession {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface AuthUser {
	id: string;
	email: string;
	name: string;
	emailVerified: boolean;
	role: string | null;
	image: string | null;
	banned: boolean | null;
	createdAt: Date;
	updatedAt: Date;
}
