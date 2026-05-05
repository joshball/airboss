---
key: page-anchor
term: Page anchor
related: [e2e, testid]
---

# Page anchor

The single `data-testid="page-anchor"` element on each page. The wide flow test uses it as proof that the page rendered.

Convention: the page anchor sits on the page's `<h1>` (or the primary section header if the page has no `<h1>`). Exactly one per page. A CI guard fails the build if any route under `apps/study/src/routes/(app)/**` ships without one.
