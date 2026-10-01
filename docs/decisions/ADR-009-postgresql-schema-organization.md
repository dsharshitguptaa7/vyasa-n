# ADR-009: PostgreSQL Schema Organization Strategy for Modular Monolith
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** PostgreSQL Database Architecture across VYASA Core & Veda Domains

---

## Context
VYASA is a single application modular monolith operating on a single PostgreSQL 16+ database instance (`vyasa_db` hosted on Neon serverless). As VYASA integrates Core platform entities (identity, RBAC, notifications, audit logging) with Atharva Veda (NIVARAN grievance redressal: ~35 domain entities) and future Veda modules (Rig, Yajur, Sama: ~10-15 entities each), the database must support clean domain boundaries, referential integrity, and maintainable migrations.

We evaluated three potential PostgreSQL organization patterns:
1. **Option 1: Single PostgreSQL Schema (`public`) with Structured Table Prefixes**  
   All tables live in the standard `public` schema. Core entities use clean base names (`users`, `roles`, `applicant_profiles`, etc.) or `core_*` namespace, while Veda modules use strict prefixes: Atharva Veda uses `nivaran_*`, Rig Veda uses `rig_*`, Yajur Veda uses `yajur_*`, Sama Veda uses `sama_*`.
2. **Option 2: Multi-Schema PostgreSQL Architecture (`core`, `atharva_veda`, `rig_veda`, `yajur_veda`, `sama_veda`, `admin`)**  
   Tables are separated into discrete PostgreSQL schemas (`CREATE SCHEMA ...`). Entities are referenced as `core.users`, `atharva_veda.grievances`, etc.
3. **Option 3: Hybrid Architecture (Core in `public`, Modules in Dedicated Schemas)**  
   Core tables remain in `public`, while individual Veda modules get dedicated logical schemas.

---

## Evaluation & Trade-off Analysis

| Evaluation Criterion | Option 1: Single Schema with Prefixes (`public`) | Option 2: Multi-Schema (`core`, `atharva`, etc.) | Option 3: Hybrid (`public` + module schemas) |
| :--- | :--- | :--- | :--- |
| **Alembic Migration Simplicity** | **High**: Single linear migration lineage, standard autogenerate, zero version table branching. | **Low**: Requires `include_schemas=True`, complex dependency graph across schemas, prone to version tracking conflicts. | **Medium**: Requires custom `include_object` filters and multi-schema version management. |
| **Connection Pooling & Neon Compatibility** | **High**: Zero `search_path` dependency. Works natively with Neon PgBouncer connection pooler in transaction mode. | **Low**: Session-level `SET search_path` is dangerous or ignored under transaction-level pooling in PgBouncer. | **Medium**: Risk of accidental cross-schema query errors if `search_path` is not fully qualified on every SQL query. |
| **Cross-Domain Referential Integrity (FKs)** | **High**: Direct, standard declarative foreign keys (`ForeignKey('users.id')`). | **Medium**: Requires schema qualification in all DDL and ORM models (`ForeignKey('core.users.id')`). | **Medium**: Mixed syntax between unqualified Core and qualified module references. |
| **Tooling & Admin GUI Ergonomics** | **High**: Compatible out-of-the-box with all standard SQL clients (DBeaver, pgAdmin, Prisma Studio, TablePlus) without schema configuration. | **Medium**: Requires explicit configuration of schema search paths in every client tool. | **Medium**: Mixed schema view in GUI tools. |
| **Zero-Downtime Migration of Baseline** | **High**: Zero DDL changes needed for existing baseline tables (`users`, `roles`, `applicant_profiles`, `notifications`). | **Low**: Requires running `ALTER TABLE ... SET SCHEMA core;` on live production tables, breaking existing queries during transition. | **High**: Existing baseline remains in `public`. |
| **Performance Overhead** | **None**: Schema lookup overhead is completely eliminated; single catalog lookup. | **Negligible to Low**: Marginal catalog search overhead if `search_path` contains multiple schemas. | **Negligible**. |

---

## Decision
We select **Option 1: Single PostgreSQL Schema (`public`) with Strict Table Prefixing**:

1. **Schema Location:** All VYASA tables reside in the standard PostgreSQL `public` schema on `vyasa_db`.
2. **Core Domain Tables:** Baseline identity and platform tables retain their canonical, clean names (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `applicant_profiles`, `notifications`, `audit_logs`, `module_registry`, `system_settings`).
3. **Atharva Veda Domain Tables:** All entities belonging to Atharva Veda (NIVARAN grievance redressal) are strictly prefixed with `nivaran_` (e.g., `nivaran_authorities`, `nivaran_subject_clusters`, `nivaran_subjects`, `nivaran_grievance_categories`, `nivaran_grievances`, `nivaran_documents`, `nivaran_routing_records`, `nivaran_approvals`, `nivaran_committees`, `nivaran_committee_members`, `nivaran_committee_polls`, `nivaran_committee_votes`, `nivaran_efiles`, `nivaran_signatures`).
4. **Future Veda Domains:**
   - Rig Veda entities will be strictly prefixed with `rig_` (e.g., `rig_synopses`, `rig_supervisors`, `rig_theses`).
   - Yajur Veda entities will be strictly prefixed with `yajur_` (e.g., `yajur_grants`, `yajur_projects`, `yajur_incentives`).
   - Sama Veda entities will be strictly prefixed with `sama_` (e.g., `sama_awards`, `sama_citations`, `sama_publications`).
5. **Codebase Boundary Enforcement:** Domain boundaries are enforced at the application code level via Python packages (`app.core.models`, `app.modules.atharva_veda.models`, `app.modules.rig_veda.models`, etc.), distinct Pydantic schemas, and modular API routers, rather than artificial PostgreSQL catalog divisions.

---

## Consequences
- **Positive:**
  - 100% compatibility with Neon's serverless architecture and transaction-mode connection poolers.
  - Zero risk of `search_path` configuration errors or accidental query scoping failures.
  - Seamless Alembic migrations: single `alembic_version` table, standard linear revision graphs.
  - Simplified cross-domain joins and declarative foreign key constraints anchoring back to `users.id`.
  - Existing baseline tables remain completely operational without invasive `ALTER TABLE ... SET SCHEMA` migrations.
- **Negative:**
  - Database explorers (e.g. pgAdmin) display all tables in a single schema view. This is fully mitigated by strict alphabetical prefix sorting (`core_*`, `nivaran_*`, `rig_*`, `sama_*`, `yajur_*`).
