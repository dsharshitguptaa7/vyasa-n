"""
VYASA Core Module Registry
Architectural evolution from microservice PillarRegistry to in-process Modular Monolith Registry.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ModuleDescriptor(BaseModel):
    module_key: str = Field(..., description="Unique slug identifier: e.g. rig_veda, atharva_veda_nivaran")
    name: str = Field(..., description="Human-readable module name")
    veda_domain: str = Field(..., description="Veda governance domain (Rig, Yajur, Sama, Atharva)")
    description: str = Field(..., description="Institutional purpose of this module")
    status: str = Field(default="active", description="Operational status: active, beta, maintenance, planned")
    version: str = Field(default="0.1.0", description="Module semantic version")
    is_enabled: bool = Field(default=True, description="Whether the module is enabled in this deployment")
    internal_route_prefix: str = Field(..., description="In-process internal route prefix e.g. /modules/atharva-veda/nivaran")
    required_permissions: List[str] = Field(default_factory=list, description="RBAC permissions required for access")
    navigation_metadata: Dict[str, Any] = Field(default_factory=dict, description="UI navigation display metadata")


# Static in-memory registry of foundational Veda modules
DEFAULT_VEDA_MODULES: List[ModuleDescriptor] = [
    ModuleDescriptor(
        module_key="rig_veda",
        name="Rig Veda",
        veda_domain="Research & Knowledge Creation",
        description="Doctoral research discovery, publications, synopsis progression, and thesis defense governance.",
        status="planned",
        version="0.1.0",
        is_enabled=False,
        internal_route_prefix="/modules/rig-veda",
        required_permissions=["rig:read"],
        navigation_metadata={"icon": "book-open", "order": 1},
    ),
    ModuleDescriptor(
        module_key="yajur_veda",
        name="Yajur Veda",
        veda_domain="Research Administration & Incentives",
        description="Institutional funding administration, research grants, incentive disbursements, and ethics clearance.",
        status="planned",
        version="0.1.0",
        is_enabled=False,
        internal_route_prefix="/modules/yajur-veda",
        required_permissions=["yajur:read"],
        navigation_metadata={"icon": "file-text", "order": 2},
    ),
    ModuleDescriptor(
        module_key="sama_veda",
        name="Sama Veda",
        veda_domain="Research Recognition & Communication",
        description="Faculty citation telemetry, research metrics, institutional symposiums, and scholarly awards.",
        status="planned",
        version="0.1.0",
        is_enabled=False,
        internal_route_prefix="/modules/sama-veda",
        required_permissions=["sama:read"],
        navigation_metadata={"icon": "award", "order": 3},
    ),
    ModuleDescriptor(
        module_key="atharva_veda_nivaran",
        name="Atharva Veda (NIVARAN-AI)",
        veda_domain="Grievance Redressal & Institutional Well-Being",
        description="Institutional grievance redressal, accountable hierarchical forwarding, and cryptographic dossier archival.",
        status="active",
        version="1.0.0-MODULAR",
        is_enabled=True,
        internal_route_prefix="/modules/atharva-veda/nivaran",
        required_permissions=["atharva:submit", "atharva:triage"],
        navigation_metadata={"icon": "shield-check", "order": 4},
    ),
]


def get_all_registered_modules() -> List[ModuleDescriptor]:
    return DEFAULT_VEDA_MODULES


def get_module_by_key(key: str) -> Optional[ModuleDescriptor]:
    for mod in DEFAULT_VEDA_MODULES:
        if mod.module_key == key or mod.module_key.replace("_", "-") == key:
            return mod
    return None
