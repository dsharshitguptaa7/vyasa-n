#!/usr/bin/env python3
"""
VYASAⁿ Central Institutional Email Outbox Worker Entry Point.

Runs the durable PostgreSQL transactional email queue worker as an independent
background service process.

Usage:
    python backend/scripts/run_email_worker.py
or
    python -m app.workers.email_worker
"""
import logging
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.workers.email_worker import EmailOutboxWorker

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    worker = EmailOutboxWorker()
    worker.run()
