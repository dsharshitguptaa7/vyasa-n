"""
Atharva Veda (NIVARAN-AI) Dean Executive Command Center Service.
Performs pure database aggregations and analytics over grievances, assignments,
authorities, and taxonomies without fake statistics or hardcoded mock data.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy import select, func, and_, or_, desc, asc
from sqlalchemy.orm import Session, selectinload

from app.modules.atharva_veda.nivaran.models.enums import (
    GrievancePriority,
    GrievanceStatus,
    NivaranRole,
    CategoryRoutingType,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
)
from app.modules.atharva_veda.nivaran.models.routing import (
    Assignment,
    ForwardingConfirmation,
)
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    Category,
    Subject,
    SubjectCluster,
    GrievanceCluster,
)
from app.modules.atharva_veda.nivaran.schemas.dean_dashboard import (
    DeanExecutiveKPIs,
    WorkflowPipelineStage,
    BottleneckLevelItem,
    AgingBucketItem,
    AuthorityWorkloadItem,
    AssistantDeanWorkloadItem,
    AssociateDeanWorkloadItem,
    RecentCategoryOverrideItem,
    ManagerTriagePanel,
    CategoryAnalyticsItem,
    GrievanceClusterAnalyticsItem,
    SubjectAnalyticsItem,
    SubjectClusterAnalyticsItem,
    PriorityLevelDistribution,
    TimeTrendPoint,
    RoutingTypeDistribution,
    EscalationTransitionCount,
    RoutingAnalytics,
    FixedAuthorityItem,
    ResolutionAnalytics,
    OldestCaseItem,
    DeanAttentionItem,
    ExecutiveActivityFeedItem,
    RoutingHealthSummary,
    FilterOptionItem,
    ExecutiveFilterMetadata,
    ExecutiveLedgerRow,
    ExecutiveLedgerResponse,
    DeanDashboardDataResponse,
)

IST_TIMEZONE = timezone(timedelta(hours=5, minutes=30))


def format_duration(hours: float) -> str:
    """Format duration in hours to human-readable string (e.g. 13d 4h, 5h 20m)."""
    if hours <= 0:
        return "0h"
    total_minutes = int(round(hours * 60))
    if total_minutes < 60:
        return f"{total_minutes}m"
    days = total_minutes // 1440
    rem_hours = (total_minutes % 1440) // 60
    rem_mins = total_minutes % 60

    if days > 0:
        return f"{days}d {rem_hours}h"
    if rem_mins > 0:
        return f"{rem_hours}h {rem_mins}m"
    return f"{rem_hours}h"


def format_ist_datetime(dt: Optional[datetime]) -> str:
    """Format datetime in IST: 30 Sep 2026, 15:20."""
    if not dt:
        return "-"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_dt = dt.astimezone(IST_TIMEZONE)
    return ist_dt.strftime("%d %b %Y, %H:%M")


def format_ist_date(dt: Optional[datetime]) -> str:
    """Format date in IST: 30 Sep 2026."""
    if not dt:
        return "-"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    ist_dt = dt.astimezone(IST_TIMEZONE)
    return ist_dt.strftime("%d %b %Y")


class DeanDashboardService:
    """
    Institutional Executive Analytics & Command Center Engine.
    """

    @classmethod
    def _determine_current_level_and_authority(
        cls,
        grievance: Grievance,
        active_assignments_by_grv: Dict[uuid.UUID, Assignment],
        categories_map: Dict[uuid.UUID, Category],
    ) -> Tuple[str, Optional[NivaranAuthority], Optional[datetime]]:
        """
        Determines current operational stage, active authority, and stage start timestamp.
        Returns: (stage_key, authority, stage_start_time)
        Stages: 'APPLICANT', 'MANAGER', 'ASSISTANT_DEAN', 'ASSOCIATE_DEAN', 'FIXED_AUTHORITY', 'DEAN', 'RESOLVED'
        """
        if grievance.status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
            return "RESOLVED", grievance.assigned_authority, grievance.resolved_at or grievance.updated_at

        active_assign = active_assignments_by_grv.get(grievance.id)
        if active_assign and active_assign.authority:
            auth = active_assign.authority
            cat_id = grievance.final_category_id or grievance.category_id
            cat = categories_map.get(cat_id)

            if cat and cat.routing_type == CategoryRoutingType.FIXED_AUTHORITY and auth.role != NivaranRole.DEAN:
                return "FIXED_AUTHORITY", auth, active_assign.assigned_at
            if auth.role == NivaranRole.ASSISTANT_DEAN:
                return "ASSISTANT_DEAN", auth, active_assign.assigned_at
            elif auth.role == NivaranRole.ASSOCIATE_DEAN:
                return "ASSOCIATE_DEAN", auth, active_assign.assigned_at
            elif auth.role == NivaranRole.DEAN:
                return "DEAN", auth, active_assign.assigned_at
            elif auth.role == NivaranRole.MANAGER:
                return "MANAGER", auth, active_assign.assigned_at

        # If no active assignment record
        if grievance.status == GrievanceStatus.SUBMITTED:
            return "APPLICANT", None, grievance.created_at
        if grievance.status in {GrievanceStatus.AI_PROCESSING, GrievanceStatus.PENDING_REVIEW}:
            return "MANAGER", grievance.assigned_authority, grievance.created_at
        if grievance.status == GrievanceStatus.ESCALATED:
            return "DEAN", grievance.assigned_authority, grievance.updated_at or grievance.created_at

        return "MANAGER", grievance.assigned_authority, grievance.created_at

    @classmethod
    def _get_aging_bucket_key(cls, hours: float) -> str:
        if hours < 24:
            return "<24h"
        elif hours < 72:
            return "1-3d"
        elif hours < 168:
            return "4-7d"
        elif hours < 336:
            return "8-14d"
        elif hours < 720:
            return "15-30d"
        else:
            return "30+d"

    @classmethod
    def get_dashboard_data(
        cls,
        db: Session,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        current_level: Optional[str] = None,
        authority_id: Optional[uuid.UUID] = None,
        category_id: Optional[uuid.UUID] = None,
        grievance_cluster_id: Optional[uuid.UUID] = None,
        subject_cluster_id: Optional[uuid.UUID] = None,
        subject_id: Optional[uuid.UUID] = None,
        routing_type: Optional[str] = None,
        aging_bucket: Optional[str] = None,
    ) -> DeanDashboardDataResponse:
        now = datetime.now(timezone.utc)

        # 1. Fetch metadata & lookup maps
        all_categories = db.scalars(select(Category)).all()
        cat_map = {c.id: c for c in all_categories}

        all_subjects = db.scalars(select(Subject)).all()
        sub_map = {s.id: s for s in all_subjects}

        all_subject_clusters = db.scalars(select(SubjectCluster)).all()
        sub_cluster_map = {sc.id: sc for sc in all_subject_clusters}

        all_grievance_clusters = db.scalars(select(GrievanceCluster)).all()
        grv_cluster_map = {gc.id: gc for gc in all_grievance_clusters}

        all_authorities = db.scalars(select(NivaranAuthority).where(NivaranAuthority.is_active.is_(True))).all()
        auth_map = {a.id: a for a in all_authorities}

        # 2. Fetch all active assignments for mapping
        active_assignments = db.scalars(
            select(Assignment).options(selectinload(Assignment.authority)).where(Assignment.is_active.is_(True))
        ).all()
        active_assignments_by_grv: Dict[uuid.UUID, Assignment] = {
            a.grievance_id: a for a in active_assignments
        }

        # 3. Base grievances query
        grv_stmt = select(Grievance).options(
            selectinload(Grievance.subject),
            selectinload(Grievance.category),
            selectinload(Grievance.assigned_authority),
        )

        all_grievances = db.scalars(grv_stmt).all()

        # Build in-memory list with level and ages calculated
        annotated_grievances = []
        for g in all_grievances:
            cat = cat_map.get(g.final_category_id or g.category_id)
            sub = sub_map.get(g.subject_id)
            lvl, auth, stage_start = cls._determine_current_level_and_authority(
                g, active_assignments_by_grv, cat_map
            )

            # Total age
            g_created = g.created_at if g.created_at.tzinfo else g.created_at.replace(tzinfo=timezone.utc)
            total_age_hours = max(0.0, (now - g_created).total_seconds() / 3600.0)

            # Stage age
            st_start = stage_start if (stage_start and stage_start.tzinfo) else ((stage_start.replace(tzinfo=timezone.utc)) if stage_start else g_created)
            stage_age_hours = max(0.0, (now - st_start).total_seconds() / 3600.0)

            bucket_key = cls._get_aging_bucket_key(total_age_hours)

            annotated_grievances.append({
                "grievance": g,
                "current_level": lvl,
                "active_authority": auth,
                "category": cat,
                "subject": sub,
                "total_age_hours": total_age_hours,
                "stage_age_hours": stage_age_hours,
                "aging_bucket": bucket_key,
                "created_at": g_created,
            })

        # 4. Apply Filters
        filtered = []
        for item in annotated_grievances:
            g = item["grievance"]
            if start_date and item["created_at"] < start_date:
                continue
            if end_date and item["created_at"] > end_date:
                continue
            if status and g.status.value != status:
                continue
            if priority and g.priority.value != priority:
                continue
            if current_level and item["current_level"] != current_level:
                continue
            if authority_id:
                auth = item["active_authority"]
                if not auth or auth.id != authority_id:
                    continue
            if category_id:
                c_id = g.final_category_id or g.category_id
                if c_id != category_id:
                    continue
            if grievance_cluster_id:
                cat = item["category"]
                if not cat or cat.grievance_cluster_id != grievance_cluster_id:
                    continue
            if subject_cluster_id:
                sub = item["subject"]
                if not sub or sub.subject_cluster_id != subject_cluster_id:
                    continue
            if subject_id and g.subject_id != subject_id:
                continue
            if routing_type:
                cat = item["category"]
                if not cat or cat.routing_type.value != routing_type:
                    continue
            if aging_bucket and item["aging_bucket"] != aging_bucket:
                continue

            filtered.append(item)

        # 5. Calculate Executive KPIs
        total_cases = len(filtered)
        active_statuses = {
            GrievanceStatus.SUBMITTED,
            GrievanceStatus.AI_PROCESSING,
            GrievanceStatus.PENDING_REVIEW,
            GrievanceStatus.ASSIGNED,
            GrievanceStatus.IN_PROGRESS,
            GrievanceStatus.AWAITING_INFORMATION,
            GrievanceStatus.ESCALATED,
            GrievanceStatus.REOPENED,
        }

        active_cases = sum(1 for item in filtered if item["grievance"].status in active_statuses)
        pending_cases = sum(
            1 for item in filtered if item["grievance"].status in {
                GrievanceStatus.SUBMITTED,
                GrievanceStatus.AI_PROCESSING,
                GrievanceStatus.PENDING_REVIEW,
                GrievanceStatus.ASSIGNED,
                GrievanceStatus.ESCALATED,
                GrievanceStatus.REOPENED,
            }
        )
        in_progress_cases = sum(1 for item in filtered if item["grievance"].status == GrievanceStatus.IN_PROGRESS)
        resolved_cases = sum(1 for item in filtered if item["grievance"].status == GrievanceStatus.RESOLVED)
        closed_cases = sum(1 for item in filtered if item["grievance"].status == GrievanceStatus.CLOSED)
        escalated_cases = sum(1 for item in filtered if item["grievance"].status == GrievanceStatus.ESCALATED)
        awaiting_info_cases = sum(1 for item in filtered if item["grievance"].status == GrievanceStatus.AWAITING_INFORMATION)
        critical_urgent_cases = sum(
            1 for item in filtered if item["grievance"].priority in {GrievancePriority.CRITICAL, GrievancePriority.HIGH}
        )
        reopened_cases = sum(1 for item in filtered if item["grievance"].reopen_count > 0 or item["grievance"].status == GrievanceStatus.REOPENED)

        total_done = resolved_cases + closed_cases
        resolution_rate = round((total_done / total_cases * 100), 1) if total_cases > 0 else 0.0

        resolution_hours_list = []
        for item in filtered:
            g = item["grievance"]
            if g.resolved_at and g.created_at:
                r_at = g.resolved_at if g.resolved_at.tzinfo else g.resolved_at.replace(tzinfo=timezone.utc)
                diff_h = max(0.0, (r_at - item["created_at"]).total_seconds() / 3600.0)
                resolution_hours_list.append(diff_h)

        avg_res_h = sum(resolution_hours_list) / len(resolution_hours_list) if resolution_hours_list else 0.0

        ai_eval_items = [item for item in filtered if item["grievance"].category_reviewed or item["grievance"].category_overridden]
        ai_correct = sum(1 for item in ai_eval_items if not item["grievance"].category_overridden)
        ai_accuracy = round((ai_correct / len(ai_eval_items) * 100), 1) if ai_eval_items else 0.0

        kpis = DeanExecutiveKPIs(
            total_cases=total_cases,
            active_cases=active_cases,
            pending_cases=pending_cases,
            in_progress_cases=in_progress_cases,
            resolved_cases=resolved_cases,
            closed_cases=closed_cases,
            escalated_cases=escalated_cases,
            awaiting_info_cases=awaiting_info_cases,
            critical_urgent_cases=critical_urgent_cases,
            reopened_cases=reopened_cases,
            resolution_rate=resolution_rate,
            avg_resolution_time_hours=round(avg_res_h, 1),
            avg_resolution_time_display=format_duration(avg_res_h),
            ai_prediction_accuracy=ai_accuracy,
        )

        # 6. Workflow Pipeline / Funnel
        stages_def = [
            ("APPLICANT", "Applicant Intake", 1),
            ("MANAGER", "Central Manager Triage", 2),
            ("ASSISTANT_DEAN", "Assistant Dean Redressal", 3),
            ("ASSOCIATE_DEAN", "Associate Dean Review", 4),
            ("FIXED_AUTHORITY", "Fixed Authority Redressal", 5),
            ("DEAN", "Dean Executive Decision", 6),
            ("RESOLVED", "Resolved & Closed", 7),
        ]
        workflow_pipeline = []
        for key, name, order in stages_def:
            st_items = [it for it in filtered if it["current_level"] == key]
            st_count = len(st_items)
            pct = round((st_count / active_cases * 100), 1) if active_cases > 0 and key != "RESOLVED" else (
                round((st_count / total_cases * 100), 1) if total_cases > 0 else 0.0
            )
            dwells = [it["stage_age_hours"] for it in st_items]
            avg_dwell = sum(dwells) / len(dwells) if dwells else 0.0

            workflow_pipeline.append(
                WorkflowPipelineStage(
                    stage_key=key,
                    stage_name=name,
                    order=order,
                    current_count=st_count,
                    percentage_of_active=pct,
                    avg_dwell_hours=round(avg_dwell, 1),
                    avg_dwell_display=format_duration(avg_dwell),
                )
            )

        # 7. Bottlenecks ("Where are cases stuck?")
        levels_to_analyze = [
            ("MANAGER", "Central Manager"),
            ("ASSISTANT_DEAN", "Assistant Deans"),
            ("ASSOCIATE_DEAN", "Associate Deans"),
            ("FIXED_AUTHORITY", "Fixed Authorities"),
            ("DEAN", "Dean R&D"),
        ]
        bottlenecks = []
        for lvl_key, lvl_label in levels_to_analyze:
            pending_lvl_items = [
                it for it in filtered
                if it["current_level"] == lvl_key and it["grievance"].status in active_statuses
            ]
            tot_pend = len(pending_lvl_items)
            if tot_pend == 0:
                bottlenecks.append(
                    BottleneckLevelItem(
                        level=lvl_key,
                        level_label=lvl_label,
                        total_pending=0,
                        oldest_case_tracking_id=None,
                        oldest_case_age_hours=0.0,
                        oldest_case_age_display="-",
                        avg_stage_age_hours=0.0,
                        avg_stage_age_display="-",
                        median_stage_age_hours=0.0,
                        median_stage_age_display="-",
                        max_stage_age_hours=0.0,
                        max_stage_age_display="-",
                    )
                )
                continue

            # Sort by stage age descending
            pending_lvl_items.sort(key=lambda x: x["stage_age_hours"], reverse=True)
            oldest = pending_lvl_items[0]
            stage_ages = [it["stage_age_hours"] for it in pending_lvl_items]
            avg_age = sum(stage_ages) / len(stage_ages)
            max_age = max(stage_ages)
            # median
            sorted_ages = sorted(stage_ages)
            mid = len(sorted_ages) // 2
            median_age = (
                (sorted_ages[mid] + sorted_ages[mid - 1]) / 2.0
                if len(sorted_ages) % 2 == 0
                else sorted_ages[mid]
            )

            bottlenecks.append(
                BottleneckLevelItem(
                    level=lvl_key,
                    level_label=lvl_label,
                    total_pending=tot_pend,
                    oldest_case_tracking_id=oldest["grievance"].grievance_id,
                    oldest_case_age_hours=round(oldest["stage_age_hours"], 1),
                    oldest_case_age_display=format_duration(oldest["stage_age_hours"]),
                    avg_stage_age_hours=round(avg_age, 1),
                    avg_stage_age_display=format_duration(avg_age),
                    median_stage_age_hours=round(median_age, 1),
                    median_stage_age_display=format_duration(median_age),
                    max_stage_age_hours=round(max_age, 1),
                    max_stage_age_display=format_duration(max_age),
                )
            )

        # 8. Aging Distribution
        buckets_def = [
            ("<24h", "< 24 Hours"),
            ("1-3d", "1–3 Days"),
            ("4-7d", "4–7 Days"),
            ("8-14d", "8–14 Days"),
            ("15-30d", "15–30 Days"),
            ("30+d", "30+ Days"),
        ]
        aging_distribution = []
        for b_key, b_label in buckets_def:
            b_items = [
                it for it in filtered
                if it["aging_bucket"] == b_key and it["grievance"].status in active_statuses
            ]
            b_cnt = len(b_items)
            pct = round((b_cnt / active_cases * 100), 1) if active_cases > 0 else 0.0

            by_lvl: Dict[str, int] = {}
            for it in b_items:
                lvl = it["current_level"]
                by_lvl[lvl] = by_lvl.get(lvl, 0) + 1

            aging_distribution.append(
                AgingBucketItem(
                    bucket_key=b_key,
                    label=b_label,
                    count=b_cnt,
                    percentage=pct,
                    by_level=by_lvl,
                )
            )

        # 9. Authority Workloads
        auth_workloads = []
        for auth in all_authorities:
            auth_assigned_items = [
                it for it in filtered
                if it["active_authority"] and it["active_authority"].id == auth.id
            ]
            assigned_cnt = len(auth_assigned_items)
            pending_cnt = sum(
                1 for it in auth_assigned_items
                if it["grievance"].status in {
                    GrievanceStatus.ASSIGNED,
                    GrievanceStatus.PENDING_REVIEW,
                    GrievanceStatus.ESCALATED,
                    GrievanceStatus.REOPENED,
                }
            )
            in_prog_cnt = sum(
                1 for it in auth_assigned_items
                if it["grievance"].status == GrievanceStatus.IN_PROGRESS
            )
            awaiting_cnt = sum(
                1 for it in auth_assigned_items
                if it["grievance"].status == GrievanceStatus.AWAITING_INFORMATION
            )
            resolved_cnt = sum(
                1 for it in filtered
                if (it["grievance"].resolved_by_authority_id == auth.id or
                    (it["active_authority"] and it["active_authority"].id == auth.id and
                     it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}))
            )
            escalated_cnt = sum(
                1 for it in auth_assigned_items
                if it["grievance"].status == GrievanceStatus.ESCALATED
            )

            # Age statistics for active cases
            active_auth_items = [
                it for it in auth_assigned_items
                if it["grievance"].status in active_statuses
            ]
            oldest_id = None
            oldest_age = 0.0
            avg_case_age = 0.0
            median_case_age = 0.0

            if active_auth_items:
                active_auth_items.sort(key=lambda x: x["stage_age_hours"], reverse=True)
                oldest_id = active_auth_items[0]["grievance"].grievance_id
                oldest_age = active_auth_items[0]["stage_age_hours"]
                ages = [it["stage_age_hours"] for it in active_auth_items]
                avg_case_age = sum(ages) / len(ages)
                sorted_ages = sorted(ages)
                mid = len(sorted_ages) // 2
                median_case_age = (
                    (sorted_ages[mid] + sorted_ages[mid - 1]) / 2.0
                    if len(sorted_ages) % 2 == 0
                    else sorted_ages[mid]
                )

            # Cluster / Dept string
            dept_or_cluster = auth.department or "Research & Development"
            # check subject cluster
            for sc in all_subject_clusters:
                if sc.assistant_dean_id == auth.id:
                    dept_or_cluster = f"Cluster: {sc.name}"
                    break
            for gc in all_grievance_clusters:
                if gc.associate_dean_id == auth.id:
                    dept_or_cluster = f"Cluster: {gc.name}"
                    break

            auth_workloads.append(
                AuthorityWorkloadItem(
                    authority_id=auth.id,
                    name=auth.name_snapshot,
                    role=auth.role.value,
                    designation=auth.designation,
                    department_or_cluster=dept_or_cluster,
                    assigned_count=assigned_cnt,
                    pending_count=pending_cnt,
                    in_progress_count=in_prog_cnt,
                    awaiting_info_count=awaiting_cnt,
                    resolved_count=resolved_cnt,
                    escalated_count=escalated_cnt,
                    oldest_case_tracking_id=oldest_id,
                    oldest_case_age_hours=round(oldest_age, 1),
                    oldest_case_age_display=format_duration(oldest_age) if oldest_id else "-",
                    avg_case_age_hours=round(avg_case_age, 1),
                    avg_case_age_display=format_duration(avg_case_age) if active_auth_items else "-",
                    median_case_age_hours=round(median_case_age, 1),
                    median_case_age_display=format_duration(median_case_age) if active_auth_items else "-",
                )
            )

        auth_workloads.sort(key=lambda x: (x.pending_count, x.assigned_count), reverse=True)

        # 10. Assistant Dean Panel
        asst_dean_panel = []
        for sc in all_subject_clusters:
            if not sc.assistant_dean_id:
                continue
            auth = auth_map.get(sc.assistant_dean_id)
            if not auth:
                continue

            cases_for_asst = [
                it for it in filtered
                if it["active_authority"] and it["active_authority"].id == auth.id
            ]
            active_c = [it for it in cases_for_asst if it["grievance"].status in active_statuses]
            pend_c = [
                it for it in cases_for_asst
                if it["grievance"].status in {GrievanceStatus.ASSIGNED, GrievanceStatus.PENDING_REVIEW}
            ]
            inp_c = [it for it in cases_for_asst if it["grievance"].status == GrievanceStatus.IN_PROGRESS]
            await_c = [it for it in cases_for_asst if it["grievance"].status == GrievanceStatus.AWAITING_INFORMATION]
            res_c = [
                it for it in filtered
                if it["grievance"].resolved_by_authority_id == auth.id
                or (it["active_authority"] and it["active_authority"].id == auth.id and it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED})
            ]

            oldest_tracking = None
            oldest_disp = "-"
            avg_pend_disp = "-"
            if pend_c:
                pend_c.sort(key=lambda x: x["stage_age_hours"], reverse=True)
                oldest_tracking = pend_c[0]["grievance"].grievance_id
                oldest_disp = format_duration(pend_c[0]["stage_age_hours"])
                avg_h = sum(it["stage_age_hours"] for it in pend_c) / len(pend_c)
                avg_pend_disp = format_duration(avg_h)

            asst_dean_panel.append(
                AssistantDeanWorkloadItem(
                    authority_id=auth.id,
                    name=auth.name_snapshot,
                    subject_cluster_name=sc.name,
                    active_cases=len(active_c),
                    pending=len(pend_c),
                    in_progress=len(inp_c),
                    awaiting_information=len(await_c),
                    resolved=len(res_c),
                    oldest_case_tracking_id=oldest_tracking,
                    oldest_case_display=oldest_disp,
                    avg_pending_age_display=avg_pend_disp,
                )
            )

        # 11. Associate Dean Panel
        assoc_dean_panel = []
        for gc in all_grievance_clusters:
            if not gc.associate_dean_id:
                continue
            auth = auth_map.get(gc.associate_dean_id)
            if not auth:
                continue

            cases_for_assoc = [
                it for it in filtered
                if it["active_authority"] and it["active_authority"].id == auth.id
            ]
            active_c = [it for it in cases_for_assoc if it["grievance"].status in active_statuses]
            pend_c = [
                it for it in cases_for_assoc
                if it["grievance"].status in {GrievanceStatus.ASSIGNED, GrievanceStatus.PENDING_REVIEW}
            ]
            inp_c = [it for it in cases_for_assoc if it["grievance"].status == GrievanceStatus.IN_PROGRESS]
            await_c = [it for it in cases_for_assoc if it["grievance"].status == GrievanceStatus.AWAITING_INFORMATION]
            res_c = [
                it for it in filtered
                if it["grievance"].resolved_by_authority_id == auth.id
                or (it["active_authority"] and it["active_authority"].id == auth.id and it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED})
            ]
            esc_to_dean = sum(
                1 for it in cases_for_assoc
                if it["grievance"].status == GrievanceStatus.ESCALATED
            )

            oldest_tracking = None
            oldest_disp = "-"
            avg_disp = "-"
            if active_c:
                active_c.sort(key=lambda x: x["stage_age_hours"], reverse=True)
                oldest_tracking = active_c[0]["grievance"].grievance_id
                oldest_disp = format_duration(active_c[0]["stage_age_hours"])
                avg_h = sum(it["stage_age_hours"] for it in active_c) / len(active_c)
                avg_disp = format_duration(avg_h)

            assoc_dean_panel.append(
                AssociateDeanWorkloadItem(
                    authority_id=auth.id,
                    name=auth.name_snapshot,
                    grievance_cluster_name=gc.name,
                    active_cases=len(active_c),
                    pending=len(pend_c),
                    in_progress=len(inp_c),
                    awaiting_information=len(await_c),
                    resolved=len(res_c),
                    escalated_to_dean=esc_to_dean,
                    oldest_case_tracking_id=oldest_tracking,
                    oldest_case_display=oldest_disp,
                    avg_age_display=avg_disp,
                )
            )

        # 12. Manager Triage Panel
        mgr_items = [
            it for it in filtered
            if it["current_level"] == "MANAGER" and it["grievance"].status in active_statuses
        ]
        awaiting_ai = sum(
            1 for it in filtered
            if it["grievance"].status == GrievanceStatus.AI_PROCESSING
            or (it["grievance"].status == GrievanceStatus.SUBMITTED and not it["grievance"].category_reviewed)
        )
        awaiting_ratify = sum(
            1 for it in filtered
            if it["grievance"].status == GrievanceStatus.PENDING_REVIEW
        )
        overridden = sum(1 for it in filtered if it["grievance"].category_overridden)
        ratified = sum(1 for it in filtered if it["grievance"].category_reviewed and not it["grievance"].category_overridden)
        assigned_to_asst = sum(
            1 for it in filtered
            if it["current_level"] == "ASSISTANT_DEAN"
        )
        oldest_mgr = None
        avg_mgr_disp = "-"
        if mgr_items:
            mgr_items.sort(key=lambda x: x["stage_age_hours"], reverse=True)
            oldest_mgr = mgr_items[0]["grievance"].grievance_id
            avg_m_h = sum(it["stage_age_hours"] for it in mgr_items) / len(mgr_items)
            avg_mgr_disp = format_duration(avg_m_h)

        recent_overrides_list = []
        for it in [it for it in filtered if it["grievance"].category_overridden][:10]:
            g = it["grievance"]
            orig_cat = cat_map.get(g.ai_suggested_category_id or g.category_id)
            final_cat = cat_map.get(g.final_category_id or g.category_id)
            recent_overrides_list.append(
                RecentCategoryOverrideItem(
                    grievance_id=g.grievance_id,
                    title=g.title,
                    ai_predicted_category=orig_cat.name if orig_cat else "AI Suggested",
                    manager_final_category=final_cat.name if final_cat else "Manager Assigned",
                    confidence_score=float(g.ai_confidence) if g.ai_confidence is not None else None,
                    reviewed_at=g.updated_at,
                )
            )

        manager_triage = ManagerTriagePanel(
            awaiting_ai_review=awaiting_ai,
            awaiting_category_ratification=awaiting_ratify,
            category_overridden=overridden,
            category_ratified=ratified,
            assigned_to_assistant_dean=assigned_to_asst,
            unresolved_manager_queue=len(mgr_items),
            oldest_pending_manager_case=oldest_mgr,
            avg_manager_age_display=avg_mgr_disp,
            ai_accuracy_percentage=ai_accuracy,
            ai_predictions_total=len(ai_eval_items),
            recent_overrides=recent_overrides_list,
        )

        # 13. Category Analytics
        category_analytics = []
        for cat in all_categories:
            c_items = [
                it for it in filtered
                if (it["grievance"].final_category_id == cat.id or it["grievance"].category_id == cat.id)
            ]
            c_tot = len(c_items)
            c_act = sum(1 for it in c_items if it["grievance"].status in active_statuses)
            c_res = sum(1 for it in c_items if it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED})
            c_pend = sum(
                1 for it in c_items
                if it["grievance"].status in {
                    GrievanceStatus.SUBMITTED,
                    GrievanceStatus.AI_PROCESSING,
                    GrievanceStatus.PENDING_REVIEW,
                    GrievanceStatus.ASSIGNED,
                    GrievanceStatus.ESCALATED,
                }
            )
            pct = round((c_tot / total_cases * 100), 1) if total_cases > 0 else 0.0
            ages = [it["total_age_hours"] for it in c_items if it["grievance"].status in active_statuses]
            avg_cat_age = sum(ages) / len(ages) if ages else 0.0

            category_analytics.append(
                CategoryAnalyticsItem(
                    category_id=cat.id,
                    category_name=cat.name,
                    routing_type=cat.routing_type.value,
                    total_count=c_tot,
                    active_count=c_act,
                    resolved_count=c_res,
                    pending_count=c_pend,
                    percentage=pct,
                    avg_age_hours=round(avg_cat_age, 1),
                    avg_age_display=format_duration(avg_cat_age),
                )
            )

        category_analytics.sort(key=lambda x: x.total_count, reverse=True)

        # 14. Grievance Cluster Analytics
        grv_cluster_analytics = []
        for gc in all_grievance_clusters:
            assoc_auth = auth_map.get(gc.associate_dean_id) if gc.associate_dean_id else None
            gc_categories = [c.id for c in all_categories if c.grievance_cluster_id == gc.id]

            gc_items = [
                it for it in filtered
                if (it["grievance"].final_category_id in gc_categories or it["grievance"].category_id in gc_categories)
            ]
            gc_tot = len(gc_items)
            gc_act = sum(1 for it in gc_items if it["grievance"].status in active_statuses)
            gc_pend = sum(
                1 for it in gc_items
                if it["grievance"].status in {
                    GrievanceStatus.SUBMITTED,
                    GrievanceStatus.AI_PROCESSING,
                    GrievanceStatus.PENDING_REVIEW,
                    GrievanceStatus.ASSIGNED,
                    GrievanceStatus.ESCALATED,
                }
            )
            gc_res = sum(1 for it in gc_items if it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED})

            oldest_disp = "-"
            avg_disp = "-"
            active_gc = [it for it in gc_items if it["grievance"].status in active_statuses]
            if active_gc:
                active_gc.sort(key=lambda x: x["total_age_hours"], reverse=True)
                oldest_disp = format_duration(active_gc[0]["total_age_hours"])
                avg_h = sum(it["total_age_hours"] for it in active_gc) / len(active_gc)
                avg_disp = format_duration(avg_h)

            grv_cluster_analytics.append(
                GrievanceClusterAnalyticsItem(
                    cluster_id=gc.id,
                    cluster_number=gc.cluster_number,
                    cluster_name=gc.name,
                    assigned_associate_dean_name=assoc_auth.name_snapshot if assoc_auth else "Unassigned",
                    active_count=gc_act,
                    pending_count=gc_pend,
                    resolved_count=gc_res,
                    oldest_case_display=oldest_disp,
                    avg_age_display=avg_disp,
                )
            )

        grv_cluster_analytics.sort(key=lambda x: x.cluster_number)

        # 15. Subject Cluster & Subject Analytics
        sub_cluster_analytics = []
        for sc in all_subject_clusters:
            asst_auth = auth_map.get(sc.assistant_dean_id) if sc.assistant_dean_id else None
            sc_subjects = [s for s in all_subjects if s.subject_cluster_id == sc.id]

            sc_items = [
                it for it in filtered
                if it["subject"] and it["subject"].subject_cluster_id == sc.id
            ]
            sc_act = sum(1 for it in sc_items if it["grievance"].status in active_statuses)
            sc_pend = sum(
                1 for it in sc_items
                if it["grievance"].status in {
                    GrievanceStatus.SUBMITTED,
                    GrievanceStatus.AI_PROCESSING,
                    GrievanceStatus.PENDING_REVIEW,
                    GrievanceStatus.ASSIGNED,
                    GrievanceStatus.ESCALATED,
                }
            )
            sc_res = sum(1 for it in sc_items if it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED})

            sub_items_list = []
            for s in sc_subjects:
                s_grvs = [it for it in sc_items if it["grievance"].subject_id == s.id]
                s_act = sum(1 for it in s_grvs if it["grievance"].status in active_statuses)
                s_pend = sum(
                    1 for it in s_grvs
                    if it["grievance"].status in {
                        GrievanceStatus.SUBMITTED,
                        GrievanceStatus.AI_PROCESSING,
                        GrievanceStatus.PENDING_REVIEW,
                        GrievanceStatus.ASSIGNED,
                        GrievanceStatus.ESCALATED,
                    }
                )
                s_res = sum(1 for it in s_grvs if it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED})
                active_s_grvs = [it for it in s_grvs if it["grievance"].status in active_statuses]
                avg_s_disp = "-"
                if active_s_grvs:
                    avg_s_h = sum(it["total_age_hours"] for it in active_s_grvs) / len(active_s_grvs)
                    avg_s_disp = format_duration(avg_s_h)

                sub_items_list.append(
                    SubjectAnalyticsItem(
                        subject_id=s.id,
                        subject_name=s.name,
                        subject_code=s.code,
                        cluster_name=sc.name,
                        active_count=s_act,
                        pending_count=s_pend,
                        resolved_count=s_res,
                        avg_age_display=avg_s_disp,
                        assigned_assistant_dean_name=asst_auth.name_snapshot if asst_auth else "Unassigned",
                    )
                )

            sub_items_list.sort(key=lambda x: (x.active_count, x.pending_count), reverse=True)

            sub_cluster_analytics.append(
                SubjectClusterAnalyticsItem(
                    cluster_id=sc.id,
                    cluster_number=sc.cluster_number,
                    cluster_name=sc.name,
                    assigned_assistant_dean_name=asst_auth.name_snapshot if asst_auth else "Unassigned",
                    active_count=sc_act,
                    pending_count=sc_pend,
                    resolved_count=sc_res,
                    subjects=sub_items_list,
                )
            )

        sub_cluster_analytics.sort(key=lambda x: x.cluster_number)

        # 16. Priority Analysis
        priority_counts: Dict[str, int] = {p.value: 0 for p in GrievancePriority}
        priority_by_level: Dict[str, Dict[str, int]] = {p.value: {} for p in GrievancePriority}

        for it in filtered:
            p_val = it["grievance"].priority.value
            priority_counts[p_val] = priority_counts.get(p_val, 0) + 1
            if it["grievance"].status in active_statuses:
                lvl = it["current_level"]
                priority_by_level[p_val][lvl] = priority_by_level[p_val].get(lvl, 0) + 1

        priority_analysis = PriorityLevelDistribution(
            counts=priority_counts,
            by_authority_level=priority_by_level,
        )

        # 17. Time Trend (Last 14 / 30 days)
        trend_days = 14
        start_trend_dt = now - timedelta(days=trend_days)
        time_trends_map: Dict[str, Dict[str, Any]] = {}
        for d in range(trend_days + 1):
            day_dt = start_trend_dt + timedelta(days=d)
            day_str = day_dt.strftime("%d %b")
            date_key = day_dt.strftime("%Y-%m-%d")
            time_trends_map[date_key] = {
                "period": day_str,
                "date": date_key,
                "submitted": 0,
                "resolved": 0,
                "escalated": 0,
            }

        for it in filtered:
            g = it["grievance"]
            c_key = it["created_at"].strftime("%Y-%m-%d")
            if c_key in time_trends_map:
                time_trends_map[c_key]["submitted"] += 1

            if g.resolved_at:
                r_dt = g.resolved_at if g.resolved_at.tzinfo else g.resolved_at.replace(tzinfo=timezone.utc)
                r_key = r_dt.strftime("%Y-%m-%d")
                if r_key in time_trends_map:
                    time_trends_map[r_key]["resolved"] += 1

            if g.status == GrievanceStatus.ESCALATED and g.updated_at:
                u_dt = g.updated_at if g.updated_at.tzinfo else g.updated_at.replace(tzinfo=timezone.utc)
                u_key = u_dt.strftime("%Y-%m-%d")
                if u_key in time_trends_map:
                    time_trends_map[u_key]["escalated"] += 1

        # Calculate cumulative active backlog across points
        cum_backlog = 0
        time_trend_points = []
        for d_key in sorted(time_trends_map.keys()):
            data = time_trends_map[d_key]
            cum_backlog += (data["submitted"] - data["resolved"])
            cum_backlog = max(0, cum_backlog)
            time_trend_points.append(
                TimeTrendPoint(
                    period=data["period"],
                    date=data["date"],
                    submitted_count=data["submitted"],
                    resolved_count=data["resolved"],
                    escalated_count=data["escalated"],
                    active_backlog=cum_backlog,
                )
            )

        # 18. Routing Analytics & Transitions
        routing_type_counts: Dict[str, Dict[str, int]] = {}
        for it in filtered:
            cat = it["category"]
            r_type = cat.routing_type.value if cat else "UNKNOWN"
            if r_type not in routing_type_counts:
                routing_type_counts[r_type] = {"total": 0, "active": 0, "resolved": 0}
            routing_type_counts[r_type]["total"] += 1
            if it["grievance"].status in active_statuses:
                routing_type_counts[r_type]["active"] += 1
            elif it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
                routing_type_counts[r_type]["resolved"] += 1

        routing_dist_items = []
        for rt, cnts in routing_type_counts.items():
            pct = round((cnts["total"] / total_cases * 100), 1) if total_cases > 0 else 0.0
            routing_dist_items.append(
                RoutingTypeDistribution(
                    routing_type=rt,
                    count=cnts["total"],
                    percentage=pct,
                    active_count=cnts["active"],
                    resolved_count=cnts["resolved"],
                )
            )

        # Count escalation transitions from ForwardingConfirmation
        confirmations = db.scalars(select(ForwardingConfirmation)).all()
        asst_to_assoc = 0
        asst_to_fixed = 0
        assoc_to_dean = 0
        for fc in confirmations:
            f_by = auth_map.get(fc.forwarded_by_authority_id)
            f_to = auth_map.get(fc.forwarded_to_authority_id)
            if not f_by or not f_to:
                continue
            if f_by.role == NivaranRole.ASSISTANT_DEAN and f_to.role == NivaranRole.ASSOCIATE_DEAN:
                asst_to_assoc += 1
            elif f_by.role == NivaranRole.ASSISTANT_DEAN and f_to.role != NivaranRole.ASSOCIATE_DEAN:
                asst_to_fixed += 1
            elif f_by.role == NivaranRole.ASSOCIATE_DEAN and f_to.role == NivaranRole.DEAN:
                assoc_to_dean += 1

        routing_analytics = RoutingAnalytics(
            by_routing_type=routing_dist_items,
            transitions=[
                EscalationTransitionCount(transition_name="Assistant Dean → Associate Dean", count=asst_to_assoc),
                EscalationTransitionCount(transition_name="Assistant Dean → Fixed Authority", count=asst_to_fixed),
                EscalationTransitionCount(transition_name="Associate Dean → Dean R&D", count=assoc_to_dean),
            ],
        )

        # 19. Fixed Authority Analytics
        fixed_authorities = []
        fixed_categories = [c for c in all_categories if c.routing_type == CategoryRoutingType.FIXED_AUTHORITY]
        for f_cat in fixed_categories:
            f_auth = auth_map.get(f_cat.fixed_authority_id) if f_cat.fixed_authority_id else None
            f_items = [
                it for it in filtered
                if (it["grievance"].final_category_id == f_cat.id or it["grievance"].category_id == f_cat.id)
            ]
            f_act = sum(1 for it in f_items if it["grievance"].status in active_statuses)
            f_pend = sum(
                1 for it in f_items
                if it["grievance"].status in {
                    GrievanceStatus.SUBMITTED,
                    GrievanceStatus.AI_PROCESSING,
                    GrievanceStatus.PENDING_REVIEW,
                    GrievanceStatus.ASSIGNED,
                    GrievanceStatus.ESCALATED,
                }
            )
            f_res = sum(1 for it in f_items if it["grievance"].status in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED})

            oldest_disp = "-"
            avg_disp = "-"
            active_f = [it for it in f_items if it["grievance"].status in active_statuses]
            if active_f:
                active_f.sort(key=lambda x: x["stage_age_hours"], reverse=True)
                oldest_disp = format_duration(active_f[0]["stage_age_hours"])
                avg_h = sum(it["stage_age_hours"] for it in active_f) / len(active_f)
                avg_disp = format_duration(avg_h)

            fixed_authorities.append(
                FixedAuthorityItem(
                    category_id=f_cat.id,
                    category_name=f_cat.name,
                    authority_id=f_auth.id if f_auth else uuid.uuid4(),
                    authority_name=f_auth.name_snapshot if f_auth else "Unassigned",
                    authority_role=f_auth.role.value if f_auth else "-",
                    active_cases=f_act,
                    pending_cases=f_pend,
                    resolved_cases=f_res,
                    oldest_case_display=oldest_disp,
                    avg_age_display=avg_disp,
                )
            )

        # 20. Resolution Analytics Breakdown
        res_by_lvl: Dict[str, int] = {}
        res_by_cat: Dict[str, int] = {}
        res_by_clus: Dict[str, int] = {}

        for it in filtered:
            g = it["grievance"]
            if g.status not in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}:
                continue
            r_auth = auth_map.get(g.resolved_by_authority_id) or it["active_authority"]
            lvl_name = r_auth.role.value if r_auth else "AUTHORITY"
            res_by_lvl[lvl_name] = res_by_lvl.get(lvl_name, 0) + 1

            cat_name = it["category"].name if it["category"] else "General"
            res_by_cat[cat_name] = res_by_cat.get(cat_name, 0) + 1

            if it["category"] and it["category"].grievance_cluster_id:
                gc = grv_cluster_map.get(it["category"].grievance_cluster_id)
                if gc:
                    res_by_clus[gc.name] = res_by_clus.get(gc.name, 0) + 1

        resolution_analytics = ResolutionAnalytics(
            total_resolved=total_done,
            resolution_rate=resolution_rate,
            avg_lifecycle_hours=round(avg_res_h, 1),
            avg_lifecycle_display=format_duration(avg_res_h),
            resolutions_by_authority_level=res_by_lvl,
            resolutions_by_category=res_by_cat,
            resolutions_by_cluster=res_by_clus,
        )

        # 21. Oldest Cases List (Top 15 oldest active cases)
        active_filtered = [it for it in filtered if it["grievance"].status in active_statuses]
        active_filtered.sort(key=lambda x: x["total_age_hours"], reverse=True)

        oldest_cases = []
        for it in active_filtered[:15]:
            g = it["grievance"]
            auth = it["active_authority"]
            cat = it["category"]
            sub = it["subject"]

            # Lookup last action from status history
            last_hist = db.scalars(
                select(GrievanceStatusHistory)
                .where(GrievanceStatusHistory.grievance_id == g.id)
                .order_by(GrievanceStatusHistory.created_at.desc())
                .limit(1)
            ).first()

            last_action_text = (
                last_hist.remarks or f"Transition to {last_hist.to_status}"
                if last_hist
                else f"Created as {g.status.value}"
            )
            last_action_ts = last_hist.created_at if last_hist else g.created_at

            oldest_cases.append(
                OldestCaseItem(
                    id=g.id,
                    tracking_id=g.grievance_id,
                    title=g.title,
                    submitted_at=it["created_at"],
                    submitted_display=format_ist_datetime(it["created_at"]),
                    total_age_hours=round(it["total_age_hours"], 1),
                    total_age_display=format_duration(it["total_age_hours"]),
                    current_stage_age_hours=round(it["stage_age_hours"], 1),
                    current_stage_age_display=format_duration(it["stage_age_hours"]),
                    current_authority_name=auth.name_snapshot if auth else "Unassigned",
                    current_authority_role=auth.role.value if auth else "-",
                    current_level=it["current_level"],
                    category_name=cat.name if cat else "General",
                    subject_name=sub.name if sub else "General",
                    priority=g.priority.value,
                    status=g.status.value,
                    last_action=last_action_text,
                    last_action_timestamp=last_action_ts,
                    last_action_display=format_ist_datetime(last_action_ts),
                )
            )

        # 22. Attention Items (Objective operational conditions)
        attention_items = []
        for it in active_filtered:
            g = it["grievance"]
            auth = it["active_authority"]
            aging_d = int(it["total_age_hours"] // 24)
            cat = it["category"]
            sub = it["subject"]

            urgency_reason = None
            if g.reopen_count > 0 or g.status == GrievanceStatus.REOPENED:
                urgency_reason = "Scholar Reopened — Dean Executive Determination Required"
            elif g.status == GrievanceStatus.ESCALATED or it["current_level"] == "DEAN":
                urgency_reason = "Escalated for Institutional Executive Ruling"
            elif g.priority in {GrievancePriority.CRITICAL, GrievancePriority.HIGH} and aging_d >= 3:
                urgency_reason = f"High/Critical priority unresolved for {aging_d} days"
            elif aging_d >= 7:
                urgency_reason = f"Institutional aging threshold exceeded ({aging_d} days pending)"

            if urgency_reason:
                attention_items.append(
                    DeanAttentionItem(
                        id=g.id,
                        tracking_id=g.grievance_id,
                        title=g.title,
                        priority=g.priority.value,
                        status=g.status.value,
                        subject_name=sub.name if sub else "-",
                        category_name=cat.name if cat else "-",
                        current_authority_name=auth.name_snapshot if auth else "Unassigned",
                        current_authority_role=auth.role.value if auth else "-",
                        submitted_at=it["created_at"],
                        submitted_display=format_ist_datetime(it["created_at"]),
                        aging_days=aging_d,
                        urgency_reason=urgency_reason,
                        escalation_count=g.reopen_count,
                    )
                )

        attention_items.sort(key=lambda x: (x.status == "ESCALATED", x.aging_days), reverse=True)

        # 23. Recent Activities (from status history)
        recent_hist = db.scalars(
            select(GrievanceStatusHistory)
            .options(selectinload(GrievanceStatusHistory.grievance))
            .order_by(GrievanceStatusHistory.created_at.desc())
            .limit(20)
        ).all()

        recent_activities = []
        for hist in recent_hist:
            grv = hist.grievance
            if not grv:
                continue
            actor_name = "Institutional Authority"
            actor_role = "SYSTEM"
            if hist.actor_authority_id and hist.actor_authority_id in auth_map:
                a = auth_map[hist.actor_authority_id]
                actor_name = a.name_snapshot
                actor_role = a.role.value

            desc_text = hist.remarks or f"Grievance status changed to {hist.to_status}"
            recent_activities.append(
                ExecutiveActivityFeedItem(
                    id=str(hist.id),
                    event_type=hist.to_status,
                    tracking_id=grv.grievance_id,
                    title=grv.title,
                    actor_name=actor_name,
                    actor_role=actor_role,
                    description=desc_text,
                    timestamp=hist.created_at,
                    timestamp_display=format_ist_datetime(hist.created_at),
                )
            )

        # 24. Routing Health
        grvs_with_assign = sum(1 for it in annotated_grievances if it["grievance"].status in active_statuses and it["grievance"].id in active_assignments_by_grv)
        grvs_no_assign = sum(1 for it in annotated_grievances if it["grievance"].status in active_statuses and it["grievance"].id not in active_assignments_by_grv)
        cats_missing_routing = sum(1 for c in all_categories if not c.routing_type)
        subs_missing_cluster = sum(1 for s in all_subjects if not s.subject_cluster_id)
        clus_missing_auth = (
            sum(1 for sc in all_subject_clusters if not sc.assistant_dean_id) +
            sum(1 for gc in all_grievance_clusters if not gc.associate_dean_id)
        )
        is_healthy = (grvs_no_assign == 0 and cats_missing_routing == 0 and subs_missing_cluster == 0 and clus_missing_auth == 0)

        routing_health = RoutingHealthSummary(
            grievances_with_active_assignment=grvs_with_assign,
            grievances_without_active_assignment=grvs_no_assign,
            categories_missing_routing=cats_missing_routing,
            subjects_missing_cluster=subs_missing_cluster,
            clusters_missing_authority=clus_missing_auth,
            is_healthy=is_healthy,
        )

        # 25. Filters Metadata
        filters_metadata = ExecutiveFilterMetadata(
            categories=[FilterOptionItem(id=str(c.id), name=c.name) for c in all_categories],
            subjects=[FilterOptionItem(id=str(s.id), name=s.name, extra=s.code) for s in all_subjects],
            subject_clusters=[FilterOptionItem(id=str(sc.id), name=f"Cluster {sc.cluster_number}: {sc.name}") for sc in all_subject_clusters],
            grievance_clusters=[FilterOptionItem(id=str(gc.id), name=f"Cluster {gc.cluster_number}: {gc.name}") for gc in all_grievance_clusters],
            authorities=[
                FilterOptionItem(id=str(a.id), name=a.name_snapshot, extra=a.role.value)
                for a in all_authorities
            ],
            priorities=[p.value for p in GrievancePriority],
            statuses=[s.value for s in GrievanceStatus],
            levels=["APPLICANT", "MANAGER", "ASSISTANT_DEAN", "ASSOCIATE_DEAN", "FIXED_AUTHORITY", "DEAN", "RESOLVED"],
            aging_buckets=["<24h", "1-3d", "4-7d", "8-14d", "15-30d", "30+d"],
        )

        return DeanDashboardDataResponse(
            generated_at=now,
            kpis=kpis,
            workflow_pipeline=workflow_pipeline,
            bottlenecks=bottlenecks,
            aging_distribution=aging_distribution,
            authority_workloads=auth_workloads,
            assistant_dean_panel=asst_dean_panel,
            associate_dean_panel=assoc_dean_panel,
            manager_triage=manager_triage,
            category_analytics=category_analytics,
            grievance_cluster_analytics=grv_cluster_analytics,
            subject_cluster_analytics=sub_cluster_analytics,
            priority_analysis=priority_analysis,
            time_trends=time_trend_points,
            routing_analytics=routing_analytics,
            fixed_authorities=fixed_authorities,
            resolution_analytics=resolution_analytics,
            oldest_cases=oldest_cases,
            attention_items=attention_items,
            recent_activities=recent_activities,
            routing_health=routing_health,
            filters_metadata=filters_metadata,
        )

    @classmethod
    def get_dashboard_cases_ledger(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 25,
        search: Optional[str] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        current_level: Optional[str] = None,
        authority_id: Optional[uuid.UUID] = None,
        category_id: Optional[uuid.UUID] = None,
        grievance_cluster_id: Optional[uuid.UUID] = None,
        subject_cluster_id: Optional[uuid.UUID] = None,
        subject_id: Optional[uuid.UUID] = None,
        routing_type: Optional[str] = None,
        aging_bucket: Optional[str] = None,
    ) -> ExecutiveLedgerResponse:
        now = datetime.now(timezone.utc)

        all_categories = db.scalars(select(Category)).all()
        cat_map = {c.id: c for c in all_categories}

        all_subjects = db.scalars(select(Subject)).all()
        sub_map = {s.id: s for s in all_subjects}

        all_grv_clusters = db.scalars(select(GrievanceCluster)).all()
        grv_cluster_map = {gc.id: gc for gc in all_grv_clusters}

        active_assignments = db.scalars(
            select(Assignment).options(selectinload(Assignment.authority)).where(Assignment.is_active.is_(True))
        ).all()
        active_assignments_by_grv: Dict[uuid.UUID, Assignment] = {
            a.grievance_id: a for a in active_assignments
        }

        grv_stmt = select(Grievance).options(
            selectinload(Grievance.subject),
            selectinload(Grievance.category),
            selectinload(Grievance.assigned_authority),
        )
        all_grievances = db.scalars(grv_stmt).all()

        annotated = []
        for g in all_grievances:
            cat = cat_map.get(g.final_category_id or g.category_id)
            sub = sub_map.get(g.subject_id)
            lvl, auth, stage_start = cls._determine_current_level_and_authority(
                g, active_assignments_by_grv, cat_map
            )

            g_created = g.created_at if g.created_at.tzinfo else g.created_at.replace(tzinfo=timezone.utc)
            total_age_hours = max(0.0, (now - g_created).total_seconds() / 3600.0)

            st_start = stage_start if (stage_start and stage_start.tzinfo) else ((stage_start.replace(tzinfo=timezone.utc)) if stage_start else g_created)
            stage_age_hours = max(0.0, (now - st_start).total_seconds() / 3600.0)

            bucket_key = cls._get_aging_bucket_key(total_age_hours)

            cluster_name = "General Academic"
            if cat and cat.grievance_cluster_id and cat.grievance_cluster_id in grv_cluster_map:
                cluster_name = grv_cluster_map[cat.grievance_cluster_id].name

            annotated.append({
                "grievance": g,
                "current_level": lvl,
                "active_authority": auth,
                "category": cat,
                "subject": sub,
                "cluster_name": cluster_name,
                "total_age_hours": total_age_hours,
                "stage_age_hours": stage_age_hours,
                "aging_bucket": bucket_key,
                "created_at": g_created,
            })

        # Apply filters
        filtered = []
        search_query = search.strip().lower() if search else None
        for it in annotated:
            g = it["grievance"]
            if search_query:
                match = (
                    search_query in g.grievance_id.lower() or
                    search_query in g.title.lower() or
                    search_query in g.description.lower() or
                    (it["category"] and search_query in it["category"].name.lower()) or
                    (it["subject"] and search_query in it["subject"].name.lower())
                )
                if not match:
                    continue

            if start_date and it["created_at"] < start_date:
                continue
            if end_date and it["created_at"] > end_date:
                continue
            if status and g.status.value != status:
                continue
            if priority and g.priority.value != priority:
                continue
            if current_level and it["current_level"] != current_level:
                continue
            if authority_id:
                auth = it["active_authority"]
                if not auth or auth.id != authority_id:
                    continue
            if category_id:
                c_id = g.final_category_id or g.category_id
                if c_id != category_id:
                    continue
            if grievance_cluster_id:
                cat = it["category"]
                if not cat or cat.grievance_cluster_id != grievance_cluster_id:
                    continue
            if subject_cluster_id:
                sub = it["subject"]
                if not sub or sub.subject_cluster_id != subject_cluster_id:
                    continue
            if subject_id and g.subject_id != subject_id:
                continue
            if routing_type:
                cat = it["category"]
                if not cat or cat.routing_type.value != routing_type:
                    continue
            if aging_bucket and it["aging_bucket"] != aging_bucket:
                continue

            filtered.append(it)

        # Sort
        reverse = (sort_dir.lower() == "desc")
        if sort_by == "age" or sort_by == "total_age_hours":
            filtered.sort(key=lambda x: x["total_age_hours"], reverse=reverse)
        elif sort_by == "stage_age" or sort_by == "stage_age_hours":
            filtered.sort(key=lambda x: x["stage_age_hours"], reverse=reverse)
        elif sort_by == "priority":
            priority_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
            filtered.sort(key=lambda x: priority_rank.get(x["grievance"].priority.value, 0), reverse=reverse)
        elif sort_by == "status":
            filtered.sort(key=lambda x: x["grievance"].status.value, reverse=reverse)
        elif sort_by == "tracking_id":
            filtered.sort(key=lambda x: x["grievance"].grievance_id, reverse=reverse)
        else:  # default: created_at
            filtered.sort(key=lambda x: x["created_at"], reverse=reverse)

        total_count = len(filtered)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_items = filtered[start_idx:end_idx]

        # Fetch last action history for paged rows
        paged_ids = [it["grievance"].id for it in paged_items]
        last_hist_by_grv: Dict[uuid.UUID, GrievanceStatusHistory] = {}
        if paged_ids:
            hist_records = db.scalars(
                select(GrievanceStatusHistory)
                .where(GrievanceStatusHistory.grievance_id.in_(paged_ids))
                .order_by(GrievanceStatusHistory.created_at.desc())
            ).all()
            for h in hist_records:
                if h.grievance_id not in last_hist_by_grv:
                    last_hist_by_grv[h.grievance_id] = h

        rows = []
        for it in paged_items:
            g = it["grievance"]
            auth = it["active_authority"]
            cat = it["category"]
            sub = it["subject"]
            last_h = last_hist_by_grv.get(g.id)
            last_action_text = (
                last_h.remarks or f"Moved to {last_h.to_status}"
                if last_h
                else f"Intake: {g.status.value}"
            )
            last_action_ts = last_h.created_at if last_h else g.created_at

            rows.append(
                ExecutiveLedgerRow(
                    id=g.id,
                    tracking_id=g.grievance_id,
                    title=g.title,
                    submitted_at=it["created_at"],
                    submitted_display=format_ist_datetime(it["created_at"]),
                    total_age_hours=round(it["total_age_hours"], 1),
                    total_age_display=format_duration(it["total_age_hours"]),
                    current_level=it["current_level"],
                    current_authority_name=auth.name_snapshot if auth else "Unassigned",
                    current_authority_role=auth.role.value if auth else "-",
                    category_name=cat.name if cat else "General",
                    subject_name=sub.name if sub else "General",
                    cluster_name=it["cluster_name"],
                    priority=g.priority.value,
                    status=g.status.value,
                    current_stage_age_hours=round(it["stage_age_hours"], 1),
                    current_stage_age_display=format_duration(it["stage_age_hours"]),
                    last_action=last_action_text,
                    last_action_timestamp=last_action_ts,
                    last_action_display=format_ist_datetime(last_action_ts),
                )
            )

        return ExecutiveLedgerResponse(
            items=rows,
            total=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
