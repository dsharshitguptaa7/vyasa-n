# Atharva Veda (NIVARAN-AI) Backend Module
**Domain:** Grievance Redressal & Institutional Well-Being  
**Parent System:** VYASA Ecosystem (CSJMU)  
**Status:** Active Modular Monolith Integration Boundary

## Scope
Atharva Veda encapsulates the complete grievance redressal, accountable hierarchical forwarding, multi-policy committee voting, and cryptographic dossier archiving systems of NIVARAN-AI.

## In-Process Monolith Integration
Unlike the obsolete microservice design (which expected an external service on port 8001), Atharva Veda / NIVARAN operates directly as an in-process module of the single VYASA backend application. It shares the single PostgreSQL database (`vyasa_db`) using the canonical `nivaran_*` table namespace.

## Module Structure
- `router.py`: FastAPI routes mounted under `/api/modules/atharva-veda/nivaran`.
- `models/`: SQLAlchemy data models (reserved namespace `nivaran_*`).
- `schemas/`: Pydantic request/response validation schemas.
- `services/`: Encapsulated domain business logic.
- `dependencies.py`: Dependency injection hooks and RBAC guards.
