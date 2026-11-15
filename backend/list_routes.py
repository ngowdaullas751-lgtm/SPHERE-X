"""Print all registered routes to confirm FastAPI app structure."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.main import app

print("Registered routes:")
for route in app.routes:
    if hasattr(route, "methods"):
        print(f"  {list(route.methods)} {route.path}")
    else:
        print(f"  ROUTER {getattr(route, 'path', repr(route))}")

print(f"\nTotal routes: {len(app.routes)}")
print("FastAPI app title:", app.title)
print("FastAPI app version:", app.version)
