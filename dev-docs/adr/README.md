# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) for the Asana CLI project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [001](./001-distribution-strategy.md) | CLI Distribution Strategy | Proposed | 2025-10-25 |

## ADR Template

Each ADR should follow this structure:

- **Title**: ADR-XXX: [Short descriptive title]
- **Status**: Proposed / Accepted / Deprecated / Superseded
- **Context**: What is the issue that we're seeing that is motivating this decision?
- **Decision**: What is the change that we're proposing and/or doing?
- **Consequences**: What becomes easier or more difficult to do because of this change?

## Creating a New ADR

1. Create a new file: `dev-docs/adr/XXX-short-title.md`
2. Use the next available number (XXX)
3. Follow the ADR template structure
4. Update this README.md with the new entry
5. Reference the ADR in relevant issues or PRs
