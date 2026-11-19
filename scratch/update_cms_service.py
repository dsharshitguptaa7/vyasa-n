import re

file_path = "backend/app/modules/sama_veda/services/cms_service.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add validation methods right after generate_unique_certificate_number
old_target_gen = '''        rand_id = uuid.uuid4().hex[:6].upper()
        return f"{prefix}{rand_id}"'''

new_validation_methods = '''        rand_id = uuid.uuid4().hex[:6].upper()
        return f"{prefix}{rand_id}"

    @staticmethod
    def validate_manual_certificate_number(cert_number: Optional[str]) -> Optional[str]:
        """
        Validates an optional manually supplied certificate number.
        Returns:
            - None if input is None, empty, or whitespace-only (triggers automatic generation)
            - The exact trimmed valid certificate number string
        Raises:
            - ValueError if format, character set, or length constraints are violated
        """
        if cert_number is None:
            return None
        trimmed = str(cert_number).strip()
        if not trimmed:
            return None

        if len(trimmed) > 100:
            raise ValueError("Certificate number exceeds maximum allowed length of 100 characters.")
        if len(trimmed) < 3:
            raise ValueError("Certificate number must be at least 3 characters long.")

        # Reject path traversal, control characters, or unsafe characters
        if ".." in trimmed or "\\\\" in trimmed or any(ord(c) < 32 or ord(c) == 127 for c in trimmed):
            raise ValueError("Certificate number contains forbidden control or path traversal characters.")

        # Allowed characters: alphanumeric, forward slashes, hyphens, underscores, dots, spaces
        pattern = r"^[A-Za-z0-9][A-Za-z0-9\\/\\-_\\. ]*[A-Za-z0-9]$"
        if not re.match(pattern, trimmed):
            raise ValueError(
                "Invalid certificate number format. Must start and end with an alphanumeric character and contain only alphanumeric characters, forward slashes (/), hyphens (-), underscores (_), and periods (.)."
            )

        return trimmed

    @staticmethod
    def validate_manual_verification_identifier(identifier: Optional[str]) -> Optional[str]:
        """
        Validates an optional manually supplied verification identifier (token).
        Supports extracting identifier from a full verification URL if provided.
        Returns:
            - None if input is None, empty, or whitespace-only (triggers automatic token generation)
            - The exact trimmed valid identifier string (e.g. hex token or UUID)
        Raises:
            - ValueError if URL format, character set, or length constraints are violated
        """
        if identifier is None:
            return None
        trimmed = str(identifier).strip()
        if not trimmed:
            return None

        # Support extracting identifier from full verification URL
        if "://" in trimmed or trimmed.startswith("/"):
            url_pattern = r'^(?:https?://[^/]+)?(?:/api)?(?:/modules/sama-veda)?/(?:certificates/)?verify/([a-zA-Z0-9_\\-]+)/?$'
            m = re.match(url_pattern, trimmed, re.IGNORECASE)
            if not m:
                raise ValueError(
                    "Invalid verification URL format. Pasted URL must match the application's verification route: /verify/{identifier}."
                )
            trimmed = m.group(1).strip()

        if len(trimmed) > 64:
            raise ValueError("Verification identifier exceeds maximum allowed length of 64 characters.")
        if len(trimmed) < 4:
            raise ValueError("Verification identifier must be at least 4 characters long.")

        # Must be URL-safe identifier: alphanumeric, hyphens, underscores
        pattern = r"^[A-Za-z0-9_\\-]+$"
        if not re.match(pattern, trimmed):
            raise ValueError(
                "Invalid verification identifier format. Only alphanumeric characters, hyphens (-), and underscores (_) are allowed."
            )

        return trimmed'''

# 2. Update issue_certificate
old_issue_code = '''        cert_num = data.certificate_number or SamaCmsService.generate_unique_certificate_number(db)
        token = uuid.uuid4().hex'''

