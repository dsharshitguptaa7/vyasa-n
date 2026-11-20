"""
Regression Tests: Production Migration & Seed Configuration Persistence.

Verifies that admin-managed persistent configurations survive application restarts,
deployments, repeated seed executions, and database migrations:
1. Custom Subject Cluster mappings survive migrations / seed runs.
2. Custom Authorities mappings survive migrations / seed runs.
3. Running seed initialization multiple times does not modify existing custom mappings.
4. Missing default mappings can still be inserted safely without touching existing records.
5. Seed and initialization logic does not delete configuration records.
6. Existing IDs and relationships remain intact.
7. Admin changes (e.g. unassigning an Assistant Dean, deactivating an authority) persist after restart.
8. Repeated migration/initialization does not revert manually configured values.
"""

import uuid
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, call, patch

import pytest
from sqlalchemy.orm import Session

from app.models.role import Role
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.models.taxonomy import Subject, SubjectCluster
from app.modules.atharva_veda.nivaran.services.subject_seed_service import (
    AUTHORITATIVE_SUBJECT_CLUSTERS,
    AUTHORITATIVE_SUBJECTS,
    seed_nivaran_subjects_and_clusters,
)
from app.services.authority_seed_service import (
    AuthoritySlotSpec,
    seed_institutional_authorities,
)
from app.services.seed_service import seed_all


# -----------------------------------------------------------------------------
# Helpers & Fixtures
# -----------------------------------------------------------------------------

def _make_mock_cluster(cluster_number: int, name: str, assistant_dean_id: Optional[uuid.UUID] = None) -> SubjectCluster:
    c = SubjectCluster(
        cluster_number=cluster_number,
        name=name,
        description=f"Description for {name}",
        assistant_dean_id=assistant_dean_id,
        is_active=True,
    )
    c.id = uuid.uuid4()
    return c


def _make_mock_subject(name: str, cluster_id: uuid.UUID) -> Subject:
    s = Subject(
        name=name,
        subject_cluster_id=cluster_id,
        is_active=True,
    )
    s.id = uuid.uuid4()
    return s


# -----------------------------------------------------------------------------
# Test Suite: Subject Cluster Persistence
# -----------------------------------------------------------------------------

