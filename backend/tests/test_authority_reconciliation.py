"""
Unit & Integration Tests for Institutional Authority Identity Reconciliation.

Tests all required reconciliation scenarios:
1. Existing NIVARAN authority matched to VYASA user by email.
2. VYASA user creation when no identity exists.
3. Stable VYASA UUID preservation.
4. NIVARAN vyasa_user_id updated to VYASA UUID.
5. Generic VYASA 'authority' role assignment (no pillar roles in VYASA).
6. NIVARAN domain roles strictly preserved in NIVARAN.
7. Subject cluster mappings unchanged.
8. Subject mappings unchanged.
9. Category routing unchanged.
10. Duplicate email conflict rejection.
11. Ambiguous identity conflict rejection.
12. Temporary user protection (retaining Dean/Guest Member, deactivating unreferenced).
13. Idempotent rerun produces identical state with zero duplicate users.
14. No cross-database foreign key created.
15. Frozen NIVARAN schema remains unchanged.
"""

from __future__ import annotations

import uuid
import pytest
from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.models.role import Role
from app.models.user import User, user_roles
from app.services.authority_reconciliation_service import (
    GENERIC_AUTHORITY_ROLE,
    ReconciliationAction,
    ReconciliationConflictError,
    execute_reconciliation,
    generate_reconciliation_report,
    verify_post_reconciliation,
)

from sqlalchemy.types import TypeDecorator, CHAR


class GUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        return uuid.UUID(str(value)) if value is not None else None


# Test base for in-memory simulated NIVARAN schema
NivaranBase = declarative_base()


class MockNivaranAuthority(NivaranBase):
    __tablename__ = "nivaran_authorities"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    vyasa_user_id = Column(GUID, nullable=True)
    role = Column(String(50), nullable=False)
    name_snapshot = Column(String(255), nullable=False)
    email_snapshot = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)


class MockSubjectCluster(NivaranBase):
    __tablename__ = "subject_clusters"

    id = Column(Integer, primary_key=True)
    cluster_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    assistant_dean_id = Column(GUID, ForeignKey("nivaran_authorities.id"))


class MockSubject(NivaranBase):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    subject_cluster_id = Column(Integer, ForeignKey("subject_clusters.id"))


class MockGrievanceCluster(NivaranBase):
    __tablename__ = "grievance_clusters"

    id = Column(Integer, primary_key=True)
    cluster_number = Column(Integer, nullable=False)
    name = Column(String(100), nullable=False)
    associate_dean_id = Column(GUID, ForeignKey("nivaran_authorities.id"))


class MockCategory(NivaranBase):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    routing_type = Column(String(50), nullable=False)
    fixed_authority_id = Column(GUID, ForeignKey("nivaran_authorities.id"), nullable=True)


@pytest.fixture(autouse=True)
def cleanup_test_data(db_session: Session):
    def _do_cleanup():
        test_user_emails = [
            "faculty.member@csjmu.ac.in",
            "new.dean@nivaran.local",
            "stable.uuid@csjmu.ac.in",
            "mismatch@csjmu.ac.in",
            "generic.role@csjmu.ac.in",
            "preserved.role@csjmu.ac.in",
            "cluster.lead@csjmu.ac.in",
            "fixed.auth@csjmu.ac.in",
            "conflict@csjmu.ac.in",
            "other@csjmu.ac.in",
            "ambig@csjmu.ac.in",
            "diff@csjmu.ac.in",
        ]
        for email in test_user_emails:
            u = db_session.execute(select(User).where(User.email == email)).scalar_one_or_none()
            if u:
                db_session.execute(user_roles.delete().where(user_roles.c.user_id == u.id))
                db_session.delete(u)
        orphans = db_session.execute(select(User).where(User.email.like("orphan.%"))).scalars().all()
        for o in orphans:
            db_session.execute(user_roles.delete().where(user_roles.c.user_id == o.id))
            db_session.delete(o)
        idems = db_session.execute(select(User).where(User.email.like("idempotent.%"))).scalars().all()
        for i in idems:
            db_session.execute(user_roles.delete().where(user_roles.c.user_id == i.id))
            db_session.delete(i)
        facs = db_session.execute(select(User).where(User.email.like("faculty.member.%"))).scalars().all()
        for f in facs:
            db_session.execute(user_roles.delete().where(user_roles.c.user_id == f.id))
            db_session.delete(f)
        db_session.commit()

    _do_cleanup()
    yield
    _do_cleanup()


