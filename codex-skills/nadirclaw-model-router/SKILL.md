---
name: nadirclaw-model-router
description: Route tasks by difficulty, cost, and risk; choose an appropriate model and reasoning effort for simple, medium, or hard work, and use this when the user wants automatic model selection or token-saving task routing.
---

# NadirClaw Model Router

## Use

- Classify the task quickly: simple, medium, hard, or high-stakes.
- Prefer the smallest model and lowest reasoning that can still solve it.
- Escalate one tier when the task is ambiguous, multi-step, or safety-sensitive.
- Use stronger reasoning for code changes, contract edits, debugging, and cross-file work.
- If the task is routine or repetitive, keep the route lean.

## Decision Heuristics

- Simple: short answers, file lookup, trivial edits.
- Medium: single-file implementation, light refactor, straightforward repo work.
- Hard: multi-file changes, debugging, tests, or coordination across components.
- High-stakes: anything safety-sensitive, user-facing money/time cost, or high blast radius.

## Output Habit

- State the chosen tier briefly before acting when the routing choice matters.
- If uncertain, bias upward by one tier.
- Re-evaluate if the task expands during execution.
