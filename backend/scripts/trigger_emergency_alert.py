#!/usr/bin/env python3
"""
Send an emergency alert as the care recipient (e.g. riyaz) so the caregiver (e.g. demo) receives it.

Usage:
  # Option 1: Login with email/password (care recipient account)
  RIYAZ_EMAIL=riyaz@example.com RIYAZ_PASSWORD=yourpassword python backend/scripts/trigger_emergency_alert.py

  # Option 2: Use an existing access token (e.g. from app / network tab)
  RIYAZ_TOKEN=eyJhbGc... python backend/scripts/trigger_emergency_alert.py

  # Custom API URL (default: production)
  EXPO_PUBLIC_API_BASE_URL=https://assistlink-backend-1qjd.onrender.com RIYAZ_EMAIL=... RIYAZ_PASSWORD=... python backend/scripts/trigger_emergency_alert.py

Run from repo root. Requires: pip install requests
"""
import os
import sys
import json

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

BASE_URL = os.environ.get("EXPO_PUBLIC_API_BASE_URL", os.environ.get("API_BASE_URL", "https://assistlink-backend-1qjd.onrender.com")).rstrip("/")
EMAIL = os.environ.get("RIYAZ_EMAIL", "")
PASSWORD = os.environ.get("RIYAZ_PASSWORD", "")
TOKEN = os.environ.get("RIYAZ_TOKEN", "")


def main():
    if not TOKEN and (not EMAIL or not PASSWORD):
        print("Set either RIYAZ_TOKEN or both RIYAZ_EMAIL and RIYAZ_PASSWORD.")
        print("Example: RIYAZ_EMAIL=riyaz@example.com RIYAZ_PASSWORD=secret python backend/scripts/trigger_emergency_alert.py")
        sys.exit(1)

    token = TOKEN
    if not token:
        print(f"Logging in as {EMAIL}...")
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        if r.status_code != 200:
            print(f"Login failed: {r.status_code} - {r.text[:200]}")
            sys.exit(1)
        data = r.json()
        token = data.get("access_token")
        if not token:
            print("Login response had no access_token")
            sys.exit(1)
        print("Login OK.")

    print("Triggering emergency alert...")
    r = requests.post(
        f"{BASE_URL}/api/emergency/trigger",
        json={
            "location": {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "location_name": "Test location (script)",
                "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            }
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        timeout=15,
    )

    try:
        out = r.json()
    except Exception:
        out = {"raw": r.text}

    print(f"Status: {r.status_code}")
    print(json.dumps(out, indent=2))

    if r.status_code == 200 and out.get("emergency_id"):
        eid = out.get("emergency_id", "")
        if not eid.startswith("stub-"):
            print(f"\nEmergency created: {eid}. Caregivers notified: {out.get('caregivers_notified', 0)}")
            print("Check the caregiver app (demo) for the alert.")
        else:
            print("\n(Stub response - emergencies table may not be set up.)")
    elif r.status_code != 200:
        sys.exit(1)


if __name__ == "__main__":
    main()
