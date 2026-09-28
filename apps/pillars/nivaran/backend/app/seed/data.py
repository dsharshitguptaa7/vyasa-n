"""
NIVARAN Institutional Master Data Specifications.

Authoritative source-backed master data structures for:
1. Authority Profiles (Bootstrap Roster linked to VYASA Core)
2. 10 Subject Clusters (Academic Taxonomy)
3. 56 Production Subjects mapped 1:many to Subject Clusters
4. 3 Grievance Clusters (Domain Taxonomy)
5. 16 Grievance Categories across 3 Routing Types
"""

import os
import uuid
from typing import Any, Dict, List

from app.models.enums import CategoryRoutingType, NivaranRole
from app.seed.authority_mappings import (
    PROVISIONED_AUTHORITY_VYASA_MAP,
    resolve_authority_vyasa_id,
)


# ==============================================================================
# 1. INSTITUTIONAL AUTHORITIES ROSTER (13 PROFILES)
# ==============================================================================

AUTHORITIES_ROSTER: List[Dict[str, Any]] = [
    # 10 Assistant Deans
    {
        "key": "ankit_trivedi",
        "name": "Dr. Ankit Trivedi",
        "email": "ankit.trivedi@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 1,
        "designation": "Assistant Dean (Cluster 1)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "pooja_singh",
        "name": "Dr. Pooja Singh",
        "email": "pooja.singh@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 2,
        "designation": "Assistant Dean (Cluster 2)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "priyanka_maurya",
        "name": "Dr. Priyanka Maurya",
        "email": "priyanka.maurya@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 3,
        "designation": "Assistant Dean (Cluster 3)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "dipesh_verma",
        "name": "Dr. Dipesh Kumar Verma",
        "email": "dipesh.verma@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 4,
        "designation": "Assistant Dean (Cluster 4) & Fellowship Authority",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "adarsh_srivastav",
        "name": "Dr. Adarsh Kumar Srivastav",
        "email": "adarsh.srivastav@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 5,
        "designation": "Assistant Dean (Cluster 5)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "pravin_agarwal",
        "name": "Dr. Pravin Kumar Agarwal",
        "email": "pravin.agarwal@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 6,
        "designation": "Assistant Dean (Cluster 6)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "shashi_mishra",
        "name": "Dr. Shashi Kiran Mishra",
        "email": "shashi.mishra@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 7,
        "designation": "Assistant Dean (Cluster 7)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "priyanka_gupta",
        "name": "Dr. Priyanka Gupta",
        "email": "priyanka.gupta@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 8,
        "designation": "Assistant Dean (Cluster 8)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "anjani_upadhayay",
        "name": "Dr. Anjani Kumar Upadhayay",
        "email": "anjani.upadhayay@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 9,
        "designation": "Assistant Dean (Cluster 9)",
        "department": "R&D / Academic Administration",
    },
    {
        "key": "samiuddin",
        "name": "Dr. Samiuddin",
        "email": "samiuddin@nivaran.local",
        "role": NivaranRole.ASSISTANT_DEAN,
        "cluster_role": "ASSISTANT_DEAN",
        "cluster_number": 10,
        "designation": "Assistant Dean (Cluster 10) & RTI/IIGRS Authority",
        "department": "R&D / Academic Administration",
    },
    # 3 Associate Deans
    {
        "key": "arun_gupta",
        "name": "Dr. Arun Kumar Gupta",
        "email": "arun.gupta@nivaran.local",
        "role": NivaranRole.ASSOCIATE_DEAN,
        "cluster_role": "ASSOCIATE_DEAN",
        "cluster_number": 1,
        "designation": "Associate Dean (Grievance Cluster 1)",
        "department": "R&D / Institutional Governance",
    },
    {
        "key": "manas_upadhyay",
        "name": "Dr. Manas Upadhyay",
        "email": "manas.upadhyay@nivaran.local",
        "role": NivaranRole.ASSOCIATE_DEAN,
        "cluster_role": "ASSOCIATE_DEAN",
        "cluster_number": 2,
        "designation": "Associate Dean (Grievance Cluster 2)",
        "department": "R&D / Institutional Governance",
    },
    {
        "key": "sweta_pandey",
        "name": "Dr. Sweta Pandey",
        "email": "sweta.pandey@nivaran.local",
        "role": NivaranRole.ASSOCIATE_DEAN,
        "cluster_role": "ASSOCIATE_DEAN",
        "cluster_number": 3,
        "designation": "Associate Dean (Grievance Cluster 3)",
        "department": "R&D / Institutional Governance",
    },
]


# ==============================================================================
# 2. SUBJECT CLUSTERS (10 ACADEMIC DIVISIONS)
# ==============================================================================

SUBJECT_CLUSTERS_DATA: List[Dict[str, Any]] = [
    {"cluster_number": 1, "name": "Cluster 1", "assistant_dean_key": "ankit_trivedi"},
    {"cluster_number": 2, "name": "Cluster 2", "assistant_dean_key": "pooja_singh"},
    {"cluster_number": 3, "name": "Cluster 3", "assistant_dean_key": "priyanka_maurya"},
    {"cluster_number": 4, "name": "Cluster 4", "assistant_dean_key": "dipesh_verma"},
    {"cluster_number": 5, "name": "Cluster 5", "assistant_dean_key": "adarsh_srivastav"},
    {"cluster_number": 6, "name": "Cluster 6", "assistant_dean_key": "pravin_agarwal"},
    {"cluster_number": 7, "name": "Cluster 7", "assistant_dean_key": "shashi_mishra"},
    {"cluster_number": 8, "name": "Cluster 8", "assistant_dean_key": "priyanka_gupta"},
    {"cluster_number": 9, "name": "Cluster 9", "assistant_dean_key": "anjani_upadhayay"},
    {"cluster_number": 10, "name": "Cluster 10", "assistant_dean_key": "samiuddin"},
]


