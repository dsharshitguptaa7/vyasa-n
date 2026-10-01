"""
Taxonomy Cleanup Service for Atharva Veda (NIVARAN)
Phase 4 Safe Cleanup Execution

Executes audited, transaction-safe lifecycle deactivations and deletions:
- Category A: Authoritative 10 Clusters & 56 Subjects -> 100% UNCHANGED (is_active = True).
- Category B: Referenced Legacy/Test (88 Subjects & 88 Clusters) -> DEACTIVATE (is_active = False).
  Preserves 100% of historical foreign key relationships to grievances, SMRs, and profiles.
- Category C: Unreferenced Test Residue (49 Subjects & 55 Clusters) -> HARD DELETE proven unreferenced records.
  Rollbacks immediately on any error or assertion failure.
"""

import uuid
import logging
from typing import Dict, Any, Set
from sqlalchemy.orm import Session
from sqlalchemy import select, update, delete, text

from app.models.applicant_profile import ApplicantProfile
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject
from app.modules.atharva_veda.nivaran.models.grievance import Grievance

logger = logging.getLogger("vyasa.atharva.taxonomy_cleanup")


def verify_and_build_cleanup_sets(db: Session) -> Dict[str, Any]:
    """
    Queries live PostgreSQL database, enforces all mandatory Phase 4 pre-cleanup assertions,
    and returns frozen ID sets for atomic execution.
    """
    # 1. Authoritative clusters: exactly 10 records, cluster_number 1..10, all active
    auth_clusters = db.scalars(
        select(SubjectCluster)
        .where(SubjectCluster.cluster_number >= 1, SubjectCluster.cluster_number <= 10)
        .order_by(SubjectCluster.cluster_number.asc())
    ).all()

    if len(auth_clusters) != 10:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 10 authoritative clusters, found {len(auth_clusters)}")

    for c in auth_clusters:
        if not c.is_active:
            raise ValueError(f"Pre-cleanup assertion failed: Authoritative Cluster {c.cluster_number} is inactive")

    set_a: Set[uuid.UUID] = {c.id for c in auth_clusters}

    # 2. Authoritative subjects: exactly 56 records, all mapped to set_a, all active
    auth_subjects = db.scalars(
        select(Subject).where(Subject.subject_cluster_id.in_(set_a))
    ).all()

    if len(auth_subjects) != 56:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 56 authoritative subjects, found {len(auth_subjects)}")

    for s in auth_subjects:
        if not s.is_active:
            raise ValueError(f"Pre-cleanup assertion failed: Authoritative Subject '{s.name}' is inactive")

    set_b: Set[uuid.UUID] = {s.id for s in auth_subjects}

    # 3. Live historical records counts
    grv_total = db.scalar(select(text("count(*)")).select_from(Grievance))
    smr_total = db.scalar(text("SELECT count(*) FROM nivaran_student_master_records"))
    prof_total = db.scalar(select(text("count(*)")).select_from(ApplicantProfile))
    prof_with_subject = db.scalar(text("SELECT count(*) FROM applicant_profiles WHERE subject_id IS NOT NULL"))

    if grv_total != 114:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 114 grievances, found {grv_total}")
    if smr_total != 84:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 84 student master records, found {smr_total}")
    if prof_total != 55:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 55 applicant profiles in live DB, found {prof_total}")

    # 4. Inbound references to subjects
    pre_orphaned_grv = db.scalar(text("""
        SELECT count(*) FROM nivaran_grievances g
        LEFT JOIN nivaran_subjects s ON g.subject_id = s.id
        WHERE g.subject_id IS NOT NULL AND s.id IS NULL;
    """))
    pre_orphaned_smr = db.scalar(text("""
        SELECT count(*) FROM nivaran_student_master_records m
        LEFT JOIN nivaran_subjects s ON m.subject_id = s.id
        WHERE m.subject_id IS NOT NULL AND s.id IS NULL;
    """))
    pre_orphaned_prof = db.scalar(text("""
        SELECT count(*) FROM applicant_profiles p
        LEFT JOIN nivaran_subjects s ON p.subject_id = s.id
        WHERE p.subject_id IS NOT NULL AND s.id IS NULL;
    """))

    if pre_orphaned_grv != 0:
        raise ValueError(f"Pre-cleanup assertion failed: Found {pre_orphaned_grv} orphaned grievances before cleanup")
    if pre_orphaned_smr != 0:
        raise ValueError(f"Pre-cleanup assertion failed: Found {pre_orphaned_smr} orphaned SMRs before cleanup")
    # Baseline for applicant profiles in live DB is exactly 10 pre-existing historical dangling profiles
    if pre_orphaned_prof != 10:
        raise ValueError(f"Pre-cleanup assertion failed: Expected exactly 10 pre-existing dangling applicant profiles, found {pre_orphaned_prof}")

    grv_subj_ids = {r[0] for r in db.execute(text("SELECT DISTINCT subject_id FROM nivaran_grievances WHERE subject_id IS NOT NULL")).fetchall()}
    smr_subj_ids = {r[0] for r in db.execute(text("SELECT DISTINCT subject_id FROM nivaran_student_master_records WHERE subject_id IS NOT NULL")).fetchall()}
    prof_subj_ids = {r[0] for r in db.execute(text("SELECT DISTINCT subject_id FROM applicant_profiles WHERE subject_id IS NOT NULL")).fetchall()}

    all_referenced_subject_ids = grv_subj_ids | smr_subj_ids | prof_subj_ids

    # None of the authoritative subjects should have inbound references from old test tickets
    auth_overlap = set_b & all_referenced_subject_ids
    if auth_overlap:
        raise ValueError(f"Pre-cleanup assertion failed: Authoritative subjects appear in legacy reference set: {auth_overlap}")

    # 5. Non-authoritative subjects
    non_auth_subjects = db.scalars(
        select(Subject).where(~Subject.id.in_(set_b))
    ).all()

    set_c: Set[uuid.UUID] = set()  # Referenced non-authoritative
    set_e: Set[uuid.UUID] = set()  # Unreferenced non-authoritative

    for s in non_auth_subjects:
        if s.id in all_referenced_subject_ids:
            set_c.add(s.id)
        else:
            set_e.add(s.id)

    if len(set_c) != 88:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 88 Category B referenced subjects, found {len(set_c)}")
    if len(set_e) != 49:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 49 Category C unreferenced subjects, found {len(set_e)}")

    # 6. Non-authoritative clusters
    non_auth_clusters = db.scalars(
        select(SubjectCluster).where(~SubjectCluster.id.in_(set_a))
    ).all()

    # Map each non-auth cluster to its subjects
    all_subjects = db.scalars(select(Subject)).all()
    cluster_subject_map: Dict[uuid.UUID, Set[uuid.UUID]] = {}
    for s in all_subjects:
        cluster_subject_map.setdefault(s.subject_cluster_id, set()).add(s.id)

    set_d: Set[uuid.UUID] = set()  # Referenced non-authoritative clusters
    set_f: Set[uuid.UUID] = set()  # Unreferenced non-authoritative clusters

    for c in non_auth_clusters:
        c_subjs = cluster_subject_map.get(c.id, set())
        has_referenced_subj = any(sid in set_c for sid in c_subjs)
        if has_referenced_subj:
            set_d.add(c.id)
        else:
            set_f.add(c.id)

    if len(set_d) != 88:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 88 Category B referenced clusters, found {len(set_d)}")
    if len(set_f) != 55:
        raise ValueError(f"Pre-cleanup assertion failed: Expected 55 Category C unreferenced clusters, found {len(set_f)}")

    # 7. Disjointness and completeness assertions
    assert len(set_a & set_d) == 0, "Assertion failure: SET A and SET D overlap!"
    assert len(set_a & set_f) == 0, "Assertion failure: SET A and SET F overlap!"
    assert len(set_d & set_f) == 0, "Assertion failure: SET D and SET F overlap!"
    assert len(set_b & set_c) == 0, "Assertion failure: SET B and SET C overlap!"
    assert len(set_b & set_e) == 0, "Assertion failure: SET B and SET E overlap!"
    assert len(set_c & set_e) == 0, "Assertion failure: SET C and SET E overlap!"

    return {
        "set_a": set_a,
        "set_b": set_b,
        "set_c": set_c,
        "set_d": set_d,
        "set_e": set_e,
        "set_f": set_f,
        "counts": {
            "authoritative_clusters": len(set_a),
            "authoritative_subjects": len(set_b),
            "category_b_subjects": len(set_c),
            "category_b_clusters": len(set_d),
            "category_c_subjects": len(set_e),
            "category_c_clusters": len(set_f),
            "total_clusters_pre": len(set_a) + len(set_d) + len(set_f),
            "total_subjects_pre": len(set_b) + len(set_c) + len(set_e),
            "grievances": grv_total,
            "smr": smr_total,
            "applicant_profiles": prof_total,
            "applicant_profiles_with_subject": prof_with_subject,
            "pre_orphaned_prof": pre_orphaned_prof,
        }
    }


