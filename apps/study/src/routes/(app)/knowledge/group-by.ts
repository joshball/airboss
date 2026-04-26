/**
 * Group-by enum for the /knowledge browse page.
 *
 * Lives in a sibling module instead of `+page.server.ts` because both the
 * server load and the client component need it -- SvelteKit forbids
 * non-`load`/`actions`/`config` exports from `+page.server.ts` modules so a
 * shared module is the only place a client can read it from safely.
 */
export const KNOWLEDGE_GROUP_BY_VALUES = ['domain', 'cert', 'priority', 'lifecycle', 'none'] as const;
export type KnowledgeGroupByValue = (typeof KNOWLEDGE_GROUP_BY_VALUES)[number];
