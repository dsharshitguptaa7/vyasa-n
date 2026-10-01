# VYASA Unified API Catalog
**Document Version:** 1.0.0-API  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)  
**Base Path:** `/api`

---

## 1. Core Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service liveness, database ping, uptime | Public |
| `POST` | `/api/auth/login` | Email/password sign-in; returns JWT | Public |
| `POST` | `/api/auth/register` | Applicant account registration | Public |
| `GET` | `/api/auth/me` | Current authenticated user profile | Bearer Token |
| `GET` | `/api/applicant/profile` | Scholar academic profile | Bearer Token (`applicant`) |
| `GET` | `/api/pillars` | List registered governance pillars | Public / Optional Auth |
| `GET` | `/api/users` | List institutional users | Bearer Token (`authority` / `admin`) |
| `GET` | `/api/roles` | List system roles | Bearer Token (`admin`) |
| `GET` | `/api/permissions` | List RBAC permissions | Bearer Token (`admin`) |
| `GET` | `/api/notifications` | User notification feed | Bearer Token |

---

## 2. Veda Governance Module Endpoints

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/modules/rig-veda/status` | Rig Veda operational & domain status | Public |
| `GET` | `/api/modules/yajur-veda/status` | Yajur Veda operational & domain status | Public |
| `GET` | `/api/modules/sama-veda/status` | Sama Veda operational & domain status | Public |
| `GET` | `/api/modules/atharva-veda/nivaran/status` | Atharva Veda / NIVARAN operational status | Public |
| `GET` | `/api/modules/atharva-veda/nivaran/workspace` | Authenticated scholar/authority workspace context | Bearer Token |

---

## 3. Administration & Operational Telemetry

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/status` | Governance platform metrics & totals | Bearer Token |
| `GET` | `/api/admin/modules` | Detailed module registry descriptors | Bearer Token |
| `GET` | `/api/watchdog/metrics` | Database connection pool telemetry | Public / Health Probe |
