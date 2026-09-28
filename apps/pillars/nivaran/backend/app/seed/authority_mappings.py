"""
Dedicated non-secret authority provisioning mapping for NIVARAN.

Maps institutional authority profiles to their primary VYASA Core user UUIDs.
Contains ONLY provisioned UUID references (NO passwords, tokens, or credentials).

Resolution Priority:
1. Cluster-specific environment variable:
   - ASSISTANT_DEAN_CLUSTER_<N>_VYASA_USER_ID
   - ASSOCIATE_DEAN_CLUSTER_<N>_VYASA_USER_ID
2. Authority-key environment variable:
   - NIVARAN_AUTHORITY_<KEY>_VYASA_USER_ID
3. Canonical provisioned mapping (PROVISIONED_AUTHORITY_VYASA_MAP)
4. None (Unresolved - NEVER generates random or fake UUIDs)
"""

import os
import uuid
from typing import Dict, Optional

# Canonical provisioned VYASA Core UUID references for institutional authorities.
# In production, these correspond to actual User.id records in VYASA Core.
PROVISIONED_AUTHORITY_VYASA_MAP: Dict[str, Optional[uuid.UUID]] = {
    # 10 Assistant Deans
    "ankit_trivedi": uuid.UUID("89352e91-401f-5dc9-83bc-b8c9ed021ed6"),      # Cluster 1
    "pooja_singh": uuid.UUID("3cd11b9e-64fb-5387-aeff-9cdc965274af"),        # Cluster 2
    "priyanka_maurya": uuid.UUID("aa72e7be-e3a0-5084-9f5f-14fd6a82feb4"),    # Cluster 3
    "dipesh_verma": uuid.UUID("c15caab3-45ae-56d2-a56b-3e7ba30367d9"),       # Cluster 4 & Fellowship
    "adarsh_srivastav": uuid.UUID("0c57021f-eade-5f1b-9811-ef265fc528d6"),   # Cluster 5
    "pravin_agarwal": uuid.UUID("4942d74f-9d17-5d16-9276-d5305161ed9b"),     # Cluster 6
    "shashi_mishra": uuid.UUID("56afc6ca-98f3-524d-8f8d-f3e6c1388814"),      # Cluster 7
    "priyanka_gupta": uuid.UUID("0d6e7eb8-d479-547e-9ebc-fe41d07a4548"),     # Cluster 8
    "anjani_upadhayay": uuid.UUID("0e1e271d-545f-545e-95cf-e00138e4d73d"),   # Cluster 9
    "samiuddin": uuid.UUID("26fd1ca7-4a82-5c01-99fb-96680d3db407"),          # Cluster 10 & RTI_IIGRS
    # 3 Associate Deans
    "arun_gupta": uuid.UUID("e6a36b30-6c8b-5d04-94fe-1ab4ca0df52f"),         # Grievance Cluster 1
    "manas_upadhyay": uuid.UUID("9c338755-5bb4-5f53-93af-cd46a22bdf4b"),     # Grievance Cluster 2
    "sweta_pandey": uuid.UUID("5ce1e4a1-c852-525c-8919-d7b5984b3024"),       # Grievance Cluster 3
}


def resolve_authority_vyasa_id(
    authority_key: str,
    cluster_role: Optional[str] = None,
    cluster_number: Optional[int] = None,
) -> Optional[uuid.UUID]:
    """
    Resolve the vyasa_user_id for an institutional authority without inventing fake IDs.
    Returns None if the authority has not been provisioned with a VYASA identity.
    """
    # 1. Check cluster-specific environment variable
    if cluster_role and cluster_number is not None:
        cluster_env_var = f"{cluster_role.upper()}_CLUSTER_{cluster_number}_VYASA_USER_ID"
        env_val = os.getenv(cluster_env_var)
        if env_val and env_val.strip():
            return uuid.UUID(env_val.strip())

    # 2. Check authority-key environment variable
    key_env_var = f"NIVARAN_AUTHORITY_{authority_key.upper()}_VYASA_USER_ID"
    env_val = os.getenv(key_env_var)
    if env_val and env_val.strip():
        return uuid.UUID(env_val.strip())

    # 3. Check provisioned authority map
    return PROVISIONED_AUTHORITY_VYASA_MAP.get(authority_key)
