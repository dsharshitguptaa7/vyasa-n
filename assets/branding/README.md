# Centralized Ecosystem Branding Assets

This directory contains ecosystem-wide visual identity assets for the VYASA ecosystem and its governing institution:

**Institution**: Chhatrapati Shahu Ji Maharaj University, Kanpur (CSJMU)  
**Product**: VYASA  
**Tagline**: "ज्ञान से शोध तक, AI के साथ"

## Asset Inventory

- `csjmu-logo.png` / `UNIVERSITY LOGO.png`: Official seal/emblem of Chhatrapati Shahu Ji Maharaj University, Kanpur.
- `vyasa-logo.png` / `vyasa_logo.png`: Official emblem of the VYASA research and governance ecosystem.

## Architectural Governance Rules

1. **Ecosystem-Wide Centralization**: These assets are the single source of truth for all applications (`apps/vyasa/frontend`, `apps/pillars/*`, and `apps/pillars/nivaran`).
2. **Zero Duplication**: Do **not** duplicate, copy, or fork university branding assets inside individual pillar directories.
3. **Consumption via `@vyasa/ui`**: All applications and pillars consume branding components through `packages/ui/branding/` to ensure visual consistency.
