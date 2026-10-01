"""
Canonical Institutional Subject Catalog for VYASA Core Redirection & Verification.

This catalog mirrors the canonical 56 production subjects established across the
institutional taxonomy, allowing VYASA Core to validate applicant subject assignments
and expose them to registration interfaces without direct cross-database dependencies.
"""

from typing import Dict, List, Optional
import uuid

CANONICAL_SUBJECTS: List[Dict[str, str]] = [
    {"id": "2e79b5bc-27b5-4006-af24-27550c2ec56d", "name": "Agricultural Chemistry"},
    {"id": "c7a2eebb-d179-42da-a5ea-0751ce904eb8", "name": "Agricultural Economics"},
    {"id": "fbf8d437-db83-4b5c-9c26-6c78bc32939f", "name": "Agriculture Entomology"},
    {"id": "4484c614-d97c-46da-badd-c4f1fc6f4b95", "name": "Agriculture Extension"},
    {"id": "49f01f2d-d903-4154-b2b2-ad744b95d7be", "name": "Agronomy"},
    {"id": "5dce488c-c861-43fe-9858-d5b275f875f6", "name": "Biochemistry"},
    {"id": "68f6c275-f5b0-49d0-9b4f-0ebfd9a97481", "name": "Biotechnology"},
    {"id": "c4cbc502-5dd5-43a4-8960-9e0c5d0f11a6", "name": "Botany"},
    {"id": "9b387d92-921d-4879-8dc8-f2b483aaead1", "name": "Business Management"},
    {"id": "90e17baf-2c84-4746-8b18-0c9b03ed57cc", "name": "Chemical Engineering"},
    {"id": "e43a06c4-0883-47fd-90d1-5d8d2daf4816", "name": "Chemistry"},
    {"id": "f6e4d398-9f23-44f3-987b-c49553625e58", "name": "Commerce"},
    {"id": "b9e772cb-1b2d-44d5-84e8-f3604019dd8f", "name": "Computer Application"},
    {"id": "298ede77-4b87-448b-92cb-dcad1c9a723a", "name": "Computer Science and Engineering"},
    {"id": "6585daa1-7c08-4999-b54a-6e9fa6cc28a8", "name": "Deen Dayal Sodh Kendra"},
    {"id": "34e994f0-087c-4a61-9227-53a4f8a6746e", "name": "Defence and Strategies"},
    {"id": "9213f6cb-2f4d-4533-83fb-f646eaa3265f", "name": "Drawing and Painting"},
    {"id": "fee1c4d0-43d7-4763-88ec-7284d384fc86", "name": "Economics"},
    {"id": "d0cda3b3-5889-4852-aab7-bf98e65ce8a6", "name": "Education/Education Training"},
    {"id": "3a6b1024-ab44-4d04-90b0-67458dc7a4e7", "name": "Electronics and Communication Engineering"},
    {"id": "0b053a9c-c0fd-4f43-9010-0bf360281d9e", "name": "English Literature"},
    {"id": "e21251b0-7543-4a99-849f-5d5512a179f6", "name": "Food Technology"},
    {"id": "5f0900d9-c718-48b8-ab7e-e4625a35c4d1", "name": "Genetics and Plant Breeding"},
    {"id": "d1775e0d-8189-46f0-963d-ec19af2ce84b", "name": "Geography"},
    {"id": "81f90776-468e-488e-b2f1-0322ca2b2ace", "name": "Hindi Literature"},
    {"id": "81b409a3-d274-4ac5-843a-88ad70773b83", "name": "Hindu Studies"},
    {"id": "c46bc730-13c7-4239-94e0-62f91c43c07e", "name": "History"},
    {"id": "ec375511-f408-4453-80e9-fc71719522da", "name": "Home Science"},
    {"id": "154f7529-6eb2-499d-9709-e5da8529b3ee", "name": "Horticulture"},
    {"id": "2bbc6c02-21cf-4b86-b403-44181d2817d0", "name": "Journalism and Mass Communication"},
    {"id": "3fc057c7-94a6-4a7d-b5c6-6c992771e23f", "name": "Law"},
    {"id": "cefb5038-7dd8-49bd-b90b-4d19dd83eb5c", "name": "Library and Information Science"},
    {"id": "3e052804-de6d-46b1-9f4f-e4cfb932d03f", "name": "Life Long Engineering"},
    {"id": "7945854f-bb71-4f20-ac1c-b66bf6e9f3c9", "name": "Life Science"},
    {"id": "c6612ba3-468e-4b0c-9e53-fba54bc090c7", "name": "MLT"},
    {"id": "b729db1e-5a5c-4137-a9da-72e2e27ff62c", "name": "Mathematics"},
    {"id": "91a89b00-f94c-4717-9226-338347492d62", "name": "Mechanical Engineering"},
    {"id": "ad53339c-7ed4-4f48-8e56-c34218be0bac", "name": "Microbiology"},
    {"id": "a9317ab0-c947-4989-a509-f3f7603b6307", "name": "Music"},
    {"id": "c961d759-a215-426c-bfc2-4474c5de54c8", "name": "Pharmacy"},
    {"id": "ccd0906d-bc3d-4713-9895-f494eadc7d29", "name": "Philosophy"},
    {"id": "27132811-4760-4d43-a78f-6b2b502859eb", "name": "Physical Education"},
    {"id": "0c590459-4720-4f78-aada-32708e7a05bc", "name": "Physics"},
    {"id": "f7b4e3b7-5490-409a-9cb8-9f7ac0fd5c4f", "name": "Physiotherapy"},
    {"id": "eaa0616f-af2c-43ac-a0a5-964339592a51", "name": "Plant Pathology"},
    {"id": "16ce5633-557a-4870-820e-dd526e041987", "name": "Political Science"},
    {"id": "dce19a9e-c2a7-4a96-a67c-0e1fd6bbe9d1", "name": "Psychology"},
    {"id": "429c3093-925d-4998-a19a-35c38587cd1f", "name": "Sanskrit"},
    {"id": "d4c00a68-bf53-43eb-9963-1beaf06dbdbd", "name": "Social Work"},
    {"id": "ac8e5e7d-1371-4c86-852c-880f5698a1e9", "name": "Sociology"},
    {"id": "87292fab-a330-4dca-aad6-1e98236e2a76", "name": "Soil Conservation"},
    {"id": "c622b90f-2689-4263-b031-0d7bfb4ae319", "name": "Soil Science"},
    {"id": "3cdce35f-39c7-495f-8593-b96609a90270", "name": "Statistics"},
    {"id": "d22924fc-5d98-41ea-8269-d88b51a1ceb6", "name": "Urdu"},
    {"id": "e9c06805-b44c-4b7f-ace9-9323a0b2aeda", "name": "Yoga"},
    {"id": "7183c337-5c76-4000-9784-546d567b047d", "name": "Zoology"},
]

SUBJECT_MAP_BY_ID: Dict[str, Dict[str, str]] = {
    s["id"]: s for s in CANONICAL_SUBJECTS
}


def get_canonical_subjects() -> List[Dict[str, str]]:
    """Return all 56 canonical subjects sorted alphabetically by name."""
    return CANONICAL_SUBJECTS


def get_subject_by_id(subject_id: uuid.UUID | str) -> Optional[Dict[str, str]]:
    """Lookup a canonical subject by UUID or UUID string."""
    return SUBJECT_MAP_BY_ID.get(str(subject_id))
