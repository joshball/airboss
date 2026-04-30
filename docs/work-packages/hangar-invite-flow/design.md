---
title: 'Design: Hangar invite flow'
product: hangar
feature: hangar-invite-flow
type: design
status: draft
review_status: pending
---

UX shape, modal copy, email template, and accept-page flow for [spec.md](./spec.md).

## Hangar list -- /users/invitations

Tabs across the top: `Pending (n)` / `Accepted (n)` / `Revoked (n)` / `Expired (n)` / `All (n)`. Default tab is `Pending`. Status comes from a derived column in the BC read (timestamps + `now()`); no DB enum.

Above the tabs, an "Invite user" button (primary). Below, a table:

| Column        | Source                                              |
| ------------- | --------------------------------------------------- |
| Email         | `invitation.email`                                  |
| Role          | `invitation.proposed_role`                          |
| Status        | derived (Pending / Accepted / Revoked / Expired)    |
| Invited       | `invited_at` (relative + tooltip with absolute)     |
| Expires       | `expires_at` (relative)                             |
| Invited by    | joined `bauth_user.name` (fall-back email)          |
| Actions       | "View" link to detail page                          |

Empty state per status: "No pending invitations." / "No invitations have been accepted yet." etc. The empty-state component already exists in `@ab/ui/EmptyState`.

## Invite modal

Reuses `ConfirmDialog` from users-editing. Body content:

- `<input type="email" name="email" required />` -- the recipient email. Lowercased on submit.
- `<select name="proposedRole">` -- options from `ROLE_VALUES` minus `admin` (decision (e)). Default: `learner`.
- A line of helper copy: "We'll send <email> a one-shot link valid for 7 days. They pick their own password on accept."

Submit button: "Send invite" (primary). No typed-confirmation gate on create -- creating an invite is recoverable (revoke if wrong recipient).

Errors render in a banner inside the modal (the form action returns `fail(409, { error })` for existing-user and `fail(400, { error })` for validation; both surface here).

## Detail page -- /users/invitations/[id]

Layout mirrors `/users/[id]`:

- Header: email, role badge, status badge.
- Profile card: invited at, expires at, invited by (with link to their `/users/<id>`), accepted at + accepted user (link) when accepted.
- Admin actions block:
  - Revoke (when status = Pending) -- ConfirmDialog with typed-email gate, danger variant.
  - Resend (when status = Pending) -- ConfirmDialog without typed gate, caution variant. Body says "We'll generate a new link and email it. The previous link will stop working."
  - View invited user (when status = Accepted) -- a button that links to `/users/<accepted_user_id>`.
- Audit history card: rows from `audit.audit_log` filtered to `targetType = hangar.invitation AND targetId = <this id>`.

## Accept page -- /invite/[token]

Single-purpose route; no nav, no auth-gated chrome. The page is intentionally minimal so the recipient sees one focused action.

```text
┌─────────────────────────────────────────────────┐
│  airboss                                        │
│                                                 │
│  You've been invited.                           │
│                                                 │
│  alice@example.com  (read-only)                 │
│  Role: learner                                  │
│  Invited by: Joshua Ball (admin1@airboss.test)  │
│                                                 │
│  Choose a password:  [____________________]    │
│  Confirm password:    [____________________]    │
│                                                 │
│                            [ Accept invite ]    │
│                                                 │
│  This invitation expires in 6 days.             │
└─────────────────────────────────────────────────┘
```

Email is read-only per decision (g) -- the token + email are bound. The role is shown so the recipient understands what they're agreeing to.

When the recipient is already signed in (HIF-43), an extra banner appears at the top: **"You are signed in as <current_email>. Accepting will sign you out and create a new account for <invite_email>."** The form still submits but with full disclosure.

After successful accept, the form-action's response includes the new session cookie; the redirect lands on `/dashboard` with the new user signed in.

## Email template

```text
Subject: You've been invited to airboss

Hi,

<inviter_name> invited you to airboss as <role>.

Click the link below to set a password and finish signup:

<accept_url>

The link is good for <expiry_days> days. If you weren't expecting this email, you can safely ignore it -- the invite will expire on its own.

-- airboss
```

HTML version mirrors the existing `magicLinkEmail` style: a single CTA button, the URL also rendered as plain text below for clients that strip buttons. No tracking pixels, no fancy chrome.

## Token + URL shape

```text
https://study.airboss.test/invite/<token>
```

Token = base64url of 32 random bytes (43 chars). Lookup is a unique-index hit on `hangar.invitation.token`. No JWT, no signed envelope -- DB lookup is the verification.

## Audit row shapes

Per spec In Scope #3 + decision (h):

```text
create:
  op             = create
  targetType     = hangar.invitation
  targetId       = invitation.id (inv_*)
  before         = null
  after          = { id, email, proposed_role, invited_at, expires_at }
  metadata       = { subKind: 'create', email, requestId, userAgent, actorEmail }

revoke:
  op             = update
  targetType     = hangar.invitation
  targetId       = invitation.id
  before         = { revoked_at: null, revoked_by_user_id: null }
  after          = { revoked_at, revoked_by_user_id }
  metadata       = { subKind: 'revoke', email, requestId, userAgent, actorEmail }

resend:
  op             = action
  targetType     = hangar.invitation
  targetId       = invitation.id
  before         = null
  after          = null
  metadata       = { subKind: 'resend', email, oldTokenSuffix, newTokenSuffix, expiresAt, requestId, userAgent, actorEmail }

accept:
  op             = action
  targetType     = hangar.invitation
  targetId       = invitation.id
  before         = null
  after          = null
  metadata       = { subKind: 'accept', email, acceptedUserId, acceptedRole, requestId, userAgent }
                   actorEmail = null (the actor IS the new user; identity flows through acceptedUserId)
```

`tokenSuffix` carries the last 8 chars of the token, never the full token. Logging full tokens to the audit trail would defeat the bearer-token security model.

## What this design prevents

- A signed-in user accidentally accepting an invite for someone else (HIF-43 banner).
- An admin invite-creating themselves into a foot-gun (`admin` role excluded from the picker per decision (e)).
- Two pending invites for the same email (unique partial index).
- Acting on a stale link after revoke / resend / accept (server-side re-check on every accept).
- Logging full bearer tokens (only token suffix appears in audit metadata).

## Risks + mitigations

| Risk                                                                                | Mitigation                                                                                       |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Email send transient failure leaves a half-state                                    | Decision (c): transactional rollback on send failure. No row, no audit, admin retries.           |
| Recipient clicks link from one device after accepting from another                  | Server-side check on every accept; second click 404s.                                            |
| Long-lived browser tab on accept page after expiry                                  | Server-side recheck on form submit; HIF-51.                                                      |
| Better-auth `createUser` fails mid-accept                                           | Wrap createUser + invitation update in a transaction; HIF-52.                                    |
| Token leaked via referrer header                                                    | Accept route is the only consumer; once redeemed the token is dead. Risk window = until accept. |

## What this design does NOT cover

- Bulk invite UI (deferred per spec).
- Cron cleanup of long-expired invites (deferred per decision (j)).
- Re-invite for an already-accepted user (deferred -- role picker handles this case today).
- Browser-level e2e (deferred to `hangar-e2e-infrastructure`).
