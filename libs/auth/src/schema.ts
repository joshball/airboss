/**
 * READ-ONLY Drizzle schemas matching better-auth's auto-created tables.
 * These are for querying only -- better-auth manages the tables.
 *
 * Table prefix: bauth_ (set via modelName in server.ts).
 * These live in the default public schema since better-auth
 * does not support PostgreSQL schema namespaces.
 */

import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const bauthUser = pgTable('bauth_user', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	role: text('role'),
	address: jsonb('address'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const bauthSession = pgTable('bauth_session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => bauthUser.id),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	impersonatedBy: text('impersonated_by'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const bauthAccount = pgTable('bauth_account', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => bauthUser.id),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const bauthVerification = pgTable('bauth_verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
