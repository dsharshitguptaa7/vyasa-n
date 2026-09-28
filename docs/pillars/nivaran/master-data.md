# NIVARAN Institutional Master Data & Routing Specification

This document establishes the official institutional routing, taxonomy, and authority bootstrapping master data for the **NIVARAN** grievance pillar within the **VYASA** ecosystem.

---

## 1. Architectural Principles & Identity Boundaries

- **Ecosystem Decoupling**:
  - **VYASA Core** owns identity, user provisioning, credentials, authentication, and platform RBAC.
  - **NIVARAN** owns the grievance domain, academic taxonomy, grievance routing, committee management, and dispute dossiers.
  - **No Cross-Database Foreign Keys**: References to platform users use `vyasa_user_id: UUID`.
  - **No VYASA Core Tables in NIVARAN**: Tables such as `users`, `roles`, `permissions`, `pillars`, and `notifications` belong strictly to VYASA Core and do **NOT** exist in the NIVARAN database.
- **Authority Identity Boundary**:
  - Authorities in NIVARAN (`nivaran_authorities`) do **NOT** have local passwords, logins, or authentication tables.
  - Each authority profile holds a `vyasa_user_id: UUID` foreign reference pointing to the user's primary identity in VYASA Core.
  - NIVARAN domain authority mappings are established **ONLY** when a valid configured VYASA user UUID is available.
  - **Zero Fake Identities / Zero Random UUIDs**: The system never generates random UUIDs (`uuid.uuid4()`) for real authority identities.

---

## 2. Institutional Master Data Summary

| Domain Entity | Count | Key Invariant / Constraint |
|---|---|---|
| **Authority Profiles** | 13 | 10 Assistant Deans, 3 Associate Deans (Fixed authorities reuse Assistant Deans 4 & 10) |
| **Subject Clusters** | 10 | `cluster_number BETWEEN 1 AND 10` (UNIQUE), 1:1 Assistant Dean reference |
| **Academic Subjects** | 56 | Unique name, mapped 1:many to exactly one Subject Cluster |
| **Grievance Clusters** | 3 | `cluster_number BETWEEN 1 AND 3` (UNIQUE), 1:1 Associate Dean reference |
| **Grievance Categories** | 16 | Tri-state routing enforced via `ck_category_routing` |

---

## 3. The 10 Subject Clusters & Academic Taxonomy

Each of the 10 Subject Clusters is uniquely assigned 1:1 to an Assistant Dean. Grievances assigned to a specific academic subject automatically route to the corresponding Assistant Dean.

| Cluster # | Name | Assigned Assistant Dean | Email | Department | Subject Count | Subjects |
|---|---|---|---|---|---|---|
| **1** | Cluster 1 | Dr. Ankit Trivedi | `ankit.trivedi@nivaran.local` | R&D | 4 | Philosophy, Mathematics, Economics, Urdu |
| **2** | Cluster 2 | Dr. Pooja Singh | `pooja.singh@nivaran.local` | R&D | 5 | Home Science, Music, Psychology, Business Management, English Literature |
| **3** | Cluster 3 | Dr. Priyanka Maurya | `priyanka.maurya@nivaran.local` | R&D | 4 | Zoology, Chemistry, Pharmacy, Geography |
| **4** | Cluster 4 | Dr. Dipesh Kumar Verma | `dipesh.verma@nivaran.local` | R&D | 4 | Botany, Microbiology, Biochemistry, Commerce |
| **5** | Cluster 5 | Dr. Adarsh Kumar Srivastav | `adarsh.srivastav@nivaran.local` | R&D | 3 | Hindi Literature, Sociology, Statistics |
| **6** | Cluster 6 | Dr. Pravin Kumar Agarwal | `pravin.agarwal@nivaran.local` | R&D | 5 | Physical Education, Sanskrit, Yoga, Life Science, Biotechnology |
| **7** | Cluster 7 | Dr. Shashi Kiran Mishra | `shashi.mishra@nivaran.local` | R&D | 6 | Deen Dayal Sodh Kendra, Hindu Studies, Library and Information Science, Journalism and Mass Communication, Food Technology, Education/Education Training |
| **8** | Cluster 8 | Dr. Priyanka Gupta | `priyanka.gupta@nivaran.local` | R&D | 5 | Political Science, Law, Chemical Engineering, Electronics and Communication Engineering, Mechanical Engineering |
| **9** | Cluster 9 | Dr. Anjani Kumar Upadhayay | `anjani.upadhayay@nivaran.local` | R&D | 6 | Drawing and Painting, Physics, Defence and Strategies, History, MLT, Physiotherapy |
| **10** | Cluster 10 | Dr. Samiuddin | `samiuddin@nivaran.local` | R&D | 14 | Social Work, Life Long Engineering, Computer Application, Computer Science and Engineering, Soil Science, Genetics and Plant Breeding, Agronomy, Agricultural Economics, Soil Conservation, Horticulture, Agricultural Chemistry, Agriculture Entomology, Plant Pathology, Agriculture Extension |

