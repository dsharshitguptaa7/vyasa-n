import uuid
from unittest.mock import MagicMock
import pytest
from sqlalchemy.sql.selectable import Select

from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.services.cms_service import SamaCmsService
from app.modules.sama_veda.services.directory_sync_service import (
    InstitutionalDirectorySyncService,
    normalize_name_tokens,
    normalize_name_key,
)
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole


def test_normalize_name_tokens():
    assert normalize_name_tokens("Prof. Namita Tiwari") == ["namita", "tiwari"]
    assert normalize_name_tokens("Dr. Adarsh Kumar Srivastav") == ["adarsh", "kumar", "srivastav"]
    assert normalize_name_tokens("Mr. John Doe") == ["john", "doe"]
    assert normalize_name_tokens("  Prof. Dr.  A. B. Singh  ") == ["singh"]
    assert normalize_name_tokens("Shri Ram Sharma") == ["ram", "sharma"]
    assert normalize_name_tokens("Smt. Sita Devi") == ["sita", "devi"]
    assert normalize_name_tokens("Er. Vikram Patel") == ["vikram", "patel"]


def test_normalize_name_key_equivalence():
    key1 = normalize_name_key("Prof. Namita Tiwari")
    key2 = normalize_name_key("Namita Tiwari")
    key3 = normalize_name_key("Dr. Namita Tiwari")
    key4 = normalize_name_key("   namita    tiwari   ")
    assert key1 == "namita tiwari"
    assert key1 == key2 == key3 == key4


def test_list_authors_query_construction_multi_token():
    mock_db = MagicMock()
    mock_db.scalar.return_value = 1
    mock_db.scalars.return_value.all.return_value = [
        ResearchAuthor(
            id=uuid.uuid4(),
            full_name="Prof. Namita Tiwari",
            department="Research and Development",
            institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
            is_verified=True,
        )
    ]

    total, authors = SamaCmsService.list_authors(
        mock_db,
        skip=0,
        limit=50,
        search="Namita Tiwari",
    )

    assert total == 1
    assert len(authors) == 1
    assert authors[0].full_name == "Prof. Namita Tiwari"

    # Verify query structure passed to db
    count_call_args = mock_db.scalar.call_args[0][0]
    select_call_args = mock_db.scalars.call_args[0][0]
    assert isinstance(count_call_args, Select)
    assert isinstance(select_call_args, Select)

    # Check that SQL string contains ilike filters
    sql_str = str(select_call_args)
    assert "full_name" in sql_str
    assert "is_verified" in sql_str


def test_list_authors_query_construction_with_honorific():
    mock_db = MagicMock()
    mock_db.scalar.return_value = 1
    mock_db.scalars.return_value.all.return_value = []

    # Searching "Prof. Namita Tiwari" should build filters without error
    total, authors = SamaCmsService.list_authors(
        mock_db,
        skip=0,
        limit=50,
        search="Prof. Namita Tiwari",
    )
    assert total == 1
    select_call_args = mock_db.scalars.call_args[0][0]
    sql_str = str(select_call_args)
    assert "sama_research_authors" in sql_str


def test_list_authors_query_construction_surname_first():
    mock_db = MagicMock()
    mock_db.scalar.return_value = 1
    mock_db.scalars.return_value.all.return_value = []

    # Searching "Tiwari Namita"
    total, authors = SamaCmsService.list_authors(
        mock_db,
        skip=0,
        limit=50,
        search="Tiwari Namita",
    )
    assert total == 1


def test_list_authors_filter_by_department():
    mock_db = MagicMock()
    mock_db.scalar.return_value = 5
    mock_db.scalars.return_value.all.return_value = []

    total, authors = SamaCmsService.list_authors(
        mock_db,
        department="Computer Science",
    )
    assert total == 5
    select_call_args = mock_db.scalars.call_args[0][0]
    sql_str = str(select_call_args)
    assert "department" in sql_str


def test_sync_single_authority():
    mock_db = MagicMock()
    # Mock no existing author
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    auth = NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=uuid.uuid4(),
        name_snapshot="Prof. Namita Tiwari",
        email_snapshot="research@csjmu.ac.in",
        role=NivaranRole.DEAN,
        department="Research and Development",
        is_active=True,
    )

    created_author = InstitutionalDirectorySyncService.sync_single_authority(mock_db, auth)
    assert created_author is not None
    assert created_author.full_name == "Prof. Namita Tiwari"
    assert created_author.department == "Research and Development"
    assert created_author.user_id == auth.vyasa_user_id
    assert created_author.is_verified is True
    assert created_author.institutional_affiliation == "Chhatrapati Shahu Ji Maharaj University, Kanpur"
    assert mock_db.add.called
    assert mock_db.flush.called


def test_sync_single_authority_updates_existing():
    mock_db = MagicMock()
    user_id = uuid.uuid4()
    existing_author = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Namita Tiwari",
        department=None,
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        user_id=None,
        is_verified=False,
    )
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    mock_db.execute.return_value.scalars.return_value.all.return_value = [existing_author]

    auth = NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=user_id,
        name_snapshot="Prof. Namita Tiwari",
        email_snapshot="research@csjmu.ac.in",
        role=NivaranRole.DEAN,
        department="Research and Development",
        is_active=True,
    )

    synced_author = InstitutionalDirectorySyncService.sync_single_authority(mock_db, auth)
    assert synced_author is existing_author
    assert synced_author.user_id == user_id
    assert synced_author.department == "Research and Development"
    assert synced_author.is_verified is True