new_issue_code = '''        clean_cert_num = SamaCmsService.validate_manual_certificate_number(data.certificate_number)
        manual_token = SamaCmsService.validate_manual_verification_identifier(
            getattr(data, "verification_identifier", None) or getattr(data, "verification_token", None)
        )

        if clean_cert_num:
            existing_c = SamaCmsService.get_certificate_by_number(db, clean_cert_num)
            if existing_c:
                raise ValueError(f"Certificate number '{clean_cert_num}' is already assigned to another certificate.")
            existing_tok = SamaCmsService.get_certificate_by_token(db, clean_cert_num)
            if existing_tok:
                raise ValueError(f"Certificate number '{clean_cert_num}' conflicts with an existing verification identifier.")
            cert_num = clean_cert_num
        else:
            cert_num = SamaCmsService.generate_unique_certificate_number(db)

        if manual_token:
            existing_tok = SamaCmsService.get_certificate_by_token(db, manual_token)
            if existing_tok:
                raise ValueError(f"Verification identifier '{manual_token}' is already assigned to another certificate.")
            existing_num = SamaCmsService.get_certificate_by_number(db, manual_token)
            if existing_num:
                raise ValueError(f"Verification identifier '{manual_token}' conflicts with an existing certificate number.")
            token = manual_token
        else:
            token = uuid.uuid4().hex'''

# 3. Update generate_bulk_certificates
old_bulk_loop = '''        for idx, item in enumerate(payload.certificates):
            try:
                cert_num = SamaCmsService.generate_unique_certificate_number(db)
                token = uuid.uuid4().hex'''

new_bulk_loop = '''        batch_cert_numbers = set()
        batch_tokens = set()

        for idx, item in enumerate(payload.certificates):
            try:
                item_cert_num = None
                item_token = None

                # 1. Resolve & validate manual certificate number if supplied
                raw_c_num = getattr(item, "certificate_number", None)
                if raw_c_num and str(raw_c_num).strip():
                    try:
                        clean_c_num = SamaCmsService.validate_manual_certificate_number(raw_c_num)
                    except ValueError as val_err:
                        failed_items.append({"index": idx, "reason": str(val_err)})
                        continue

                    if clean_c_num in batch_cert_numbers:
                        failed_items.append({"index": idx, "reason": f"Duplicate certificate number '{clean_c_num}' within batch."})
                        continue
                    if SamaCmsService.get_certificate_by_number(db, clean_c_num) or SamaCmsService.get_certificate_by_token(db, clean_c_num):
                        failed_items.append({"index": idx, "reason": f"Certificate number '{clean_c_num}' already exists or conflicts with an existing token."})
                        continue
                    item_cert_num = clean_c_num
                    batch_cert_numbers.add(clean_c_num)
                else:
                    item_cert_num = SamaCmsService.generate_unique_certificate_number(db)
                    batch_cert_numbers.add(item_cert_num)

                # 2. Resolve & validate manual verification identifier if supplied
                raw_tok = getattr(item, "verification_identifier", None) or getattr(item, "verification_token", None)
                if raw_tok and str(raw_tok).strip():
                    try:
                        clean_tok = SamaCmsService.validate_manual_verification_identifier(raw_tok)
                    except ValueError as val_err:
                        failed_items.append({"index": idx, "reason": str(val_err)})
                        continue

                    if clean_tok in batch_tokens:
                        failed_items.append({"index": idx, "reason": f"Duplicate verification identifier '{clean_tok}' within batch."})
                        continue
                    if SamaCmsService.get_certificate_by_token(db, clean_tok) or SamaCmsService.get_certificate_by_number(db, clean_tok):
                        failed_items.append({"index": idx, "reason": f"Verification identifier '{clean_tok}' already exists or conflicts with an existing certificate number."})
                        continue
                    item_token = clean_tok
                    batch_tokens.add(clean_tok)
                else:
                    item_token = uuid.uuid4().hex
                    batch_tokens.add(item_token)

                cert_num = item_cert_num
                token = item_token'''

content_norm = content.replace("\r\n", "\n")
assert old_target_gen in content_norm, "old_target_gen not found"
assert old_issue_code in content_norm, "old_issue_code not found"
assert old_bulk_loop in content_norm, "old_bulk_loop not found"

content_norm = content_norm.replace(old_target_gen, new_validation_methods, 1)
content_norm = content_norm.replace(old_issue_code, new_issue_code, 1)
content_norm = content_norm.replace(old_bulk_loop, new_bulk_loop, 1)

content_out = content_norm.replace("\n", "\r\n")
with open(file_path, "w", encoding="utf-8", newline="") as f:
    f.write(content_out)

print("Successfully updated cms_service.py")
