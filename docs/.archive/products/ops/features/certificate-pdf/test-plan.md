---
title: Certificate PDF - Test Plan
status: done
date: 2026-03-31
---

# Certificate PDF Test Plan

## Address Fields

| Step | Action                          | Expected                                                |
| ---- | ------------------------------- | ------------------------------------------------------- |
| 1    | Open ops invite form            | Address section visible, collapsed by default           |
| 2    | Invite user with address filled | User created, `bauth_user.address` has structured JSONB |
| 3    | Invite user without address     | User created, address is null                           |
| 4    | Invite admin/operator           | Address section present but clearly optional            |

## PDF Download

| Step | Action                                | Expected                                                                                                  |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1    | Open active certificate detail page   | "Download PDF" button visible                                                                             |
| 2    | Click "Download PDF"                  | PDF downloads, filename is `certificate-{id}.pdf`                                                         |
| 3    | Open downloaded PDF                   | Single page with: certificate ID, attendee name, course title, dates, graduation status, FAA time, issuer |
| 4    | Download PDF for user with address    | Address appears on PDF                                                                                    |
| 5    | Download PDF for user without address | PDF renders cleanly, no blank space where address would be                                                |
| 6    | Open revoked certificate detail page  | No download button                                                                                        |

## Edge Cases

| Step | Action                                              | Expected              |
| ---- | --------------------------------------------------- | --------------------- |
| 1    | Issue cert for user with special characters in name | PDF renders correctly |
| 2    | Visit PDF endpoint without auth                     | Redirected to login   |
| 3    | Visit PDF endpoint as learner (wrong role)          | 403 or redirect       |
| 4    | Visit PDF endpoint with invalid certificate ID      | 404                   |

## General

- `bun run check` passes
- No regressions in existing certificate issuance flow
