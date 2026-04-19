import { ENV_VARS, isProd, LOG_LEVEL_ORDER, type LogLevel } from '@ab/constants';

interface LogContext extends Record<string, unknown> {
	requestId?: string;
	userId?: string | null;
	metadata?: Record<string, unknown>;
}

interface LogEntry {
	level: string;
	message: string;
	timestamp: string;
	app: string;
	requestId?: string;
	userId?: string;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
	metadata?: Record<string, unknown>;
}

export interface Logger {
	debug: (msg: string, ctx?: LogContext) => void;
	info: (msg: string, ctx?: LogContext) => void;
	warn: (msg: string, ctx?: LogContext) => void;
	error: (msg: string, ctx?: LogContext, err?: Error) => void;
}

function getMinLevel(): LogLevel {
	const raw = process.env[ENV_VARS.LOG_LEVEL] ?? 'info';
	if (raw in LOG_LEVEL_ORDER) return raw as LogLevel;
	return 'info';
}

function formatPretty(app: string, level: string, msg: string, ctx?: LogContext): string {
	const ts = new Date().toISOString();
	const label = level.toUpperCase().padEnd(5);
	const reqSuffix = ctx?.requestId ? ` req=${ctx.requestId}` : '';
	const userSuffix = ctx?.userId ? ` uid=${ctx.userId}` : '';
	return `${ts} [${app}] ${label} ${msg}${reqSuffix}${userSuffix}`;
}

export function createLogger(app: string): Logger {
	function log(level: LogLevel, msg: string, ctx?: LogContext, err?: Error): void {
		const minLevel = getMinLevel();
		if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[minLevel]) return;

		if (isProd()) {
			const entry: LogEntry = {
				level,
				message: msg,
				timestamp: new Date().toISOString(),
				app,
				requestId: ctx?.requestId,
				// null -> undefined: omit the field rather than log null
				userId: ctx?.userId ?? undefined,
				error: err ? { name: err.name, message: err.message, stack: err.stack } : undefined,
				metadata: ctx?.metadata,
			};
			process.stdout.write(`${JSON.stringify(entry)}\n`);
		} else {
			const line = formatPretty(app, level, msg, ctx);
			if (level === 'error') {
				// biome-ignore lint/suspicious/noConsole: logger is the designated console output wrapper
				console.error(line);
				if (err?.stack) {
					// biome-ignore lint/suspicious/noConsole: logger is the designated console output wrapper
					console.error(err.stack);
				}
			} else {
				// biome-ignore lint/suspicious/noConsole: logger is the designated console output wrapper
				console.log(line);
			}
			if (ctx?.metadata && Object.keys(ctx.metadata).length > 0) {
				// biome-ignore lint/suspicious/noConsole: logger is the designated console output wrapper
				console.log(`  meta: ${JSON.stringify(ctx.metadata)}`);
			}
		}
	}

	return {
		debug: (msg, ctx) => log('debug', msg, ctx),
		info: (msg, ctx) => log('info', msg, ctx),
		warn: (msg, ctx) => log('warn', msg, ctx),
		error: (msg, ctx, err) => log('error', msg, ctx, err),
	};
}
