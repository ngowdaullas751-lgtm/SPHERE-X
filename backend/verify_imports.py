"""Quick import verification for COSMIC LENS backend."""
import sys
import os

# Add backend dir to path
sys.path.insert(0, os.path.dirname(__file__))

errors = []

try:
    from app.main import app
    print("OK: app.main")
except Exception as e:
    print(f"FAIL: app.main - {e}")
    errors.append(str(e))

try:
    from app.routes import observations, analysis
    print("OK: app.routes")
except Exception as e:
    print(f"FAIL: app.routes - {e}")
    errors.append(str(e))

try:
    from app.services import spherex_service, image_service, motion_service
    print("OK: app.services")
except Exception as e:
    print(f"FAIL: app.services - {e}")
    errors.append(str(e))

try:
    from app.models.schemas import (
        HealthResponse, ObservationResult, CutoutResult,
        ProcessedImage, ComparisonResult, MotionCandidate,
        MotionDetectionResult, SpectrumResult, LightCurveResult,
        Candidate, Target, ErrorResponse
    )
    print("OK: app.models.schemas")
except Exception as e:
    print(f"FAIL: app.models.schemas - {e}")
    errors.append(str(e))

if errors:
    print(f"\n{len(errors)} error(s) found.")
    sys.exit(1)
else:
    print("\nALL BACKEND MODULES IMPORTED SUCCESSFULLY")
