# VYASA Security & Role-Based Access Control Architecture
**Document Version:** 1.0.0-SECURITY  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)

---

## 1. Security Architecture Principles
1. **Zero Trust Inside the Monolith:** Even though VYASA is a single application, modules must never trust incoming request payloads blindly. Every request to an authenticated endpoint is validated by FastAPI dependency injection.
2. **Defense-in-Depth:** Frontend route guards provide smooth user experience and prevent unnecessary unauthorized clicks. Backend authorization dependencies independently enforce RBAC rules on every HTTP request.
3. **Stateless Bearer JWT Authentication:** Tokens are signed with HMAC-SHA256 (`HS256`) using a cryptographically secure `SECRET_KEY`. Access tokens carry an explicit institutional issuer (`vyasa-core`), subject UUID, and expiry (`exp`).
4. **Credential Security:** Plaintext passwords are never stored. Passwords are salted and hashed using `bcrypt`.
5. **No Credentials in URLs:** Tokens and credentials must never appear in query parameters or URL fragments.

---

## 2. Platform Roles
- `administrator`: Full system configuration, module state management, user role assignments, audit log review.
- `authority`: University officers, deans, faculty supervisors, review committee members.
- `applicant`: Doctoral scholars and research fellows.

---

## 3. Granular RBAC Permissions
Format: `<resource>:<action>`
- `users:read`, `users:write`
- `roles:manage`, `permissions:read`
- `modules:manage`
- `audit:read`
- `atharva:submit`, `atharva:triage`, `atharva:forward`, `atharva:vote`, `atharva:sign`
- `rig:read`, `rig:submit`, `rig:review`
- `yajur:read`, `yajur:apply`, `yajur:disburse`
- `sama:read`, `sama:nominate`, `sama:judge`
