"""
Backwards-compatible bridge for PillarRegistry evolving to ModuleRegistry.
"""
from app.models.module import ModuleRegistry, PillarRegistry

__all__ = ["PillarRegistry", "ModuleRegistry"]
