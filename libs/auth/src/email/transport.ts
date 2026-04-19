import { ENV_VARS, MAIL_FROM_NOREPLY } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { Resend } from 'resend';

const log = createLogger('email');

let resendClient: Resend | null = null;

function getResend(): Resend | null {
	if (resendClient) return resendClient;
	const key = process.env[ENV_VARS.RESEND_API_KEY];
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
	const from = message.from ?? MAIL_FROM_NOREPLY;
	const client = getResend();

	if (!client) {
		log.info('no RESEND_API_KEY -- email logged', {
			metadata: { to: message.to, from, subject: message.subject },
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
			log.error('resend error', { metadata: { error: result.error.message } });
			return false;
		}

		return true;
	} catch (err) {
		log.error('email send failed', { metadata: { error: err instanceof Error ? err.message : 'unknown' } });
		return false;
	}
}