---

## 4. The 3 Institutional Grievance Clusters

Grievance clusters group related doctoral milestones and procedural domains, each presided over 1:1 by a designated Associate Dean.

| Cluster # | Name | Associate Dean | Email | Core Institutional Domains |
|---|---|---|---|---|
| **1** | Cluster 1 - Admissions, Registration & Supervisors | Dr. Arun Kumar Gupta | `arun.gupta@nivaran.local` | Admissions, Registration, Supervisor Allocation |
| **2** | Cluster 2 - Coursework, RAC & RDC | Dr. Manas Upadhyay | `manas.upadhyay@nivaran.local` | Coursework, RAC, RDC, Part-Time/Full-Time Conversion |
| **3** | Cluster 3 - Research Verification & Thesis | Dr. Sweta Pandey | `sweta.pandey@nivaran.local` | Publication Verification, Plagiarism Clearance, Thesis Evaluation |

---

## 5. The 16 Grievance Categories & Tri-State Routing Engine

NIVARAN operates a tri-state routing engine enforced at the database level by check constraint `ck_category_routing`:
1. `GRIEVANCE_CLUSTER`: Automatically routes to the Associate Dean of the specified Grievance Cluster (1, 2, or 3).
2. `SUBJECT_ASSISTANT_DEAN`: Terminates at the Assistant Dean of the student's academic subject cluster.
3. `FIXED_AUTHORITY`: Routes directly to a designated institutional statutory officer regardless of subject.

| Category Name | Routing Type | Target Destination | Foreign Key Mapping | Description |
|---|---|---|---|---|
| **PhD_Admission** | `GRIEVANCE_CLUSTER` | Grievance Cluster 1 (Dr. Arun Kumar Gupta) | `grievance_cluster_id = GC-1` | PhD entrance, admission procedure, seat allocation inquiries |
| **Registration** | `GRIEVANCE_CLUSTER` | Grievance Cluster 1 (Dr. Arun Kumar Gupta) | `grievance_cluster_id = GC-1` | Doctoral registration, enrollment confirmation, renewal issues |
| **Supervisor_Related** | `GRIEVANCE_CLUSTER` | Grievance Cluster 1 (Dr. Arun Kumar Gupta) | `grievance_cluster_id = GC-1` | Supervisor allocation, co-supervisor appointment, change of guide |
| **Course_Work** | `GRIEVANCE_CLUSTER` | Grievance Cluster 2 (Dr. Manas Upadhyay) | `grievance_cluster_id = GC-2` | PhD coursework, classes, syllabus, coursework examinations |
| **RAC** | `GRIEVANCE_CLUSTER` | Grievance Cluster 2 (Dr. Manas Upadhyay) | `grievance_cluster_id = GC-2` | Research Advisory Committee scheduling, presentation, review |
| **RDC** | `GRIEVANCE_CLUSTER` | Grievance Cluster 2 (Dr. Manas Upadhyay) | `grievance_cluster_id = GC-2` | Research Degree Committee approval, topic modification |
| **FT_PT_Conversion** | `GRIEVANCE_CLUSTER` | Grievance Cluster 2 (Dr. Manas Upadhyay) | `grievance_cluster_id = GC-2` | Conversion between Full-Time and Part-Time doctoral status |
| **Publication_Verification** | `GRIEVANCE_CLUSTER` | Grievance Cluster 3 (Dr. Sweta Pandey) | `grievance_cluster_id = GC-3` | UGC-CARE / Scopus / peer-reviewed journal publication verification |
| **Thesis_Submission** | `GRIEVANCE_CLUSTER` | Grievance Cluster 3 (Dr. Sweta Pandey) | `grievance_cluster_id = GC-3` | Thesis submission prerequisites, plagiarism clearance certificate |
| **Thesis_Evaluation** | `GRIEVANCE_CLUSTER` | Grievance Cluster 3 (Dr. Sweta Pandey) | `grievance_cluster_id = GC-3` | External examiner evaluation reports, thesis review progress |
| **Viva** | `SUBJECT_ASSISTANT_DEAN` | Dynamic Subject Assistant Dean | `grievance_cluster_id = NULL`, `fixed_authority_id = NULL` | Oral defence / viva-voce examination scheduling and coordination |
| **Fee** | `SUBJECT_ASSISTANT_DEAN` | Dynamic Subject Assistant Dean | `grievance_cluster_id = NULL`, `fixed_authority_id = NULL` | Tuition, examination, semester or annual fee disputes and receipts |
| **Portal_Data_Correction** | `SUBJECT_ASSISTANT_DEAN` | Dynamic Subject Assistant Dean | `grievance_cluster_id = NULL`, `fixed_authority_id = NULL` | Correction of student profile, spelling, records on university portal |
| **Other** | `SUBJECT_ASSISTANT_DEAN` | Dynamic Subject Assistant Dean | `grievance_cluster_id = NULL`, `fixed_authority_id = NULL` | General departmental and academic inquiries not listed elsewhere |
| **Fellowship** | `FIXED_AUTHORITY` | Dr. Dipesh Kumar Verma | `fixed_authority_id = Auth(dipesh.verma)` | JRF/SRF/University fellowship disbursement and stipend claims |
| **RTI_IIGRS** | `FIXED_AUTHORITY` | Dr. Samiuddin | `fixed_authority_id = Auth(samiuddin)` | Right to Information (RTI) and Integrated Grievance Redressal System matters |

