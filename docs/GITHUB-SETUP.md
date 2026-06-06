# GitHub Setup

Remote:

```text
https://github.com/jike072-collab/codex_sp.git
```

After Git for Windows is installed:

```powershell
git init
git branch -M main
git remote add origin https://github.com/jike072-collab/codex_sp.git
git add .
git commit -m "Initialize modular Shoe Ad Studio"
git push -u origin main
```

Before the first push, review:

```powershell
git status --short
git diff --cached --stat
```

Expected exclusions include `.env`, `input_files/`, `reference_examples/`, `outputs/`, `studio-v2/data/`, logs, and PID files.

## Starting Parallel Work

Each Codex creates one branch from current `main`:

```powershell
git switch main
git pull --ff-only
git switch -c codex/<task>
```

Use the exact branches and ownership scopes in `docs/TASKS.md`. Open one pull request per task.