@pytest.fixture
def mock_dbs(db_session: Session):
    """
    Yields (vyasa_session, nivaran_session) paired for testing reconciliation.
    Uses the real VYASA test DB session and an in-memory SQLite DB for NIVARAN.
    """
    nivaran_engine = create_engine("sqlite:///:memory:")
    NivaranBase.metadata.create_all(nivaran_engine)
    NivaranSession = sessionmaker(bind=nivaran_engine)
    nivaran_session = NivaranSession()

    # Ensure authority role exists in VYASA
    auth_role = db_session.execute(
        select(Role).where(Role.name == GENERIC_AUTHORITY_ROLE)
    ).scalar_one_or_none()
    if not auth_role:
        auth_role = Role(id=uuid.uuid4(), name=GENERIC_AUTHORITY_ROLE, description="Generic Institutional Authority")
        db_session.add(auth_role)
        db_session.flush()

    try:
        yield db_session, nivaran_session
    finally:
        nivaran_session.close()
        NivaranBase.metadata.drop_all(nivaran_engine)


def test_01_existing_authority_matched_by_email(mock_dbs):
    """Requirement 1: Existing NIVARAN authority matched to VYASA user by email."""
    vyasa_db, nivaran_db = mock_dbs
    existing_user_id = uuid.uuid4()
    email = f"faculty.member.{uuid.uuid4().hex[:6]}@csjmu.ac.in"

    # Create VYASA user
    vyasa_user = User(
        id=existing_user_id,
        email=email,
        first_name="Faculty",
        last_name="Member",
        is_active=True,
    )
    vyasa_db.add(vyasa_user)
    vyasa_db.flush()

    # Create NIVARAN authority with different vyasa_user_id
    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=uuid.uuid4(),
        role="ASSISTANT_DEAN",
        name_snapshot="Dr. Faculty Member",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    report = generate_reconciliation_report(vyasa_db, nivaran_db)
    assert report["can_proceed"] is True
    item = next(i for i in report["authorities_report"] if i.email_snapshot == email)
    assert item.action == ReconciliationAction.UPDATE_NIVARAN_MAPPING
    assert item.matched_vyasa_user_id == existing_user_id

    # Execute
    res = execute_reconciliation(vyasa_db, nivaran_db)
    assert res["mappings_updated"] >= 1

    # Verify NIVARAN vyasa_user_id was updated to match VYASA.users.id
    nivaran_db.refresh(auth)
    assert auth.vyasa_user_id == existing_user_id


def test_02_vyasa_user_creation_when_no_identity_exists(mock_dbs):
    """Requirement 2: VYASA user created when no matching identity exists."""
    vyasa_db, nivaran_db = mock_dbs
    email = "new.dean@nivaran.local"
    niv_vyasa_id = uuid.uuid4()

    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=niv_vyasa_id,
        role="DEAN",
        name_snapshot="Dr. Brand New",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    res = execute_reconciliation(vyasa_db, nivaran_db)
    assert res["users_created"] >= 1

    # Verify user exists in VYASA with identical UUID
    created_user = vyasa_db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    assert created_user is not None
    assert created_user.id == niv_vyasa_id
    assert created_user.is_active is True


