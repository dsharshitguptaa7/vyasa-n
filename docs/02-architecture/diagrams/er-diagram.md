# VYASA-N — ENTITY RELATIONSHIP DIAGRAM (ERD)

**Audit Date:** November 7, 2026  
**Auditor Classification:** Database Architect & Data Modeler  
**Format:** Mermaid Class Diagram (`classDiagram`)  

---

## 1. High-Level Relational Diagram

```mermaid
classDiagram
    direction TB

    class User {
        UUID id PK
        String email UK
        String password_hash
        String full_name
        Boolean is_active
        Boolean must_change_password
        DateTime created_at
    }

    class Role {
        UUID id PK
        String name UK
        String display_name
        Boolean is_system
    }

    class Permission {
        UUID id PK
        String name UK
        String module
    }

    class ApplicantProfile {
        UUID id PK
        UUID user_id FK
        String enrollment_number UK
        String department
        String program
    }

    class NivaranAuthority {
        UUID id PK
        UUID user_id FK
        String role_enum
        String designation
        UUID assigned_cluster_id
    }

    class NivaranSubject {
        UUID id PK
        String name UK
        String code
        UUID cluster_id FK
    }

    class NivaranGrievance {
        UUID id PK
        String tracking_id UK
        UUID applicant_user_id FK
        UUID subject_id FK
        UUID category_id FK
        String status
        String priority
        DateTime submitted_at
        DateTime resolved_at
    }

    class NivaranGrievanceDocument {
        UUID id PK
        UUID grievance_id FK
        String file_name
        String storage_key
        String file_hash
    }

    class NivaranCommittee {
        UUID id PK
        UUID grievance_id FK
        String committee_name
        UUID chairperson_id FK
        String status
        DateTime chartered_at
    }

    class NivaranCommitteeMember {
        UUID id PK
        UUID committee_id FK
        UUID authority_id FK
        String member_role
    }

    class NivaranCommitteePoll {
        UUID id PK
        UUID committee_id FK
        String title
        String voting_policy
        String status
    }

    class NivaranEFile {
        UUID id PK
        UUID grievance_id FK
        String efile_number UK
        String dossier_hash
        DateTime sealed_at
    }

    class NivaranStudentMasterRecord {
        UUID id PK
        String roll_number UK
        String enrollment_number UK
        Integer total_grievances
        Integer resolved_grievances
    }

    class SamaPublication {
        UUID id PK
        UUID bulletin_id FK
        String title
        String slug UK
        String doi UK
        String status
    }

    class SamaAuthor {
        UUID id PK
        String full_name
        String scopus_id UK
        String orcid_id UK
    }

    class SamaBulletin {
        UUID id PK
        Integer volume
        Integer issue
        String pdf_storage_key
        String status
    }

    class SamaCertificate {
        UUID id PK
        String certificate_number UK
        String recipient_name
        String qr_hash
        Boolean is_revoked
    }

    User "1" --> "1" ApplicantProfile : possesses
    User "1" --> "1" NivaranAuthority : appointed_as
    User "m" <--> "m" Role : user_roles
    Role "m" <--> "m" Permission : role_permissions

    NivaranSubject "1" --> "m" NivaranGrievance : classifies
    User "1" --> "m" NivaranGrievance : submits
    NivaranGrievance "1" --> "m" NivaranGrievanceDocument : contains
    NivaranGrievance "1" --> "m" NivaranCommittee : deliberated_by
    NivaranCommittee "1" --> "m" NivaranCommitteeMember : composed_of
    NivaranAuthority "1" --> "m" NivaranCommitteeMember : serves_in
    NivaranCommittee "1" --> "m" NivaranCommitteePoll : conducts
    NivaranGrievance "1" --> "1" NivaranEFile : compiles_into

    SamaBulletin "1" --> "m" SamaPublication : publishes
    SamaPublication "m" <--> "m" SamaAuthor : publication_authors
```

---

## 2. Key Relationship Constraints & Invariants

1. **User to Authority Isolation:** A user identity can only link to one `NivaranAuthority` appointment (`user_id` unique constraint), preventing dual-role conflicts within the grievance committee hierarchy.
2. **Grievance Cascading & Deletion Prevention:** While test fixtures use cascading deletes, production database rules enforce `ON DELETE RESTRICT` on grievances with associated legal documents or sealed e-Files.
3. **Committee Membership Uniqueness:** `UNIQUE (committee_id, authority_id)` guarantees an appointed official cannot be duplicated on a single panel.
4. **Voter Ballot Secrecy & Deduplication:** `UNIQUE (poll_id, voter_member_id)` in `nivaran_committee_poll_votes` guarantees one ballot per member while storing only the SHA-256 vote hash, preserving integrity without compromising ballot secrecy.
