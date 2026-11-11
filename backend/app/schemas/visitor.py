from pydantic import BaseModel, Field


class VisitorStatsOut(BaseModel):
    """
    Public aggregate visitor statistics for the main VYASA website.
    Strictly aggregates: no individual visitor identities or PII are exposed.
    """
    total_visitors: int = Field(
        ...,
        description="Cumulative count of unique visitors across the lifetime window",
    )
    today_visitors: int = Field(
        ...,
        description="Count of unique visitors recorded during the current institutional calendar day (Asia/Kolkata)",
    )
    date: str = Field(
        ...,
        description="Current institutional calendar date in YYYY-MM-DD format (Asia/Kolkata)",
    )
    timezone: str = Field(
        default="Asia/Kolkata",
        description="Institutional business timezone used for calendar day rollover",
    )
