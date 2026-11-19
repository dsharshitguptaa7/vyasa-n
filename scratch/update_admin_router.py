import re

file_path = "backend/app/admin/sama_admin_router.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update preview_certificate_pdf
old_preview_call = '''    try:
        pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
            certificate_number=payload.certificate_number or "CSJMU/PREVIEW/DRAFT-0000",
            verification_token="PREVIEW",
            verification_url=f"{str(request.base_url).rstrip('/')}/verify/preview-draft",'''

new_preview_call = '''    try:
        clean_preview_num = sama_cms_service.validate_manual_certificate_number(payload.certificate_number)
    except ValueError:
        clean_preview_num = None

    try:
        manual_preview_token = sama_cms_service.validate_manual_verification_identifier(
            getattr(payload, "verification_identifier", None) or getattr(payload, "verification_token", None)
        )
    except ValueError:
        manual_preview_token = None

    preview_cert_no = clean_preview_num or "CSJMU/PREVIEW/DRAFT-0000"
    preview_token = manual_preview_token or "PREVIEW"
    base_url = _get_production_verification_base_url(request)
    preview_url = f"{base_url}/verify/{preview_token}"

    try:
        pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
            certificate_number=preview_cert_no,
            verification_token=preview_token,
            verification_url=preview_url,'''

# 2. Update issue_certificate
old_issue_func = '''    if payload.certificate_number:
        existing = sama_cms_service.get_certificate_by_number(db, payload.certificate_number)
        if existing:
            raise HTTPException(status_code=400, detail="Certificate number already exists.")

    if payload.bulletin_id:'''

new_issue_func = '''    try:
        clean_cert_num = sama_cms_service.validate_manual_certificate_number(payload.certificate_number)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

    try:
        manual_token = sama_cms_service.validate_manual_verification_identifier(
            getattr(payload, "verification_identifier", None) or getattr(payload, "verification_token", None)
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))

    if clean_cert_num:
        existing = sama_cms_service.get_certificate_by_number(db, clean_cert_num)
        if existing:
            raise HTTPException(status_code=400, detail=f"Certificate number '{clean_cert_num}' is already assigned to another certificate.")
        existing_tok = sama_cms_service.get_certificate_by_token(db, clean_cert_num)
        if existing_tok:
            raise HTTPException(status_code=400, detail=f"Certificate number '{clean_cert_num}' conflicts with an existing verification identifier.")

    if manual_token:
        existing_tok = sama_cms_service.get_certificate_by_token(db, manual_token)
        if existing_tok:
            raise HTTPException(status_code=400, detail=f"Verification identifier '{manual_token}' already belongs to an existing certificate.")
        existing_num = sama_cms_service.get_certificate_by_number(db, manual_token)
        if existing_num:
            raise HTTPException(status_code=400, detail=f"Verification identifier '{manual_token}' conflicts with an existing certificate number.")

    if payload.bulletin_id:'''

# 3. Update audit log in issue_certificate
old_audit_call = '''    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="certificate_issued",
        entity_name="FelicitationCertificate",
        entity_id=cert.id,
        actor_user_id=current_user.id,
        details={
            "certificate_number": cert.certificate_number,
            "author_id": str(cert.author_id),
            "bulletin_id": str(cert.bulletin_id),
            "submit_mode": "APPROVAL" if payload.submit_for_approval else "DIRECT_ISSUANCE",
            "direct_issue_justification": payload.direct_issue_justification if not payload.submit_for_approval else None,
        },
        fail_silent=False,
    )'''

new_audit_call = '''    is_manual_num = bool(clean_cert_num)
    is_manual_token = bool(manual_token)
    override_type = (
        "BOTH" if (is_manual_num and is_manual_token)
        else "CERTIFICATE_NUMBER" if is_manual_num
        else "VERIFICATION_IDENTIFIER" if is_manual_token
        else "NONE"
    )

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="certificate_issued",
        entity_name="FelicitationCertificate",
        entity_id=cert.id,
        actor_user_id=current_user.id,
        details={
            "certificate_number": cert.certificate_number,
            "verification_token": cert.verification_token,
            "author_id": str(cert.author_id),
            "bulletin_id": str(cert.bulletin_id),
            "submit_mode": "APPROVAL" if payload.submit_for_approval else "DIRECT_ISSUANCE",
            "direct_issue_justification": payload.direct_issue_justification if not payload.submit_for_approval else None,
            "is_manual_certificate_number": is_manual_num,
            "is_manual_verification_identifier": is_manual_token,
            "manual_override_type": override_type,
            "manual_certificate_number": cert.certificate_number if is_manual_num else None,
            "manual_verification_identifier": cert.verification_token if is_manual_token else None,
        },
        fail_silent=False,
    )'''

content_norm = content.replace("\r\n", "\n")
assert old_preview_call in content_norm, "old_preview_call not found"
assert old_issue_func in content_norm, "old_issue_func not found"
assert old_audit_call in content_norm, "old_audit_call not found"

content_norm = content_norm.replace(old_preview_call, new_preview_call, 1)
content_norm = content_norm.replace(old_issue_func, new_issue_func, 1)
content_norm = content_norm.replace(old_audit_call, new_audit_call, 1)

content_out = content_norm.replace("\n", "\r\n")
with open(file_path, "w", encoding="utf-8", newline="") as f:
    f.write(content_out)

print("Successfully updated sama_admin_router.py")
