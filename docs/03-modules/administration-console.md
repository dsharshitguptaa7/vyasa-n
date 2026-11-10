# INSTITUTIONAL ADMINISTRATION CONSOLE AUDIT

**Domain:** Platform Governance, Master Taxonomy, Authority Hierarchy & Audit Trail  
**Subsystem Code:** `admin` (`app.admin`)  
**Current Audit Date:** November 7, 2026  
**Implementation Classification:** **IMPLEMENTED (CORE OPERATIONAL)**  

---

## 1. Subsystem Overview & Institutional Mandate

The Institutional Administration Console provides CSJMU leadership, the Registrar's office, and technical system administrators with master control over platform configuration, academic taxonomies, routing rules, and security policies.

To protect the neutrality of academic and disciplinary investigations, the Administration Console is **strictly decoupled** from individual case deliberations. Administrators manage the governance framework (authorities, clusters, subjects, categories) rather than directly ruling on student grievances.

---

## 2. Key Administrative Workspaces & Features

### 1. Master Academic Taxonomy Management
- **Frontend Pages:** [`SubjectClustersPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/atharva/SubjectClustersPage.tsx), [`SubjectsPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/atharva/SubjectsPage.tsx)
- **Backend Endpoints:** `GET`, `POST`, `PATCH`, `DELETE` under `/api/admin/atharva/subject-clusters` and `/subjects`
- **Features:**
  - Manages all 56 officially recognized CSJMU academic subjects (e.g. Physics, Chemistry, Law, Education, Ancient Indian History).
  - Groups subjects into hierarchical Subject Clusters.
  - Remaps individual subjects between clusters with automatic dependency conflict detection (rejects deletion of subjects linked to active applicant profiles or historical cases).

### 2. Grievance Clusters & Category TAT Configuration
- **Frontend Pages:** [`GrievanceClustersPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/atharva/GrievanceClustersPage.tsx), [`GrievanceCategoriesPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/atharva/GrievanceCategoriesPage.tsx)
- **Backend Endpoints:** `GET`, `POST`, `PATCH`, `DELETE` under `/api/admin/atharva/grievance-clusters` and `/categories`
- **Features:**
  - Manages functional grievance classifications (Academic, Examinations, Financial, Hostel/Infrastructure).
  - Sets formal Service Level Agreements (Turn-Around-Time in calendar days) and priority defaults per category.
  - **Routing Simulator:** Interactive tool allowing administrators to simulate subject and category combinations to verify that algorithmic routing targets the intended Assistant Dean and Associate Dean.

### 3. Institutional Authority Roster & Office Transfer
- **Frontend Page:** [`AuthoritiesPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/atharva/AuthoritiesPage.tsx)
- **Backend Endpoints:** `GET`, `POST`, `PATCH /api/admin/atharva/authorities`, `POST /.../authorities/{id}/transfer`
- **Features:**
  - Onboards faculty members into statutory authority roles (`ASSISTANT_DEAN`, `ASSOCIATE_DEAN`, `DEAN`, `MANAGER`).
  - **Atomic Office Transfer:** When a faculty officer is relieved or appointed, the administrator executes an office transfer. In a single database transaction, all assigned subject clusters and active cases are transferred to the incoming successor, while logging a permanent audit record.

### 4. Platform-Wide Immutable Audit Log Explorer
- **Frontend Page:** [`AuditLogsPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/atharva/AuditLogsPage.tsx)
- **Backend Endpoints:** `GET /api/admin/audit-logs`, `GET /api/admin/atharva/audit-logs`
- **Features:**
  - Comprehensive inspection of all sensitive system events (password updates, 2FA enrollments, category overrides, committee charters, vote tallies, e-file seals).
  - Multi-dimensional filtering by Module (`auth`, `nivaran`, `sama`, `admin`), Action string, Actor User ID, Date Range, and Client IP.
  - JSON payload inspector displaying before/after snapshots of modified entities.

---

## 3. Discovered Vulnerabilities & Known Limitations

1. **Role Delegation Granularity (Governance - Medium):**
   - Currently, a single `super_admin` role possesses all configuration permissions. Introducing sub-administrative roles (e.g., `Taxonomy_Manager`, `Auditor_ReadOnly`) would adhere more strictly to the principle of least privilege.
2. **Audit Log Export (Operational - Low):**
   - The Audit Log Explorer does not currently offer a one-click CSV/PDF export button for offline statutory syndicate reviews.