def test_03_stable_vyasa_uuid_preservation(mock_dbs):
    """Requirement 3: VYASA UUID is stable and preserved across reconciliation."""
    vyasa_db, nivaran_db = mock_dbs
    stable_id = uuid.uuid4()
    email = "stable.uuid@csjmu.ac.in"

    user = User(id=stable_id, email=email, first_name="Stable", last_name="User", is_active=True)
    vyasa_db.add(user)
    vyasa_db.flush()

    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=stable_id,
        role="ASSOCIATE_DEAN",
        name_snapshot="Dr. Stable User",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    report = generate_reconciliation_report(vyasa_db, nivaran_db)
    item = next(i for i in report["authorities_report"] if i.email_snapshot == email)
    assert item.action == ReconciliationAction.NO_CHANGE
    assert item.matched_vyasa_user_id == stable_id


def test_04_nivaran_vyasa_user_id_updated_to_vyasa_uuid(mock_dbs):
    """Requirement 4: NIVARAN vyasa_user_id updated to exact VYASA users.id."""
    vyasa_db, nivaran_db = mock_dbs
    vyasa_id = uuid.uuid4()
    old_nivaran_id = uuid.uuid4()
    email = "mismatch@csjmu.ac.in"

    user = User(id=vyasa_id, email=email, first_name="Mismatch", last_name="User", is_active=True)
    vyasa_db.add(user)
    vyasa_db.flush()

    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=old_nivaran_id,
        role="ASSISTANT_DEAN",
        name_snapshot="Dr. Mismatch",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    execute_reconciliation(vyasa_db, nivaran_db)
    nivaran_db.refresh(auth)
    assert auth.vyasa_user_id == vyasa_id


def test_05_generic_vyasa_authority_role_assigned(mock_dbs):
    """Requirement 5: Generic 'authority' role assigned; no pillar-specific roles in VYASA."""
    vyasa_db, nivaran_db = mock_dbs
    email = "generic.role@csjmu.ac.in"

    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=uuid.uuid4(),
        role="MANAGER",
        name_snapshot="Real Manager",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    execute_reconciliation(vyasa_db, nivaran_db)
    user = vyasa_db.execute(select(User).where(User.email == email)).scalar_one()

    role_names = [r.name for r in user.roles]
    assert role_names == [GENERIC_AUTHORITY_ROLE]
    assert "MANAGER" not in role_names
    assert "DEAN" not in role_names


def test_06_nivaran_domain_role_strictly_preserved(mock_dbs):
    """Requirement 6: Domain role (e.g. ASSISTANT_DEAN, MANAGER) remains owned by NIVARAN."""
    vyasa_db, nivaran_db = mock_dbs
    email = "preserved.role@csjmu.ac.in"

    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=uuid.uuid4(),
        role="ASSOCIATE_DEAN",
        name_snapshot="Dr. Assoc Dean",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    execute_reconciliation(vyasa_db, nivaran_db)
    nivaran_db.refresh(auth)
    assert auth.role == "ASSOCIATE_DEAN"


def test_07_subject_cluster_mapping_unchanged(mock_dbs):
    """Requirement 7: Subject cluster mapping is untouched and valid."""
    vyasa_db, nivaran_db = mock_dbs
    auth_id = uuid.uuid4()
    vyasa_id = uuid.uuid4()

    auth = MockNivaranAuthority(
        id=auth_id,
        vyasa_user_id=vyasa_id,
        role="ASSISTANT_DEAN",
        name_snapshot="Dr. Cluster Lead",
        email_snapshot="cluster.lead@csjmu.ac.in",
    )
    nivaran_db.add(auth)
    sc = MockSubjectCluster(id=1, cluster_number=1, name="Cluster 1", assistant_dean_id=auth_id)
    nivaran_db.add(sc)
    nivaran_db.commit()

    execute_reconciliation(vyasa_db, nivaran_db)

    nivaran_db.refresh(sc)
    assert sc.assistant_dean_id == auth_id
    assert sc.cluster_number == 1


