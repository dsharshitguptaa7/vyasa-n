"""
Regression Tests: CMS-Administered Configuration Persistence Across Deployments & Restarts.

Explicitly satisfies Phase 5 & 6 requirements:
1. Bootstrap the application with default seed data.
2. Modify an existing cluster from CMS/service layer (rename, unassign dean).
3. Create a custom subject category.
4. Create a custom subject.
5. Change the subject-to-cluster mapping.
6. Modify an authority mapping (assign custom authority).
7. Run application startup seeding again.
8. Simulate a deployment/restart.
9. Verify that all CMS modifications remain exactly unchanged (IDs, relationships, attributes).
10. Verify that new missing default records can still be safely inserted.
11. Run seeding multiple times and prove idempotency.
"""

import uuid
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.models.role import Role
from app.models.settings import SystemSetting
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import CategoryRoutingType, NivaranRole
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    Category,
    GrievanceCluster,
    Subject,
    SubjectCluster,
)
from app.modules.atharva_veda.nivaran.services.category_seed_service import (
    APPROVED_NIVARAN_CATEGORIES,
    INITIAL_CANONICAL_CATEGORY_NAMES,
    seed_nivaran_categories,
)
from app.modules.atharva_veda.nivaran.services.subject_seed_service import (
    AUTHORITATIVE_SUBJECT_CLUSTERS,
    AUTHORITATIVE_SUBJECTS,
    INITIAL_CANONICAL_CLUSTER_NUMBERS,
    INITIAL_CANONICAL_SUBJECT_NAMES,
    seed_nivaran_subjects_and_clusters,
)
from app.services.authority_seed_service import (
    AuthoritySlotSpec,
    seed_institutional_authorities,
)
from app.services.seed_service import (
    is_governance_bootstrapped,
    mark_governance_bootstrapped,
    seed_all,
)


