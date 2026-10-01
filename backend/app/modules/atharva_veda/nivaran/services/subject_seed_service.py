import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.user import User
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole

logger = logging.getLogger("vyasa.atharva.subject_seed")

# Authoritative 10 Subject Clusters from projects/NIVARAN-AI/scripts/seed_subject_clusters.py
AUTHORITATIVE_SUBJECT_CLUSTERS: List[Dict[str, Any]] = [
    {
        "cluster_number": 1,
        "name": "Cluster 1",
        "description": "Authoritative Subject Cluster 1",
        "reference_email": "ankit.trivedi@nivaran.local",
    },
    {
        "cluster_number": 2,
        "name": "Cluster 2",
        "description": "Authoritative Subject Cluster 2",
        "reference_email": "pooja.singh@nivaran.local",
    },
    {
        "cluster_number": 3,
        "name": "Cluster 3",
        "description": "Authoritative Subject Cluster 3",
        "reference_email": "priyanka.maurya@nivaran.local",
    },
    {
        "cluster_number": 4,
        "name": "Cluster 4",
        "description": "Authoritative Subject Cluster 4",
        "reference_email": "dipesh.verma@nivaran.local",
    },
    {
        "cluster_number": 5,
        "name": "Cluster 5",
        "description": "Authoritative Subject Cluster 5",
        "reference_email": "adarsh.srivastav@nivaran.local",
    },
    {
        "cluster_number": 6,
        "name": "Cluster 6",
        "description": "Authoritative Subject Cluster 6",
        "reference_email": "pravin.agarwal@nivaran.local",
    },
    {
        "cluster_number": 7,
        "name": "Cluster 7",
        "description": "Authoritative Subject Cluster 7",
        "reference_email": "shashi.mishra@nivaran.local",
    },
    {
        "cluster_number": 8,
        "name": "Cluster 8",
        "description": "Authoritative Subject Cluster 8",
        "reference_email": "priyanka.gupta@nivaran.local",
    },
    {
        "cluster_number": 9,
        "name": "Cluster 9",
        "description": "Authoritative Subject Cluster 9",
        "reference_email": "anjani.upadhayay@nivaran.local",
    },
    {
        "cluster_number": 10,
        "name": "Cluster 10",
        "description": "Authoritative Subject Cluster 10",
        "reference_email": "samiuddin@nivaran.local",
    },
]

# Authoritative 56 Subjects by Cluster from projects/NIVARAN-AI/scripts/seed_subjects.py
AUTHORITATIVE_SUBJECTS: Dict[int, List[str]] = {
    1: [
        "Philosophy",
        "Mathematics",
        "Economics",
        "Urdu",
    ],
    2: [
        "Home Science",
        "Music",
        "Psychology",
        "Business Management",
        "English Literature",
    ],
    3: [
        "Zoology",
        "Chemistry",
        "Pharmacy",
        "Geography",
    ],
    4: [
        "Botany",
        "Microbiology",
        "Biochemistry",
        "Commerce",
    ],
    5: [
        "Hindi Literature",
        "Sociology",
        "Statistics",
    ],
    6: [
        "Physical Education",
        "Sanskrit",
        "Yoga",
        "Life Science",
        "Biotechnology",
    ],
    7: [
        "Deen Dayal Sodh Kendra",
        "Hindu Studies",
        "Library and Information Science",
        "Journalism and Mass Communication",
        "Food Technology",
        "Education/Education Training",
    ],
    8: [
        "Political Science",
        "Law",
        "Chemical Engineering",
        "Electronics and Communication Engineering",
        "Mechanical Engineering",
    ],
    9: [
        "Drawing and Painting",
        "Physics",
        "Defence and Strategies",
        "History",
        "MLT",
        "Physiotherapy",
    ],
    10: [
        "Social Work",
        "Life Long Engineering",
        "Computer Application",
        "Computer Science and Engineering",
        "Soil Science",
        "Genetics and Plant Breeding",
        "Agronomy",
        "Agricultural Economics",
        "Soil Conservation",
        "Horticulture",
        "Agricultural Chemistry",
        "Agriculture Entomology",
        "Plant Pathology",
        "Agriculture Extension",
    ],
}


