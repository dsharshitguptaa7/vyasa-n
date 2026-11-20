# VYASA — Centralized Object Storage Architecture

## 1. Executive Summary & Mandatory Policy

From this point onward, **DigitalOcean Spaces Object Storage** (S3-compatible) is the **mandatory, centralized permanent file storage architecture** across the entire VYASA ecosystem.

### Why DigitalOcean Spaces is Mandatory
1. **Container Ephemerality**: In modern cloud deployments (Docker, Kubernetes, App Platform, Serverless), container filesystems are strictly ephemeral and destroyed upon restart, scaling events, or redeployments. No permanent file may depend on container disk.
2. **Horizontal Scaling**: Multiple backend replicas must access the same persistent files (certificates, research bulletins, Anudaan gallery photography, E-File dossiers, and evidence documents) simultaneously with strong consistency.
3. **Data Durability & High Availability**: DigitalOcean Spaces provides 99.999999999% (11 9's) data durability with built-in regional replication and automated encryption at rest.
4. **Architectural Standardization**: Eliminates fragmented, ad-hoc `open(..., "wb")` local folder writes and unifies all modules under a single, audited, secure abstraction.

> [!IMPORTANT]
> **No Local Permanent File Writes**: Local disk storage is **strictly prohibited** for permanent assets. Local storage is permitted **only** for transient, temporary processing (e.g. ReportLab PDF compilation, OCR processing, image resizing) and must be cleaned up immediately.
>
> Silent fallback to local storage when Spaces is unavailable is **strictly forbidden**. Storage operations fail-closed with explicit error reporting to guarantee database-storage consistency.

---

## 2. Central Storage Service Location & Architecture

All storage operations route exclusively through the central singleton:
```python
from app.core.storage import storage_service
```

### Subsystem File Layout
```
backend/app/core/storage/
├── __init__.py        # Singleton proxy (storage_service), factory, and exports
├── base.py            # BaseStorageProvider abstract class, StorageResult, and normalizer
├── spaces.py          # SpacesStorageProvider (DigitalOcean Spaces / S3 implementation)
├── local.py           # LocalStorageProvider (Development & offline test implementation)
└── migration.py       # StorageMigrationManager (Discovery, Spaces upload, verification)
```

---

## 3. Configuration & Environment Variables

Configure these settings in `backend/.env` or deployment secrets:

| Variable | Required | Default | Description |
|---|---|---|---|
| `STORAGE_PROVIDER` | Yes | `spaces` | Active provider: `spaces` for production/staging, `local` for offline tests |
| `SPACES_BUCKET` | Yes (for Spaces) | `vyasa-documents` | DigitalOcean Spaces bucket name |
| `SPACES_REGION` | Yes (for Spaces) | `sgp1` | DigitalOcean datacenter region (e.g. `sgp1`, `nyc3`, `ams3`) |
| `SPACES_ENDPOINT_URL` | Optional | `https://{SPACES_REGION}.digitaloceanspaces.com` | Spaces S3-compatible API endpoint |
| `SPACES_ACCESS_KEY_ID` | Yes (for Spaces) | — | Spaces access key ID |
| `SPACES_SECRET_ACCESS_KEY` | Yes (for Spaces) | — | Spaces secret access key |
| `STORAGE_BASE_DIR` | Optional | `storage` | Local base directory used when `STORAGE_PROVIDER=local` |

> [!CAUTION]
> Never hardcode credentials. Never log tokens, secrets, or authorization headers. The storage subsystem masks all credentials in diagnostics and logs.

---

## 4. Standard API Capabilities & Usage Examples

### 4.1 Uploading a File (`save_file` / `upload_file`)
Accepts bytes, streams, or FastAPI `UploadFile`. Automatically calculates SHA-256 integrity checksums, validates file signatures (magic bytes), prevents path traversal, and enforces file size limits.

```python
from fastapi import APIRouter, UploadFile, File, Depends
from app.core.storage import storage_service, StorageResult

@router.post("/gallery/upload")
async def upload_image(file: UploadFile = File(...)):
    # Read bytes or pass file directly
    content = await file.read()
    
    result: StorageResult = storage_service.save_file(
        content=content,
        filename=file.filename,
        subfolder="anudaan/gallery",
        allowed_mime_types=["image/jpeg", "image/png", "image/webp"],
        max_size_bytes=10 * 1024 * 1024,  # 10MB ceiling
    )
    
    # Persist metadata to database
    # result.storage_key -> "anudaan/gallery/1a2b3c_photo.jpg"
    # result.sha256_checksum -> "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    # result.file_size_bytes -> 204850
    return {"storage_key": result.storage_key, "checksum": result.sha256_checksum}
```

### 4.2 Resolving & Streaming Files for Download (`get_file_path`)
For fast, atomic streaming via FastAPI `FileResponse`, `get_file_path` resolves local storage files or downloads cloud objects to an atomic local cache directory:

```python
from fastapi.responses import FileResponse
from app.core.storage import storage_service, StorageFileNotFoundError

@router.get("/documents/{storage_key:path}/download")
def download_document(storage_key: str):
    try:
        local_cached_path = storage_service.get_file_path(storage_key)
        return FileResponse(
            path=str(local_cached_path),
            filename="document.pdf",
            media_type="application/pdf",
        )
    except StorageFileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found in storage.")
```

### 4.3 Reading Raw Binary Bytes (`get_file` / `get_file_bytes`)
For cryptographic verification, hashing, or in-memory processing:

```python
file_bytes = storage_service.get_file_bytes(storage_key)
calculated_hash = hashlib.sha256(file_bytes).hexdigest()
```

### 4.4 Generating Secure Presigned Signed URLs (`generate_signed_url`)
For direct, authorized client downloads bypassing the application web server:

```python
# Generates a time-limited signed GET URL (valid for 5 minutes)
signed_url = storage_service.generate_signed_url(storage_key, expires_in_seconds=300)
```

### 4.5 Deleting Objects (`delete_file`)
Removes objects from Spaces and invalidates local cache copies:

```python
deleted: bool = storage_service.delete_file(storage_key)
```

### 4.6 Copying & Moving Objects (`copy_file` / `move_file`)
```python
new_key = storage_service.copy_file(source_key, "archive/v1_old.pdf")
moved_key = storage_service.move_file(source_key, "promoted/approved.pdf")
```

---

## 5. Object Key Conventions

All object keys generated by VYASA must be predictable, collision-resistant, and strictly path-traversal-proof.

### Standard Object Key Structure
```
vyasa/{environment}/{module}/{entity_id}/{unique_token}/{sanitized_filename}
```

### Examples
- **Certificates**: `sama_veda/certificates/{unique_prefix}_{cert_number}.pdf`
- **Research Bulletins**: `sama_veda/bulletins/{unique_prefix}_Vol2_Issue1.pdf`
- **Anudaan Gallery**: `anudaan/gallery/{unique_prefix}_ceremony_photo.jpg`
- **Anudaan Applications**: `anudaan/applications/{app_id}/{unique_prefix}_paper.pdf`
- **E-File Dossiers**: `nivaran/efiles/{year}/{clean_efile_number}.pdf`
- **Grievance Evidence**: `nivaran/grievances/{grievance_id}/{unique_prefix}_{filename}`
- **AI Knowledge Center**: `vyasa-knowledge/{domain}/{version}_{filename}`

### Key Rules
1. Keys are generated exclusively by the backend.
2. User-provided filenames must be sanitized via `sanitize_filename()`.
3. Traversal characters (`../`, `..\\`, null bytes, drive colons) are strictly rejected.
4. Relative forward slashes (`/`) only.

---

## 6. Security & Access Policies

### Private-by-Default Bucket
All objects in DigitalOcean Spaces are persisted with `ACL="private"`. The entire bucket is never made public.

### Access Classification
1. **Public Assets** (Bulletins, Public Verification Certificates, Published Gallery Photos):
   - Streamed via authenticated public API endpoints (e.g. `/api/modules/sama-veda/bulletins/{id}/download`, `/anudaan/public/gallery/images/{id}/file`).
   - Caching headers (`Cache-Control: public, max-age=86400`) are applied at the HTTP response layer.
2. **Private Assets** (E-Files, Grievance Evidence Attachments, Administrative Submissions):
   - Strict authorization and RBAC checks run prior to resolving file paths or generating presigned URLs.
   - Presigned URLs are time-limited (default: 300 seconds).

---

## 7. Temporary File Processing Policy

When intermediate filesystem files are required (ReportLab PDF generation, OCR, image resizing):
1. Write to the system temporary directory (`tempfile.gettempdir() / "vyasa_tmp"`).
2. Read bytes into memory or stream to `storage_service.save_file()`.
3. Clean up the temporary file immediately in a `finally` block or `try...finally`:
```python
temp_file = Path(tempfile.gettempdir()) / f"tmp_{uuid.uuid4().hex}.pdf"
try:
    generate_pdf_to_disk(str(temp_file))
    pdf_bytes = temp_file.read_bytes()
    res = storage_service.save_file(content=pdf_bytes, filename="dossier.pdf", ...)
finally:
    if temp_file.exists():
        temp_file.unlink(missing_ok=True)
```

---

## 8. Migration Commands

To migrate existing local filesystem assets to DigitalOcean Spaces:

### Dry-Run (Audit & Planning)
```bash
cd backend
python -m app.core.storage.migration --output migration_report.json
```

### Live Migration Execution
```bash
cd backend
python -m app.core.storage.migration --execute --output migration_report.json
```

### Migration Safety Guarantees
- **Idempotency**: Existing objects in Spaces with matching size and SHA-256 hash are skipped automatically.
- **Verification**: Remote existence is verified via `head_object` before updating database records.
- **Non-Destructive**: Original local files are preserved on disk.

---

## 9. Automated Testing & Architecture Guard

Run the dedicated storage test suites:
```bash
cd backend
# Architecture guard: ensures no unauthorized boto3 or open(..., 'wb') writes exist
pytest tests/test_storage_architecture_guard.py

# Complete centralized storage capabilities & regression tests
pytest tests/test_centralized_storage_migration.py

# DigitalOcean Spaces provider unit & mock tests
pytest tests/test_spaces_storage_service.py
```

---

## 10. Checklist for Adding File Storage to a New Module

1. **Import `storage_service`**:
   ```python
   from app.core.storage import storage_service
   ```
2. **Never initialize `boto3` or write to `storage/` directly**.
3. **Save files using `storage_service.save_file()`** and store `result.storage_key` in PostgreSQL.
4. **Download/Stream files using `storage_service.get_file_path()`** with `FileResponse`.
5. **Always provide allowed MIME types and max size limits**.
6. **Clean up any temporary files generated during processing**.