def execute_phase4_cleanup(db: Session, dry_run: bool = False) -> Dict[str, Any]:
    """
    Executes Phase 4 cleanup inside a controlled transaction.
    Rolls back automatically if any assertion fails.
    """
    # 1. Pre-cleanup audit and validation
    audit_data = verify_and_build_cleanup_sets(db)
    counts = audit_data["counts"]
    set_a = audit_data["set_a"]
    set_b = audit_data["set_b"]
    set_c = audit_data["set_c"]
    set_d = audit_data["set_d"]
    set_e = audit_data["set_e"]
    set_f = audit_data["set_f"]

    logger.info("[Phase 4 Cleanup] Pre-cleanup verification passed. Beginning atomic transaction...")

    try:
        # STEP 1: Deactivate Category B subjects (is_active = FALSE)
        db.execute(
            update(Subject)
            .where(Subject.id.in_(set_c))
            .values(is_active=False)
        )

        # STEP 2: Deactivate Category B clusters (is_active = FALSE)
        db.execute(
            update(SubjectCluster)
            .where(SubjectCluster.id.in_(set_d))
            .values(is_active=False)
        )

        # STEP 3: Hard delete Category C subjects (proven 0 inbound references)
        res_del_sub = db.execute(
            delete(Subject).where(Subject.id.in_(set_e))
        )
        deleted_subjects_count = res_del_sub.rowcount

        if deleted_subjects_count != len(set_e):
            raise ValueError(f"Deletion mismatch: Expected to delete {len(set_e)} subjects, deleted {deleted_subjects_count}")

        # STEP 4: Verify parent clusters of Category C subjects are now completely empty
        remaining_subjs_in_c_clusters = db.scalar(
            select(text("count(*)")).select_from(Subject).where(Subject.subject_cluster_id.in_(set_f))
        )

        if remaining_subjs_in_c_clusters != 0:
            raise ValueError(f"Integrity failure: Category C clusters still contain {remaining_subjs_in_c_clusters} subjects")

        # STEP 5: Hard delete Category C clusters (now empty, 0 inbound references)
        res_del_clus = db.execute(
            delete(SubjectCluster).where(SubjectCluster.id.in_(set_f))
        )
        deleted_clusters_count = res_del_clus.rowcount

        if deleted_clusters_count != len(set_f):
            raise ValueError(f"Deletion mismatch: Expected to delete {len(set_f)} clusters, deleted {deleted_clusters_count}")

        # STEP 6: Post-cleanup verification assertions inside the transaction
        # A. Active subjects
        active_subjects = db.scalars(select(Subject).where(Subject.is_active == True)).all()
        if len(active_subjects) != 56:
            raise ValueError(f"Post-cleanup assertion failed: Expected 56 active subjects, found {len(active_subjects)}")
        for s in active_subjects:
            if s.id not in set_b or s.subject_cluster_id not in set_a:
                raise ValueError(f"Post-cleanup assertion failed: Active subject {s.name} does not belong to authoritative set")

        # B. Active clusters
        active_clusters = db.scalars(select(SubjectCluster).where(SubjectCluster.is_active == True)).all()
        if len(active_clusters) != 10:
            raise ValueError(f"Post-cleanup assertion failed: Expected 10 active clusters, found {len(active_clusters)}")
        for c in active_clusters:
            if c.id not in set_a or c.cluster_number < 1 or c.cluster_number > 10:
                raise ValueError(f"Post-cleanup assertion failed: Active cluster {c.name} is not an authoritative 1..10 cluster")

        # C. Total database counts
        total_subjects_post = db.scalar(select(text("count(*)")).select_from(Subject))
        if total_subjects_post != 144:  # 56 active + 88 inactive
            raise ValueError(f"Post-cleanup assertion failed: Expected 144 total subjects, found {total_subjects_post}")

        total_clusters_post = db.scalar(select(text("count(*)")).select_from(SubjectCluster))
        if total_clusters_post != 98:  # 10 active + 88 inactive
            raise ValueError(f"Post-cleanup assertion failed: Expected 98 total clusters, found {total_clusters_post}")

        # D. Historical integrity check
        grv_post = db.scalar(select(text("count(*)")).select_from(Grievance))
        smr_post = db.scalar(text("SELECT count(*) FROM nivaran_student_master_records"))
        prof_post = db.scalar(select(text("count(*)")).select_from(ApplicantProfile))

        if grv_post != counts["grievances"] or smr_post != counts["smr"] or prof_post != counts["applicant_profiles"]:
            raise ValueError("Post-cleanup assertion failed: Historical record counts changed during transaction!")

        # E. Verify every grievance, SMR, and applicant profile still has a valid foreign key in nivaran_subjects
        orphaned_grv = db.scalar(text("""
            SELECT count(*) FROM nivaran_grievances g
            LEFT JOIN nivaran_subjects s ON g.subject_id = s.id
            WHERE g.subject_id IS NOT NULL AND s.id IS NULL;
        """))
        if orphaned_grv != 0:
            raise ValueError(f"Post-cleanup integrity failed: {orphaned_grv} orphaned grievances found!")

        orphaned_smr = db.scalar(text("""
            SELECT count(*) FROM nivaran_student_master_records m
            LEFT JOIN nivaran_subjects s ON m.subject_id = s.id
            WHERE m.subject_id IS NOT NULL AND s.id IS NULL;
        """))
        if orphaned_smr != 0:
            raise ValueError(f"Post-cleanup integrity failed: {orphaned_smr} orphaned SMRs found!")

        orphaned_prof = db.scalar(text("""
            SELECT count(*) FROM applicant_profiles p
            LEFT JOIN nivaran_subjects s ON p.subject_id = s.id
            WHERE p.subject_id IS NOT NULL AND s.id IS NULL;
        """))
        if orphaned_prof != counts["pre_orphaned_prof"]:
            raise ValueError(f"Post-cleanup integrity failed: Orphaned applicant profiles changed from baseline {counts['pre_orphaned_prof']} to {orphaned_prof}!")

        if dry_run:
            db.rollback()
            logger.info("[Phase 4 Cleanup] DRY RUN complete. All assertions passed. Changes rolled back.")
            return {
                "dry_run": True,
                "committed": False,
                "pre_counts": counts,
                "mutations": {
                    "category_b_subjects_deactivated": len(set_c),
                    "category_b_clusters_deactivated": len(set_d),
                    "category_c_subjects_deleted": deleted_subjects_count,
                    "category_c_clusters_deleted": deleted_clusters_count,
                },
                "post_counts": {
                    "active_subjects": len(active_subjects),
                    "active_clusters": len(active_clusters),
                    "total_subjects": total_subjects_post,
                    "total_clusters": total_clusters_post,
                    "grievances": grv_post,
                    "smr": smr_post,
                    "applicant_profiles": prof_post,
                }
            }

        db.commit()
        logger.info("[Phase 4 Cleanup] Transaction successfully committed!")

        return {
            "dry_run": False,
            "committed": True,
            "pre_counts": counts,
            "mutations": {
                "category_b_subjects_deactivated": len(set_c),
                "category_b_clusters_deactivated": len(set_d),
                "category_c_subjects_deleted": deleted_subjects_count,
                "category_c_clusters_deleted": deleted_clusters_count,
            },
            "post_counts": {
                "active_subjects": len(active_subjects),
                "active_clusters": len(active_clusters),
                "total_subjects": total_subjects_post,
                "total_clusters": total_clusters_post,
                "grievances": grv_post,
                "smr": smr_post,
                "applicant_profiles": prof_post,
            }
        }

    except Exception as e:
        db.rollback()
        logger.error(f"[Phase 4 Cleanup] Error during execution: {e}. Transaction rolled back.", exc_info=True)
        raise


if __name__ == "__main__":
    import argparse
    from app.core.database import SessionLocal

    parser = argparse.ArgumentParser(description="VYASA Phase 4 Safe Taxonomy Cleanup")
    parser.add_argument("--commit", action="store_true", help="Commit transaction to database")
    args = parser.parse_args()

    with SessionLocal() as session:
        is_dry_run = not args.commit
        res = execute_phase4_cleanup(session, dry_run=is_dry_run)
        print("=== PHASE 4 CLEANUP RESULT ===")
        print(f"Committed: {res['committed']} (Dry Run: {res['dry_run']})")
        print("\nPre-cleanup Counts:")
        for k, v in res["pre_counts"].items():
            print(f"  {k}: {v}")
        print("\nMutations:")
        for k, v in res["mutations"].items():
            print(f"  {k}: {v}")
        print("\nPost-cleanup Counts:")
        for k, v in res["post_counts"].items():
            print(f"  {k}: {v}")