class TestSubjectClusterPersistence:
    """Proves that custom admin Subject Cluster mappings permanently survive seed/migration runs."""

    def test_custom_subject_cluster_mapping_survives_seed(self):
        """
        Requirement 1: An admin moved 'Computer Science and Engineering' from Cluster 1 to Cluster 2.
        Running seed_nivaran_subjects_and_clusters must NOT revert the subject back to Cluster 1.
        """
        mock_db = MagicMock(spec=Session)

        cluster_1 = _make_mock_cluster(1, "Cluster 1")
        cluster_2 = _make_mock_cluster(2, "Cluster 2")
        clusters_by_num = {1: cluster_1, 2: cluster_2}
        for n in range(3, 11):
            clusters_by_num[n] = _make_mock_cluster(n, f"Cluster {n}")

        # Subject belongs to Cluster 2 (admin-modified from default Cluster 1)
        cse_subject = _make_mock_subject("Computer Science and Engineering", cluster_2.id)

        def mock_scalar(query):
            q = str(query).lower()
            if "nivaran_subject_clusters" in q:
                params = query.compile().params
                for num in params.values():
                    if num in clusters_by_num:
                        return clusters_by_num[num]
                return cluster_1
            if "nivaran_subjects" in q:
                params = query.compile().params
                if any("computer science and engineering" in str(v).lower() for v in params.values()):
                    return cse_subject
                return None
            return None

        mock_db.scalar.side_effect = mock_scalar

        # Execute seeder with default safe settings (force_realign=False)
        result = seed_nivaran_subjects_and_clusters(mock_db, force_realign=False)

        # Assertions
        assert cse_subject.subject_cluster_id == cluster_2.id, (
            "FATAL: Admin-configured subject_cluster_id was reverted to default!"
        )
        assert len(result["subjects_realigned"]) == 0, (
            f"Subjects were unexpectedly realigned: {result['subjects_realigned']}"
        )
        assert mock_db.delete.call_count == 0, "No records should ever be deleted by seeder!"

    def test_unassigned_assistant_dean_persists(self):
        """
        Requirement 2 & 7: An admin deliberately unassigned the Assistant Dean from Cluster 1.
        Running seed_nivaran_subjects_and_clusters must NOT forcefully reassign a default Assistant Dean.
        """
        mock_db = MagicMock(spec=Session)

        # Cluster 1 with NO assistant dean assigned (admin unassigned)
        cluster_1 = _make_mock_cluster(1, "Cluster 1", assistant_dean_id=None)
        clusters_by_num = {1: cluster_1}
        for n in range(2, 11):
            clusters_by_num[n] = _make_mock_cluster(n, f"Cluster {n}")

        def mock_scalar(query):
            q = str(query).lower()
            if "nivaran_subject_clusters" in q:
                params = query.compile().params
                for num in params.values():
                    if num in clusters_by_num:
                        return clusters_by_num[num]
                return cluster_1
            return None

        mock_db.scalar.side_effect = mock_scalar

        with patch("app.modules.atharva_veda.nivaran.services.subject_seed_service.resolve_assistant_dean") as mock_resolve:
            mock_dean = MagicMock()
            mock_dean.id = uuid.uuid4()
            mock_dean.name_snapshot = "Default Dean"
            mock_resolve.return_value = mock_dean

            seed_nivaran_subjects_and_clusters(mock_db, force_realign=False)

        # Cluster 1 assistant_dean_id must still be None
        assert cluster_1.assistant_dean_id is None, (
            "FATAL: Intentionally unassigned assistant_dean_id was overwritten by default resolver!"
        )

    def test_custom_assigned_assistant_dean_persists(self):
        """
        Requirement 2 & 6: An admin assigned a custom Assistant Dean to Cluster 1.
        Running seed_nivaran_subjects_and_clusters must NOT overwrite the custom assignment.
        """
        mock_db = MagicMock(spec=Session)

        custom_dean_id = uuid.uuid4()
        cluster_1 = _make_mock_cluster(1, "Cluster 1", assistant_dean_id=custom_dean_id)
        clusters_by_num = {1: cluster_1}
        for n in range(2, 11):
            clusters_by_num[n] = _make_mock_cluster(n, f"Cluster {n}")

        def mock_scalar(query):
            q = str(query).lower()
            if "nivaran_subject_clusters" in q:
                params = query.compile().params
                for num in params.values():
                    if num in clusters_by_num:
                        return clusters_by_num[num]
                return cluster_1
            return None

        mock_db.scalar.side_effect = mock_scalar

        with patch("app.modules.atharva_veda.nivaran.services.subject_seed_service.resolve_assistant_dean") as mock_resolve:
            default_dean = MagicMock()
            default_dean.id = uuid.uuid4()  # A different default ID
            mock_resolve.return_value = default_dean

            seed_nivaran_subjects_and_clusters(mock_db, force_realign=False)

        assert cluster_1.assistant_dean_id == custom_dean_id, (
            "FATAL: Admin-assigned assistant_dean_id was overwritten by default resolver!"
        )

    def test_missing_default_subjects_inserted_safely(self):
        """
        Requirement 4: If a canonical subject is missing from DB, it is safely created without
        touching any existing subjects or clusters.
        """
        mock_db = MagicMock(spec=Session)
        created_objects = []
        mock_db.add.side_effect = lambda obj: created_objects.append(obj)

        cluster_1 = _make_mock_cluster(1, "Cluster 1")
        clusters_by_num = {n: _make_mock_cluster(n, f"Cluster {n}") for n in range(1, 11)}

        existing_subject = _make_mock_subject("Computer Science and Engineering", cluster_1.id)

        def mock_scalar(query):
            q = str(query).lower()
            if "nivaran_subject_clusters" in q:
                params = query.compile().params
                for num in params.values():
                    if num in clusters_by_num:
                        return clusters_by_num[num]
                return cluster_1
            if "nivaran_subjects" in q:
                params = query.compile().params
                if any("computer science and engineering" in str(v).lower() for v in params.values()):
                    return existing_subject
                return None  # All other subjects are missing
            return None

        mock_db.scalar.side_effect = mock_scalar

        result = seed_nivaran_subjects_and_clusters(mock_db, force_realign=False)

        # Missing subjects were created
        assert len(result["subjects_created"]) > 0
        assert len(created_objects) > 0
        # Existing subject was preserved in subjects_existing
        assert len(result["subjects_existing"]) >= 1
        assert existing_subject.subject_cluster_id == cluster_1.id

    def test_repeated_seed_runs_produce_zero_mutations(self):
        """
        Requirement 3 & 8: Running seed_nivaran_subjects_and_clusters multiple times produces
        0 created, 0 realigned, 0 deleted, and preserves all existing records.
        """
        mock_db = MagicMock(spec=Session)
        clusters = {n: _make_mock_cluster(n, f"Cluster {n}") for n in range(1, 11)}

        subjects = {
            name: _make_mock_subject(name, clusters[c_num].id)
            for c_num, s_list in AUTHORITATIVE_SUBJECTS.items()
            for name in s_list
        }

        def mock_scalar(query):
            q = str(query).lower()
            if "nivaran_subject_clusters" in q:
                params = query.compile().params
                for num in params.values():
                    if num in clusters:
                        return clusters[num]
                return clusters[1]
            if "nivaran_subjects" in q:
                params = query.compile().params
                for s_name, s_obj in subjects.items():
                    if any(s_name.lower() in str(v).lower() for v in params.values()):
                        return s_obj
                return list(subjects.values())[0]
            return None

        mock_db.scalar.side_effect = mock_scalar

        # First run
        res1 = seed_nivaran_subjects_and_clusters(mock_db, force_realign=False)
        assert len(res1["clusters_created"]) == 0
        assert len(res1["subjects_created"]) == 0
        assert len(res1["subjects_realigned"]) == 0

        # Second run
        res2 = seed_nivaran_subjects_and_clusters(mock_db, force_realign=False)
        assert len(res2["clusters_created"]) == 0
        assert len(res2["subjects_created"]) == 0
        assert len(res2["subjects_realigned"]) == 0

        # Third run
        res3 = seed_nivaran_subjects_and_clusters(mock_db, force_realign=False)
        assert len(res3["clusters_created"]) == 0
        assert len(res3["subjects_created"]) == 0
        assert len(res3["subjects_realigned"]) == 0


