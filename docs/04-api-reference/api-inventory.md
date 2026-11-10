# VYASA-N — COMPLETE API ROUTE INVENTORY

**Audit Date:** November 7, 2026  
**Total Routes Cataloged:** 122 Endpoints  
**Base Route Prefix:** `/api`  

---

## 1. Authentication & Identity Routes (`/api/auth/*`)

| HTTP Method | Route Endpoint | Purpose / Scope | Auth Required | Required Permission | Implementation File |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/auth/register` | Register new student/applicant profile | Public | None | `routes/auth.py#L1145` |
| `POST` | `/api/auth/login` | Unified credential login & password verification | Public | None | `routes/auth.py#L175` |
| `POST` | `/api/auth/first-login/set-password` | Mandatory first-login permanent password reset | Challenge | `PASSWORD_CHANGE_REQUIRED` | `routes/auth.py#L406` |
| `POST` | `/api/auth/2fa/setup` | Generate TOTP secret seed & QR code SVG | Challenge | `TWO_FACTOR_SETUP` | `routes/auth.py#L538` |
| `POST` | `/api/auth/2fa/confirm-setup` | Validate first TOTP token and enable 2FA | Challenge | `TWO_FACTOR_SETUP` | `routes/auth.py#L612` |
| `POST` | `/api/auth/2fa/verify` | Validate 6-digit TOTP token during routine login | Challenge | `TWO_FACTOR_LOGIN` | `routes/auth.py#L725` |
| `POST` | `/api/auth/2fa/recovery` | Authenticate using one-time 8-character backup code | Challenge | `TWO_FACTOR_LOGIN` | `routes/auth.py#L867` |
| `GET` | `/api/auth/2fa/status` | Inspect active 2FA enrollment status | Bearer JWT | Authenticated User | `routes/auth.py#L973` |
| `POST` | `/api/auth/2fa/recovery-codes/regenerate` | Regenerate new set of 8 emergency backup codes | Bearer JWT | Authenticated User | `routes/auth.py#L1002` |
| `GET` | `/api/auth/me` | Retrieve profile and active role claims | Bearer JWT | Authenticated User | `routes/auth.py#L1067` |
| `POST` | `/api/auth/verify` | Validate JWT token integrity and expiration | Bearer JWT | Authenticated User | `routes/auth.py#L1079` |
| `GET` | `/api/auth/subjects` | Public listing of all 56 academic subjects | Public | None | `routes/auth.py#L1132` |

---

## 2. Core Governance & Identity Routes

| HTTP Method | Route Endpoint | Purpose / Scope | Auth Required | Required Permission | Implementation File |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/applicant/profile` | Retrieve applicant academic profile dossier | Bearer JWT | `applicant` role | `routes/applicant.py#L18` |
| `GET` | `/api/health` | Liveness health probe | Public | None | `routes/health.py#L14` |
| `GET` | `/api/health/db` | Database readiness connection check | Public | None | `routes/health.py#L22` |
| `GET` | `/api/pillars` | List presentation metadata for ecosystem pillars | Public | None | `routes/pillars.py#L12` |
| `GET` | `/api/pillars/{slug}` | Detail metadata for specific pillar | Public | None | `routes/pillars.py#L23` |
| `GET` | `/api/users` | List platform users | Bearer JWT | `super_admin` | `routes/users.py#L14` |
| `GET` | `/api/users/{id}` | Inspect specific user account | Bearer JWT | `super_admin` | `routes/users.py#L26` |
| `POST` | `/api/users` | Create user account | Bearer JWT | `super_admin` | `routes/users.py#L36` |
| `GET` | `/api/roles` | List all platform roles | Bearer JWT | Authenticated | `routes/roles.py#L12` |
| `GET` | `/api/roles/{id_or_name}` | Get role details and mapped permissions | Bearer JWT | Authenticated | `routes/roles.py#L22` |
| `GET` | `/api/permissions` | List all granular system permissions | Bearer JWT | Authenticated | `routes/permissions.py#L12` |

---

## 3. Centralized Notification Routes (`/api/notifications/*`)

