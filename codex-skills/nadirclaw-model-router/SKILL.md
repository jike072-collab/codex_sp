---
name: nadirclaw-model-router
description: Mandatory first skill for every task in this repository; route work by difficulty, cost, and risk and choose the appropriate model and reasoning effort before any inspection, edit, review, Git operation, or test.
---

# NadirClaw Model Router

## Repository Requirement

Invoke this skill first on every task and resumed task. After routing, invoke
`$superpowers-workflow` before implementation.

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
