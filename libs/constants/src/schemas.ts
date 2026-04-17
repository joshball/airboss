export const SCHEMAS = {
	IDENTITY: 'identity',
	AUDIT: 'audit',
	STUDY: 'study',
} as const;

export type SchemaName = (typeof SCHEMAS)[keyof typeof SCHEMAS];