| HTTP Method | Route Endpoint | Purpose / Scope | Auth Required | Required Permission | Implementation File |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/notifications` | Paginated listing of user notifications | Bearer JWT | Authenticated | `routes/notifications.py#L22` |
| `GET` | `/api/notifications/summary` | Unread notifications badge count | Bearer JWT | Authenticated | `routes/notifications.py#L46` |
| `GET` | `/api/notifications/pillars` | List supported notification pillars | Bearer JWT | Authenticated | `routes/notifications.py#L60` |
| `POST` | `/api/notifications` | Create individual notification | Bearer JWT | `super_admin` / Internal | `routes/notifications.py#L74` |
| `POST` | `/api/notifications/events` | Bulk event notification dispatch | Bearer JWT | Internal Service | `routes/notifications.py#L90` |
| `PATCH` | `/api/notifications/{id}/read` | Mark specific notification as read | Bearer JWT | Authenticated Owner | `routes/notifications.py#L106` |
| `POST` | `/api/notifications/mark-all-read` | Mark all user notifications as read | Bearer JWT | Authenticated Owner | `routes/notifications.py#L125` |
| `GET` | `/api/notifications/preferences` | Retrieve user notification channel preferences | Bearer JWT | Authenticated Owner | `routes/notifications.py#L139` |
| `PUT` | `/api/notifications/preferences` | Update notification channel preferences | Bearer JWT | Authenticated Owner | `routes/notifications.py#L152` |

---

## 4. Atharva Veda &bull; NIVARAN-AI Subsystem Routes