class InMemoryDatabaseMock:
    """
    A stateful mock database session that stores real ORM entities across multiple
    seed executions, deployment simulations, and CMS operations.
    """

    def __init__(self):
        self.settings: Dict[str, SystemSetting] = {}
        self.roles: Dict[str, Role] = {}
        self.users_by_id: Dict[uuid.UUID, User] = {}
        self.users_by_email: Dict[str, User] = {}
        self.authorities_by_id: Dict[uuid.UUID, NivaranAuthority] = {}
        self.subject_clusters_by_num: Dict[int, SubjectCluster] = {}
        self.subject_clusters_by_id: Dict[uuid.UUID, SubjectCluster] = {}
        self.subjects_by_name: Dict[str, Subject] = {}
        self.subjects_by_id: Dict[uuid.UUID, Subject] = {}
        self.grievance_clusters_by_num: Dict[int, GrievanceCluster] = {}
        self.grievance_clusters_by_id: Dict[uuid.UUID, GrievanceCluster] = {}
        self.categories_by_name: Dict[str, Category] = {}
        self.categories_by_id: Dict[uuid.UUID, Category] = {}

        self.deleted_records: List[Any] = []
        self.add_count = 0
        self.commit_count = 0

    def add(self, obj: Any) -> None:
        self.add_count += 1
        if not getattr(obj, "id", None) and not isinstance(obj, SystemSetting):
            obj.id = uuid.uuid4()

        if isinstance(obj, SystemSetting):
            self.settings[obj.key] = obj
        elif isinstance(obj, Role):
            self.roles[obj.name] = obj
        elif isinstance(obj, User):
            self.users_by_id[obj.id] = obj
            self.users_by_email[obj.email.strip().lower()] = obj
        elif isinstance(obj, NivaranAuthority):
            self.authorities_by_id[obj.id] = obj
        elif isinstance(obj, SubjectCluster):
            self.subject_clusters_by_num[obj.cluster_number] = obj
            self.subject_clusters_by_id[obj.id] = obj
        elif isinstance(obj, Subject):
            self.subjects_by_name[obj.name] = obj
            self.subjects_by_id[obj.id] = obj
        elif isinstance(obj, GrievanceCluster):
            self.grievance_clusters_by_num[obj.cluster_number] = obj
            self.grievance_clusters_by_id[obj.id] = obj
        elif isinstance(obj, Category):
            self.categories_by_name[obj.name] = obj
            self.categories_by_id[obj.id] = obj

    def delete(self, obj: Any) -> None:
        self.deleted_records.append(obj)
        if isinstance(obj, SubjectCluster):
            self.subject_clusters_by_num.pop(obj.cluster_number, None)
            self.subject_clusters_by_id.pop(obj.id, None)
        elif isinstance(obj, Subject):
            self.subjects_by_name.pop(obj.name, None)
            self.subjects_by_id.pop(obj.id, None)
        elif isinstance(obj, Category):
            self.categories_by_name.pop(obj.name, None)
            self.categories_by_id.pop(obj.id, None)
        elif isinstance(obj, NivaranAuthority):
            self.authorities_by_id.pop(obj.id, None)

    def flush(self) -> None:
        pass

    def commit(self) -> None:
        self.commit_count += 1

    def rollback(self) -> None:
        pass

    def scalar(self, stmt: Any) -> Any:
        s = str(stmt).lower()
        params = stmt.compile().params if hasattr(stmt, "compile") else {}

        # 1. SystemSetting
        if "system_settings" in s:
            for key_param in params.values():
                if key_param in self.settings:
                    return self.settings[key_param]
            return None

        # 2. Count queries
        if "count(" in s:
            if "nivaran_subject_clusters" in s:
                return len(self.subject_clusters_by_id)
            if "nivaran_categories" in s:
                return len(self.categories_by_id)
            if "nivaran_subjects" in s:
                return len(self.subjects_by_id)
            if "nivaran_authorities" in s:
                return len(self.authorities_by_id)
            return 0

        # 3. SubjectCluster
        if "nivaran_subject_clusters" in s:
            for num in params.values():
                if isinstance(num, int) and num in self.subject_clusters_by_num:
                    return self.subject_clusters_by_num[num]
            return None

        # 4. Subject
        if "nivaran_subjects" in s:
            for name in params.values():
                if isinstance(name, str) and name in self.subjects_by_name:
                    return self.subjects_by_name[name]
            return None

        # 5. GrievanceCluster
        if "nivaran_grievance_clusters" in s:
            for num in params.values():
                if isinstance(num, int) and num in self.grievance_clusters_by_num:
                    return self.grievance_clusters_by_num[num]
            if self.grievance_clusters_by_num:
                return list(self.grievance_clusters_by_num.values())[0]
            return None

        # 6. Category
        if "nivaran_categories" in s:
            for name in params.values():
                if isinstance(name, str) and name in self.categories_by_name:
                    return self.categories_by_name[name]
            return None

        # 7. NivaranAuthority
        if "nivaran_authorities" in s:
            for val in params.values():
                if isinstance(val, str):
                    clean = val.strip().lower()
                    for auth in self.authorities_by_id.values():
                        if (auth.email_snapshot or "").strip().lower() == clean:
                            return auth
            return None

        # 8. User
        if "users" in s:
            for val in params.values():
                if isinstance(val, str):
                    clean = val.strip().lower()
                    if clean in self.users_by_email:
                        return self.users_by_email[clean]
            return None

        return None

    def execute(self, stmt: Any) -> Any:
        s = str(stmt).lower()
        mock_result = MagicMock()
        params = stmt.compile().params if hasattr(stmt, "compile") else {}

        if "from roles" in s:
            for name in params.values():
                if name in self.roles:
                    mock_result.scalar_one_or_none.return_value = self.roles[name]
                    return mock_result
            mock_result.scalar_one_or_none.return_value = None
            return mock_result

        if "from users" in s:
            found_user = None
            for val in params.values():
                if isinstance(val, uuid.UUID) and val in self.users_by_id:
                    found_user = self.users_by_id[val]
                    break
                if isinstance(val, str) and val.strip().lower() in self.users_by_email:
                    found_user = self.users_by_email[val.strip().lower()]
                    break
            mock_result.unique.return_value.scalar_one_or_none.return_value = found_user
            mock_result.scalar_one_or_none.return_value = found_user
            return mock_result

        if "pillar_registry" in s:
            mock_result.scalar_one_or_none.return_value = None
            return mock_result

        mock_result.scalar_one_or_none.return_value = None
        mock_result.scalars.return_value.all.return_value = []
        return mock_result


# -----------------------------------------------------------------------------
# Regression Suite: 11-Step Lifecycle Test
# -----------------------------------------------------------------------------

