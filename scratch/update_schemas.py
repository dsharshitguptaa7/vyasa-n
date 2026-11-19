import re

file_path = "backend/app/modules/sama_veda/schemas/cms.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Update CertificateIssueRequest
old_issue_req = """    direct_issue_justification: Optional[str] = Field(
        None,
        max_length=1000,
        description="Mandatory institutional justification for exceptional direct issuance bypassing dual approval",
    )"""

new_issue_req = """    direct_issue_justification: Optional[str] = Field(
        None,
        max_length=1000,
        description="Mandatory institutional justification for exceptional direct issuance bypassing dual approval",
    )
    verification_token: Optional[str] = Field(None, max_length=64, description="Optional manual verification identifier override")
    verification_identifier: Optional[str] = Field(None, description="Optional manual verification identifier or pasted verification URL")

    @model_validator(mode="before")
    @classmethod
    def resolve_verification_identifier(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_ident = data.get("verification_identifier") or data.get("verification_token")
            if raw_ident is not None:
                ident_str = str(raw_ident).strip()
                if not ident_str:
                    data["verification_token"] = None
                    data["verification_identifier"] = None
                else:
                    if "://" in ident_str or ident_str.startswith("/"):
                        url_pattern = r'^(?:https?://[^/]+)?(?:/api)?(?:/modules/sama-veda)?/(?:certificates/)?verify/([a-zA-Z0-9_\\-]+)/?$'
                        m = re.match(url_pattern, ident_str, re.IGNORECASE)
                        if m:
                            ident_str = m.group(1).strip()
                        else:
                            raise ValueError(
                                "Invalid verification URL format. Pasted URL must match the application's verification route: /verify/{identifier}."
                            )
                    data["verification_token"] = ident_str
                    data["verification_identifier"] = ident_str
        return data"""

old_bulk_item = """class BulkCertificateItemInput(BaseModel):
    item_id: Optional[str] = None
    research_title: str = Field(..., min_length=3)
    authors: List[BulkAuthorInput] = Field(..., min_length=1)
    research_contribution_statement: Optional[str] = None
    publication_details: Optional[Dict[str, Any]] = None
    incentive_details: Optional[Dict[str, Any]] = None"""

new_bulk_item = """class BulkCertificateItemInput(BaseModel):
    item_id: Optional[str] = None
    research_title: str = Field(..., min_length=3)
    authors: List[BulkAuthorInput] = Field(..., min_length=1)
    research_contribution_statement: Optional[str] = None
    publication_details: Optional[Dict[str, Any]] = None
    incentive_details: Optional[Dict[str, Any]] = None
    certificate_number: Optional[str] = Field(None, max_length=100)
    verification_token: Optional[str] = Field(None, max_length=64)
    verification_identifier: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_bulk_item_identifiers(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_ident = data.get("verification_identifier") or data.get("verification_token")
            if raw_ident is not None:
                ident_str = str(raw_ident).strip()
                if not ident_str:
                    data["verification_token"] = None
                    data["verification_identifier"] = None
                else:
                    if "://" in ident_str or ident_str.startswith("/"):
                        url_pattern = r'^(?:https?://[^/]+)?(?:/api)?(?:/modules/sama-veda)?/(?:certificates/)?verify/([a-zA-Z0-9_\\-]+)/?$'
                        m = re.match(url_pattern, ident_str, re.IGNORECASE)
                        if m:
                            ident_str = m.group(1).strip()
                        else:
                            raise ValueError(
                                "Invalid verification URL format. Pasted URL must match the application's verification route: /verify/{identifier}."
                            )
                    data["verification_token"] = ident_str
                    data["verification_identifier"] = ident_str
        return data"""

# Normalize \r\n to \n for matching
content_norm = content.replace("\r\n", "\n")
assert old_issue_req in content_norm, "old_issue_req not found"
assert old_bulk_item in content_norm, "old_bulk_item not found"

content_norm = content_norm.replace(old_issue_req, new_issue_req, 1)
content_norm = content_norm.replace(old_bulk_item, new_bulk_item, 1)

# Write back preserving \r\n
content_out = content_norm.replace("\n", "\r\n")
with open(file_path, "w", encoding="utf-8", newline="") as f:
    f.write(content_out)

print("Successfully updated cms.py")
