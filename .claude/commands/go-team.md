---
description: Spawn Go expert team for review, design, or spec input
argument-hint: <objective — e.g. "review pkg/auth for race conditions" or "design retry layer for ingest pipeline">
---

# Go Expert Team

You are the team lead. Form an agent team of Go experts to address the objective below.

## Objective

$ARGUMENTS

## Instructions

1. Read the objective. Identify which domains it touches (style, architecture, reliability, perf, qa, plus any specialty area).
2. Spawn the **core teammates** that apply. Skip any core teammate whose lens is irrelevant — five focused teammates outperform five scattered ones.
3. Spawn **conditional teammates** only if the objective explicitly involves their domain.
4. Each teammate must **invoke their listed skills first** (via the Skill tool), then act on the objective. Auto-trigger is unreliable for niche tasks — be explicit.
5. Use Sonnet for every teammate unless the objective demands deeper reasoning.
6. Wait for all teammates to finish before synthesizing. Do not start implementing yourself while teammates work.
7. After synthesis, surface conflicts between teammates' findings rather than papering over them.

## Core teammates

Spawn the relevant subset based on the objective.

- **stylist** — invoke skills: `cc-skills-golang:golang-code-style`, `cc-skills-golang:golang-naming`, `cc-skills-golang:golang-modernize`, `cc-skills-golang:golang-lint`, `cc-skills-golang:golang-documentation`. Lens: idiomatic Go, naming conventions, modern features, godoc quality, lint hygiene.

- **architect** — invoke skills: `cc-skills-golang:golang-design-patterns`, `cc-skills-golang:golang-project-layout`, `cc-skills-golang:golang-dependency-injection`, `cc-skills-golang:golang-structs-interfaces`, `cc-skills-golang:golang-dependency-management`. Lens: structure, composition, interface segregation, dependency wiring, package boundaries.

- **reliability** — invoke skills: `cc-skills-golang:golang-error-handling`, `cc-skills-golang:golang-safety`, `cc-skills-golang:golang-concurrency`, `cc-skills-golang:golang-context`, `cc-skills-golang:golang-data-structures`. Lens: error flow, nil safety, race conditions, cancellation, resource lifecycle, data structure correctness.

- **perf** — invoke skills: `cc-skills-golang:golang-performance`, `cc-skills-golang:golang-benchmark`, `cc-skills-golang:golang-observability`. Lens: hot paths, allocation, measurement methodology, production signals (logs/metrics/traces).

- **qa** — invoke skills: `cc-skills-golang:golang-security`, `cc-skills-golang:golang-testing`, `cc-skills-golang:golang-stretchr-testify`, `cc-skills-golang:golang-troubleshooting`. Lens: vulnerabilities, test coverage and quality, debugging methodology.

## Conditional teammates

Spawn ONLY if the objective involves the domain.

- **cli-expert** — skill: `cc-skills-golang:golang-cli`. Spawn if work touches CLI tooling, cobra/viper, flag parsing, exit codes, shell completion.
- **grpc-expert** — skill: `cc-skills-golang:golang-grpc`. Spawn if work involves gRPC, protobuf, interceptors, streaming RPCs.
- **db-expert** — skill: `cc-skills-golang:golang-database`. Spawn if work involves SQL queries, transactions, migrations, connection pooling.
- **ci-expert** — skill: `cc-skills-golang:golang-continuous-integration`. Spawn if work involves GitHub Actions, release pipelines, SAST setup.
- **libs-expert** — skill: `cc-skills-golang:golang-popular-libraries`. Spawn if work involves choosing or evaluating new dependencies.

## Notes

- This codebase does NOT use samber packages — never spawn samber-skill teammates and never suggest samber libraries.
- Teammates load skills from user settings automatically, but listing them in the spawn prompt forces explicit invocation rather than relying on auto-trigger.
- If the objective is ambiguous, ask the user one clarifying question before spawning.
