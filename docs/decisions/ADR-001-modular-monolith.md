# ADR-001: Adoption of Single Application Modular Monolith Architecture
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** VYASA Research & Governance Ecosystem (CSJMU)

## Context
Initial exploratory scaffolding in the VYASA repository considered distributing governance pillars across independent frontend and backend applications with separate deployment targets and external message-passing interfaces. However, in an institutional university environment:
1. Operational overhead of managing multiple microservice deployments, ports, and independent database instances creates excessive operational burden.
2. Fragmented security perimeters increase attack surface and risk cross-origin session leaks.
3. Cross-pillar governance workflows (such as a doctoral grievance citing research grant disbursements or thesis milestones) require transactional consistency and relational integrity that microservice boundaries complicate unnecessarily.

## Decision
VYASA is finalized as a **Single Application Modular Monolith**:
- **One Unified Frontend:** A single React 19 application (`apps/vyasa/frontend`).
- **One Unified Backend:** A single FastAPI application (`apps/vyasa/backend`).
- **One Central PostgreSQL Database:** Shared across all core subsystems and Veda modules.

Internally, strict modular boundaries are enforced in both frontend and backend code to maintain high cohesion and low coupling without physical microservice boundaries.

## Alternatives Considered
- **Distributed Microservices:** Separate repositories/containers for each pillar. Rejected due to extreme orchestration complexity, networking latency, and distributed data consistency challenges.
- **Microfrontends via Module Federation:** Rejected due to tooling fragility, CSS token leakage, and runtime version collisions in React 19.

## Consequences
- **Positive:** Single operational deployable, unified authentication and session state, instant cross-module foreign key relationships, zero network latency between modules.
- **Negative:** Requires strict discipline in code reviews to prevent circular dependencies or accidental direct database model mutations across modules.
