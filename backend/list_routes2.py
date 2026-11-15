"""Walk all routes including sub-routes from included routers."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.main import app
from fastapi.routing import APIRoute

def collect_routes(routes):
    for route in routes:
        if isinstance(route, APIRoute):
            print(f"  {sorted(route.methods)} {route.path}")
        elif hasattr(route, "routes"):
            collect_routes(route.routes)
        elif hasattr(route, "original_router"):
            collect_routes(route.original_router.routes)

print("All API routes:")
collect_routes(app.routes)
