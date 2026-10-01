# VYASA Core Platform Architecture
**Document Version:** 1.0.0-CORE  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)

---

## 1. Overview
VYASA Core (`apps/vyasa/backend/app/core/` and `apps/vyasa/frontend/src/core/`) provides the shared institutional operating foundation for all Veda governance modules.

## 2. Core Subsystems

### 2.1 Identity & User Management (`app/core/users/`)
- Single source of truth for all university accounts.
- Model `User` (`id` UUID, `email`, `password_hash`, `first_name`, `last_name`, `phone`, `is_active`, `is_verified`).
- Model `ApplicantProfile` (1:1 scholar profile with `phd_registration_number`, `department`, `subject_id`, `subject_name`).

### 2.2 Authentication & Security (`app/core/auth/`, `app/core/security.py`)
- Standardized JWT access tokens signed with HMAC-SHA256 (`HS256`).
- Password hashing utilizing industry-standard `bcrypt`.
- Automatic issuer verification (`vyasa-core`).

### 2.3 Role-Based Access Control (`app/core/rbac/`)
- Platform-wide generic roles: `administrator`, `authority`, `applicant`.
- Association tables: `user_roles` and `role_permissions`.
- Granular permission strings (`users:read`, `roles:manage`, `atharva:triage`).
- Independent backend dependency validation via `get_current_user`.

### 2.4 In-Process Module Registry (`app/core/registry/`)
- Replaces legacy microservice URL routing with in-process module management.
- Manages `ModuleDescriptor` records tracking module key, name, Veda domain, operational status, route prefix, version, and required permissions.

### 2.5 Compliance & Audit Logging (`app/core/audit/`)
- Structured logging boundary for security, administrative, and legal actions.

### 2.6 Notification Engine (`app/core/notifications/`)
- Centralized user notification inbox and alert dispatcher.
- Model `Notification` linked directly to `User`.

### 2.7 Database Engine & Connection Pool (`app/core/database.py`)
- Centralized SQLAlchemy `create_engine` managing connection recycling, pre-ping validation, and session-level `Asia/Kolkata` institutional timezone initialization.
