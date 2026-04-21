# {{Feature Name}}

> One-paragraph elevator pitch. What is this, who is it for, why does it exist.

## The journey

Step-by-step user flow. Each step: what you click, what happens, what you see.

### 1. {{First step}}

Describe the UI state, the action, the result. Link to the file
(`apps/{surface}/src/routes/...`) that owns the rendered page.

### 2. {{Next step}}

...

## Code map

Where each piece of the feature lives. Reader should be able to find any
behavior from one of these entries.

| Concern             | Lives at                                                 |
| ------------------- | -------------------------------------------------------- |
| Page routes         | `apps/{surface}/src/routes/...`                          |
| BC / business logic | `libs/bc/{bc-name}/src/...`                              |
| DB schema           | `libs/bc/{bc-name}/src/schema.ts`                        |
| Constants           | `libs/constants/src/{area}.ts`                           |
| Validation          | `libs/bc/{bc-name}/src/validation.ts`                    |
| Tests               | `libs/bc/{bc-name}/src/*.test.ts`, `apps/{surface}/...`  |

## Key decisions

Non-obvious choices future-you will want to know. Each: the decision, the
trade-off, and a pointer to the doc/commit/ADR where the reasoning lives.

- {{Decision}} -- {{trade-off}}. See {{link}}.

## Operator notes

How to run, seed, reset, test, debug this feature locally.

```text
# Dev
bun run dev
# DB setup
bun run db push
bun run db seed
# Smoke
bun scripts/smoke/{feature}.ts
```

## Related docs

- Spec: [work-packages/{feature}/spec.md](../work-packages/{feature}/spec.md)
- Design: [work-packages/{feature}/design.md](../work-packages/{feature}/design.md)
- Tasks: [work-packages/{feature}/tasks.md](../work-packages/{feature}/tasks.md)
- Test plan: [work-packages/{feature}/test-plan.md](../work-packages/{feature}/test-plan.md)
- User stories: [work-packages/{feature}/user-stories.md](../work-packages/{feature}/user-stories.md)
- Review: [work-packages/{feature}/review.md](../work-packages/{feature}/review.md)
- PRD: [work-packages/{feature}/PRD.md](../work-packages/{feature}/PRD.md)

## Deferred / follow-ups

Items that were reviewed and consciously deferred. Each with a reason and
a target (next phase, next product, post-launch, etc.).

- {{Item}} -- {{reason}}. Target: {{when}}.

## Change log

Significant shifts in behavior or shape. Keeps the walkthrough honest as
the feature evolves.

- `YYYY-MM-DD` -- initial walkthrough written (feature shipped on branch `build/{name}`).
