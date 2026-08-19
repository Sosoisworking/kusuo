# Kusuo — GitHub + Claude Code Workflow

## Repository setup

Recommended repository name:

`kusuo`

Suggested default branch:

`main`

Recommended development branch pattern:

- `feature/<short-name>`
- `fix/<short-name>`
- `refactor/<short-name>`
- `chore/<short-name>`

## Initial workflow

1. Push the existing working project to GitHub.
2. Add the documentation from this package.
3. Create an initial baseline commit.
4. Ask Claude Code to audit/build before editing.
5. Make one coherent change at a time.
6. Run tests/build after each major change.
7. Review the diff.
8. Commit with a descriptive message.

## Recommended commit style

Examples:

- `feat: add daily habit completion`
- `feat: add goal tracking`
- `feat: add weekly progress review`
- `fix: preserve habit state after restart`
- `test: add streak calculation coverage`
- `refactor: move habit logic into repository layer`
- `chore: update android build tooling`

## Claude Code safety rules

Claude should:

- Inspect before changing.
- Avoid destructive database operations.
- Avoid wholesale rewrites when a small change works.
- Keep unrelated files untouched.
- Explain meaningful architecture changes.
- Run Gradle checks after implementation.
- Keep commits logically separated.

## Suggested CI baseline

A future GitHub Actions workflow should run:

```bash
./gradlew test
./gradlew lint
./gradlew assembleDebug
```

The exact tasks should be confirmed against the repository because task names/configuration can vary.

## Pull request checklist

- [ ] Builds successfully
- [ ] Tests pass
- [ ] Lint passes / known issues documented
- [ ] No user data migration risk
- [ ] UI tested on emulator/device
- [ ] Documentation updated
- [ ] Screenshots attached for major UI changes
- [ ] No secrets committed
