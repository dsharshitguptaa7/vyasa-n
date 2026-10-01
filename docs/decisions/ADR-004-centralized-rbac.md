# ADR-004: Centralized Role-Based Access Control (RBAC) Architecture
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** Authorization, Permission Verification & Route Guards

## Context
A modular system requires consistent authorization rules. If each module invents its own permission naming schema and authorization checks, privilege escalation bugs and audit blindness inevitably occur.

## Decision
VYASA establishes a **Centralized RBAC Engine** owned by Core:
1. **Generic Platform Roles:** `administrator`, `authority`, `applicant`.
2. **Granular Permission Catalog:** Canonical format `resource:action` (e.g., `users:read`, `users:manage`, `roles:manage`, `modules:manage`, `atharva:submit`, `atharva:triage`, `atharva:vote`, `atharva:sign`).
3. **Defense-in-Depth Principle:**
   - **Frontend route guards and navigation filters provide UX routing only.** Hiding a button is never security.
   - **Backend API dependencies independently enforce authorization on every request** via `require_permission("...")` or `require_role("...")` dependency injection.
4. **Module Permission Delegation:** Veda modules declare their required permissions in the Core Module Registry. Core RBAC evaluates these permissions when a request targets `/api/modules/<veda-name>`.

## Alternatives Considered
- **Attribute-Based Access Control (ABAC):** High runtime evaluation complexity deemed unnecessary for current institutional governance requirements; RBAC with domain jurisdiction entities provides the ideal balance.
- **Frontend-Only Role Checks:** Explicitly rejected as insecure.

## Consequences
- **Positive:** Uniform authorization across all 4 Veda domains; centralized security auditing and permission assignment.
- **Negative:** Adding new module capabilities requires declaring granular permissions in the Core catalog.