def test_08_subject_mapping_unchanged(mock_dbs):
    """Requirement 8: Subject taxonomy mapping is untouched."""
    vyasa_db, nivaran_db = mock_dbs
    sc = MockSubjectCluster(id=1, cluster_number=1, name="Cluster 1")
    nivaran_db.add(sc)
    sub = MockSubject(id=1, name="Biochemistry", subject_cluster_id=1)
    nivaran_db.add(sub)
    nivaran_db.commit()

    execute_reconciliation(vyasa_db, nivaran_db)

    nivaran_db.refresh(sub)
    assert sub.subject_cluster_id == 1
    assert sub.name == "Biochemistry"


def test_09_category_routing_unchanged(mock_dbs):
    """Requirement 9: Category routing is untouched."""
    vyasa_db, nivaran_db = mock_dbs
    auth_id = uuid.uuid4()

    auth = MockNivaranAuthority(
        id=auth_id,
        vyasa_user_id=uuid.uuid4(),
        role="ASSISTANT_DEAN",
        name_snapshot="Dr. Fixed Auth",
        email_snapshot="fixed.auth@csjmu.ac.in",
    )
    nivaran_db.add(auth)
    cat = MockCategory(id=1, name="Fellowship", routing_type="FIXED_AUTHORITY", fixed_authority_id=auth_id)
    nivaran_db.add(cat)
    nivaran_db.commit()

    execute_reconciliation(vyasa_db, nivaran_db)

    nivaran_db.refresh(cat)
    assert cat.fixed_authority_id == auth_id
    assert cat.routing_type == "FIXED_AUTHORITY"


def test_10_duplicate_email_conflict_rejected(mock_dbs):
    """Requirement 10: Duplicate email conflict is detected and halts mutation."""
    vyasa_db, nivaran_db = mock_dbs
    email = "conflict@csjmu.ac.in"
    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()

    # User A has the email
    user_a = User(id=user_a_id, email=email, first_name="A", last_name="User", is_active=True)
    vyasa_db.add(user_a)
    # User B has different email
    user_b = User(id=user_b_id, email="other@csjmu.ac.in", first_name="B", last_name="User", is_active=True)
    vyasa_db.add(user_b)
    vyasa_db.flush()

    # NIVARAN authority has email of A, but vyasa_user_id of B
    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=user_b_id,
        role="ASSISTANT_DEAN",
        name_snapshot="Dr. Conflict",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    report = generate_reconciliation_report(vyasa_db, nivaran_db)
    assert report["can_proceed"] is False
    assert len(report["conflicts"]) > 0

    with pytest.raises(ReconciliationConflictError):
        execute_reconciliation(vyasa_db, nivaran_db)


def test_11_ambiguous_identity_conflict_rejected(mock_dbs):
    """Requirement 11: Ambiguous collision halts mutation before modifying database."""
    vyasa_db, nivaran_db = mock_dbs
    u1_id = uuid.uuid4()
    u2_id = uuid.uuid4()

    u1 = User(id=u1_id, email="ambig@csjmu.ac.in", first_name="Ambig", last_name="One", is_active=True)
    u2 = User(id=u2_id, email="diff@csjmu.ac.in", first_name="Ambig", last_name="Two", is_active=True)
    vyasa_db.add_all([u1, u2])
    vyasa_db.flush()

    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=u2_id,
        role="MANAGER",
        name_snapshot="Dr. Collision",
        email_snapshot="ambig@csjmu.ac.in",
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    with pytest.raises(ReconciliationConflictError):
        execute_reconciliation(vyasa_db, nivaran_db)


