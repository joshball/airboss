import type { Logger } from './logger';

interface ErrorHandlerOptions {
	logger: Logger;
}

interface HandleErrorParams {
	error: unknown;
	status: number;
	message: string;
	requestId?: string;
	userId?: string | null;
}

interface ErrorResponse {
	message: string;
	requestId: string;
}

function safeMessageForStatus(status: number): string {
	if (status === 404) return 'Page not found';
	if (status === 401) return 'Please sign in';
	if (status === 403) return 'You do not have permission to view this page';
	return 'An unexpected error occurred';
}

/**
 * Creates a SvelteKit-compatible handleError function.
 * Logs the error with structured context and returns a safe response.
 *
 * 4xx statuses (client errors, typically "not found" for SPA fall-through
 * requests like favicon.ico) are logged at warn; 5xx at error.
 */
export function createErrorHandler({ logger }: ErrorHandlerOptions) {
	return function handleError(params: HandleErrorParams): ErrorResponse {
		const requestId = params.requestId ?? crypto.randomUUID();
		const isClientError = params.status >= 400 && params.status < 500;

		if (params.error instanceof Error) {
			if (isClientError) {
				logger.warn(params.message, { requestId, userId: params.userId });
			} else {
				logger.error(params.message, { requestId, userId: params.userId }, params.error);
			}
		} else if (isClientError) {
			logger.warn(params.message, { requestId, userId: params.userId, metadata: { error: String(params.error) } });
		} else {
			logger.error(params.message, {
				requestId,
				userId: params.userId,
				metadata: { error: String(params.error) },
			});
		}

		return {
			message: safeMessageForStatus(params.status),
			requestId,
		};
	};
}