| HTTP Method | Route Endpoint | Purpose / Scope | Auth Required | Required Permission / Scope | Implementation File |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/modules/atharva-veda/nivaran/status` | Module boundary status | Public | None | `nivaran/router.py#L65` |
| `GET` | `/.../workspace` | Summary stats for authenticated user | Bearer JWT | Authenticated | `nivaran/router.py#L82` |
| `GET` | `/.../me` | Current authority appointment details | Bearer JWT | Authenticated Authority | `nivaran/router.py#L108` |
| `GET` | `/.../taxonomy/subjects` | Active subjects taxonomy | Public | None | `nivaran/router.py#L132` |
| `GET` | `/.../taxonomy/categories` | Approved grievance categories and TAT | Public | None | `nivaran/router.py#L147` |
| `POST` | `/.../grievances/ocr/extract` | Extract text from uploaded document | Bearer JWT | `applicant` | `nivaran/router.py#L162` |
| `POST` | `/.../grievances` | Submit new grievance case | Bearer JWT | `applicant` | `nivaran/router.py#L206` |
| `GET` | `/.../grievances/my` | List cases submitted by caller | Bearer JWT | `applicant` | `nivaran/router.py#L263` |
| `GET` | `/.../grievances/{id}` | Inspect grievance details & timeline | Bearer JWT | Applicant or Assigned Authority | `nivaran/router.py#L295` |
| `POST` | `/.../grievances/{id}/documents` | Upload supplementary document | Bearer JWT | Case Participant | `nivaran/router.py#L351` |
| `GET` | `/.../documents/{id}/download` | Stream uploaded evidence document | Bearer JWT | Case Participant | `nivaran/router.py#L398` |
| `GET` | `/.../manager/queue` | List cases awaiting intake triage | Bearer JWT | `manager` | `nivaran/router.py#L442` |
| `PATCH`| `/.../grievances/{id}/ai-review` | Inspect ML category prediction | Bearer JWT | `manager` | `nivaran/router.py#L465` |
| `GET` | `/.../manager/grievances/{id}/preview-routing` | Preview routing destination | Bearer JWT | `manager` | `nivaran/router.py#L510` |
| `POST` | `/.../manager/grievances/{id}/review` | Dispatch case to Assistant Dean | Bearer JWT | `manager` | `nivaran/router.py#L540` |
| `GET` | `/.../assistant-dean/queue` | List cases assigned to Assistant Dean | Bearer JWT | `assistant_dean` | `nivaran/router.py#L598` |
| `GET` | `/.../assistant-dean/cases` | Ledger of active & resolved cases | Bearer JWT | `assistant_dean` | `nivaran/router.py#L622` |
| `GET` | `/.../assistant-dean/grievances/{id}`| Detailed case view with actions | Bearer JWT | Assigned `assistant_dean` | `nivaran/router.py#L655` |
| `POST` | `/.../assistant-dean/grievances/{id}/resolve` | Record formal case resolution | Bearer JWT | Assigned `assistant_dean` | `nivaran/router.py#L690` |
| `POST` | `/.../assistant-dean/grievances/{id}/forward` | Forward case upward to Associate Dean | Bearer JWT | Assigned `assistant_dean` | `nivaran/router.py#L745` |
| `POST` | `/.../assistant-dean/grievances/{id}/document-requests`| Request evidence from student | Bearer JWT | Assigned `assistant_dean` | `nivaran/router.py#L798` |
| `GET` | `/.../grievances/{id}/document-requests`| List outstanding document requests | Bearer JWT | Case Participant | `nivaran/router.py#L845` |
| `POST` | `/.../assistant-dean/grievances/{id}/committee-requests`| Petition for inquiry committee | Bearer JWT | Assigned `assistant_dean` | `nivaran/router.py#L870` |
| `POST` | `/.../committees/requests/{id}/review` | Review committee petition | Bearer JWT | `associate_dean` or `dean` | `nivaran/router.py#L920` |
| `POST` | `/.../committees/direct` | Charter committee directly | Bearer JWT | `associate_dean` or `dean` | `nivaran/router.py#L985` |
| `GET` | `/.../committees/requests` | List pending committee petitions | Bearer JWT | `associate_dean` or `dean` | `nivaran/router.py#L1040` |
| `GET` | `/.../committees` | Directory of university committees | Bearer JWT | Authority | `nivaran/router.py#L1085` |
| `GET` | `/.../committees/overview-metrics` | High-level committee metrics | Bearer JWT | Authority | `nivaran/router.py#L1120` |
| `GET` | `/.../committees/{id}` | Inspect committee workspace details | Bearer JWT | Committee Member or Dean | `nivaran/router.py#L1150` |
| `POST` | `/.../committees/{id}/dissolve` | Formally dissolve committee | Bearer JWT | Committee Chairperson or Dean | `nivaran/router.py#L1190` |
| `GET` | `/.../committees/{id}/messages` | List committee chat deliberation messages | Bearer JWT | Committee Member | `nivaran/router.py#L1230` |
| `POST` | `/.../committees/{id}/messages` | Post message to committee chat | Bearer JWT | Committee Member | `nivaran/router.py#L1265` |
| `POST` | `/.../committees/{id}/ws-ticket` | Mint single-use WebSocket ticket | Bearer JWT | Committee Member | `nivaran/router.py#L1305` |
| `WS` | `/.../committees/{id}/ws` | Real-time committee deliberation socket | WS Ticket | Committee Member | `nivaran/router.py#L1340` |
| `GET` | `/.../committees/{id}/polls` | List committee polls and ballots | Bearer JWT | Committee Member | `nivaran/router.py#L1380` |
| `POST` | `/.../committees/{id}/polls` | Launch consensus poll | Bearer JWT | Committee Member | `nivaran/router.py#L1415` |
| `POST` | `/.../committees/polls/{id}/vote` | Cast cryptographically hashed ballot | Bearer JWT | Eligible Committee Voter | `nivaran/router.py#L1460` |
| `POST` | `/.../committees/polls/{id}/close`| Formally close voting poll | Bearer JWT | Poll Creator or Chairperson | `nivaran/router.py#L1510` |
| `GET` | `/.../committees/{id}/meetings` | List scheduled hearings | Bearer JWT | Committee Member | `nivaran/router.py#L1545` |
| `POST` | `/.../committees/{id}/meetings` | Schedule Google Meet hearing | Bearer JWT | Committee Member | `nivaran/router.py#L1580` |
| `GET` | `/.../committees/{id}/documents`| List confidential evidence docs | Bearer JWT | Committee Member | `nivaran/router.py#L1645` |
| `POST` | `/.../committees/{id}/documents`| Upload in-camera evidence document | Bearer JWT | Committee Member | `nivaran/router.py#L1680` |
| `GET` | `/.../committees/{id}/decisions`| List formal resolutions & minutes | Bearer JWT | Committee Member | `nivaran/router.py#L1720` |
| `POST` | `/.../committees/{id}/decisions`| Submit formal committee resolution | Bearer JWT | Committee Chairperson | `nivaran/router.py#L1755` |
| `GET` | `/.../associate-dean/dashboard` | Cluster performance dashboard | Bearer JWT | `associate_dean` | `nivaran/router.py#L1810` |
| `POST` | `/.../associate-dean/grievances/{id}/resolve` | Record cluster resolution | Bearer JWT | Assigned `associate_dean` | `nivaran/router.py#L1850` |
| `POST` | `/.../associate-dean/grievances/{id}/escalate`| Escalate case to Dean | Bearer JWT | Assigned `associate_dean` | `nivaran/router.py#L1895` |
| `GET` | `/.../dean/dashboard` | University-wide executive dashboard | Bearer JWT | `dean` | `nivaran/router.py#L1940` |
| `GET` | `/.../dean/cases` | Unrestricted case ledger | Bearer JWT | `dean` | `nivaran/router.py#L1975` |
| `POST` | `/.../grievances/{id}/feedback` | Submit applicant rating (1-5 stars) | Bearer JWT | Case Applicant | `nivaran/router.py#L2015` |
| `GET` | `/.../manager/closure-queue` | List resolved cases awaiting closure | Bearer JWT | `manager` | `nivaran/router.py#L2060` |
| `POST` | `/.../manager/grievances/{id}/finalize-closure`| Verify & trigger e-file seal | Bearer JWT | `manager` | `nivaran/router.py#L2100` |
| `GET` | `/.../e-files` | List sealed electronic dossiers | Bearer JWT | Authenticated | `nivaran/router.py#L2145` |
| `GET` | `/.../e-files/{id}/download` | Download sealed e-file PDF | Bearer JWT | Authorized User | `nivaran/router.py#L2180` |
| `GET` | `/.../e-files/{id}/verify` | Verify SHA-256 seal integrity | Bearer JWT | Authorized User | `nivaran/router.py#L2210` |
| `GET` | `/.../student-records/me` | Inspect own longitudinal student record| Bearer JWT | `applicant` | `nivaran/router.py#L2245` |
| `GET` | `/.../student-records/search` | Search master student records | Bearer JWT | Authority | `nivaran/router.py#L2280` |

