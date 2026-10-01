# ADR-007: Centralized Database Migration Strategy
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** Relational Schema Evolution & Alembic Versioning

## Context
With multiple applications originally possessing independent Alembic configurations, there was a danger of diverging database versions, conflicting revision IDs, and untracked schema mutations.

## Decision
All relational schema migrations for VYASA are unified under **one central Alembic migration lineage**:
- Located strictly at `apps/vyasa/backend/alembic`.
- Existing baseline migrations (`e09046751800_initial_vyasa_core_schema.py` and `74bfd3bf7936_add_applicant_profiles_table.py`) remain the authoritative foundation.
- All future table additions (Core Audit, Module Registry expansion, Atharva Veda/NIVARAN tables, and future Veda tables) will be authored as linear, sequentially reviewed Alembic revisions.
- Every migration must be idempotent, reversible (`downgrade` implemented), and safe for production zero-downtime execution where feasible.

## Alternatives Considered
- **Decoupled Alembic Instances:** Managing separate Alembic versions against different schemas in the same PostgreSQL database was rejected due to lock contention and complex deployment dependency ordering.
- **Manual Raw SQL DDL:** Rejected due to lack of version tracking and automated rollback capability.

## Consequences
- **Positive:** Single clear source of schema truth; deterministic CI/CD migration deployment; simple local development setup.
- **Negative:** Developers must coordinate migration branches to prevent Alembic branch divergences.
