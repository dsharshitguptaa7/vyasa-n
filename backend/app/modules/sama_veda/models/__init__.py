"""
Sama Veda Data Models: Research Recognition & Communication
Tables prefixed with 'sama_*'.
"""
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.publication import ResearchPublication, PublicationAuthor
from app.modules.sama_veda.models.certificate import FelicitationCertificate, CertificateVerificationEvent
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.models.fellowship import FellowshipScheme
from app.modules.sama_veda.models.spotlight import ResearcherSpotlight
from app.modules.sama_veda.models.import_batch import SamaImportBatch

__all__ = [
    "ResearchBulletin",
    "ResearchAuthor",
    "ResearchPublication",
    "PublicationAuthor",
    "FelicitationCertificate",
    "CertificateVerificationEvent",
    "CamAiProject",
    "FellowshipScheme",
    "ResearcherSpotlight",
    "SamaImportBatch",
]
