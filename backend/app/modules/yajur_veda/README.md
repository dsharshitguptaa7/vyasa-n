# Yajur Veda Backend Module
**Domain:** Research Administration & Incentives  
**Parent System:** VYASA Ecosystem (CSJMU)  
**Status:** Planned Architectural Boundary

## Scope
Yajur Veda automates administrative and financial research governance including research project sanctioning, ethics committee reviews, incentive calculations, and funding compliance.

## Module Structure
- `router.py`: FastAPI routes mounted under `/api/modules/yajur-veda`.
- `models/`: SQLAlchemy data models (reserved namespace `yajur_*`).
- `schemas/`: Pydantic request/response validation schemas.
- `services/`: Encapsulated domain business logic.
- `dependencies.py`: Dependency injection hooks and RBAC guards.