---

## 6. Authority Provisioning Strategy & Unresolved Identities

### Configuration Mechanism
Authority identities are provisioned without embedding passwords, tokens, or credentials into the codebase:
1. **Dedicated Non-Secret Mapping File**:
   [`app/seed/authority_mappings.py`](file:///c:/Projects/VYASA/apps/pillars/nivaran/backend/app/seed/authority_mappings.py) contains the canonical provisioned UUID references (`PROVISIONED_AUTHORITY_VYASA_MAP`).
2. **Environment Variable Overrides**:
   Specific identities can be overridden at runtime via:
   - `ASSISTANT_DEAN_CLUSTER_<N>_VYASA_USER_ID=<UUID>` (e.g. `ASSISTANT_DEAN_CLUSTER_1_VYASA_USER_ID=...`)
   - `ASSOCIATE_DEAN_CLUSTER_<N>_VYASA_USER_ID=<UUID>` (e.g. `ASSOCIATE_DEAN_CLUSTER_1_VYASA_USER_ID=...`)
   - `NIVARAN_AUTHORITY_<KEY>_VYASA_USER_ID=<UUID>` (e.g. `NIVARAN_AUTHORITY_ANKIT_TRIVEDI_VYASA_USER_ID=...`)

### Unresolved Authority Handling
If an authority has not been provisioned with a VYASA identity:
- `resolve_authority_vyasa_id()` returns `None`.
- The seeder logs: `WARNING: Authority '<name>' (<email>) has no configured VYASA user ID. Remaining UNRESOLVED.`
- The system **never** invents a fake UUID or inserts dummy authentication records.
- Unresolved authorities are cleanly reported in the CLI summary under `Unresolved Authorities`.

---

## 7. Seed Command & CLI Execution

### Command
```bash
python -m app.seed
```

### Execution Flow
1. Connects to the database using `DATABASE_URL` securely via Pydantic `SecretStr`.
2. Verifies that all 5 required master data tables exist (`nivaran_authorities`, `subject_clusters`, `subjects`, `grievance_clusters`, `categories`).
3. Seeds/syncs the 13 authority profiles (resolving configured VYASA user UUIDs).
4. Seeds/syncs the 3 Grievance Clusters.
5. Seeds/syncs the 10 Subject Clusters.
6. Seeds/syncs all 56 academic subjects.
7. Seeds/syncs all 16 grievance categories with verified foreign keys and check constraints.
8. Commits the transaction and prints a concise, unprivileged summary without exposing credentials.

### Output
```text
============================================================
NIVARAN Pillar - Institutional Master Data Seeder
Service: vyasa-nivaran-backend | Environment: development
============================================================

Master Data Seed Completed Successfully:
  Subject Clusters:       10
  Subjects:               56
  Grievance Clusters:     3
  Categories:             16
  Resolved Authorities:   13
  Unresolved Authorities: 0
============================================================
```

---

## 8. Idempotency Behavior

The seeder is strictly idempotent:
- Lookups use unique natural/business keys:
  - `nivaran_authorities`: `email_snapshot` or `vyasa_user_id`
  - `subject_clusters`: `cluster_number`
  - `subjects`: `name`
  - `grievance_clusters`: `cluster_number`
  - `categories`: `name`
- First execution performs clean atomic inserts.
- Subsequent runs perform targeted updates to synchronized fields and preserve existing IDs.
- Running the seed command consecutively produces identical counts with **zero duplicate rows**.
