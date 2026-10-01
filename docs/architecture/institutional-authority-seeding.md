# VYASA Institutional Authority Identity Seeding Specification

**Document Identifier:** `VYASA-ARCH-SEED-01`  
**Governing Rule:** *"VYASA owns institutional identity. Pillars own domain roles."*  
**Status:** Canonical Platform Foundation  

---

## 1. Overview & Purpose

In the VYASA ecosystem, university officers (Assistant Deans, Associate Deans, Deans, Triage Managers, and Committee Members) require canonical user accounts in VYASA Core before they can be authorized within independent domain pillars such as NIVARAN.

To uphold the core architectural rule:
- **VYASA Core** owns user identity, canonical UUIDs, email registries, password hashes, and generic platform roles (`administrator`, `authority`, `applicant`).
- **Independent Pillars (NIVARAN)** own grievance dispute records, subject clusters, committee assignments, and pillar-specific domain roles (`MANAGER`, `DEAN`, `ASSISTANT_DEAN`, etc.).
- Pillars **never create random UUIDs** or maintain independent credential storage.

---

## 2. 15-Slot Institutional Identity Foundation

The institutional authority seeding architecture provides explicit, structured slots for **15 university authority identities**:

| Slot Identifier | Typical Jurisdiction in NIVARAN | VYASA Core Role |
|:---:|:---:|:---:|
| `AUTHORITY_01` | Cluster 1 Assistant Dean | `authority` |
| `AUTHORITY_02` | Cluster 2 Assistant Dean | `authority` |
| `AUTHORITY_03` | Cluster 3 Assistant Dean | `authority` |
| `AUTHORITY_04` | Cluster 4 Assistant Dean | `authority` |
| `AUTHORITY_05` | Cluster 5 Assistant Dean | `authority` |
| `AUTHORITY_06` | Cluster 6 Assistant Dean | `authority` |
| `AUTHORITY_07` | Cluster 7 Assistant Dean | `authority` |
| `AUTHORITY_08` | Cluster 8 Assistant Dean | `authority` |
| `AUTHORITY_09` | Cluster 9 Assistant Dean | `authority` |
| `AUTHORITY_10` | Cluster 10 Assistant Dean | `authority` |
| `AUTHORITY_11` | Associate Dean | `authority` |
| `AUTHORITY_12` | Guest Member 1 | `authority` |
| `AUTHORITY_13` | Guest Member 2 | `authority` |
| `AUTHORITY_14` | Central Triage Manager | `authority` |
| `AUTHORITY_15` | Dean (Apex Authority) | `authority` |

> [!IMPORTANT]
> The table above illustrates how pillars map to these 15 slots. Within **VYASA Core**, every single one of these 15 accounts receives **strictly the generic `authority` role**. No pillar-specific role names exist or are permitted within VYASA Core.

---

## 3. Configuration Mechanisms (ENV & Manifest Driven)

Real names, institutional emails, passwords, and UUIDs are **never hard-coded in git or source control**. Instead, the seed service supports three non-committed configuration pathways:

### Pathway A: Manifest JSON File
Point to an external JSON manifest outside git:
```bash
AUTHORITIES_MANIFEST_PATH=/secure/credentials/authorities_manifest.json
```
A template is provided at [`backend/config/authorities_manifest.example.json`](file:///C:/Projects/VYASA/backend/config/authorities_manifest.example.json).

### Pathway B: Inline JSON Environment Variable
Pass the JSON string directly via environment variable in deployment:
```bash
AUTHORITIES_MANIFEST_JSON='{"AUTHORITY_01": {"id": "...", "email": "...", "first_name": "...", "last_name": "...", "password": "..."}}'
```

### Pathway C: Per-Slot Environment Variables
Provide individual slot variables (with or without `VYASA_` prefix):
```bash
AUTHORITY_01_ID=10000000-0000-0000-0000-000000000001
AUTHORITY_01_EMAIL=officer1@institution.ac.in
AUTHORITY_01_FIRST_NAME=Officer
AUTHORITY_01_LAST_NAME=One
AUTHORITY_01_PASSWORD=SecureInitialPassword!

# ... up to AUTHORITY_15_...
```

---

## 4. Strict Validation Invariants

Before any database write occurs, the seed engine runs exhaustive pre-flight validation. If any check fails, the operation aborts with zero database changes:

1. **Duplicate Email Rejection:** Emails must be globally unique across all 15 slots (case-insensitive check).
2. **Duplicate UUID Rejection:** Every slot must have a unique, canonical UUID.
3. **Missing Field Rejection:** Every configured slot must contain `id`, `email`, `first_name`, and `last_name`.
4. **Pillar Role Prohibition:** Any occurrence of NIVARAN domain roles (`MANAGER`, `DEAN`, `ASSISTANT_DEAN`, `ASSOCIATE_DEAN`, `GUEST_MEMBER`) is strictly rejected.
5. **Strict 15-Slot Completeness:** In standard/production mode, all 15 slots (`AUTHORITY_01` to `AUTHORITY_15`) must be configured to prevent partial sets.
6. **Existing Email Conflict Check:** If an email is already claimed in the database by a user with a different UUID, the seed halts safely with `AuthoritySeedConflictError`.

---

## 5. Execution & Seed Commands

### Dedicated Authority Seeding CLI
```bash
# In backend
python -m app.services.authority_seed_service --manifest config/authorities_manifest.json

# Or load from environment variables (AUTHORITIES_MANIFEST_JSON or slot variables)
python -m app.services.authority_seed_service
```

### Integrated Platform Seeding CLI
```bash
# Seeds roles, permissions, pillars, and institutional authorities (if configured)
python -m app.services.seed_service --authorities
```

---

## 6. Password Hashing & Security Invariants

- Plaintext passwords are **never stored** in the database.
- Initial passwords (if supplied in the manifest for initial onboarding) are immediately hashed using the canonical VYASA password utility (`hash_password` from `app.core.security`).
- The hash format strictly complies with:
  `pbkdf2_sha256$100000$<salt>$<hex_digest>`
- Once seeded, passwords can be rotated by the user through the standard authentication lifecycle.
