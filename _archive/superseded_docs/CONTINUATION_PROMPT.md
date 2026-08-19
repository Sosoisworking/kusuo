# Continuation Prompt — Give This Directly to Claude Code

Read all Kusuo project documentation in this repository before making changes, especially:

- `README.md`
- `PROJECT_CONTEXT.md`
- `EXISTING_CODE_STRUCTURE.md`
- `IMPLEMENTATION_SPEC.md`
- `ROADMAP.md`
- `BACKLOG.md`
- `DECISIONS.md`
- `GITHUB_WORKFLOW.md`
- `CLAUDE_CODE_MASTER_PROMPT.md`

Then inspect the actual source repository and treat source code as authoritative over historical documentation.

Your first output should be an implementation audit, not a speculative rewrite.

After the audit:

1. Build the untouched project.
2. Run tests.
3. Identify the highest-value missing core feature.
4. Implement it safely.
5. Add/update tests.
6. Verify the build.
7. Show the diff summary.
8. Recommend the next milestone.

Preserve user data and do not make destructive Room migrations.
