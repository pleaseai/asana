# Product Guide

> Stable product context for the Asana CLI. Consulted before planning and implementation.

## Vision

A fast, scriptable command-line interface for managing Asana tasks without leaving the
terminal. Built for developers and power users who live in the shell and want Asana
workflows to be automatable, pipeable, and quick.

## Target Users

- **Developers** who manage their own work in Asana and prefer terminal-native tooling.
- **Power users / team leads** who want to script repetitive Asana operations
  (bulk task creation, status sweeps, reporting).
- **Automation / CI authors** who need machine-readable Asana output (TOON/JSON) to
  pipe into other tools.

## Goals

- Provide first-class CRUD over Asana **tasks**, **projects**, and **sections** from the CLI.
- Support both **OAuth 2.0** and **Personal Access Token** authentication, with automatic
  OAuth token refresh.
- Offer **multiple output formats** — TOON (token-efficient), JSON (machine-readable),
  and Plain (human-readable) — selectable per command.
- Stay **fast** by leveraging the Bun runtime and shipping as a compiled single binary.
- Distribute easily via Homebrew, an install script, and source builds.

## Core Features

- **Authentication**: `auth login` via PAT or OAuth, automatic token refresh, default
  workspace configuration.
- **Tasks**: create, list, complete, and delete tasks.
- **Projects & Sections**: manage projects and their sections.
- **Self-update**: `self-update` command to upgrade the installed binary.
- **Output formatting**: switchable TOON / JSON / Plain output for interactive and
  scripted use.

## Non-Goals

- Not a full Asana web-UI replacement; focuses on the most common task-management flows.
- Not a long-running daemon or sync service; each invocation is a discrete command.
- No GUI; terminal-only by design.

## Constraints

- Requires the **Bun** runtime for development; ships as a compiled binary for end users.
- Depends on the official **Asana API** and its rate limits / availability.
- Secrets (tokens) must never be logged; managed via dotenvx-encrypted environment files.
