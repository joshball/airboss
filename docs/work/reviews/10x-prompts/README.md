# 10x Review Prompts -- airboss codebase carve-up

Six self-contained prompts. Each is meant to be pasted into a fresh Claude Code session as the first user message. The session will then invoke `/ball-review-10x` against the locked-in scope.

Run them one at a time (or in parallel sessions). Each writes its review files to `docs/work/reviews/`.

| # | Chunk | Prompt |
|---|-------|--------|
| 1 | Study app -- surfaces and routes | [01-study-app-surfaces.md](01-study-app-surfaces.md) |
| 2 | Study BC -- domain logic | [02-study-bc-domain.md](02-study-bc-domain.md) |
| 3 | Auth, identity, audit | [03-auth-identity-audit.md](03-auth-identity-audit.md) |
| 4 | Sources and content pipeline | [04-sources-content-pipeline.md](04-sources-content-pipeline.md) |
| 5 | UI library and themes | [05-ui-library-themes.md](05-ui-library-themes.md) |
| 6 | Hangar (app + libs + BC) | [06-hangar-cluster.md](06-hangar-cluster.md) |

## Notes

- Each prompt locks the scope tightly so the orchestrator does not re-negotiate boundaries.
- Each prompt names the reviewers to launch -- the orchestrator should still detect the stack itself, but the named set is the floor.
- Review outputs land in `docs/work/reviews/{date}-{feature}-{category}.md` per the skill.
- After each chunk finishes, decide whether to invoke `/ball-review-fix` (or `/rfix`) before moving on.
