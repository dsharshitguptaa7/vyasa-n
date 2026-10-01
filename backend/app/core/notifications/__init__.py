"""
VYASA Core Notification Subsystem
Owns platform alerts and cross-module notification dispatching.
"""
from app.models.notification import Notification

__all__ = ["Notification"]
