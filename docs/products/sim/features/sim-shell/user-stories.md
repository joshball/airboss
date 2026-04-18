---
title: "User Stories: Sim App Shell"
product: sim
feature: sim-shell
type: user-stories
status: done
---

# User Stories: Sim App Shell

## Authentication

- As a learner, I want to log in with my email and password so I can access my course.
- As a learner, I want to stay logged in across browser refreshes so I don't have to re-authenticate every session.
- As a learner, I want to see a clear error message if my credentials are wrong so I know what to fix.
- As a learner, I want to log out when I'm done so my session isn't left open on a shared machine.

## Navigation

- As a learner, I want a persistent nav bar so I can move between my course, progress, and settings from any page.
- As a learner, I want to see my name or identifier in the nav so I know I'm logged in as the right account.
- As a learner, I want the sim app to feel visually distinct from other apps (amber/warm accent) so I know where I am.

## Settings

- As a learner, I want to toggle between light and dark mode so I can train in comfortable lighting conditions.
- As a learner, I want my theme preference saved across sessions so I don't have to re-apply it every time.
- As a learner, I want to change my password from within the app so I don't need to contact support.

## Security

- As a learner, I want unauthenticated routes to redirect me to login so my training data isn't accessible to others.
- As an operator, I want all sim routes protected by session auth so learner records can't be viewed or modified without authentication.