---

## 5. Sama Veda &bull; ANVESHAN / SAMIKSHA Routes

| HTTP Method | Route Endpoint | Purpose / Scope | Auth Required | Required Permission | Implementation File |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/modules/sama-veda/status` | Module status | Public | None | `sama_veda/router.py#L77` |
| `GET` | `/api/modules/sama-veda/publications` | List public research papers | Public | None | `sama_veda/router.py#L94` |
| `GET` | `/.../publications/{slug}` | Detail view of publication | Public | None | `sama_veda/router.py#L135` |
| `GET` | `/.../bulletins` | List published research bulletins | Public | None | `sama_veda/router.py#L165` |
| `GET` | `/.../bulletins/{id}` | Inspect bulletin metadata | Public | None | `sama_veda/router.py#L205` |
| `GET` | `/.../bulletins/{id}/download`| Download bulletin PDF file | Public | None | `sama_veda/router.py#L235` |
| `GET` | `/.../bulletins/{id}/view` | Stream bulletin PDF for in-browser viewer| Public | None | `sama_veda/router.py#L265` |
| `GET` | `/.../cam-projects` | List CAM sponsored projects | Public | None | `sama_veda/router.py#L305` |
| `GET` | `/.../spotlights` | List featured faculty spotlights | Public | None | `sama_veda/router.py#L355` |
| `GET` | `/.../fellowships` | List fellowship schemes | Public | None | `sama_veda/router.py#L395` |
| `GET` | `/.../authors` | Directory of verified faculty authors | Public | None | `sama_veda/router.py#L435` |
| `GET` | `/.../certificates/verify/{number}`| Public QR certificate verification | Public | None | `sama_veda/router.py#L485` |
| `GET` | `/.../certificates/download/{number}`| Download authentic certificate PDF | Public | None | `sama_veda/router.py#L540` |

