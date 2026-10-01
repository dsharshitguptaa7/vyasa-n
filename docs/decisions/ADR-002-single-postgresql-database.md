# ADR-002: Consolidation onto a Single PostgreSQL Database
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** Database Architecture across VYASA Core & Veda Modules

## Context
Exploratory phase implementations ran separate database instances for VYASA Core (`ep-nameless-feather`) and NIVARAN (`ep-cool-surf`). Multiple independent databases prevented declarative relational foreign keys, forced brittle cross-service eventual consistency patterns, duplicated user identities, and complicated database backup and disaster recovery operations.

## Decision
All VYASA relational data domains will reside within **ONE central PostgreSQL database instance**:
- **Core Domain:** Universal identity, RBAC roles and permissions, applicant scholar profiles, notifications, audit logging, system settings, and module registry.
- **Veda Modules:** Namespaced tables (`rig_*`, `yajur_*`, `sama_*`, `nivaran_*`) or dedicated PostgreSQL schemas residing within the same database engine.
- Where a genuine business link exists between modules, declarative foreign keys and junction tables are utilized directly.
- Connection pooling is centralized in `app.core.database` with an engineered pool size, timeout, and recycle interval.

## Alternatives Considered
- **Database-per-Service:** Rejected because cross-pillar workflows require ACID guarantees and relational foreign keys back to canonical Core identity entities (`users.id`).
- **Polyglot Persistence (NoSQL for Modules):** Rejected because university governance data is inherently relational, highly structured, and subject to strict regulatory auditing.

## Consequences
- **Positive:** True referential integrity, atomic transactions across related entities, zero synchronization lag, simplified unified backup/restore routines.
- **Negative:** Schema migrations must be orchestrated carefully through a centralized Alembic migration pipeline.
