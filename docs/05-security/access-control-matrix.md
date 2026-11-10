# VYASA-N — ACCESS CONTROL & PERMISSION MATRIX

**Audit Date:** November 7, 2026  
**Auditor Classification:** Security Reviewer & Systems Auditor  

---

## 1. Role-Based Access Control Architecture

The platform separates user identities into functional roles stored in the `roles` table and mapped to users via `user_roles`. Permissions are stored in `permissions` and mapped to roles via `role_permissions`.

### Foundational System Roles:
1. `super_admin`: Apex institutional technology lead and system administrator.
2. `applicant`: Enrolled doctoral candidate, master's student, or prospective applicant.
3. `manager`: Central grievance triage and closure officer.
4. `assistant_dean`: Faculty officer managing specific academic subject clusters.
5. `associate_dean`: Faculty officer managing functional grievance clusters.
6. `dean`: Executive dean of academic affairs and research.
7. `sama_content_admin`: Research communications officer and bulletin editor.
8. `sama_content_editor`: Editorial assistant for publication indexing.

---

## 2. Master Access Control Matrix

The table below delineates the access entitlements for each role across all system operations:

| Capability / API Operation | `applicant` | `manager` | `assistant_dean` | `associate_dean` | `dean` | `super_admin` | `sama_admin` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **View Own Academic Profile** | &check; | &cross; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Submit Grievance** | &check; | &cross; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Track Own Grievance Details** | &check; | &cross; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Submit Post-Resolution Feedback** | &check; | &cross; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Access Manager Triage Queue** | &cross; | &check; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Review & Override AI Category** | &cross; | &check; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Dispatch Case to Assistant Dean** | &cross; | &check; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Finalize Case Closure** | &cross; | &check; | &cross; | &cross; | &cross; | &cross; | &cross; |
| **Resolve Subject Case** | &cross; | &cross; | &check; | &cross; | &cross; | &cross; | &cross; |
| **Forward Case Upward** | &cross; | &cross; | &check; | &check; | &cross; | &cross; | &cross; |
| **Request Document from Student** | &cross; | &cross; | &check; | &check; | &check; | &cross; | &cross; |
| **Petition for Committee Formation**| &cross; | &cross; | &check; | &check; | &cross; | &cross; | &cross; |
| **Review Committee Petition** | &cross; | &cross; | &cross; | &check; | &check; | &cross; | &cross; |
| **Directly Charter Committee** | &cross; | &cross; | &cross; | &check; | &check; | &cross; | &cross; |
| **Participate in Committee Deliberation**| &cross; | &cross; | &check;* | &check;* | &check;* | &cross; | &cross; |
| **Cast Committee Poll Ballot** | &cross; | &cross; | &check;* | &check;* | &check;* | &cross; | &cross; |
| **Resolve Cluster Case** | &cross; | &cross; | &cross; | &check; | &cross; | &cross; | &cross; |
| **Resolve Apex Case / Executive View**| &cross; | &cross; | &cross; | &cross; | &check; | &cross; | &cross; |
| **Order Case Reopening** | &cross; | &cross; | &cross; | &cross; | &check; | &cross; | &cross; |
| **Manage Subjects & Clusters** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &cross; |
| **Transfer Authority Office** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &cross; |
| **Inspect System Audit Logs** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &cross; |
| **Manage Research Publications** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &check; |
| **Publish Research Bulletins** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &check; |
| **Issue Felicitation Certificates** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &check; |
| **Revoke Certificates with Reason** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &check; |
| **Execute Bulk Research Import** | &cross; | &cross; | &cross; | &cross; | &cross; | &check; | &check; |

*\*Note: Committee participation and voting are restricted to appointed members of that specific chartered committee, regardless of general institutional authority tier.*