# -----------------------------------------------------------------------------
# Test Suite: Authorities Persistence
# -----------------------------------------------------------------------------

class TestAuthoritiesPersistence:
    """Proves that custom admin Authorities configurations permanently survive seed/migration runs."""

    def test_custom_authority_user_details_persist(self):
        """
        Requirement 2 & 7: An admin updated an authority user's name, email, and deactivated them.
        Running seed_institutional_authorities must NOT overwrite email, name, password, or is_active!
        """
        mock_db = MagicMock(spec=Session)

        auth_role = Role(name="authority", description="Authority role", is_system=True)
        auth_role.id = uuid.uuid4()

        spec_id = uuid.uuid4()
        existing_user = User(
            id=spec_id,
            email="admin.renamed@csjmu.ac.in",
            first_name="Dr. Renamed",
            last_name="Authority",
            password_hash="custom_admin_hash_999",
            is_active=False,  # Deliberately deactivated by admin
            is_verified=True,
        )
        existing_user.roles = [auth_role]

        spec = AuthoritySlotSpec(
            slot="AUTHORITY_01",
            id=spec_id,
            email="default.auth01@csjmu.ac.in",
            first_name="DefaultFirst",
            last_name="DefaultLast",
            password="DefaultPassword123",
        )

        def mock_execute(stmt):
            s = str(stmt).lower()
            mock_res = MagicMock()
            if "from roles" in s:
                mock_res.scalar_one_or_none.return_value = auth_role
            elif "from users" in s and "lower(" in s:
                # No collision by email
                mock_res.scalar_one_or_none.return_value = None
            elif "from users" in s:
                mock_res.unique.return_value.scalar_one_or_none.return_value = existing_user
            return mock_res

        mock_db.execute.side_effect = mock_execute

        # Execute seeder with overwrite_existing=False (safe default)
        result = seed_institutional_authorities(mock_db, specs=[spec], strict_16_slots=False, overwrite_existing=False)

        # Assertions
        assert existing_user.email == "admin.renamed@csjmu.ac.in", "User email was overwritten by default manifest!"
        assert existing_user.first_name == "Dr. Renamed", "User first_name was overwritten by default manifest!"
        assert existing_user.last_name == "Authority", "User last_name was overwritten by default manifest!"
        assert existing_user.is_active is False, "Deactivated authority was forcefully reactivated!"
        assert existing_user.password_hash == "custom_admin_hash_999", "Password hash was overwritten by default manifest!"
        assert result["users_created"] == 0
        assert result["users_updated"] == 1

    def test_missing_authority_user_created_safely(self):
        """
        Requirement 4: If an authority identity is missing, it is created cleanly without
        modifying any existing users.
        """
        mock_db = MagicMock(spec=Session)
        created_users = []
        mock_db.add.side_effect = lambda u: created_users.append(u)

        auth_role = Role(name="authority", description="Authority role", is_system=True)
        auth_role.id = uuid.uuid4()

        spec_id = uuid.uuid4()
        spec = AuthoritySlotSpec(
            slot="AUTHORITY_01",
            id=spec_id,
            email="new.authority@csjmu.ac.in",
            first_name="New",
            last_name="Authority",
            password="InitialPassword123",
        )

        def mock_execute(stmt):
            s = str(stmt).lower()
            mock_res = MagicMock()
            if "from roles" in s:
                mock_res.scalar_one_or_none.return_value = auth_role
            elif "from users" in s and "lower(" in s:
                mock_res.scalar_one_or_none.return_value = None
            elif "from users" in s:
                # User does not exist yet
                mock_res.unique.return_value.scalar_one_or_none.return_value = None
            return mock_res

        mock_db.execute.side_effect = mock_execute

        result = seed_institutional_authorities(mock_db, specs=[spec], strict_16_slots=False, overwrite_existing=False)

        assert result["users_created"] == 1
        assert len(created_users) == 1
        created = created_users[0]
        assert created.email == "new.authority@csjmu.ac.in"
        assert created.is_active is True
        assert auth_role in created.roles

    def test_explicit_overwrite_flag_allows_intentional_updates(self):
        """
        Verifies that IF overwrite_existing=True is explicitly passed (e.g. from an operator CLI command),
        updates are permitted, but the default startup behavior is strictly overwrite_existing=False.
        """
        mock_db = MagicMock(spec=Session)

        auth_role = Role(name="authority", description="Authority role", is_system=True)
        auth_role.id = uuid.uuid4()

        spec_id = uuid.uuid4()
        user = User(
            id=spec_id,
            email="old.name@csjmu.ac.in",
            first_name="OldFirst",
            last_name="OldLast",
            password_hash="old_hash",
            is_active=True,
            is_verified=True,
        )
        user.roles = [auth_role]

        spec = AuthoritySlotSpec(
            slot="AUTHORITY_01",
            id=spec_id,
            email="updated.name@csjmu.ac.in",
            first_name="UpdatedFirst",
            last_name="UpdatedLast",
            password="NewPassword123",
        )

        def mock_execute(stmt):
            s = str(stmt).lower()
            mock_res = MagicMock()
            if "from roles" in s:
                mock_res.scalar_one_or_none.return_value = auth_role
            elif "from users" in s and "lower(" in s:
                mock_res.scalar_one_or_none.return_value = None
            elif "from users" in s:
                mock_res.unique.return_value.scalar_one_or_none.return_value = user
            return mock_res

        mock_db.execute.side_effect = mock_execute

        # With overwrite_existing=True
        seed_institutional_authorities(mock_db, specs=[spec], strict_16_slots=False, overwrite_existing=True)

        assert user.email == "updated.name@csjmu.ac.in"
        assert user.first_name == "UpdatedFirst"
        assert user.last_name == "UpdatedLast"


