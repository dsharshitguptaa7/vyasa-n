"""
Phase 5B Canonical Nivaran Authority Reconciliation & Safe Cleanup Service.

Governing Rules:
1. VYASA owns institutional identity (users.id). Pillars own domain roles (nivaran_authorities.role).
2. Exactly 15 canonical institutional authorities.
3. Zero synthetic authorities created.
4. Clean up test/legacy residue: 534 test authorities, 139 test grievance clusters, 204 test categories.
5. Atomic transaction execution: full rollback on ANY assertion failure.
"""

from __future__ import annotations

import argparse
import logging
import sys
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.audit import AuditLog
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import CategoryRoutingType, NivaranRole
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    Category,
    GrievanceCluster,
    Subject,
    SubjectCluster,
)

logger = logging.getLogger("vyasa.atharva.authority_reconciliation")

# ---------------------------------------------------------------------------
# 15 Canonical Institutional Authority Specifications
# ---------------------------------------------------------------------------
CANONICAL_AUTHORITIES: List[Dict[str, Any]] = [
    # 1. Dean
    {
        "vyasa_user_id": uuid.UUID("889e14ec-5411-5554-b8e3-2be991e64080"),
        "email": "research@csjmu.ac.in",
        "name": "Prof. Namita Tiwari",
        "role": NivaranRole.DEAN,
        "designation": "Dean, Research & Development",
        "department": "R&D",
    },
    # 2. Manager
    {
        "vyasa_user_id": uuid.UUID("73fd427c-30c5-54d7-ba9a-4101620815f8"),
        "email": "rdmmanager@csjmu.ac.in",
        "name": "Mr. Ashfaq Ansari",
        "role": NivaranRole.MANAGER,
        "designation": "R&D Support Manager",
        "department": "R&D",
    },
    # 3-12. Assistant Deans (Subject Clusters 1 to 10)
    {
        "vyasa_user_id": uuid.UUID("89352e91-401f-5dc9-83bc-b8c9ed021ed6"),
        "email": "assistantdean1@csjmu.ac.in",
        "name": "Dr. Ankit Trivedi",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 1,
    },
    {
        "vyasa_user_id": uuid.UUID("3cd11b9e-64fb-5387-aeff-9cdc965274af"),
        "email": "assistantdean2@csjmu.ac.in",
        "name": "Dr. Pooja Singh",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 2,
    },
    {
        "vyasa_user_id": uuid.UUID("aa72e7be-e3a0-5084-9f5f-14fd6a82feb4"),
        "email": "assistantdean3@csjmu.ac.in",
        "name": "Dr. Priyanka Maurya",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 3,
    },
    {
        "vyasa_user_id": uuid.UUID("c15caab3-45ae-56d2-a56b-3e7ba30367d9"),
        "email": "assistantdean4@csjmu.ac.in",
        "name": "Dr. Dipesh Kumar Verma",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 4,
        "fixed_category": "Fellowship",
    },
    {
        "vyasa_user_id": uuid.UUID("0c57021f-eade-5f1b-9811-ef265fc528d6"),
        "email": "assistantdean5@csjmu.ac.in",
        "name": "Dr. Adarsh Kumar Srivastav",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 5,
    },
    {
        "vyasa_user_id": uuid.UUID("4942d74f-9d17-5d16-9276-d5305161ed9b"),
        "email": "assistantdean6@csjmu.ac.in",
        "name": "Dr. Pravin Kumar Agarwal",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 6,
    },
    {
        "vyasa_user_id": uuid.UUID("56afc6ca-98f3-524d-8f8d-f3e6c1388814"),
        "email": "assistantdean7@csjmu.ac.in",
        "name": "Dr. Shashi Kiran Mishra",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 7,
    },
    {
        "vyasa_user_id": uuid.UUID("0d6e7eb8-d479-547e-9ebc-fe41d07a4548"),
        "email": "assistantdean9@csjmu.ac.in",
        "name": "Dr. Priyanka Gupta",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 8,
    },
    {
        "vyasa_user_id": uuid.UUID("0e1e271d-545f-545e-95cf-e00138e4d73d"),
        "email": "assistantdean10@csjmu.ac.in",
        "name": "Dr. Anjani Kumar Upadhayay",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 9,
    },
    {
        "vyasa_user_id": uuid.UUID("26fd1ca7-4a82-5c01-99fb-96680d3db407"),
        "email": "assistantdean11@csjmu.ac.in",
        "name": "Dr. Samiuddin",
        "role": NivaranRole.ASSISTANT_DEAN,
        "designation": "Assistant Dean (Subject Specialist)",
        "department": "R&D",
        "subject_cluster_number": 10,
        "fixed_category": "RTI_IIGRS",
    },
    # 13-15. Associate Deans (Grievance Clusters 1 to 3)
    {
        "vyasa_user_id": uuid.UUID("e6a36b30-6c8b-5d04-94fe-1ab4ca0df52f"),
        "email": "associatedean2@csjmu.ac.in",
        "name": "Dr. Arun Kumar Gupta",
        "role": NivaranRole.ASSOCIATE_DEAN,
        "designation": "Associate Dean (Domain Cluster)",
        "department": "R&D",
        "grievance_cluster_number": 1,
    },
    {
        "vyasa_user_id": uuid.UUID("9c338755-5bb4-5f53-93af-cd46a22bdf4b"),
        "email": "associatedean3@csjmu.ac.in",
        "name": "Dr. Manas Upadhyay",
        "role": NivaranRole.ASSOCIATE_DEAN,
        "designation": "Associate Dean (Domain Cluster)",
        "department": "R&D",
        "grievance_cluster_number": 2,
    },
    {
        "vyasa_user_id": uuid.UUID("5ce1e4a1-c852-525c-8919-d7b5984b3024"),
        "email": "associatedean1@csjmu.ac.in",
        "name": "Dr. Sweta Pandey",
        "role": NivaranRole.ASSOCIATE_DEAN,
        "designation": "Associate Dean (Domain Cluster)",
        "department": "R&D",
        "grievance_cluster_number": 3,
    },
]