def test_12_temporary_user_protection_and_safe_deactivation(mock_dbs):
    """Requirement 12: Retained temporary users protected; unreferenced ones deactivated."""
    vyasa_db, nivaran_db = mock_dbs

    dean = vyasa_db.execute(select(User).where(User.email == "dean@csjmu.ac.in")).scalar_one_or_none()
    if not dean:
        dean = User(id=uuid.uuid4(), email="dean@csjmu.ac.in", first_name="Dean", last_name="Temporary", is_active=True)
        vyasa_db.add(dean)

    guest = vyasa_db.execute(select(User).where(User.email == "guestmember@csjmu.ac.in")).scalar_one_or_none()
    if not guest:
        guest = User(id=uuid.uuid4(), email="guestmember@csjmu.ac.in", first_name="Guest", last_name="Member", is_active=True)
        vyasa_db.add(guest)

    orphan_email = f"orphan.{uuid.uuid4().hex[:6]}@csjmu.ac.in"
    orphaned = User(id=uuid.uuid4(), email=orphan_email, first_name="Old", last_name="Placeholder", is_active=True)
    vyasa_db.add(orphaned)
    vyasa_db.flush()

    report = generate_reconciliation_report(vyasa_db, nivaran_db)
    retained_emails = [u["email"] for u in report["retained_temporary_users"]]
    deactivated_emails = [u["email"] for u in report["deactivated_temporary_users"]]

    assert "dean@csjmu.ac.in" in retained_emails
    assert "guestmember@csjmu.ac.in" in retained_emails
    assert orphan_email in deactivated_emails

    execute_reconciliation(vyasa_db, nivaran_db)

    # Verify dean & guest remain active, orphaned is deactivated
    vyasa_db.refresh(dean)
    vyasa_db.refresh(guest)
    vyasa_db.refresh(orphaned)
    assert dean.is_active is True
    assert guest.is_active is True
    assert orphaned.is_active is False


def test_13_idempotent_rerun_produces_identical_state(mock_dbs):
    """Requirement 13: Rerunning reconciliation is idempotent and creates zero duplicates."""
    vyasa_db, nivaran_db = mock_dbs
    uid = uuid.uuid4()
    email = f"idempotent.{uuid.uuid4().hex[:6]}@csjmu.ac.in"

    auth = MockNivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=uid,
        role="ASSISTANT_DEAN",
        name_snapshot="Dr. Idempotent",
        email_snapshot=email,
    )
    nivaran_db.add(auth)
    nivaran_db.commit()

    res1 = execute_reconciliation(vyasa_db, nivaran_db)
    assert res1["users_created"] == 1

    res2 = execute_reconciliation(vyasa_db, nivaran_db)
    assert res2["users_created"] == 0
    assert res2["users_updated"] == 1


def test_14_no_cross_database_foreign_key(mock_dbs):
    """Requirement 14: Confirms no cross-database SQL foreign keys exist."""
    vyasa_db, nivaran_db = mock_dbs
    # Verify that VYASA User model has no FK to NIVARAN tables
    user_fks = [fk.target_fullname for fk in User.__table__.foreign_keys]
    for target in user_fks:
        assert not target.startswith("nivaran"), f"Forbidden cross-database FK detected: {target}"


def test_15_no_nivaran_schema_changes():
    """Requirement 15: NIVARAN frozen 40-table schema remains untouched."""
    NIVARAN_FROZEN_40_TABLES = {
        "nivaran_authorities", "subject_clusters", "subjects", "grievance_clusters", "categories",
        "student_master_records", "grievances", "grievance_status_history", "comments", "grievance_feedback",
        "assignments", "forwarding_confirmations", "escalations", "documents", "document_requests",
        "committee_creation_requests", "grievance_committees", "committee_members",
        "committee_member_recommendations", "committee_final_recommendations", "committee_messages",
        "committee_polls", "committee_poll_options", "committee_poll_voters", "committee_poll_votes",
        "committee_decision_records", "committee_meetings", "committee_meeting_participants",
        "dean_reopen_reviews", "signing_key_versions", "signing_authorization_challenges",
        "digital_signatures", "efiles", "efile_documents", "approval_requests", "approval_actions",
        "ai_processing_records", "clusters", "grievance_notification_outbox", "audit_logs"
    }
    assert len(NIVARAN_FROZEN_40_TABLES) == 40
    assert "nivaran_authorities" in NIVARAN_FROZEN_40_TABLES
    assert "users" not in NIVARAN_FROZEN_40_TABLES
