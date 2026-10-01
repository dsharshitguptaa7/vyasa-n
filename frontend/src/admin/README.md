# VYASA Admin Subsystem
**Domain:** System Administration & Governance Console  
**Parent System:** VYASA Ecosystem (CSJMU)  
**Status:** Foundational Module Shell

## Overview
The Admin subsystem provides institutional administrative controls for:
- User lifecycle and credential reviews
- Role creation and granular RBAC permission assignments
- Veda Module Registry orchestration (activating/deactivating module availability)
- System-wide configuration variables and maintenance flags
- Immutable audit log inspection

## Subsystem Structure
- `index.ts`: Subsystem entrypoint.
- `routes.tsx`: Sub-route definitions mounted under `/admin`.
- `pages/`: Page-level admin console views.
- `components/`: Administrative cards, tables, and toggles.
- `services/`: API interactions for `/api/admin` and Core endpoints.
- `types/`: Admin data contracts.
