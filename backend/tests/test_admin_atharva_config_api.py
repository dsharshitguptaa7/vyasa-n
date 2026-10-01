import uuid
import random
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.main import app
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.audit import AuditLog
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject, GrievanceCluster, Category
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole, CategoryRoutingType

client = TestClient(app)


def get_or_create_admin_user(db: Session) -> User:
    admin_role = db.execute(select(Role).where(Role.name == "administrator")).scalar_one_or_none()
    if not admin_role:
        admin_role = Role(name="administrator", description="Institutional Administrator", is_system=True)
        db.add(admin_role)
        db.commit()
        db.refresh(admin_role)

    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"admin_test_{uid}@csjmu.ac.in",
        password_hash="test_hash",
        first_name="Admin",
        last_name="Officer",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.execute(user_roles.insert().values(user_id=user.id, role_id=admin_role.id))
    db.commit()
    db.refresh(user)
    return user


def get_or_create_applicant_user(db: Session) -> User:
    applicant_role = db.execute(select(Role).where(Role.name == "applicant")).scalar_one_or_none()
    if not applicant_role:
        applicant_role = Role(name="applicant", description="Scholar Applicant", is_system=True)
        db.add(applicant_role)
        db.commit()
        db.refresh(applicant_role)

    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"scholar_test_{uid}@csjmu.ac.in",
        password_hash="test_hash",
        first_name="Scholar",
        last_name="Applicant",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.execute(user_roles.insert().values(user_id=user.id, role_id=applicant_role.id))
    db.commit()
    db.refresh(user)
    return user


def test_atharva_admin_unauthenticated_rejected():
    res = client.get("/api/admin/atharva/summary")
    assert res.status_code == 401

    res = client.get("/api/admin/atharva/authorities")
    assert res.status_code == 401


