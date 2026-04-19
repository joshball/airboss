/**
 * Email templates for auth flows.
 * Simple HTML -- no external dependencies. Inline styles for email client compatibility.
 */

/** Escape text for safe interpolation into HTML content or attribute values. */
function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function baseTemplate(content: string): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
${content}
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;" />
<p style="font-size: 12px; color: #94a3b8;">airboss -- pilot performance and rehearsal platform</p>
</body>
</html>`;
}

function buttonHtml(url: string, label: string): string {
	return `<a href="${escapeHtml(url)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">${escapeHtml(label)}</a>`;
}

export function verificationEmail(url: string, name: string): { subject: string; html: string } {
	const safeName = escapeHtml(name);
	return {
		subject: 'Verify your email -- airboss',
		html: baseTemplate(`
<h1 style="font-size: 20px; margin: 0 0 16px;">Verify your email</h1>
<p>Hi ${safeName},</p>
<p>Click the button below to verify your email address and activate your airboss account.</p>
<p style="margin: 24px 0;">${buttonHtml(url, 'Verify Email')}</p>
<p style="font-size: 13px; color: #64748b;">If you didn't create an account, you can safely ignore this email. This link expires in 24 hours.</p>
`),
	};
}

export function resetPasswordEmail(url: string, name: string): { subject: string; html: string } {
	const safeName = escapeHtml(name);
	return {
		subject: 'Reset your password -- airboss',
		html: baseTemplate(`
<h1 style="font-size: 20px; margin: 0 0 16px;">Reset your password</h1>
<p>Hi ${safeName},</p>
<p>We received a request to reset your password. Click the button below to choose a new one.</p>
<p style="margin: 24px 0;">${buttonHtml(url, 'Reset Password')}</p>
<p style="font-size: 13px; color: #64748b;">If you didn't request a password reset, you can safely ignore this email. This link expires in 1 hour.</p>
`),
	};
}

export function magicLinkEmail(url: string): { subject: string; html: string } {
	return {
		subject: 'Sign in to airboss',
		html: baseTemplate(`
<h1 style="font-size: 20px; margin: 0 0 16px;">Sign in to airboss</h1>
<p>Click the button below to sign in. No password needed.</p>
<p style="margin: 24px 0;">${buttonHtml(url, 'Sign In')}</p>
<p style="font-size: 13px; color: #64748b;">This link expires in 5 minutes and can only be used once. If you didn't request this, you can safely ignore it.</p>
`),
	};
}
