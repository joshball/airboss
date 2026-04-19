// Study BC -- spaced repetition, cards, reviews, scenarios, calibration.

export type { CardFilters, CardWithState, CreateCardInput, UpdateCardInput } from './cards';
export {
	CardNotEditableError,
	CardNotFoundError,
	createCard,
	getCard,
	getCards,
	getDueCards,
	SourceRefRequiredError,
	setCardStatus,
	updateCard,
} from './cards';
export type { SubmitReviewInput } from './reviews';
export { CardNotReviewableError, submitReview } from './reviews';
// Drizzle table objects + row types. Table objects are exported for scripts
// and seed code; route handlers should prefer BC functions and never issue
// raw db.insert/select on these tables.
export type { CardRow, CardStateRow, NewCardRow, NewCardStateRow, NewReviewRow, ReviewRow } from './schema';
export { card, cardState, review, studySchema } from './schema';
export type { CardSchedulerState, ScheduleResult } from './srs';
export { fsrsDefaultParams, fsrsInitialState, fsrsSchedule } from './srs';
export type { DashboardStats, DomainStats, MasteryStats, RecentReviewRow, ReviewStats } from './stats';
export {
	getCardMastery,
	getDashboardStats,
	getDomainBreakdown,
	getDueCardCount,
	getMasteredCount,
	getRecentReviewsForCard,
	getReviewStats,
} from './stats';
export {
	cardTagsSchema,
	cardTextSchema,
	confidenceSchema,
	newCardSchema,
	reviewRatingSchema,
	submitReviewSchema,
	updateCardSchema,
} from './validation';
