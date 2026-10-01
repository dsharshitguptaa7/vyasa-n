# ADR-003: Centralized Platform Identity & Universal User Model
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** Identity, Credential Storage & User Authentication

## Context
Decoupled modules often suffer from identity fragmentation, where individual sub-applications implement local user accounts, local password tables, independent session tokens, and divergent hashing standards. This creates severe security hazards, password desynchronization, and poor institutional scholar user experience.

## Decision
All user identities, passwords, authentication mechanisms, and session lifecycles are owned strictly by **VYASA Core**:
- The `users` table in Core is the single source of truth for identity across the entire ecosystem.
- Individual Veda modules (Rig, Yajur, Sama, Atharva) **must never** maintain password hashes, token issuance infrastructure, or duplicate user master records.
- When a module needs to represent domain-specific authority or role jurisdiction (e.g., NIVARAN Assistant Dean for a specific Subject Cluster), it maps directly to `users.id` via an immutable UUID foreign key.
- Scholar academic profiles are unified under `applicant_profiles` linked 1:1 with `users`.

## Alternatives Considered
- **Distributed Token Handoff / Cross-Origin PostMessage:** Deprecated and eliminated in Phase 2 due to security vulnerabilities and fragile window-to-window messaging.
- **Federated Third-Party Identity Provider (Keycloak / Auth0):** Evaluated as an external bridge, but internal Core identity with standard JWT and bcrypt meets CSJMU university requirements without external licensing or vendor lock-in.

## Consequences
- **Positive:** Scholars and faculty log in once; single password reset workflow; zero identity duplication.
- **Negative:** Any downtime in Core Auth affects all modules; mitigated by stateless signed JWT verification.
