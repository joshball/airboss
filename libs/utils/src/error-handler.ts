import type { Logger } from './logger';

interface ErrorHandlerOptions {
	logger: Logger;
}

interface HandleErrorParams {
	error: unknown;
	status: number;
	message: string;
	requestId?: string;
	userId?: string;
}

interface ErrorResponse {
	message: string;
	requestId: string;
}

/**
 * Creates a SvelteKit-compatible handleError function.
 * Logs the error with structured context and returns a safe response.
 */
export function createErrorHandler({ logger }: ErrorHandlerOptions) {
	return function handleError(params: HandleErrorParams): ErrorResponse {
		const requestId = params.requestId ?? crypto.randomUUID();

		if (params.error instanceof Error) {
			logger.error(params.message, { requestId, userId: params.userId }, params.error);
		} else {
			logger.error(params.message, {
				requestId,
				userId: params.userId,
				metadata: { error: String(params.error) },
			});
		}

		const safeMessage = params.status === 404 ? 'Page not found' : 'An unexpected error occurred';

		return {
			message: safeMessage,
			requestId,
		};
	};
}
