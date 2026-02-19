from fastapi.testclient import TestClient
from app.main import app
import sys

client = TestClient(app)

print("Checking routes...")
routes = [route.path for route in app.routes]
for r in sorted(routes):
    print(f"Route: {r}")

target = "/api/auth/login"
if target in routes:
    print(f"SUCCESS: {target} is registered.")
else:
    print(f"FAILURE: {target} is NOT registered.")

# Also check for common prefix issues
if "/api/auth/api/auth/login" in routes:
    print("WARNING: Double prefix detected: /api/auth/api/auth/login")
