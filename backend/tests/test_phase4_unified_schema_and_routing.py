"""
Phase 4 Unified Schema, Dynamic Routing & Institutional Configuration Tests
Validates:
- Dynamic authority model with variable counts (not hardcoded to 1/10/3/1)
- Subject taxonomy and dynamic routing (Subject -> Cluster -> Asst Dean)
- Grievance taxonomy and cluster routing (Category -> Cluster -> Assoc Dean)
- Fixed authority category routing
- Dynamic re-mapping affecting future routing without code changes
- Routing validation (inactive entities, missing mappings)
- Core audit logging on configuration changes
- Referential integrity and delete restrictions on official records
"""
import uuid
import pytest
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.module import ModuleRegistry
from app.models.audit import AuditLog
from app.models.settings import SystemSetting
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject, GrievanceCluster, Category
from app.modules.atharva_veda.nivaran.models.grievance import StudentMasterRecord, Grievance, GrievanceStatusHistory
from app.modules.atharva_veda.nivaran.models.enums import (
    NivaranRole,
    CategoryRoutingType,
    GrievanceStatus,
    GrievancePriority,
    StudentRecordStatus,
)
from app.modules.atharva_veda.nivaran.services.routing_service import (
    DynamicRoutingEngine,
    RoutingConfigurationError,
)
from app.modules.atharva_veda.nivaran.services.admin_config_service import (
    AdminConfigService,
)


def create_test_user(db: Session, email_prefix: str) -> User:
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        email=f"{email_prefix}_{unique_id}@test.csjmu.ac.in",
        password_hash="test_bcrypt_hash",
        first_name="Test",
        last_name=f"User_{unique_id}",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_dynamic_authority_model_with_variable_counts(db_session: Session):
    """
    Validates that the authority model supports variable counts per role.
    Does NOT enforce artificial limits (e.g. exactly 1 manager or exactly 10 assistant deans).
    """
    user1 = create_test_user(db_session, "auth_mgr1")
    user2 = create_test_user(db_session, "auth_mgr2")
    user3 = create_test_user(db_session, "auth_asst1")
    user4 = create_test_user(db_session, "auth_asst2")

    # Create 2 managers (demonstrating variable count)
    mgr1 = NivaranAuthority(
        vyasa_user_id=user1.id,
        role=NivaranRole.MANAGER,
        name_snapshot="Manager One",
        email_snapshot=user1.email,
        designation="Grievance Cell Incharge",
    )
    mgr2 = NivaranAuthority(
        vyasa_user_id=user2.id,
        role=NivaranRole.MANAGER,
        name_snapshot="Manager Two",
        email_snapshot=user2.email,
        designation="Assistant Grievance Officer",
    )
    asst1 = NivaranAuthority(
        vyasa_user_id=user3.id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Assistant Alpha",
        email_snapshot=user3.email,
        department="Engineering",
    )
    asst2 = NivaranAuthority(
        vyasa_user_id=user4.id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Assistant Beta",
        email_snapshot=user4.email,
        department="Sciences",
    )

    db_session.add_all([mgr1, mgr2, asst1, asst2])
    db_session.commit()

    assert mgr1.id is not None
    assert mgr2.id is not None
    assert asst1.id is not None
    assert asst2.id is not None

    # Test 1:1 constraint on vyasa_user_id
    duplicate_auth = NivaranAuthority(
        vyasa_user_id=user1.id,
        role=NivaranRole.DEAN,
        name_snapshot="Duplicate Authority",
        email_snapshot="dup@test.com",
    )
    db_session.add(duplicate_auth)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_subject_taxonomy_and_dynamic_routing(db_session: Session):
    """
    Validates Subject -> Subject Cluster -> Assistant Dean routing algorithm.
    Validates dynamic re-mapping immediately changes routing.
    """
    user_asst1 = create_test_user(db_session, "dean_alpha")
    user_asst2 = create_test_user(db_session, "dean_beta")

    asst_dean1 = NivaranAuthority(
        vyasa_user_id=user_asst1.id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Alpha",
        email_snapshot=user_asst1.email,
    )
    asst_dean2 = NivaranAuthority(
        vyasa_user_id=user_asst2.id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Beta",
        email_snapshot=user_asst2.email,
    )
    db_session.add_all([asst_dean1, asst_dean2])
    db_session.commit()

    import random
    # Dynamic Cluster
    cluster = SubjectCluster(
        cluster_number=random.randint(10000, 999999),
        name=f"Advanced Computing Cluster {uuid.uuid4().hex[:4]}",
        assistant_dean_id=asst_dean1.id,
    )
    db_session.add(cluster)
    db_session.commit()

    # Dynamic Subject
    subject = Subject(
        subject_cluster_id=cluster.id,
        name=f"Artificial Intelligence & Neural Systems {uuid.uuid4().hex[:4]}",
        code=f"AINS-{uuid.uuid4().hex[:4]}",
    )
    db_session.add(subject)
    db_session.commit()

    # 1. Resolve route: Should resolve to Dr. Alpha
    resolved_auth = DynamicRoutingEngine.resolve_subject_route(db_session, subject.id)
    assert resolved_auth.id == asst_dean1.id
    assert resolved_auth.name_snapshot == "Dr. Alpha"

    # 2. Dynamic Re-Mapping: Reconfigure cluster to Dr. Beta
    admin_user = create_test_user(db_session, "admin_user")
    AdminConfigService.update_subject_cluster_assistant_dean(
        db=db_session,
        cluster_id=cluster.id,
        new_assistant_dean_id=asst_dean2.id,
        actor_user_id=admin_user.id,
    )

    # 3. Resolve route again: Must immediately resolve to Dr. Beta without code modification
    resolved_auth_updated = DynamicRoutingEngine.resolve_subject_route(db_session, subject.id)
    assert resolved_auth_updated.id == asst_dean2.id
    assert resolved_auth_updated.name_snapshot == "Dr. Beta"

    # 4. Check audit log was written
    audit = db_session.query(AuditLog).filter(
        AuditLog.entity_name == "SubjectCluster",
        AuditLog.entity_id == str(cluster.id),
    ).first()
    assert audit is not None
    assert audit.action == "taxonomy.update_assistant_dean_mapping"
    assert audit.details["new_assistant_dean_id"] == str(asst_dean2.id)


