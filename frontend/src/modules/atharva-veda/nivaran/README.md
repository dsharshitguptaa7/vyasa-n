# Atharva Veda (NIVARAN-AI) Frontend Module
**Domain:** Grievance Redressal & Institutional Well-Being  
**Parent System:** VYASA Ecosystem (CSJMU)  
**Status:** Active Modular Monolith Integration Phase

## Overview
Atharva Veda represents the grievance redressal and institutional well-being pillar of VYASA. It embeds the NIVARAN-AI case management, accountable hierarchical routing, deliberative committee voting, and cryptographic PDF dossier generation systems directly within the single VYASA frontend application.

## Key Subsystems
- Applicant Grievance Filing & Tracking
- Manager Triage & Accountable Forwarding
- Subject Assistant Dean & Grievance Associate Dean Adjudication
- Special Committee Formations & Deliberative Voting
- Cryptographic Dossier Archival (RSA-3072 + TOTP)

## Module Structure
- `index.ts`: Module entrypoint exporting components, routes, and services.
- `routes.tsx`: Sub-route definitions mounted under `/modules/atharva-veda/nivaran`.
- `pages/`: Page-level dashboard and workspace components.
- `components/`: Domain UI widgets.
- `services/`: API client interactions for Atharva Veda / NIVARAN backend endpoints.
- `types/`: Domain TypeScript contracts.
