# Git workflow

This project uses GitHub Actions to run `npm ci` and `npm run check` on pushes and pull requests. Keep changes reviewable, preserve research provenance, and do not put private inputs or generated decks into Git. The machine-local and repository agent instructions both require following this workflow.

## Branches and pull requests

- `main` is the stable/release line and the current GitHub default branch. `dev` is the integration line. Recheck the remote before relying on this after future repository changes.
- Create a short-lived branch from the latest fetched `origin/dev`, using `codex/<topic>`. Do not develop or commit directly on `main` or `dev`.
- Open a PR back to `dev`. Keep each PR focused on one coherent change. Separate generated reports, dependency/tool integrations, and unrelated documentation when they can be reviewed independently.
- Do not force-push shared branches, rewrite published history, or merge a PR with failing CI. If a branch is already shared, prefer a normal merge commit over rebasing it.
- Before a Git mutation, record status, staged/unstaged summaries, branch tracking, and all worktrees. Never use `git add .`, `git add -A`, `git clean`, or `git reset --hard` as a shortcut. Stage explicit paths only; review the exact staged patch and scan it for secrets/private/generated content before each commit.
- As checked on 2026-11-12, GitHub reported both `main` and `dev` as unprotected and returned no repository rulesets. This guide is not an enforcement mechanism. A repository admin should configure branch rules requiring PRs and the `test-and-build` CI check before treating those safeguards as active.

## Safe daily sequence

Run these from a clean worktree before creating a branch or syncing. If the worktree is dirty, first identify and preserve each change; do not stash blindly when several tasks share the checkout.

```sh
git status --short --branch
git fetch origin
git log --oneline --left-right --graph HEAD...origin/dev
git switch -c codex/<topic> origin/dev
```

On an existing feature branch, fetch and inspect divergence before syncing. Rebase only a private, unpublished branch. Use an explicit `git rebase origin/dev` or merge after saving and reviewing local work; do not rely on `git pull` to choose a history operation implicitly.

Before committing:

```sh
git diff --check
git diff
git diff --cached
git status --short
git diff --cached --name-only
```

Stage only named files for the task (`git add <paths>`), run `git diff --cached --check`, inspect the staged patch, then commit atomically with a short imperative subject, for example `Add isolated PDF image extraction`. Never use `git add .` in a checkout shared by multiple tasks.

## Parallel work and worktrees

Use one branch per task and a separate worktree when concurrent work is needed. Before editing, run `git worktree list --porcelain`; before removing a worktree, verify that it has no uncommitted work and is not the active directory. Resolve any unmerged paths (`UU`) deliberately and inspect both sides; do not reset or delete the worktree to make the status look clean.

## Files and releases

- Keep `outputs/`, `workspace/`, local model/document environments, credentials, downloaded third-party templates, and private research data out of commits. `.gitignore` covers the project's standard local paths; still inspect every staged filename and diff because ignore rules do not protect already tracked files.
- Commit `package-lock.json` with `package.json` whenever dependencies or package engines change. Use `npm ci` in CI and for reproducible local setup.
- Keep generated sample inputs clearly labeled as synthetic or unverified and preserve evidence IDs/source attribution.
- Use semantic version tags (`vMAJOR.MINOR.PATCH`) only for reviewed releases from `main`, after required CI passes. Do not tag an in-progress `dev` snapshot as a release.

## Current repository controls

The checked-in workflow is `.github/workflows/ci.yml` (`test-and-build`). Its checks run on pushes, pull requests, and manual dispatch. There are no Git tags in the local clone, and GitHub returned no repository rulesets. GitHub currently has `main` and `dev`; both were reported unprotected when checked on 2026-11-12. Confirm rules and release permissions in GitHub before treating them as enforced controls.
