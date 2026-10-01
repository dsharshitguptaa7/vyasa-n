# ADR-008: Documentation-First Architecture & Institutional Knowledge Preservation
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** Engineering Standards, Knowledge Transfer & System Governance

## Context
Academic and institutional enterprise software frequently suffers from catastrophic knowledge decay when initial development teams rotate off the project. If design decisions, data boundaries, and operational procedures are not rigorously documented in code-adjacent Markdown, subsequent teams struggle to extend the platform safely.

## Decision
VYASA mandates a **Documentation-First Architectural Policy**:
1. Documentation is not an optional or secondary post-hoc activity. It is a prerequisite for feature completion.
2. Every Veda module must maintain a standardized 20-point architectural specification covering purpose, actors, workflows, database ownership, APIs, RBAC, and testing.
3. Every fundamental architectural change must be accompanied by an Architecture Decision Record (ADR) under `docs/decisions/`.
4. A dedicated Future Team Development Guide (`docs/development/adding-a-new-module.md`) outlines the explicit 18-step lifecycle for adding new governance capabilities.
5. All documentation is committed directly into the Git repository in `docs/` alongside the code.

## Alternatives Considered
- **External Wiki / Confluence:** Rejected due to desynchronization between external docs and code pull requests.
- **Code Comments Only:** Insufficient for high-level governance, ER design, and audit requirements.

## Consequences
- **Positive:** Guaranteed knowledge preservation for future CSJMU engineering generations; frictionless onboarding; high audit compliance.
- **Negative:** Requires rigorous review effort during code review to keep documentation current with code evolution.