def resolve_assistant_dean(db: Session, email: str) -> Optional[NivaranAuthority]:
    """
    Looks up an authentic active Assistant Dean in the database by institutional email.
    Matches against:
    1. NivaranAuthority.email_snapshot == email
    2. User.email == email joined through vyasa_user_id
    Strictly verifies role == NivaranRole.ASSISTANT_DEAN and is_active is True.
    Never creates synthetic users or guesses arbitrary authorities.
    Returns None if no authentic match exists.
    """
    if not email:
        return None
    clean_email = email.strip().lower()

    # 1. Match against NivaranAuthority email_snapshot
    auth = db.scalar(
        select(NivaranAuthority).where(
            func.lower(NivaranAuthority.email_snapshot) == clean_email,
            NivaranAuthority.role == NivaranRole.ASSISTANT_DEAN,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if auth:
        return auth

    # 2. Match against Core User email joined through vyasa_user_id
    auth = db.scalar(
        select(NivaranAuthority)
        .join(User, NivaranAuthority.vyasa_user_id == User.id)
        .where(
            func.lower(User.email) == clean_email,
            NivaranAuthority.role == NivaranRole.ASSISTANT_DEAN,
            NivaranAuthority.is_active.is_(True),
        )
    )
    return auth


def seed_nivaran_subjects_and_clusters(db: Session) -> Dict[str, Any]:
    """
    Idempotently seeds all 10 authoritative reference Subject Clusters and 56 Subjects into VYASA.
    
    Guarantees:
    - Never deletes or modifies unrelated clusters/subjects (preserves existing historical test records).
    - Checks existence by cluster_number and subject name.
    - Resolves Assistant Dean strictly by matching reference email to real active authorities.
      Unresolved reference emails are safely set to None (nullable in schema) for Admin Panel mapping.
    - Idempotent: safe to run multiple times without duplicating entries.
    """
    clusters_created: List[Dict[str, Any]] = []
    clusters_existing: List[Dict[str, Any]] = []
    assistant_dean_resolutions: List[Dict[str, Any]] = []

    cluster_record_map: Dict[int, SubjectCluster] = {}

    # 1. Seed or Verify Subject Clusters (1 through 10)
    for c_spec in AUTHORITATIVE_SUBJECT_CLUSTERS:
        num = c_spec["cluster_number"]
        name = c_spec["name"]
        desc = c_spec.get("description")
        ref_email = c_spec["reference_email"]

        # Attempt to resolve authentic Assistant Dean in database
        asst_dean = resolve_assistant_dean(db, ref_email)
        asst_dean_id = asst_dean.id if asst_dean else None

        assistant_dean_resolutions.append({
            "cluster_number": num,
            "cluster_name": name,
            "reference_email": ref_email,
            "resolved": asst_dean is not None,
            "assistant_dean_id": str(asst_dean_id) if asst_dean_id else None,
            "assistant_dean_name": asst_dean.name_snapshot if asst_dean else None,
        })

        existing_cluster = db.scalar(
            select(SubjectCluster).where(SubjectCluster.cluster_number == num)
        )

        if not existing_cluster:
            # Create cluster
            cluster = SubjectCluster(
                cluster_number=num,
                name=name,
                description=desc,
                assistant_dean_id=asst_dean_id,
                is_active=True,
            )
            db.add(cluster)
            db.flush()
            cluster_record_map[num] = cluster
            clusters_created.append({
                "id": str(cluster.id),
                "cluster_number": num,
                "name": name,
                "assistant_dean_id": str(asst_dean_id) if asst_dean_id else None,
            })
        else:
            # Preserve existing cluster record; update assistant_dean if unassigned and resolved
            if existing_cluster.assistant_dean_id is None and asst_dean_id is not None:
                existing_cluster.assistant_dean_id = asst_dean_id
            cluster_record_map[num] = existing_cluster
            clusters_existing.append({
                "id": str(existing_cluster.id),
                "cluster_number": num,
                "name": existing_cluster.name,
                "assistant_dean_id": str(existing_cluster.assistant_dean_id) if existing_cluster.assistant_dean_id else None,
            })

    # 2. Seed or Verify 56 Subjects
    subjects_created: List[Dict[str, Any]] = []
    subjects_existing: List[Dict[str, Any]] = []
    subjects_realigned: List[Dict[str, Any]] = []

    total_expected_subjects = sum(len(subjs) for subjs in AUTHORITATIVE_SUBJECTS.values())

    for cluster_num, subject_names in AUTHORITATIVE_SUBJECTS.items():
        cluster = cluster_record_map.get(cluster_num)
        if not cluster:
            raise ValueError(f"Target SubjectCluster {cluster_num} was not initialized.")

        for subj_name in subject_names:
            existing_subj = db.scalar(
                select(Subject).where(Subject.name == subj_name)
            )

            if not existing_subj:
                new_subj = Subject(
                    name=subj_name,
                    subject_cluster_id=cluster.id,
                    is_active=True,
                )
                db.add(new_subj)
                subjects_created.append({
                    "name": subj_name,
                    "cluster_number": cluster_num,
                    "cluster_id": str(cluster.id),
                })
            else:
                # Ensure mapping points to the authoritative cluster
                if existing_subj.subject_cluster_id != cluster.id:
                    existing_subj.subject_cluster_id = cluster.id
                    subjects_realigned.append({
                        "name": subj_name,
                        "cluster_number": cluster_num,
                        "cluster_id": str(cluster.id),
                    })
                else:
                    subjects_existing.append({
                        "id": str(existing_subj.id),
                        "name": subj_name,
                        "cluster_number": cluster_num,
                    })

    db.commit()

    logger.info(
        f"[NIVARAN Subject Seed] Complete: "
        f"Clusters ({len(clusters_created)} created, {len(clusters_existing)} preserved); "
        f"Subjects ({len(subjects_created)} created, {len(subjects_existing)} preserved, "
        f"{len(subjects_realigned)} realigned)."
    )

    return {
        "authoritative_clusters_count": len(AUTHORITATIVE_SUBJECT_CLUSTERS),
        "clusters_created": clusters_created,
        "clusters_existing": clusters_existing,
        "assistant_dean_resolutions": assistant_dean_resolutions,
        "authoritative_subjects_count": total_expected_subjects,
        "subjects_created": subjects_created,
        "subjects_existing": subjects_existing,
        "subjects_realigned": subjects_realigned,
    }


if __name__ == "__main__":
    from app.core.database import SessionLocal

    with SessionLocal() as session:
        results = seed_nivaran_subjects_and_clusters(session)
        print("=== SUBJECT & CLUSTER SEEDING RESULTS ===")
        print(f"Clusters created: {len(results['clusters_created'])}")
        print(f"Clusters existing: {len(results['clusters_existing'])}")
        print(f"Subjects created: {len(results['subjects_created'])}")
        print(f"Subjects existing: {len(results['subjects_existing'])}")
        print(f"Subjects realigned: {len(results['subjects_realigned'])}")
        print("\nAssistant Dean Resolutions:")
        for r in results["assistant_dean_resolutions"]:
            print(f"  Cluster {r['cluster_number']}: {r['reference_email']} -> Resolved: {r['resolved']}")