# ==============================================================================
# 3. PRODUCTION SUBJECTS (56 SUBJECTS MAPPED 1:MANY)
# ==============================================================================

SUBJECTS_BY_CLUSTER: Dict[int, List[str]] = {
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


# ==============================================================================
# 4. GRIEVANCE CLUSTERS (3 DOMAIN CLUSTERS)
# ==============================================================================

GRIEVANCE_CLUSTERS_DATA: List[Dict[str, Any]] = [
    {
        "cluster_number": 1,
        "name": "Cluster 1 - Admissions, Registration & Supervisors",
        "associate_dean_key": "arun_gupta",
        "description": "Admissions, Registration, Supervisor Allocation",
    },
    {
        "cluster_number": 2,
        "name": "Cluster 2 - Coursework, RAC & RDC",
        "associate_dean_key": "manas_upadhyay",
        "description": "Coursework, RAC, RDC, Part-Time/Full-Time Conversion",
    },
    {
        "cluster_number": 3,
        "name": "Cluster 3 - Research Verification & Thesis",
        "associate_dean_key": "sweta_pandey",
        "description": "Publication Verification, Plagiarism Clearance, Thesis Evaluation",
    },
]


# ==============================================================================
# 5. GRIEVANCE CATEGORIES (16 ESTABLISHED CATEGORIES ACROSS 3 ROUTING TYPES)
# ==============================================================================

CATEGORIES_DATA: List[Dict[str, Any]] = [
    # Routing Type: GRIEVANCE_CLUSTER -> Cluster 1 (Admissions, Registration, Supervisor Allocation)
    {
        "name": "PhD_Admission",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 1,
        "fixed_authority_key": None,
        "description": "PhD entrance, admission procedure, seat allocation inquiries",
    },
    {
        "name": "Registration",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 1,
        "fixed_authority_key": None,
        "description": "Doctoral registration, enrollment confirmation, renewal issues",
    },
    {
        "name": "Supervisor_Related",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 1,
        "fixed_authority_key": None,
        "description": "Supervisor allocation, co-supervisor appointment, change of guide",
    },

    # Routing Type: GRIEVANCE_CLUSTER -> Cluster 2 (Coursework, RAC, RDC, PT/FT Conversion)
    {
        "name": "Course_Work",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 2,
        "fixed_authority_key": None,
        "description": "PhD coursework, classes, syllabus, coursework examinations",
    },
    {
        "name": "RAC",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 2,
        "fixed_authority_key": None,
        "description": "Research Advisory Committee scheduling, presentation, review",
    },
    {
        "name": "RDC",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 2,
        "fixed_authority_key": None,
        "description": "Research Degree Committee approval, topic modification",
    },
    {
        "name": "FT_PT_Conversion",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 2,
        "fixed_authority_key": None,
        "description": "Conversion between Full-Time and Part-Time doctoral status",
    },

    # Routing Type: GRIEVANCE_CLUSTER -> Cluster 3 (Publication, Thesis)
    {
        "name": "Publication_Verification",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 3,
        "fixed_authority_key": None,
        "description": "UGC-CARE / Scopus / peer-reviewed journal publication verification",
    },
    {
        "name": "Thesis_Submission",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 3,
        "fixed_authority_key": None,
        "description": "Thesis submission prerequisites, plagiarism clearance certificate",
    },
    {
        "name": "Thesis_Evaluation",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
        "grievance_cluster_number": 3,
        "fixed_authority_key": None,
        "description": "External examiner evaluation reports, thesis review progress",
    },

    # Routing Type: SUBJECT_ASSISTANT_DEAN
    {
        "name": "Viva",
        "routing_type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
        "grievance_cluster_number": None,
        "fixed_authority_key": None,
        "description": "Oral defence / viva-voce examination scheduling and coordination",
    },
    {
        "name": "Fee",
        "routing_type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
        "grievance_cluster_number": None,
        "fixed_authority_key": None,
        "description": "Tuition, examination, semester or annual fee disputes and receipts",
    },
    {
        "name": "Portal_Data_Correction",
        "routing_type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
        "grievance_cluster_number": None,
        "fixed_authority_key": None,
        "description": "Correction of student profile, spelling, records on university portal",
    },
    {
        "name": "Other",
        "routing_type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
        "grievance_cluster_number": None,
        "fixed_authority_key": None,
        "description": "General departmental and academic inquiries not listed elsewhere",
    },

    # Routing Type: FIXED_AUTHORITY
    {
        "name": "Fellowship",
        "routing_type": CategoryRoutingType.FIXED_AUTHORITY,
        "grievance_cluster_number": None,
        "fixed_authority_key": "dipesh_verma",  # Dr. Dipesh Kumar Verma
        "description": "JRF/SRF/University fellowship disbursement and stipend claims",
    },
    {
        "name": "RTI_IIGRS",
        "routing_type": CategoryRoutingType.FIXED_AUTHORITY,
        "grievance_cluster_number": None,
        "fixed_authority_key": "samiuddin",     # Dr. Samiuddin
        "description": "Right to Information (RTI) and Integrated Grievance Redressal System matters",
    },
]
