import { createLogger } from '@ab/utils';
import { Resend } from 'resend';

const log = createLogger('email');
const DEFAULT_FROM = 'airboss <noreply@air-boss.org>';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
	if (resendClient) return resendClient;
	const key = process.env.RESEND_API_KEY;
	if (!key) return null;
	resendClient = new Resend(key);
	return resendClient;
}

export interface EmailMessage {
	to: string;
	subject: string;
	html: string;
	from?: string;
}

/**
 * Send an email via Resend. Falls back to console logging when no API key is set (dev).
 * Does not throw -- logs errors and returns false.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
	const from = message.from ?? DEFAULT_FROM;
	const client = getResend();

	if (!client) {
		// Dev fallback: log to console
		log.info('no RESEND_API_KEY -- email logged', {
			to: message.to,
			from,
			subject: message.subject,
		});
		return true;
	}

	try {
		const result = await client.emails.send({
			from,
			to: message.to,
			subject: message.subject,
			html: message.html,
		});

		if (result.error) {
			log.error('resend error', { error: result.error.message });
			return false;
		}

		return true;
	} catch (err) {
		log.error('email send failed', { error: err instanceof Error ? err.message : 'unknown' });
		return false;
	}
}
