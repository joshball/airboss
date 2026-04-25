---
title: "User Stories: Ops App Shell"
product: ops
feature: ops-shell
type: user-stories
status: done
---

# User Stories: Ops App Shell

## Authentication

- As an operator, I want to log in with my email and password so I can access the operations dashboard.
- As an operator, I want to stay logged in across browser refreshes so I don't have to re-authenticate every session.
- As an operator, I want to see a clear error message if my credentials are wrong so I know what to fix.
- As an operator, I want to log out when I'm done so my session isn't left open on a shared machine.

## Role Enforcement

- As an admin, I want ops restricted to OPERATOR and ADMIN roles so learners and authors can't access operational data.
- As an admin, I want unauthorized role access to return a 403, not a login page, so it's clear the user doesn't have permission (not that they need to log in).
- As an admin, I want banned users blocked at the hooks level so they can't access any ops route.

## Navigation

- As an operator, I want a persistent sidebar nav so I can move between all ops sections from any page.
- As an operator, I want to see my name and role in the sidebar so I know I'm logged in as the right account.
- As an operator, I want the ops app to feel visually distinct from hangar and sim so I know where I am.
- As an operator, I want stub pages for features not yet built so the nav structure is complete and I understand the full scope.

## Settings

- As an operator, I want to toggle between light and dark mode so I can work in comfortable lighting.
- As an operator, I want my theme preference saved across sessions so I don't have to re-apply it every time.
- As an operator, I want to change my password from within the app so I don't need to contact an admin.

## Security

- As an admin, I want all ops routes protected by session + role auth so operational records can't be viewed without proper authorization.
- As an admin, I want invite-only access (no self-registration) so the operator pool is controlled.
