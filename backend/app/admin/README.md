# VYASA Admin Backend Subsystem
**Domain:** System Administration & Governance Console  
**Parent System:** VYASA Ecosystem (CSJMU)  
**Status:** Foundational Shell

## Scope
The Admin subsystem exposes secure management endpoints for:
- User activation, verification, and credential lifecycle
- Role and granular permission assignment
- Veda Module Registry configuration and activation
- System-wide operational settings
- Audit trail review

## Structure
- `router.py`: FastAPI routes mounted under `/api/admin`.
- `schemas/`: Pydantic request/response models.
- `services/`: Encapsulated administrative actions.
