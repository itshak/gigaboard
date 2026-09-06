# Contributing

Thank you for the interest! Before you open a PR, please read:

1. [`STANDARDS.md`](STANDARDS.md) — the rules every PR follows.
2. [`TESTING.md`](TESTING.md) — what we test and how.
3. [`PERFORMANCE.md`](PERFORMANCE.md) — budgets you must not regress.
4. [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the pieces fit together.

## Local setup

```bash
git clone https://github.com/itshak/gigaboard.git
cd gigaboard
bun install
bun run turbo build
bun run turbo test
```

Requirements: Bun ≥ 1.3, Node ≥ 20. Node is used only for Playwright and a few tooling scripts; Bun is the primary runtime.

## Everyday loop

```bash
bun run turbo dev              # start docs + watch builds
bun -F gigaboard test --watch
bun run turbo lint             # format + lint
bun run turbo typecheck
bun run turbo test:visual      # Playwright + Loki
bun run turbo bench            # perf regression
bun run turbo size             # bundle sizes
```

Before opening a PR:

```bash
bun run ci                     # the full gate CI will run
```

## PR checklist

- [ ] Tests added/updated and pass locally
- [ ] `bun run ci` passes
- [ ] No new `any`, no new `@ts-ignore`, no new `eslint-disable`
- [ ] No new runtime dependency without a Changeset justifying it
- [ ] Render-count budgets hold (attach `apps/benchmarks` output in the description)
- [ ] Visual regression baselines updated only intentionally
- [ ] Docs / ADR / Changeset included as needed
- [ ] Commit message follows Conventional Commits

## Scope of a PR

One logical change per PR. Refactors and feature work go in separate PRs. If you can't describe the change in one sentence, split it.

## Commit cadence

See [`STANDARDS.md §9.1`](STANDARDS.md#91-commit-cadence--commit-early-commit-often). In short:

- **Commit after every milestone.** When M0, M1, M2, … exit, the milestone
  gets its own commit. No milestone is "done" in memory only.
- **Commit after every heavy decision.** Architectural choices, API shape
  changes, config flips, and docs updates that others rely on each land as
  their own atomic commit.
- **Commit at natural pause points.** Multi-day milestones get checkpoint
  commits as sub-pieces land with their tests.
- **Commit before risky refactors.** Always have a green save point.

`git log --oneline` should read like a sentence telling the story of the repo.

## ADRs

Architectural decisions (new package, rendering-strategy change, API break) need an Architecture Decision Record in `docs/adr/NNN-title.md`, Michael Nygard format. Link it from your PR.

## Changesets

Every user-visible change ships with a Changeset:

```bash
bunx changeset
```

Pick the semver bump (`patch` / `minor` / `major`) and write a one-line user-facing summary. The release workflow aggregates these into `CHANGELOG.md`.

## Getting help

Open a discussion on GitHub if you're stuck. For security issues, email the maintainer directly; do **not** open a public issue.

## License

By contributing, you agree that your contributions are licensed under the same MIT license as the project.