---

## 6. Institutional Administration & CMS Routes (`/api/admin/*`)

| HTTP Method | Route Endpoint | Purpose / Scope | Auth Required | Required Permission | Implementation File |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `GET` | `/api/admin/status` | Platform-wide administrative metrics | Bearer JWT | `super_admin` | `admin/router.py#L14` |
| `GET` | `/api/admin/modules` | Governance modules registry | Bearer JWT | `super_admin` | `admin/router.py#L40` |
| `GET` | `/api/admin/audit-logs` | Platform-wide audit log explorer | Bearer JWT | `super_admin` | `admin/router.py#L64` |
| `GET` | `/api/admin/atharva/authorities` | List institutional authorities roster | Bearer JWT | `super_admin` | `atharva_admin_router.py#L45` |
| `POST` | `/api/admin/atharva/authorities` | Onboard new authority official | Bearer JWT | `super_admin` | `atharva_admin_router.py#L75` |
| `POST` | `/api/admin/atharva/authorities/{id}/transfer` | Execute atomic office transfer | Bearer JWT | `super_admin` | `atharva_admin_router.py#L125` |
| `GET` | `/api/admin/atharva/subjects` | Manage 56 academic subjects | Bearer JWT | `super_admin` | `atharva_admin_router.py#L190` |
| `POST` | `/api/admin/atharva/subjects` | Add new academic discipline | Bearer JWT | `super_admin` | `atharva_admin_router.py#L225` |
| `GET` | `/api/admin/atharva/categories` | Manage grievance categories & TAT | Bearer JWT | `super_admin` | `atharva_admin_router.py#L310` |
| `POST` | `/api/admin/atharva/routing/simulate` | Test routing algorithm | Bearer JWT | `super_admin` | `atharva_admin_router.py#L390` |
| `GET` | `/api/admin/sama/publications` | CMS: List and filter publications | Bearer JWT | `sama_content_admin` | `sama_admin_router.py#L65` |
| `POST` | `/api/admin/sama/publications` | CMS: Create new publication record | Bearer JWT | `sama_content_admin` | `sama_admin_router.py#L110` |
| `POST` | `/api/admin/sama/bulletins/upload` | CMS: Upload bulletin PDF file | Bearer JWT | `sama_content_admin` | `sama_admin_router.py#L220` |
| `POST` | `/api/admin/sama/certificates` | CMS: Issue merit certificate with QR | Bearer JWT | `sama_content_admin` | `sama_admin_router.py#L350` |
| `POST` | `/api/admin/sama/certificates/{id}/revoke`| CMS: Revoke certificate with reason | Bearer JWT | `sama_content_admin` | `sama_admin_router.py#L415` |
| `POST` | `/api/admin/sama/import/preview` | Preview Excel/CSV publication batch | Bearer JWT | `sama_content_admin` | `sama_admin_router.py#L520` |
| `POST` | `/api/admin/sama/import/execute/{id}` | Execute batch insertion transaction | Bearer JWT | `sama_content_admin` | `sama_admin_router.py#L580` |

---

## 7. Public Ph.D. RAG & Boundary Routes

| HTTP Method | Route Endpoint | Purpose / Scope | Auth Required | Rate Limiting | Implementation File |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `POST` | `/api/public/phd-admission/chat` | Natural language grounded chat | Public | 20 req/min/IP | `phd_rag/router.py#L31` |
| `GET` | `/api/public/phd-admission/suggested-questions`| Dynamic suggestion prompts | Public | None | `phd_rag/router.py#L140` |
| `GET` | `/api/public/phd-admission/status` | Ingestion status & chunk counts | Public | None | `phd_rag/router.py#L160` |
| `GET` | `/api/modules/rig-veda/status` | Rig Veda architectural boundary | Public | None | `rig_veda/router.py#L8` |
| `GET` | `/api/modules/yajur-veda/status` | Yajur Veda architectural boundary | Public | None | `yajur_veda/router.py#L8` |
| `GET` | `/api/watchdog/metrics` | Database pool operational telemetry | Bearer JWT | `super_admin` | `watchdog/router.py#L10` |
