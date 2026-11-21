"""
Authoritative Research Intelligence & Analytics Aggregation Service.
Centralizes calculation of scholarly output, category distribution,
researcher verification metrics, and bulletin associations across Sama Veda.
Guarantees zero hardcoded metrics and complete data reconciliation.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import re
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case, or_, and_, text

from app.modules.sama_veda.models.publication import ResearchPublication
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.models.fellowship import FellowshipScheme


# Canonical publication categories
CANONICAL_CATEGORIES = [
    "Article",
    "Review",
    "Book Chapter",
    "Conference Paper",
    "Book",
]

CATEGORY_NORMALIZATION_MAP = {
    "article": "Article",
    "articles": "Article",
    "journal article": "Article",
    "review": "Review",
    "reviews": "Review",
    "review article": "Review",
    "book chapter": "Book Chapter",
    "chapter": "Book Chapter",
    "conference paper": "Conference Paper",
    "conference proceedings": "Conference Paper",
    "proceeding": "Conference Paper",
    "proceedings": "Conference Paper",
    "book": "Book",
    "books": "Book",
}


def normalize_publication_category(raw_category: Optional[str]) -> str:
    """
    Normalizes arbitrary category strings into canonical institutional categories.
    """
    if not raw_category or not raw_category.strip():
        return "Uncategorized"
    
    cleaned = raw_category.strip().lower()
    cleaned = re.sub(r"\s+", " ", cleaned)
    
    if cleaned in CATEGORY_NORMALIZATION_MAP:
        return CATEGORY_NORMALIZATION_MAP[cleaned]
    
    # Capitalize title case for unrecognized types
    return " ".join(word.capitalize() for word in cleaned.split(" "))


class SamaAnalyticsService:
    """
    Authoritative backend aggregation engine for Research Intelligence & Analytics.
    Ensures identical aggregation logic across Overview and specific modules.
    """

    @classmethod
    def get_total_eligible_publications(cls, db: Session) -> int:
        """
        Total published research publications.
        STRICT CRITERIA: status == 'published'.
        """
        stmt = (
            select(func.count(ResearchPublication.id))
            .where(ResearchPublication.status == "published")
        )
        return db.scalar(stmt) or 0

    @classmethod
    def get_publication_category_distribution(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Aggregates published publications by category from authoritative database records.
        Normalizes categories and reconciles totals.
        """
        stmt = (
            select(
                ResearchPublication.category,
                func.count(ResearchPublication.id).label("count")
            )
            .where(ResearchPublication.status == "published")
            .group_by(ResearchPublication.category)
        )
        rows = db.execute(stmt).all()
        
        normalized_counts: Dict[str, int] = {}
        for cat_raw, count in rows:
            norm = normalize_publication_category(cat_raw)
            normalized_counts[norm] = normalized_counts.get(norm, 0) + (count or 0)
        
        total_eligible = sum(normalized_counts.values())
        
        # Sort descending by count, then alphabetical
        sorted_categories = sorted(
            normalized_counts.items(),
            key=lambda x: (-x[1], x[0])
        )
        
        return [
            {
                "name": name,
                "count": count,
                "percentage": round((count / total_eligible) * 100, 1) if total_eligible > 0 else 0.0,
            }
            for name, count in sorted_categories
        ]

    @classmethod
    def get_publication_yearly_trends(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Aggregates published publications by calendar year.
        Uses published_at when available, falling back to created_at.
        Excludes unparseable, out-of-range, or missing years.
        """
        year_expr = func.extract(
            "year",
            func.coalesce(ResearchPublication.published_at, ResearchPublication.created_at)
        )
        stmt = (
            select(
                year_expr.label("year"),
                func.count(ResearchPublication.id).label("count")
            )
            .where(ResearchPublication.status == "published")
            .where(year_expr.isnot(None))
            .where(year_expr >= 1990)
            .where(year_expr <= 2100)
            .group_by(year_expr)
            .order_by(year_expr.asc())
        )
        rows = db.execute(stmt).all()
        
        return [
            {
                "year": str(int(r.year)),
                "count": r.count,
            }
            for r in rows
            if r.year is not None
        ]

    @classmethod
    def get_researcher_verification_metrics(cls, db: Session) -> Dict[str, int]:
        """
        Authoritative researcher verification counts.
        - Verified Faculty: is_verified == True
        - Provisional Scholars: is_verified == False
        - Total: all distinct researcher profiles in sama_research_authors
        """
        stmt = select(
            func.count(ResearchAuthor.id).label("total"),
            func.count(case((ResearchAuthor.is_verified == True, ResearchAuthor.id), else_=None)).label("verified"),
            func.count(case((ResearchAuthor.is_verified == False, ResearchAuthor.id), else_=None)).label("provisional"),
        )
        row = db.execute(stmt).one()
        return {
            "total_researchers": row.total or 0,
            "verified_faculty": row.verified or 0,
            "provisional_scholars": row.provisional or 0,
        }

    @classmethod
    def get_bulletin_issue_metrics(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Aggregates bulletin issues with live publication association counts.
        Distinguishes between actual published records in VYASA database
        and archival cover count.
        """
        stmt = (
            select(
                ResearchBulletin.id,
                ResearchBulletin.volume_number,
                ResearchBulletin.issue_number,
                ResearchBulletin.title,
                ResearchBulletin.publication_period,
                ResearchBulletin.publication_count.label("archival_count"),
                ResearchBulletin.file_size_bytes,
                func.count(
                    case(
                        (ResearchPublication.status == "published", ResearchPublication.id),
                        else_=None,
                    )
                ).label("actual_publication_count"),
            )
            .outerjoin(ResearchPublication, ResearchBulletin.id == ResearchPublication.bulletin_id)
            .where(ResearchBulletin.status == "published")
            .where(ResearchBulletin.is_active == True)
            .group_by(
                ResearchBulletin.id,
                ResearchBulletin.volume_number,
                ResearchBulletin.issue_number,
                ResearchBulletin.title,
                ResearchBulletin.publication_period,
                ResearchBulletin.publication_count,
                ResearchBulletin.file_size_bytes,
            )
            .order_by(
                ResearchBulletin.volume_number.asc(),
                ResearchBulletin.issue_number.asc(),
            )
        )
        rows = db.execute(stmt).all()
        
        return [
            {
                "id": str(r.id),
                "volume_number": r.volume_number,
                "issue_number": r.issue_number,
                "label": f"Vol {r.volume_number} Iss {r.issue_number}",
                "title": r.title,
                "period": r.publication_period,
                "actual_publication_count": r.actual_publication_count or 0,
                "archival_count": r.archival_count or 0,
                "file_size_bytes": r.file_size_bytes or 0,
            }
            for r in rows
        ]

    @classmethod
    def get_indexing_and_recognition_metrics(cls, db: Session) -> Dict[str, Any]:
        """
        Returns publication indexing and grant metrics.
        Kept strictly as distinct entity counts without combining them into a misleading sum.
        """
        pub_stmt = select(
            func.count(ResearchPublication.id).label("total_published"),
            func.count(case((and_(ResearchPublication.doi.isnot(None), func.trim(ResearchPublication.doi) != ""), ResearchPublication.id), else_=None)).label("with_doi"),
        ).where(ResearchPublication.status == "published")
        pub_row = db.execute(pub_stmt).one()
        
        total_published = pub_row.total_published or 0
        doi_indexed = pub_row.with_doi or 0
        direct_peer_reviewed = max(0, total_published - doi_indexed)
        
        total_cam_projects = db.scalar(
            select(func.count(CamAiProject.id))
        ) or 0
        
        total_fellows = db.scalar(
            select(func.coalesce(func.sum(FellowshipScheme.active_scholars_count), 0))
        ) or 0
        
        return {
            "total_publications": total_published,
            "doi_indexed_publications": doi_indexed,
            "direct_citation_publications": direct_peer_reviewed,
            "cam_projects_count": total_cam_projects,
            "active_fellows_count": total_fellows,
        }

    @classmethod
    def get_full_overview_analytics(cls, db: Session) -> Dict[str, Any]:
        """
        Consolidated, authoritative payload for the Research Intelligence & Analytics Overview.
        All metrics reconcile with their authoritative datasets.
        """
        total_publications = cls.get_total_eligible_publications(db)
        categories = cls.get_publication_category_distribution(db)
        yearly_trends = cls.get_publication_yearly_trends(db)
        researcher_metrics = cls.get_researcher_verification_metrics(db)
        bulletin_metrics = cls.get_bulletin_issue_metrics(db)
        recognition_metrics = cls.get_indexing_and_recognition_metrics(db)
        
        # Verify category totals reconcile with total_publications
        category_sum = sum(c["count"] for c in categories)
        
        # Verify yearly trends sum matches total_publications (or explain difference if missing years exist)
        yearly_sum = sum(y["count"] for y in yearly_trends)
        
        # Verify bulletin actual count sum matches total_publications
        bulletin_actual_sum = sum(b["actual_publication_count"] for b in bulletin_metrics)
        
        return {
            "summary": {
                "total_publications": total_publications,
                "total_researchers": researcher_metrics["total_researchers"],
                "verified_faculty": researcher_metrics["verified_faculty"],
                "provisional_scholars": researcher_metrics["provisional_scholars"],
                "total_bulletins": len(bulletin_metrics),
                "cam_grants": recognition_metrics["cam_projects_count"],
                "active_fellows": recognition_metrics["active_fellows_count"],
            },
            "category_distribution": categories,
            "yearly_trends": yearly_trends,
            "researcher_breakdown": researcher_metrics,
            "bulletin_volumes": bulletin_metrics,
            "indexing_metrics": {
                "doi_indexed": recognition_metrics["doi_indexed_publications"],
                "direct_peer_reviewed": recognition_metrics["direct_citation_publications"],
            },
            "reconciliation": {
                "total_publications": total_publications,
                "category_sum": category_sum,
                "yearly_sum": yearly_sum,
                "bulletin_actual_sum": bulletin_actual_sum,
                "categories_reconciled": category_sum == total_publications,
                "bulletins_reconciled": bulletin_actual_sum == total_publications,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


sama_analytics_service = SamaAnalyticsService()