def test_complete_cms_configuration_persistence_lifecycle():
    """
    Executes the full 11-step verification verifying CMS-managed configuration
    permanently survives application restarts, deployment seeding, and migrations.
    """
    db = InMemoryDatabaseMock()

    # Create dummy initial roles needed by seed_all
    for r_name in ["super_admin", "administrator", "authority"]:
        role = Role(name=r_name, description=r_name, is_system=True)
        role.id = uuid.uuid4()
        db.add(role)

    # -------------------------------------------------------------------------
    # STEP 1: Bootstrap the application with default seed data
    # -------------------------------------------------------------------------
    with patch("app.modules.sama_veda.services.directory_sync_service.InstitutionalDirectorySyncService") as mock_dir:
        mock_dir.sync_institutional_directory.return_value = {"status": "ok"}
        bootstrap_results = seed_all(db)

    # Verify initial bootstrap populated standard entities
    assert len(db.subject_clusters_by_num) == 10, "Initial bootstrap must populate 10 clusters."
    assert len(db.subjects_by_name) == 56, "Initial bootstrap must populate 56 subjects."
    assert len(db.categories_by_name) == 16, "Initial bootstrap must populate 16 categories."
    assert is_governance_bootstrapped(db) is True, "Database must be marked as bootstrapped post-initialization."

    # -------------------------------------------------------------------------
    # STEP 2: Modify an existing cluster from CMS/service layer
    # -------------------------------------------------------------------------
    cluster_1 = db.subject_clusters_by_num[1]
    original_c1_id = cluster_1.id
    # CMS changes cluster name and explicitly unassigns Assistant Dean
    cluster_1.name = "School of Engineering & Technology (CMS Modified)"
    cluster_1.assistant_dean_id = None

    # -------------------------------------------------------------------------
    # STEP 3: Create a custom subject category via CMS
    # -------------------------------------------------------------------------
    custom_cat_id = uuid.uuid4()
    custom_cat = Category(
        id=custom_cat_id,
        name="Hostel_Affairs_CMS",
        description="CMS Created Category for Student Housing",
        routing_type=CategoryRoutingType.GRIEVANCE_CLUSTER,
        is_active=True,
    )
    db.add(custom_cat)

    # -------------------------------------------------------------------------
    # STEP 4: Create a custom subject via CMS
    # -------------------------------------------------------------------------
    custom_subj_id = uuid.uuid4()
    cluster_2 = db.subject_clusters_by_num[2]
    custom_subject = Subject(
        id=custom_subj_id,
        name="Quantum Computing & Nanotechnology",
        subject_cluster_id=cluster_2.id,
        code="QC-901",
        is_active=True,
    )
    db.add(custom_subject)

    # -------------------------------------------------------------------------
    # STEP 5: Change subject-to-cluster mapping via CMS
    # -------------------------------------------------------------------------
    # Move "Computer Science and Engineering" from Cluster 1 to Cluster 2
    cse_subject = db.subjects_by_name["Computer Science and Engineering"]
    original_cse_id = cse_subject.id
    cse_subject.subject_cluster_id = cluster_2.id

    # -------------------------------------------------------------------------
    # STEP 6: Modify an authority mapping via CMS
    # -------------------------------------------------------------------------
    custom_auth_id = uuid.uuid4()
    custom_auth_user_id = uuid.uuid4()
    custom_auth = NivaranAuthority(
        id=custom_auth_id,
        vyasa_user_id=custom_auth_user_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. CMS Appointed Dean",
        email_snapshot="cms.dean@csjmu.ac.in",
        designation="Dean of Interdisciplinary Sciences",
        department="Engineering",
        is_active=True,
    )
    db.add(custom_auth)

    # Assign this custom authority to Cluster 3
    cluster_3 = db.subject_clusters_by_num[3]
    cluster_3.assistant_dean_id = custom_auth_id

    # Take Snapshot of all CMS configurations
    snapshot_before_reseed = {
        "cluster_1_name": cluster_1.name,
        "cluster_1_asst_dean": cluster_1.assistant_dean_id,
        "cluster_3_asst_dean": cluster_3.assistant_dean_id,
        "cse_cluster_id": cse_subject.subject_cluster_id,
        "custom_cat_name": custom_cat.name,
        "custom_cat_routing": custom_cat.routing_type,
        "custom_subj_name": custom_subject.name,
        "custom_subj_cluster_id": custom_subject.subject_cluster_id,
    }

    # -------------------------------------------------------------------------
    # STEP 7 & 8: Run application startup seeding again / simulate deployment restart
    # -------------------------------------------------------------------------
    with patch("app.modules.sama_veda.services.directory_sync_service.InstitutionalDirectorySyncService") as mock_dir:
        mock_dir.sync_institutional_directory.return_value = {"status": "ok"}
        redeploy_results = seed_all(db)

    # -------------------------------------------------------------------------
    # STEP 9: Verify that all CMS modifications remain exactly unchanged
    # -------------------------------------------------------------------------
    # A. Cluster 1 modifications persisted
    assert cluster_1.id == original_c1_id, "Cluster 1 ID must remain stable."
    assert cluster_1.name == snapshot_before_reseed["cluster_1_name"], (
        "FATAL: CMS modified cluster name was reverted to default!"
    )
    assert cluster_1.assistant_dean_id is None, (
        "FATAL: Intentionally unassigned assistant_dean_id was overwritten by startup seed!"
    )

    # B. Cluster 3 authority assignment persisted
    assert cluster_3.assistant_dean_id == custom_auth_id, (
        "FATAL: CMS authority assignment to Cluster 3 was reverted!"
    )

    # C. Subject mapping move persisted
    assert cse_subject.id == original_cse_id, "Subject ID must remain stable."
    assert cse_subject.subject_cluster_id == cluster_2.id, (
        "FATAL: Custom Subject-to-Cluster mapping was reverted back to default!"
    )

    # D. Custom category persisted
    assert custom_cat.name in db.categories_by_name, "Custom category must survive deployment."
    assert db.categories_by_name[custom_cat.name].id == custom_cat_id
    assert db.categories_by_name[custom_cat.name].routing_type == CategoryRoutingType.GRIEVANCE_CLUSTER

    # E. Custom subject persisted
    assert custom_subject.name in db.subjects_by_name, "Custom subject must survive deployment."
    assert db.subjects_by_name[custom_subject.name].id == custom_subj_id
    assert db.subjects_by_name[custom_subject.name].subject_cluster_id == cluster_2.id

    # F. Zero records deleted by seeder
    assert len(db.deleted_records) == 0, "Startup seeding must never delete database records!"

    # -------------------------------------------------------------------------
    # STEP 10: Verify that new missing default records can still be safely inserted
    # -------------------------------------------------------------------------
    # Simulate future release introducing a new Cluster 11
    new_release_cluster_spec = {
        "cluster_number": 11,
        "name": "Cluster 11 - Advanced Research & Innovation",
        "reference_email": "asst_dean_c11@csjmu.ac.in",
        "description": "Newly introduced default cluster in future release",
    }
    with patch("app.modules.atharva_veda.nivaran.services.subject_seed_service.AUTHORITATIVE_SUBJECT_CLUSTERS",
               AUTHORITATIVE_SUBJECT_CLUSTERS + [new_release_cluster_spec]):
        seed_res = seed_nivaran_subjects_and_clusters(db, force_realign=False)

    # Verify newly introduced default cluster was added additively
    assert 11 in db.subject_clusters_by_num, "New future release default cluster must be safely inserted."
    assert db.subject_clusters_by_num[11].name == "Cluster 11 - Advanced Research & Innovation"
    # Verify existing CMS modifications were NOT affected
    assert cluster_1.name == snapshot_before_reseed["cluster_1_name"]
    assert cse_subject.subject_cluster_id == cluster_2.id

    # -------------------------------------------------------------------------
    # STEP 11: Run seeding multiple times and prove idempotency
    # -------------------------------------------------------------------------
    with patch("app.modules.sama_veda.services.directory_sync_service.InstitutionalDirectorySyncService") as mock_dir:
        mock_dir.sync_institutional_directory.return_value = {"status": "ok"}
        run_1 = seed_all(db)
        run_2 = seed_all(db)
        run_3 = seed_all(db)

    # Assert 0 mutations in all subsequent runs
    assert len(run_1["subjects"]["clusters_created"]) == 0
    assert len(run_1["subjects"]["subjects_created"]) == 0
    assert len(run_1["subjects"]["subjects_realigned"]) == 0

    assert len(run_2["subjects"]["clusters_created"]) == 0
    assert len(run_2["subjects"]["subjects_created"]) == 0
    assert len(run_2["subjects"]["subjects_realigned"]) == 0

    assert len(run_3["subjects"]["clusters_created"]) == 0
    assert len(run_3["subjects"]["subjects_created"]) == 0
    assert len(run_3["subjects"]["subjects_realigned"]) == 0

    # Final assertion on CMS data integrity
    assert cluster_1.name == snapshot_before_reseed["cluster_1_name"]
    assert cluster_1.assistant_dean_id is None
    assert cse_subject.subject_cluster_id == cluster_2.id
    assert custom_cat.name in db.categories_by_name
    assert custom_subject.name in db.subjects_by_name
