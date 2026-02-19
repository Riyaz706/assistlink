"""
Utility script to seed the AssistLink database with some easy-to-use test data.

This uses the Supabase admin client, so it will bypass RLS and is intended for
local development / staging only – do not run against production unless you
are comfortable with the test records it creates.

Run from the backend directory root:

    python -m scripts.seed_test_data

It will:
- Ensure a few test care recipients and caregivers exist in the `users` table
- Create or update matching rows in `caregiver_profile`
- Create a couple of example `bookings` connecting them
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple

from app.database import supabase, supabase_admin


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_user(
    email: str,
    full_name: str,
    role: str,
    password: str | None = None,
    **extra_fields: Any,
) -> Dict[str, Any]:
    """
    Idempotently ensure a user row exists and return it.

    If a user with this email already exists, it will be updated with the
    provided fields (where values differ). Otherwise, a new row is inserted.
    """
    # Look up by email first
    existing = (
        supabase_admin.table("users")
        .select("*")
        .eq("email", email)
        .limit(1)
        .execute()
    )

    if existing.data:
        user = existing.data[0]
        update_payload: Dict[str, Any] = {}

        desired = {
            "full_name": full_name,
            "role": role,
            "is_active": True,
            **extra_fields,
        }

        for key, value in desired.items():
            # Only update fields that actually change
            if value is not None and user.get(key) != value:
                update_payload[key] = value

        if update_payload:
            updated = (
                supabase_admin.table("users")
                .update(update_payload)
                .eq("id", user["id"])
                .execute()
            )
            if updated.data:
                user = updated.data[0]

        return user

    # Create a new Supabase Auth user first so we get a valid auth.user id
    if password is None:
        raise RuntimeError(
            f"Password is required to create a new seeded user for {email!r}"
        )

    auth_payload: Dict[str, Any] = {
        "email": email,
        "password": password,
        "options": {
            "data": {
                "full_name": full_name,
                "role": role,
            }
        },
    }

    try:
        auth_response = supabase.auth.sign_up(auth_payload)
    except Exception as exc:  # pragma: no cover - defensive
        raise RuntimeError(f"Auth sign_up failed for {email!r}: {exc}") from exc

    user_obj = getattr(auth_response, "user", None)
    if user_obj is None and isinstance(auth_response, dict):
        user_obj = auth_response.get("user")

    if user_obj is None:
        raise RuntimeError(f"Auth sign_up did not return a user for {email!r}")

    # Normalize the user object into a dict-like shape
    if isinstance(user_obj, dict):
        user_id = user_obj.get("id")
        auth_email = user_obj.get("email") or email
    else:
        user_id = getattr(user_obj, "id", None)
        auth_email = getattr(user_obj, "email", email)

    if not user_id:
        raise RuntimeError(f"Auth user for {email!r} does not have an id")

    # Insert corresponding profile row into our public.users table
    insert_payload: Dict[str, Any] = {
        "id": user_id,
        "email": auth_email,
        "full_name": full_name,
        "role": role,
        "is_active": True,
        **extra_fields,
    }

    inserted = supabase_admin.table("users").insert(insert_payload).execute()
    if not inserted.data:
        raise RuntimeError(f"Failed to insert profile for user {email!r}")

    return inserted.data[0]


def seed_users() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Create a small set of test care recipients and caregivers.

    Returns:
        (care_recipients, caregivers)
    """
    care_recipient_configs = [
        {
            "email": "test.recipient1@example.com",
            "full_name": "Test Recipient One",
            "password": "AssistLink123!",
        },
        {
            "email": "test.recipient2@example.com",
            "full_name": "Test Recipient Two",
            "password": "AssistLink123!",
        },
    ]

    caregiver_configs = [
        {
            "email": "test.caregiver1@example.com",
            "full_name": "Test Caregiver One",
            "password": "AssistLink123!",
            "skills": ["Exam assistance", "Note-taking", "Mobility support"],
            "availability_status": "available",
            "hourly_rate": 25.0,
            "experience_years": 2,
            "bio": "Patient and punctual caregiver, experienced with exam support.",
        },
        {
            "email": "test.caregiver2@example.com",
            "full_name": "Test Caregiver Two",
            "password": "AssistLink123!",
            "skills": ["Daily care", "Meal preparation"],
            "availability_status": "available",
            "hourly_rate": 18.5,
            "experience_years": 1,
            "bio": "Friendly caregiver focused on daily routines and comfort.",
        },
    ]

    care_recipients: List[Dict[str, Any]] = []
    caregivers: List[Dict[str, Any]] = []

    # Seed care recipients
    for cfg in care_recipient_configs:
        user = get_or_create_user(
            email=cfg["email"],
            full_name=cfg["full_name"],
            role="care_recipient",
            password=cfg["password"],
        )
        care_recipients.append(user)

    # Seed caregivers
    for cfg in caregiver_configs:
        user = get_or_create_user(
            email=cfg["email"],
            full_name=cfg["full_name"],
            role="caregiver",
            password=cfg["password"],
        )
        caregivers.append(
            {
                "user": user,
                "profile_cfg": cfg,
            }
        )

    # Ensure caregiver_profile rows exist / are updated
    for item in caregivers:
        user = item["user"]
        profile_cfg = item["profile_cfg"]
        user_id = user["id"]

        profile_existing = (
            supabase_admin.table("caregiver_profile")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        profile_payload: Dict[str, Any] = {
            "user_id": user_id,
            "skills": profile_cfg.get("skills"),
            "availability_status": profile_cfg.get("availability_status", "available"),
            "qualifications": profile_cfg.get("qualifications"),
            "experience_years": profile_cfg.get("experience_years"),
            "bio": profile_cfg.get("bio"),
            "hourly_rate": profile_cfg.get("hourly_rate"),
        }

        if profile_existing.data:
            supabase_admin.table("caregiver_profile").update(profile_payload).eq(
                "user_id", user_id
            ).execute()
        else:
            supabase_admin.table("caregiver_profile").insert(profile_payload).execute()

    return care_recipients, [c["user"] for c in caregivers]


def seed_bookings(
    care_recipients: List[Dict[str, Any]],
    caregivers: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Create a couple of simple bookings connecting recipients and caregivers.

    These are intentionally minimal and are only meant to make dashboard /
    bookings views show some data.
    """
    if not care_recipients or not caregivers:
        return []

    now = _now_utc()

    # Pair the first recipient with the first caregiver, etc.
    pairs: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
    for idx, recipient in enumerate(care_recipients):
        caregiver = caregivers[min(idx, len(caregivers) - 1)]
        pairs.append((recipient, caregiver))

    created_bookings: List[Dict[str, Any]] = []

    for idx, (recipient, caregiver) in enumerate(pairs):
        care_recipient_id = recipient["id"]
        caregiver_id = caregiver["id"]

        # Avoid creating duplicate demo bookings for the same pair on repeated runs
        existing = (
            supabase_admin.table("bookings")
            .select("id, service_type, scheduled_date")
            .eq("care_recipient_id", care_recipient_id)
            .eq("caregiver_id", caregiver_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            continue

        scheduled_date = (now + timedelta(days=idx + 1)).isoformat()

        booking_payload: Dict[str, Any] = {
            "care_recipient_id": care_recipient_id,
            "caregiver_id": caregiver_id,
            "service_type": "exam_assistance",
            "scheduled_date": scheduled_date,
            "duration_hours": 2.0,
            "status": "pending",
            "is_recurring": False,
            "specific_needs": "Demo booking created by seed_test_data.py",
        }

        inserted = (
            supabase_admin.table("bookings").insert(booking_payload).execute()
        )
        if inserted.data:
            created_bookings.extend(inserted.data)

    return created_bookings


def main() -> None:
    print("Seeding test users and caregivers...")
    care_recipients, caregivers = seed_users()
    print(f"  Care recipients: {len(care_recipients)}")
    print(f"  Caregivers: {len(caregivers)}")

    print("Seeding example bookings...")
    bookings = seed_bookings(care_recipients, caregivers)
    print(f"  Bookings created this run: {len(bookings)}")

    print("\nDone. You can now:")
    print("- Log in with your own Supabase accounts as usual")
    print(
        "- Use endpoints like /api/caregivers and dashboard routes to see the seeded caregivers and bookings."
    )


if __name__ == "__main__":
    main()