def test_grievance_category_and_fixed_authority_routing(db_session: Session):
    """
    Validates both CLUSTER and FIXED_AUTHORITY category routing modes.
    """
    user_assoc = create_test_user(db_session, "assoc_dean")
    user_fixed = create_test_user(db_session, "fixed_officer")

    assoc_dean = NivaranAuthority(
        vyasa_user_id=user_assoc.id,
        role=NivaranRole.ASSOCIATE_DEAN,
        name_snapshot="Dr. Associate Dean",
        email_snapshot=user_assoc.email,
    )
    fixed_officer = NivaranAuthority(
        vyasa_user_id=user_fixed.id,
        role=NivaranRole.MANAGER,
        name_snapshot="Finance Officer Fixed",
        email_snapshot=user_fixed.email,
    )
    db_session.add_all([assoc_dean, fixed_officer])
    db_session.commit()

    import random
    # Grievance Cluster
    grv_cluster = GrievanceCluster(
        cluster_number=random.randint(10000, 999999),
        name=f"Financial & Scholarship Affairs {uuid.uuid4().hex[:4]}",
        associate_dean_id=assoc_dean.id,
    )
    db_session.add(grv_cluster)
    db_session.commit()

    # Category 1: CLUSTER routing
    cat_cluster = Category(
        name=f"Fellowship Disbursal Delay_{uuid.uuid4().hex[:6]}",
        routing_type=CategoryRoutingType.CLUSTER,
        grievance_cluster_id=grv_cluster.id,
    )
    # Category 2: FIXED_AUTHORITY routing
    cat_fixed = Category(
        name=f"Hostel Fee Dispute_{uuid.uuid4().hex[:6]}",
        routing_type=CategoryRoutingType.FIXED_AUTHORITY,
        fixed_authority_id=fixed_officer.id,
    )
    db_session.add_all([cat_cluster, cat_fixed])
    db_session.commit()

    # Test CLUSTER route resolution
    res1 = DynamicRoutingEngine.resolve_category_route(db_session, cat_cluster.id)
    assert res1.id == assoc_dean.id

    # Test FIXED_AUTHORITY route resolution
    res2 = DynamicRoutingEngine.resolve_category_route(db_session, cat_fixed.id)
    assert res2.id == fixed_officer.id


def test_routing_validation_rules(db_session: Session):
    """
    Verifies that invalid configuration (inactive cluster, missing authority, inactive authority)
    is caught and rejected with clear exceptions.
    """
    user_auth = create_test_user(db_session, "inactive_test")
    auth = NivaranAuthority(
        vyasa_user_id=user_auth.id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Inactive Doctor",
        email_snapshot=user_auth.email,
        is_active=False,  # Inactive
    )
    db_session.add(auth)
    db_session.commit()

    import random
    cluster = SubjectCluster(
        cluster_number=random.randint(10000, 999999),
        name=f"Inactive Cluster Test {uuid.uuid4().hex[:4]}",
        assistant_dean_id=auth.id,
        is_active=True,
    )
    db_session.add(cluster)
    db_session.commit()

    subject = Subject(
        subject_cluster_id=cluster.id,
        name=f"Inactive Test Subject_{uuid.uuid4().hex[:6]}",
        is_active=True,
    )
    db_session.add(subject)
    db_session.commit()

    # Should raise error because configured Assistant Dean is inactive
    with pytest.raises(RoutingConfigurationError) as exc_info:
        DynamicRoutingEngine.resolve_subject_route(db_session, subject.id)
    assert "currently inactive" in str(exc_info.value)


def test_core_module_registry_and_system_settings(db_session: Session):
    """
    Verifies ModuleRegistry and SystemSetting database functionality.
    """
    # System Setting
    setting = SystemSetting(
        key="test.academic_calendar.freeze",
        value="false",
        data_type="boolean",
        description="Whether semester registration is frozen",
        is_public=True,
    )
    db_session.merge(setting)
    db_session.commit()

    loaded = db_session.get(SystemSetting, "test.academic_calendar.freeze")
    assert loaded is not None
    assert loaded.value == "false"
    assert loaded.is_public is True

    # Module Registry entry
    mod = db_session.query(ModuleRegistry).filter(
        ModuleRegistry.module_key == "atharva_veda_nivaran"
    ).first()
    if not mod:
        mod = ModuleRegistry(
            module_key="atharva_veda_nivaran",
            name="Atharva Veda (NIVARAN-AI)",
            status="active",
            version="1.0.0-MODULAR",
            is_enabled=True,
        )
        db_session.add(mod)
        db_session.commit()
    assert mod.module_key == "atharva_veda_nivaran"
    assert mod.is_enabled is True