def test_atharva_admin_non_admin_forbidden(db_session: Session):
    applicant = get_or_create_applicant_user(db_session)
    token = create_access_token({"sub": str(applicant.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/admin/atharva/summary", headers=headers)
    assert res.status_code == 403
    assert "Access restricted to institutional administrators" in res.json()["message"]


def test_atharva_admin_summary(db_session: Session):
    admin = get_or_create_admin_user(db_session)
    token = create_access_token({"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/admin/atharva/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert "total_authorities" in data
    assert "active_authorities" in data
    assert "role_counts" in data
    assert "total_subject_clusters" in data
    assert "total_subjects" in data
    assert "total_grievance_clusters" in data
    assert "total_categories" in data
    assert "categories_by_routing_type" in data


def test_atharva_admin_authorities_crud_and_status(db_session: Session):
    admin = get_or_create_admin_user(db_session)
    token = create_access_token({"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Create dummy authority
    auth_user = get_or_create_applicant_user(db_session)
    uid = uuid.uuid4().hex[:6]
    authority = NivaranAuthority(
        vyasa_user_id=auth_user.id,
        role=NivaranRole.MANAGER,
        name_snapshot=f"Admin Test Manager {uid}",
        email_snapshot=auth_user.email,
        designation="Test Manager Officer",
        is_active=True,
    )
    db_session.add(authority)
    db_session.commit()
    db_session.refresh(authority)

    # 1. List authorities
    res = client.get("/api/admin/atharva/authorities", headers=headers)
    assert res.status_code == 200
    authorities = res.json()["data"]["authorities"]
    assert any(a["id"] == str(authority.id) for a in authorities)

    # 2. Filter by role
    res = client.get(f"/api/admin/atharva/authorities?role={NivaranRole.MANAGER.value}", headers=headers)
    assert res.status_code == 200
    assert all(a["role"] == NivaranRole.MANAGER.value for a in res.json()["data"]["authorities"])

    # 3. Patch status to False
    patch_res = client.patch(
        f"/api/admin/atharva/authorities/{authority.id}/status",
        json={"is_active": False},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["is_active"] is False

    # Verify audit log was created
    audit = db_session.query(AuditLog).filter(
        AuditLog.entity_name == "NivaranAuthority",
        AuditLog.entity_id == str(authority.id),
        AuditLog.action == "authority.update_active_status",
    ).first()
    assert audit is not None
    assert audit.details["new_status"] is False

    # Cleanup created authority
    db_session.delete(authority)
    db_session.commit()



def test_atharva_admin_subject_clusters_and_remapping(db_session: Session):
    admin = get_or_create_admin_user(db_session)
    token = create_access_token({"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Setup two Assistant Deans
    user1 = get_or_create_applicant_user(db_session)
    user2 = get_or_create_applicant_user(db_session)
    asst1 = NivaranAuthority(
        vyasa_user_id=user1.id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. First Asst",
        email_snapshot=user1.email,
        is_active=True,
    )
    asst2 = NivaranAuthority(
        vyasa_user_id=user2.id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Second Asst",
        email_snapshot=user2.email,
        is_active=True,
    )
    db_session.add_all([asst1, asst2])
    db_session.commit()

    cluster = SubjectCluster(
        cluster_number=random.randint(100000, 999999),
        name=f"Admin Test Subj Cluster {uuid.uuid4().hex[:4]}",
        assistant_dean_id=asst1.id,
        is_active=True,
    )
    db_session.add(cluster)
    db_session.commit()

    # 1. List subject clusters
    res = client.get("/api/admin/atharva/subject-clusters", headers=headers)
    assert res.status_code == 200
    clusters = res.json()["data"]["clusters"]
    matching = [c for c in clusters if c["id"] == str(cluster.id)]
    assert len(matching) == 1
    assert matching[0]["assistant_dean"]["id"] == str(asst1.id)

    # 2. Re-map Assistant Dean to asst2
    patch_res = client.patch(
        f"/api/admin/atharva/subject-clusters/{cluster.id}/assistant-dean",
        json={"assistant_dean_id": str(asst2.id)},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["assistant_dean_id"] == str(asst2.id)

    # 3. Check audit log
    audit = db_session.query(AuditLog).filter(
        AuditLog.entity_name == "SubjectCluster",
        AuditLog.entity_id == str(cluster.id),
        AuditLog.action == "taxonomy.update_assistant_dean_mapping",
    ).first()
    assert audit is not None
    assert audit.details["new_assistant_dean_id"] == str(asst2.id)

    # Cleanup test fixtures
    db_session.delete(cluster)
    db_session.delete(asst1)
    db_session.delete(asst2)
    db_session.commit()


def test_atharva_admin_grievance_clusters_and_categories_routing(db_session: Session):
    admin = get_or_create_admin_user(db_session)
    token = create_access_token({"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Setup Associate Dean and Fixed Authority
    u_assoc = get_or_create_applicant_user(db_session)
    u_fixed = get_or_create_applicant_user(db_session)
    assoc = NivaranAuthority(
        vyasa_user_id=u_assoc.id,
        role=NivaranRole.ASSOCIATE_DEAN,
        name_snapshot="Dr. Grv Assoc",
        email_snapshot=u_assoc.email,
        is_active=True,
    )
    fixed = NivaranAuthority(
        vyasa_user_id=u_fixed.id,
        role=NivaranRole.MANAGER,
        name_snapshot="Dr. Fixed Mgr",
        email_snapshot=u_fixed.email,
        is_active=True,
    )
    db_session.add_all([assoc, fixed])
    db_session.commit()

    grv_cluster = GrievanceCluster(
        cluster_number=random.randint(100000, 999999),
        name=f"Admin Grv Cluster {uuid.uuid4().hex[:4]}",
        associate_dean_id=assoc.id,
        is_active=True,
    )
    db_session.add(grv_cluster)
    db_session.commit()

    category = Category(
        name=f"Admin Test Category {uuid.uuid4().hex[:6]}",
        routing_type=CategoryRoutingType.CLUSTER,
        grievance_cluster_id=grv_cluster.id,
        is_active=True,
    )
    db_session.add(category)
    db_session.commit()

    # 1. List grievance clusters
    res = client.get("/api/admin/atharva/grievance-clusters", headers=headers)
    assert res.status_code == 200

    # 2. List categories
    res = client.get("/api/admin/atharva/categories", headers=headers)
    assert res.status_code == 200
    cats = res.json()["data"]["categories"]
    matching_cat = [c for c in cats if c["id"] == str(category.id)]
    assert len(matching_cat) == 1
    assert matching_cat[0]["cluster_name"] == grv_cluster.name

    # 3. Reconfigure category to FIXED_AUTHORITY
    patch_res = client.patch(
        f"/api/admin/atharva/categories/{category.id}/routing",
        json={
            "routing_type": CategoryRoutingType.FIXED_AUTHORITY.value,
            "fixed_authority_id": str(fixed.id),
        },
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["routing_type"] == CategoryRoutingType.FIXED_AUTHORITY.value
    assert patch_res.json()["data"]["fixed_authority_id"] == str(fixed.id)

    # 4. Reconfigure category to SUBJECT_ASSISTANT_DEAN
    patch_res = client.patch(
        f"/api/admin/atharva/categories/{category.id}/routing",
        json={"routing_type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN.value},
        headers=headers,
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["routing_type"] == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN.value
    assert patch_res.json()["data"]["fixed_authority_id"] is None
    assert patch_res.json()["data"]["grievance_cluster_id"] is None

    # Cleanup test fixtures
    db_session.delete(category)
    db_session.delete(grv_cluster)
    db_session.delete(assoc)
    db_session.delete(fixed)
    db_session.commit()


def test_atharva_admin_audit_logs_explorer(db_session: Session):
    admin = get_or_create_admin_user(db_session)
    token = create_access_token({"sub": str(admin.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/admin/atharva/audit-logs?module=atharva_veda&limit=10", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert "total" in data
    assert "logs" in data
    assert isinstance(data["logs"], list)

    # Top-level alias
    res_top = client.get("/api/admin/audit-logs?limit=5", headers=headers)
    assert res_top.status_code == 200
    assert "total" in res_top.json()["data"]
