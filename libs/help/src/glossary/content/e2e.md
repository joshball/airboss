---
key: e2e
term: E2E
related: [testid, page-anchor]
---

# E2E

**End-to-end test.** A Playwright test that drives a real browser through real pages.

E2E tests prove that the user-facing flow works -- that the door opens, the form submits, the navigation lands somewhere. They are slower than unit tests; the trade-off is that they exercise the whole stack.

The study app uses two shapes of e2e: a wide **flow** test that walks every top-level route and asserts the page rendered, plus a small set of **focused** tests that prove load-bearing transitions (auth, goal-create, session start).