# -----------------------------------------------------------------------------
# Test Suite: End-to-End Startup & Seed Lifecycle Persistence
# -----------------------------------------------------------------------------

class TestStartupAndMigrationLifecyclePersistence:
    """Proves that running full startup initialization (seed_all) does not overwrite custom config."""

    @patch("app.services.seed_service.seed_roles_and_permissions")
    @patch("app.services.seed_service.seed_default_pillars")
    @patch("app.modules.sama_veda.services.directory_sync_service.InstitutionalDirectorySyncService")
    def test_seed_all_preserves_custom_configurations(
        self,
        mock_directory_sync,
        mock_seed_pillars,
        mock_seed_roles,
    ):
        """
        Requirement 7 & 8: Application startup executes seed_all(db).
        Verify that seed_all invokes seeders with non-destructive, safe parameters.
        """
        mock_db = MagicMock(spec=Session)
        mock_seed_roles.return_value = (5, 20)
        mock_seed_pillars.return_value = 1
        mock_directory_sync.sync_institutional_directory.return_value = {"status": "synced"}

        with patch("app.services.authority_seed_service.seed_institutional_authorities") as mock_auth_seed, \
             patch("app.modules.atharva_veda.nivaran.services.category_seed_service.seed_nivaran_categories") as mock_cat_seed, \
             patch("app.modules.atharva_veda.nivaran.services.subject_seed_service.seed_nivaran_subjects_and_clusters") as mock_subj_seed:

            mock_auth_seed.return_value = {"status": "success", "users_created": 0}
            mock_cat_seed.return_value = {"added": []}
            mock_subj_seed.return_value = {"subjects_created": [], "subjects_realigned": []}

            # Run startup seed
            results = seed_all(mock_db)

            # Assert authority seed was called with overwrite_existing=False
            mock_auth_seed.assert_called_once_with(mock_db, strict_15_slots=False, overwrite_existing=False)

            # Assert subject seed was called with force_realign=False
            mock_subj_seed.assert_called_once_with(mock_db, force_realign=False)

            assert "authorities" in results
            assert "subjects" in results
            assert "categories" in results
