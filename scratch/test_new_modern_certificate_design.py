import hashlib
import io
import math
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-12345678901234567890")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget

# Verify assets
assets_dir = Path(r"C:\Projects\VYASA\assets")
csjmu_logo = assets_dir / "branding" / "csjmu" / "csjmu-logo.png"
naac_logo = assets_dir / "branding" / "naac-A-Plus-Plus.png"
print(f"CSJMU logo exists: {csjmu_logo.exists()}")
print(f"NAAC logo exists: {naac_logo.exists()}")
