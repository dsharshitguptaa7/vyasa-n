# ADR-006: Internal Application Module Routing vs. External Handoff
**Status:** Approved  
**Date:** 2026-09-28  
**Scope:** Frontend Cross-Pillar Experience & Navigation

## Context
In the obsolete microservices design, navigating from VYASA Core to NIVARAN involved:
1. Opening a secondary browser window or tab via `window.open(nivaranUrl, '_blank')`.
2. Listening on window `message` events in both windows.
3. Transmitting raw JWT Bearer tokens across origins via `postMessage`.
4. Storing tokens separately in the secondary application's localStorage.

This design was inherently fragile, vulnerable to browser popup blockers, subject to cross-origin spoofing risks if origins were misconfigured, and created a disjointed scholar experience.

## Decision
All pillar navigation is consolidated to **Internal Application Routing**:
- The single React 19 application hosts internal module routes (e.g., `/modules/atharva-veda/nivaran`, `/modules/rig-veda`, `/modules/yajur-veda`, `/modules/sama-veda`, `/admin`).
- Navigating to a module is a standard client-side route transition using React Router `navigate()`.
- Authentication tokens and session contexts are naturally shared within the single SPA without cross-window messaging or tokens in query parameters.
- Obsolete `window.open` and `postMessage` listeners are completely eliminated from the modular monolith.

## Alternatives Considered
- **Subdomain Routing with Shared Cookies:** Unnecessary operational overhead for a single unified portal.
- **External Popup Handoff:** Formally deprecated and removed.

## Consequences
- **Positive:** Seamless UX, zero popup blocker friction, elimination of cross-window security attack surface, simplified automated testing.
- **Negative:** None.
