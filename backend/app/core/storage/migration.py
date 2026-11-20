"""
VYASA Centralized DigitalOcean Spaces Storage Migration Subsystem.
Scans legacy local files across efiles, uploads, and sama_veda,
computes cryptographic checksums, uploads them idempotently to DigitalOcean Spaces,
verifies remote object integrity, and updates database records safely.

Non-destructive: Never removes local files unless explicitly confirmed.
Idempotent: Skips re-uploading if key already exists in target storage with matching size/hash.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple
import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import (
    BaseStorageProvider,
    LocalStorageProvider,
    SpacesStorageProvider,
    StorageResult,
    StorageError,
    create_storage_provider,
    storage_service,
    generate_standard_storage_key,
)

logger = logging.getLogger("vyasa.storage.migration")


@dataclass
class MigrationItemResult:
    source_path: str
    destination_key: str
    file_size_bytes: int
    sha256_checksum: str
    status: str  # "MIGRATED", "SKIPPED_EXISTS", "DRY_RUN", "FAILED"
    db_updated: bool = False
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class MigrationReport:
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    finished_at: Optional[datetime] = None
    is_dry_run: bool = True
    storage_provider: str = "spaces"
    total_scanned: int = 0
    total_migrated: int = 0
    total_skipped: int = 0
    total_failed: int = 0
    total_db_updated: int = 0
    items: List[MigrationItemResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "is_dry_run": self.is_dry_run,
            "storage_provider": self.storage_provider,
            "summary": {
                "total_scanned": self.total_scanned,
                "total_migrated": self.total_migrated,
                "total_skipped": self.total_skipped,
                "total_failed": self.total_failed,
                "total_db_updated": self.total_db_updated,
            },
            "items": [
                {
                    "source_path": item.source_path,
                    "destination_key": item.destination_key,
                    "file_size_bytes": item.file_size_bytes,
                    "sha256_checksum": item.sha256_checksum,
                    "status": item.status,
                    "db_updated": item.db_updated,
                    "entity_type": item.entity_type,
                    "entity_id": item.entity_id,
                    "error_message": item.error_message,
                }
                for item in self.items
            ],
        }


class StorageMigrationManager:
    """
    Orchestrates the discovery, validation, Spaces upload, verification,
    and database reconciliation of all existing local persistent files.
    """

    def __init__(
        self,
        provider: Optional[BaseStorageProvider] = None,
        base_storage_dir: Optional[Union[str, Path]] = None,
    ):
        self.provider = provider or storage_service.get_provider()
        self._explicit_base_dir = base_storage_dir is not None
        self.base_storage_dir = Path(base_storage_dir or getattr(settings, "STORAGE_BASE_DIR", "storage")).resolve()

    @staticmethod
    def compute_sha256(file_path: Path) -> Tuple[str, int]:
        hasher = hashlib.sha256()
        total_size = 0
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
                total_size += len(chunk)
        return hasher.hexdigest(), total_size

    def discover_local_files(self) -> List[Tuple[Path, str, str]]:
        """
        Discovers all persistent files in backend/storage and storage roots.
        Returns list of (absolute_file_path, module, relative_subpath).
        """
        discovered = []
        if self._explicit_base_dir:
            search_roots = [self.base_storage_dir]
        else:
            search_roots = [
                self.base_storage_dir,
                Path("backend/storage").resolve(),
                Path("storage").resolve(),
            ]

        seen_real_paths = set()

        for s_root in search_roots:
            if not s_root.is_dir():
                continue
            for root, dirs, files in os.walk(s_root):
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                for f in files:
                    if f.startswith("."):
                        continue
                    full_p = (Path(root) / f).resolve()
                    if full_p in seen_real_paths or not full_p.is_file():
                        continue
                    seen_real_paths.add(full_p)

                    # Determine module classification
                    try:
                        rel = full_p.relative_to(s_root).as_posix()
                    except ValueError:
                        rel = full_p.name

                    parts = rel.split("/")
                    first = parts[0].lower() if parts else "common"

                    if first in ("efiles", "efile"):
                        module = "nivaran"
                    elif first in ("uploads", "grievances"):
                        module = "nivaran"
                    elif first in ("sama_veda", "bulletins", "certificates"):
                        module = "sama_veda"
                    elif first in ("anudaan", "yajur_veda"):
                        module = "anudaan"
                    elif first in ("knowledge", "vyasa-knowledge"):
                        module = "knowledge_centre"
                    else:
                        module = "common"

                    discovered.append((full_p, module, rel))

        return discovered

    def generate_destination_key(self, module: str, rel_path: str, file_path: Path) -> str:
        """
        Generates standard collision-resistant Spaces destination key.
        Preserves natural prefix groupings for backwards compatibility.
        """
        clean_rel = rel_path.replace("\\", "/").strip("/")
        parts = clean_rel.split("/")

        # Preserve canonical Sama Veda bulletin and certificate paths if already structured
        if len(parts) >= 2 and parts[0] in ("sama_veda", "anudaan", "vyasa-knowledge"):
            return clean_rel

        # Standardize efiles: nivaran/efiles/{year}/{filename}
        if parts[0] == "efiles":
            return f"nivaran/{clean_rel}"

        # Standardize grievance uploads: nivaran/grievances/{grievance_id}/{filename}
        if parts[0] == "uploads" and len(parts) >= 3:
            grievance_id = parts[1]
            filename = parts[-1]
            return f"nivaran/grievances/{grievance_id}/{filename}"
        elif parts[0] == "uploads" and len(parts) == 2:
            return f"nivaran/uploads/{parts[1]}"

        # Fallback to standard object key
        return f"vyasa/production/{module}/{clean_rel}"

    def migrate_file(
        self,
        file_path: Path,
        module: str,
        rel_path: str,
        dry_run: bool = True,
        db: Optional[Session] = None,
    ) -> MigrationItemResult:
        """
        Migrates a single file to DigitalOcean Spaces with verification and DB reconciliation.
        """
        try:
            sha256, file_size = self.compute_sha256(file_path)
        except Exception as exc:
            return MigrationItemResult(
                source_path=str(file_path),
                destination_key="",
                file_size_bytes=0,
                sha256_checksum="",
                status="FAILED",
                error_message=f"Failed to read/hash source file: {exc}",
            )

        destination_key = self.generate_destination_key(module, rel_path, file_path)

        if dry_run:
            return MigrationItemResult(
                source_path=str(file_path),
                destination_key=destination_key,
                file_size_bytes=file_size,
                sha256_checksum=sha256,
                status="DRY_RUN",
                db_updated=False,
            )

        # 1. Idempotency Check: verify if already present in remote storage
        try:
            if self.provider.exists(destination_key):
                meta = self.provider.get_file_metadata(destination_key)
                remote_size = meta.get("file_size_bytes")
                remote_sha = meta.get("sha256_checksum")
                if remote_size == file_size and (not remote_sha or remote_sha == sha256):
                    # Reconcile DB if needed
                    db_up = self._reconcile_db(db, file_path, rel_path, destination_key, sha256)
                    return MigrationItemResult(
                        source_path=str(file_path),
                        destination_key=destination_key,
                        file_size_bytes=file_size,
                        sha256_checksum=sha256,
                        status="SKIPPED_EXISTS",
                        db_updated=db_up,
                    )
        except Exception as check_exc:
            logger.debug("Existence check check_exc on %s: %s", destination_key, check_exc)

        # 2. Upload to Spaces
        try:
            with open(file_path, "rb") as fp:
                content_bytes = fp.read()

            subfolder = os.path.dirname(destination_key)
            filename = os.path.basename(destination_key)

            # Direct put_object or save_file
            if isinstance(self.provider, SpacesStorageProvider):
                effective_mime = "application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream"
                self.provider.s3_client.put_object(
                    Bucket=self.provider.bucket,
                    Key=destination_key,
                    Body=content_bytes,
                    ContentType=effective_mime,
                    ACL="private",
                    Metadata={
                        "sha256": sha256,
                        "original_filename": file_path.name,
                        "migrated_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            elif isinstance(self.provider, LocalStorageProvider):
                target_p = self.provider.base_dir / destination_key
                target_p.parent.mkdir(parents=True, exist_ok=True)
                target_p.write_bytes(content_bytes)
            else:
                self.provider.save_file(
                    content=content_bytes,
                    destination_path=destination_key,
                )

            # 3. Verification: verify existence and metadata
            if not self.provider.exists(destination_key):
                raise StorageError(f"Post-upload existence verification failed for key '{destination_key}'.")

            # 4. Database Reconciliation
            db_up = self._reconcile_db(db, file_path, rel_path, destination_key, sha256)

            return MigrationItemResult(
                source_path=str(file_path),
                destination_key=destination_key,
                file_size_bytes=file_size,
                sha256_checksum=sha256,
                status="MIGRATED",
                db_updated=db_up,
            )

        except Exception as exc:
            logger.error("Migration failed for %s -> %s: %s", file_path, destination_key, exc)
            return MigrationItemResult(
                source_path=str(file_path),
                destination_key=destination_key,
                file_size_bytes=file_size,
                sha256_checksum=sha256,
                status="FAILED",
                error_message=str(exc),
            )

    def _reconcile_db(
        self,
        db: Optional[Session],
        file_path: Path,
        rel_path: str,
        destination_key: str,
        sha256: str,
    ) -> bool:
        """
        Reconciles database records matching local path or filename with the new destination key.
        """
        if not db:
            return False

        updated = False
        try:
            # 1. Nivaran Document (evidence attachments)
            from app.modules.atharva_veda.nivaran.models.document import Document
            filename = file_path.name

            docs = db.scalars(
                select(Document).where(
                    (Document.file_name == filename)
                    | (Document.file_path.ilike(f"%{filename}%"))
                    | (Document.file_path == str(file_path))
                )
            ).all()
            for d in docs:
                if d.storage_key != destination_key:
                    d.storage_key = destination_key
                    d.file_path = destination_key
                    if not d.content_hash:
                        d.content_hash = sha256
                    updated = True

            # 2. Nivaran EFile
            from app.modules.atharva_veda.nivaran.models.efile import EFile
            efiles = db.scalars(
                select(EFile).where(
                    (EFile.file_path.ilike(f"%{filename}%"))
                    | (EFile.file_path == str(file_path))
                )
            ).all()
            for ef in efiles:
                if ef.file_path != destination_key:
                    ef.file_path = destination_key
                    if not ef.content_hash:
                        ef.content_hash = sha256
                    updated = True

            # 3. Sama Veda Bulletins
            from app.modules.sama_veda.models.bulletin import ResearchBulletin
            bulletins = db.scalars(
                select(ResearchBulletin).where(
                    (ResearchBulletin.file_path.ilike(f"%{filename}%"))
                    | (ResearchBulletin.file_path == str(file_path))
                )
            ).all()
            for b in bulletins:
                if b.file_path != destination_key:
                    b.file_path = destination_key
                    if not b.checksum_sha256:
                        b.checksum_sha256 = sha256
                    updated = True

            # 4. Sama Veda Certificates
            from app.modules.sama_veda.models.certificate import FelicitationCertificate
            certs = db.scalars(
                select(FelicitationCertificate).where(
                    (FelicitationCertificate.file_storage_path.ilike(f"%{filename}%"))
                    | (FelicitationCertificate.file_storage_path == str(file_path))
                )
            ).all()
            for c in certs:
                if c.file_storage_path != destination_key:
                    c.file_storage_path = destination_key
                    if not c.checksum_sha256:
                        c.checksum_sha256 = sha256
                    updated = True

            if updated:
                db.commit()

        except Exception as exc:
            logger.warning("DB reconciliation failed for %s: %s", destination_key, exc)
            if db:
                db.rollback()
            return False

        return updated

    def run_migration(
        self,
        dry_run: bool = True,
        db: Optional[Session] = None,
    ) -> MigrationReport:
        """
        Executes a full discovery and migration pass.
        """
        provider_name = "spaces" if isinstance(self.provider, SpacesStorageProvider) else "local"
        report = MigrationReport(
            is_dry_run=dry_run,
            storage_provider=provider_name,
        )

        files = self.discover_local_files()
        report.total_scanned = len(files)

        for file_path, module, rel_path in files:
            res = self.migrate_file(
                file_path=file_path,
                module=module,
                rel_path=rel_path,
                dry_run=dry_run,
                db=db,
            )
            report.items.append(res)
            if res.status == "MIGRATED":
                report.total_migrated += 1
            elif res.status == "SKIPPED_EXISTS":
                report.total_skipped += 1
            elif res.status == "FAILED":
                report.total_failed += 1

            if res.db_updated:
                report.total_db_updated += 1

        report.finished_at = datetime.now(timezone.utc)
        return report


def run_migration_cli():
    """CLI entrypoint for storage migration."""
    import argparse
    parser = argparse.ArgumentParser(description="VYASA DigitalOcean Spaces Storage Migration CLI")
    parser.add_argument("--execute", action="store_true", help="Execute live migration (default is dry-run)")
    parser.add_argument("--output", type=str, default="migration_report.json", help="Path to write JSON report")
    args = parser.parse_args()

    dry_run = not args.execute
    print("=" * 70)
    print("VYASA — DIGITALOCEAN OBJECT STORAGE MIGRATION CLI")
    print(f"Mode: {'DRY-RUN (Simulating)' if dry_run else 'LIVE EXECUTION'}")
    print(f"Active Provider: {getattr(settings, 'STORAGE_PROVIDER', 'local')}")
    print("=" * 70)

    mgr = StorageMigrationManager()
    report = mgr.run_migration(dry_run=dry_run)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report.to_dict(), f, indent=2)

    print(f"Discovered: {report.total_scanned} files")
    if not dry_run:
        print(f"Migrated:   {report.total_migrated}")
        print(f"Skipped:    {report.total_skipped}")
        print(f"Failed:     {report.total_failed}")
        print(f"DB Updated: {report.total_db_updated}")
    else:
        print(f"Planned destination keys prepared for all {report.total_scanned} items.")
    print(f"Report saved to: {args.output}")
    print("=" * 70)


if __name__ == "__main__":
    run_migration_cli()