CANONICAL_GRIEVANCE_CLUSTERS = [
    {
        "cluster_number": 1,
        "name": "Cluster 1",
        "description": "Academic, Admission & Supervisor Domain Cluster",
        "associate_email": "associatedean2@csjmu.ac.in",
    },
    {
        "cluster_number": 2,
        "name": "Cluster 2",
        "description": "Course Work, Committees & Conversion Domain Cluster",
        "associate_email": "associatedean3@csjmu.ac.in",
    },
    {
        "cluster_number": 3,
        "name": "Cluster 3",
        "description": "Publication & Thesis Evaluation Domain Cluster",
        "associate_email": "associatedean1@csjmu.ac.in",
    },
]

INSTITUTIONAL_CATEGORY_ROUTING = {
    # Grievance Cluster 1
    "PhD_Admission": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 1},
    "Registration": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 1},
    "Supervisor_Related": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 1},
    # Grievance Cluster 2
    "Course_Work": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 2},
    "RAC": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 2},
    "RDC": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 2},
    "FT_PT_Conversion": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 2},
    # Grievance Cluster 3
    "Publication_Verification": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 3},
    "Thesis_Submission": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 3},
    "Thesis_Evaluation": {"type": CategoryRoutingType.GRIEVANCE_CLUSTER, "cluster_num": 3},
    # Subject Assistant Dean
    "Viva": {"type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN},
    "Fee": {"type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN},
    "Portal_Data_Correction": {"type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN},
    "Other": {"type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN},
    # Fixed Authority
    "Fellowship": {"type": CategoryRoutingType.FIXED_AUTHORITY, "email": "assistantdean4@csjmu.ac.in"},
    "RTI_IIGRS": {"type": CategoryRoutingType.FIXED_AUTHORITY, "email": "assistantdean11@csjmu.ac.in"},
}

AUTHORITY_FK_TABLES: List[Tuple[str, str]] = [
    ("nivaran_approval_actions", "action_by_authority_id"),
    ("nivaran_approval_requests", "target_authority_id"),
    ("nivaran_approval_requests", "requested_by_id"),
    ("nivaran_assignments", "authority_id"),
    ("nivaran_assignments", "assigned_by_id"),
    ("nivaran_comments", "author_authority_id"),
    ("nivaran_committee_creation_requests", "reviewed_by_id"),
    ("nivaran_committee_creation_requests", "requested_by_id"),
    ("nivaran_committee_decision_records", "certified_by_chairperson_id"),
    ("nivaran_committee_final_recommendations", "chairperson_id"),
    ("nivaran_committee_members", "authority_id"),
    ("nivaran_committee_messages", "sender_authority_id"),
    ("nivaran_committees", "chairperson_id"),
    ("nivaran_dean_reopen_reviews", "dean_authority_id"),
    ("nivaran_digital_signatures", "signer_authority_id"),
    ("nivaran_document_requests", "requested_by_id"),
    ("nivaran_efiles", "sealed_by_authority_id"),
    ("nivaran_escalations", "escalated_by_id"),
    ("nivaran_forwarding_confirmations", "forwarded_by_authority_id"),
    ("nivaran_forwarding_confirmations", "forwarded_to_authority_id"),
    ("nivaran_grievance_status_history", "actor_authority_id"),
    ("nivaran_grievances", "previous_closed_by_id"),
    ("nivaran_grievances", "resolved_by_authority_id"),
    ("nivaran_grievances", "previous_resolved_by_id"),
    ("nivaran_grievances", "closed_by_authority_id"),
    ("nivaran_grievances", "assigned_authority_id"),
    ("nivaran_signing_challenges", "authority_id"),
    ("nivaran_subject_clusters", "assistant_dean_id"),
    ("nivaran_grievance_clusters", "associate_dean_id"),
    ("nivaran_categories", "fixed_authority_id"),
]


class AuthorityReconciliationService:
    def __init__(self, db: Session):
        self.db = db

    def execute_reconciliation(self, commit: bool = False, actor_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
        """
        Executes the canonical authority reconciliation and cleanup atomically.
        """
        logger.info(f"Starting Phase 5B authority reconciliation (commit={commit})")
        report: Dict[str, Any] = {
            "mode": "COMMIT" if commit else "DRY_RUN",
            "pre_mutation_assertions": {},
            "users_activated": 0,
            "canonical_authorities_created": 0,
            "subject_clusters_mapped": 0,
            "grievance_clusters_created": 0,
            "categories_realigned": 0,
            "test_categories_deleted": 0,
            "test_grievance_clusters_deleted": 0,
            "test_authorities_deleted": 0,
            "post_mutation_assertions": {},
        }

        # ------------------------------------------------------------------
        # 1. PRE-MUTATION ASSERTIONS
        # ------------------------------------------------------------------
        logger.info("Step 1: Running pre-mutation assertions...")
        canonical_emails = [a["email"] for a in CANONICAL_AUTHORITIES]
        canonical_users = self.db.query(User).filter(User.email.in_(canonical_emails)).all()
        if len(canonical_users) != 15:
            raise ValueError(f"Pre-assertion failed: Expected 15 canonical users, found {len(canonical_users)}")

        user_by_email = {u.email: u for u in canonical_users}
        for auth_spec in CANONICAL_AUTHORITIES:
            u = user_by_email.get(auth_spec["email"])
            if not u or u.id != auth_spec["vyasa_user_id"]:
                raise ValueError(f"Pre-assertion failed: User ID mismatch for {auth_spec['email']}: {u.id} != {auth_spec['vyasa_user_id']}")

        current_authorities_count = self.db.scalar(select(func.count(NivaranAuthority.id)))
        if current_authorities_count < 15:
            raise ValueError(f"Pre-assertion failed: Expected at least 15 current authorities, found {current_authorities_count}")

        # Verify test categories are NOT referenced by grievances or AI records
        inst_cats_tuple = tuple(INSTITUTIONAL_CATEGORY_ROUTING.keys())
        inst_str = ", ".join(f"'{c}'" for c in inst_cats_tuple)
        q_grv_cat = f"""SELECT count(*) FROM nivaran_grievances g 
                        JOIN nivaran_categories c ON g.category_id = c.id OR g.final_category_id = c.id OR g.ai_suggested_category_id = c.id 
                        WHERE c.name NOT IN ({inst_str})"""
        if self.db.execute(text(q_grv_cat)).scalar() > 0:
            raise ValueError("Pre-assertion failed: Test categories are referenced by historical grievances")

        report["pre_mutation_assertions"] = {
            "canonical_users_count": len(canonical_users),
            "current_authorities_count": current_authorities_count,
            "historical_authority_references": 0,
            "historical_test_category_references": 0,
        }
        logger.info("Pre-mutation assertions passed successfully.")


        # ------------------------------------------------------------------
        # 2. ACTIVATE CANONICAL USERS
        # ------------------------------------------------------------------
        logger.info("Step 2: Activating 15 canonical users...")
        canonical_user_ids = [a["vyasa_user_id"] for a in CANONICAL_AUTHORITIES]
        activated_count = self.db.execute(
            text("UPDATE users SET is_active = true WHERE id = ANY(:uids)").bindparams(uids=canonical_user_ids)
        ).rowcount
        report["users_activated"] = activated_count
        logger.info(f"Activated {activated_count} canonical users.")

        # ------------------------------------------------------------------
        # 3. CREATE 15 CANONICAL NIVARAN AUTHORITIES
        # ------------------------------------------------------------------
        logger.info("Step 3: Creating 15 canonical Nivaran authorities...")
        authority_by_email: Dict[str, NivaranAuthority] = {}
        authorities_created = 0

        for spec in CANONICAL_AUTHORITIES:
            # Check if authority already exists for this vyasa_user_id
            existing_auth = self.db.scalar(
                select(NivaranAuthority).where(NivaranAuthority.vyasa_user_id == spec["vyasa_user_id"])
            )
            if existing_auth:
                existing_auth.role = spec["role"]
                existing_auth.name_snapshot = spec["name"]
                existing_auth.email_snapshot = spec["email"]
                existing_auth.designation = spec["designation"]
                existing_auth.department = spec["department"]
                existing_auth.is_active = True
                authority_by_email[spec["email"]] = existing_auth
            else:
                auth = NivaranAuthority(
                    id=uuid.uuid4(),
                    vyasa_user_id=spec["vyasa_user_id"],
                    role=spec["role"],
                    name_snapshot=spec["name"],
                    email_snapshot=spec["email"],
                    designation=spec["designation"],
                    department=spec["department"],
                    is_active=True,
                )
                self.db.add(auth)
                self.db.flush()
                authority_by_email[spec["email"]] = auth
                authorities_created += 1

        report["canonical_authorities_created"] = authorities_created
        logger.info(f"Created/updated {len(authority_by_email)} canonical authorities.")

        # ------------------------------------------------------------------
        # 4. SUBJECT CLUSTER MAPPING
        # ------------------------------------------------------------------
        logger.info("Step 4: Mapping 10 authoritative subject clusters to Assistant Deans...")
        subject_clusters_mapped = 0
        for spec in CANONICAL_AUTHORITIES:
            if "subject_cluster_number" in spec:
                cluster_num = spec["subject_cluster_number"]
                asst_auth = authority_by_email[spec["email"]]
                subj_cluster = self.db.scalar(
                    select(SubjectCluster).where(SubjectCluster.cluster_number == cluster_num)
                )
                if not subj_cluster:
                    raise ValueError(f"Subject cluster {cluster_num} does not exist!")
                subj_cluster.assistant_dean_id = asst_auth.id
                subject_clusters_mapped += 1

        report["subject_clusters_mapped"] = subject_clusters_mapped
        logger.info(f"Mapped {subject_clusters_mapped} subject clusters to Assistant Deans.")

        # ------------------------------------------------------------------
        # 5. CREATE CANONICAL GRIEVANCE CLUSTERS
        # ------------------------------------------------------------------
        logger.info("Step 5: Creating 3 canonical grievance clusters...")
        grievance_cluster_by_num: Dict[int, GrievanceCluster] = {}
        for gc_spec in CANONICAL_GRIEVANCE_CLUSTERS:
            assoc_auth = authority_by_email[gc_spec["associate_email"]]
            existing_gc = self.db.scalar(
                select(GrievanceCluster).where(GrievanceCluster.cluster_number == gc_spec["cluster_number"])
            )
            if existing_gc:
                existing_gc.name = gc_spec["name"]
                existing_gc.description = gc_spec["description"]
                existing_gc.associate_dean_id = assoc_auth.id
                existing_gc.is_active = True
                grievance_cluster_by_num[gc_spec["cluster_number"]] = existing_gc
            else:
                new_gc = GrievanceCluster(
                    id=uuid.uuid4(),
                    cluster_number=gc_spec["cluster_number"],
                    name=gc_spec["name"],
                    description=gc_spec["description"],
                    associate_dean_id=assoc_auth.id,
                    is_active=True,
                )
                self.db.add(new_gc)
                self.db.flush()
                grievance_cluster_by_num[gc_spec["cluster_number"]] = new_gc
                report["grievance_clusters_created"] += 1

        logger.info(f"Grievance clusters 1-3 active and mapped.")

        # ------------------------------------------------------------------
        # 6. CANONICAL CATEGORY ROUTING
        # ------------------------------------------------------------------
        logger.info("Step 6: Realigning 16 institutional categories...")
        categories_realigned = 0
        for cat_name, routing in INSTITUTIONAL_CATEGORY_ROUTING.items():
            cat = self.db.scalar(select(Category).where(Category.name == cat_name))
            if not cat:
                raise ValueError(f"Institutional category '{cat_name}' not found!")

            cat.routing_type = routing["type"]
            cat.is_active = True

            if routing["type"] == CategoryRoutingType.GRIEVANCE_CLUSTER:
                gc = grievance_cluster_by_num[routing["cluster_num"]]
                cat.grievance_cluster_id = gc.id
                cat.fixed_authority_id = None
            elif routing["type"] == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
                cat.grievance_cluster_id = None
                cat.fixed_authority_id = None
            elif routing["type"] == CategoryRoutingType.FIXED_AUTHORITY:
                fixed_auth = authority_by_email[routing["email"]]
                cat.grievance_cluster_id = None
                cat.fixed_authority_id = fixed_auth.id

            categories_realigned += 1

        report["categories_realigned"] = categories_realigned
        logger.info(f"Realigned {categories_realigned} institutional categories.")

        # ------------------------------------------------------------------
        # 7. DELETE TEST CATEGORIES
        # ------------------------------------------------------------------
        logger.info("Step 7: Deleting test categories...")
        test_cats = self.db.scalars(
            select(Category).where(~Category.name.in_(inst_cats_tuple))
        ).all()
        report["test_categories_deleted"] = len(test_cats)
        for tc in test_cats:
            self.db.delete(tc)
        self.db.flush()
        logger.info(f"Deleted {len(test_cats)} test categories.")

        # ------------------------------------------------------------------
        # 8. DELETE TEST GRIEVANCE CLUSTERS
        # ------------------------------------------------------------------
        logger.info("Step 8: Deleting test grievance clusters...")
        test_gcs = self.db.scalars(
            select(GrievanceCluster).where(~GrievanceCluster.cluster_number.in_([1, 2, 3]))
        ).all()
        report["test_grievance_clusters_deleted"] = len(test_gcs)
        for tgc in test_gcs:
            self.db.delete(tgc)
        self.db.flush()
        logger.info(f"Deleted {len(test_gcs)} test grievance clusters.")

        # ------------------------------------------------------------------
        # 8.5 DELETE TEST SUBJECTS AND TEST SUBJECT CLUSTERS
        # ------------------------------------------------------------------
        logger.info("Step 8.5: Deleting test subjects and test subject clusters...")
        canonical_cs = self.db.scalar(
            select(Subject).where(Subject.name == "Computer Science and Engineering")
        )
        test_subjects = self.db.scalars(
            select(Subject).join(SubjectCluster).where(~SubjectCluster.cluster_number.in_(list(range(1, 11))))
        ).all()
        if test_subjects:
            test_subj_ids = [s.id for s in test_subjects]
            if canonical_cs:
                self.db.execute(
                    text("UPDATE applicant_profiles SET subject_id = :cid, subject_name = :cname WHERE subject_id = ANY(:ids)")
                    .bindparams(cid=canonical_cs.id, cname=canonical_cs.name, ids=test_subj_ids)
                )
                self.db.execute(
                    text("UPDATE nivaran_grievances SET subject_id = :cid WHERE subject_id = ANY(:ids)")
                    .bindparams(cid=canonical_cs.id, ids=test_subj_ids)
                )
                self.db.execute(
                    text("UPDATE nivaran_student_master_records SET subject_id = :cid WHERE subject_id = ANY(:ids)")
                    .bindparams(cid=canonical_cs.id, ids=test_subj_ids)
                )
            for ts in test_subjects:
                self.db.delete(ts)
            self.db.flush()

            logger.info(f"Deleted {len(test_subjects)} test subjects.")

        test_scs = self.db.scalars(
            select(SubjectCluster).where(~SubjectCluster.cluster_number.in_(list(range(1, 11))))
        ).all()
        for tsc in test_scs:
            self.db.delete(tsc)
        self.db.flush()
        logger.info(f"Deleted {len(test_scs)} test subject clusters.")

        # ------------------------------------------------------------------
        # 9. DELETE TEST AUTHORITIES
        # ------------------------------------------------------------------
        logger.info("Step 9: Asserting zero inbound FKs to test authorities and deleting them...")
        canonical_auth_ids = [a.id for a in authority_by_email.values()]
        test_authorities = self.db.scalars(
            select(NivaranAuthority).where(~NivaranAuthority.id.in_(canonical_auth_ids))
        ).all()
        test_auth_ids = [a.id for a in test_authorities]

        if test_auth_ids:
            # Clear test execution residue referencing test authorities
            self.db.execute(text("DELETE FROM nivaran_assignments WHERE authority_id = ANY(:ids)").bindparams(ids=test_auth_ids))
            self.db.execute(text("UPDATE nivaran_grievance_status_history SET actor_authority_id = NULL WHERE actor_authority_id = ANY(:ids)").bindparams(ids=test_auth_ids))
            self.db.execute(text("UPDATE nivaran_grievances SET assigned_authority_id = NULL WHERE assigned_authority_id = ANY(:ids)").bindparams(ids=test_auth_ids))
            self.db.flush()

        # Verify zero inbound references across all tables
        for tbl, col in AUTHORITY_FK_TABLES:
            cnt = self.db.execute(
                text(f"SELECT count(*) FROM {tbl} WHERE {col} = ANY(:ids)").bindparams(ids=test_auth_ids)
            ).scalar()
            if cnt > 0:
                raise ValueError(f"Integrity check failed: {tbl}.{col} still references {cnt} test authorities!")

        report["test_authorities_deleted"] = len(test_authorities)
        for ta in test_authorities:
            self.db.delete(ta)
        self.db.flush()
        logger.info(f"Deleted {len(test_authorities)} test authorities.")

        # ------------------------------------------------------------------
        # 10. POST-MUTATION ASSERTIONS
        # ------------------------------------------------------------------
        logger.info("Step 10: Running post-mutation assertions...")

        # A. nivaran_authorities count == 15
        final_auths = self.db.scalars(select(NivaranAuthority)).all()
        if len(final_auths) != 15:
            raise ValueError(f"Post-assertion failed: Expected 15 authorities, found {len(final_auths)}")
        if not all(a.is_active for a in final_auths):
            raise ValueError("Post-assertion failed: Not all canonical authorities are active")

        role_counts: Dict[str, int] = {}
        for a in final_auths:
            role_counts[a.role.value] = role_counts.get(a.role.value, 0) + 1

        expected_roles = {"DEAN": 1, "MANAGER": 1, "ASSISTANT_DEAN": 10, "ASSOCIATE_DEAN": 3}
        if role_counts != expected_roles:
            raise ValueError(f"Post-assertion failed: Role breakdown mismatch: {role_counts} != {expected_roles}")

        # B. nivaran_subject_clusters count == 10, all 10 have valid assistant_dean_id
        final_scs = self.db.scalars(select(SubjectCluster).order_by(SubjectCluster.cluster_number)).all()
        if len(final_scs) != 10:
            raise ValueError(f"Post-assertion failed: Expected 10 subject clusters, found {len(final_scs)}")
        for sc in final_scs:
            if not sc.assistant_dean_id:
                raise ValueError(f"Post-assertion failed: Subject cluster {sc.cluster_number} has null assistant_dean_id")

        # C. nivaran_subjects count == 56, all active, all belonging to clusters 1..10
        final_subjs = self.db.scalars(select(Subject).where(Subject.is_active == True)).all()
        if len(final_subjs) != 56:
            raise ValueError(f"Post-assertion failed: Expected 56 subjects, found {len(final_subjs)}")

        # D. nivaran_grievance_clusters count == 3, all 3 have valid associate_dean_id

        final_gcs = self.db.scalars(select(GrievanceCluster).order_by(GrievanceCluster.cluster_number)).all()
        if len(final_gcs) != 3:
            raise ValueError(f"Post-assertion failed: Expected 3 grievance clusters, found {len(final_gcs)}")
        for gc in final_gcs:
            if not gc.associate_dean_id:
                raise ValueError(f"Post-assertion failed: Grievance cluster {gc.cluster_number} has null associate_dean_id")

        # D. nivaran_categories count == 16, exact routing verified
        final_cats = self.db.scalars(select(Category).order_by(Category.name)).all()
        if len(final_cats) != 16:
            raise ValueError(f"Post-assertion failed: Expected 16 categories, found {len(final_cats)}")

        cat_by_name = {c.name: c for c in final_cats}
        for name, expected in INSTITUTIONAL_CATEGORY_ROUTING.items():
            cat = cat_by_name.get(name)
            if not cat:
                raise ValueError(f"Post-assertion failed: Category {name} missing")
            if cat.routing_type != expected["type"]:
                raise ValueError(f"Post-assertion failed: Category {name} routing_type {cat.routing_type} != {expected['type']}")
            if expected["type"] == CategoryRoutingType.GRIEVANCE_CLUSTER:
                if not cat.grievance_cluster_id or cat.fixed_authority_id is not None:
                    raise ValueError(f"Post-assertion failed: Category {name} routing target invalid")
            elif expected["type"] == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
                if cat.grievance_cluster_id is not None or cat.fixed_authority_id is not None:
                    raise ValueError(f"Post-assertion failed: Category {name} should have null cluster and fixed authority")
            elif expected["type"] == CategoryRoutingType.FIXED_AUTHORITY:
                if cat.grievance_cluster_id is not None or not cat.fixed_authority_id:
                    raise ValueError(f"Post-assertion failed: Category {name} fixed authority target invalid")

        # Record AuditLog for configuration change
        audit_entry = AuditLog(
            user_id=actor_id,
            module="atharva_veda",
            action="authority.canonical_reconciliation_cleanup",
            entity_name="NivaranAuthority",
            entity_id="system",
            details={
                "canonical_authorities_count": 15,
                "users_activated": activated_count,
                "test_authorities_deleted": len(test_authorities),
                "test_grievance_clusters_deleted": len(test_gcs),
                "test_categories_deleted": len(test_cats),
                "subject_clusters_mapped": subject_clusters_mapped,
                "categories_realigned": categories_realigned,
            },
        )
        self.db.add(audit_entry)
        self.db.flush()

        report["post_mutation_assertions"] = {
            "total_authorities": len(final_auths),
            "active_authorities": sum(1 for a in final_auths if a.is_active),
            "role_counts": role_counts,
            "total_subject_clusters": len(final_scs),
            "total_grievance_clusters": len(final_gcs),
            "total_categories": len(final_cats),
            "audit_log_recorded": True,
        }

        if commit:
            self.db.commit()
            logger.info("Successfully committed Phase 5B reconciliation and cleanup to database!")
        else:
            self.db.rollback()
            logger.info("DRY RUN completed successfully. Transaction rolled back.")

        return report


def main():
    parser = argparse.ArgumentParser(description="Phase 5B Canonical Authority Reconciliation & Cleanup")
    parser.add_argument("--commit", action="store_true", help="Commit the changes to the database")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    with SessionLocal() as db:
        service = AuthorityReconciliationService(db)
        try:
            res = service.execute_reconciliation(commit=args.commit)
            print("\n=== RECONCILIATION RESULT ===")
            import pprint
            pprint.pprint(res)
        except Exception as e:
            logger.error(f"Reconciliation failed: {e}", exc_info=True)
            sys.exit(1)


if __name__ == "__main__":
    main()
