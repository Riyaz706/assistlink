"""
Emergency router — Real implementation with Supabase.

Uses `emergencies` table (see backend/database/schema_emergency.sql).
Columns: id, user_id, status, location (jsonb), caregiver_id, acknowledged_at, resolved_at, created_at, updated_at.
If the table does not exist, endpoints return safe stub responses with a clear message.
"""
from fastapi import APIRouter, Depends, Body
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from app.dependencies import get_current_user
from app.database import supabase_admin
from app.services.notifications import notify_emergency_alert, notify_emergency_acknowledged
import sys
import uuid

router = APIRouter()

# Request body for trigger
class TriggerBody(BaseModel):
    location: Optional[Dict[str, Any]] = None


def _ensure_emergencies_table() -> bool:
    """Check if emergencies table exists by attempting a simple select."""
    try:
        supabase_admin.table("emergencies").select("id").limit(1).execute()
        return True
    except Exception as e:
        err = str(e).lower()
        if "relation" in err and "does not exist" in err or "pgrst" in err or "42p01" in err:
            return False
        raise


@router.post("/trigger")
async def trigger_emergency(
    body: TriggerBody = Body(default=TriggerBody()),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("id")
    if not user_id:
        return {
            "status": "error",
            "emergency_id": None,
            "message": "User not identified.",
            "caregivers_notified": 0
        }

    location = (body.location if body else None) or {}

    if not _ensure_emergencies_table():
        sys.stderr.write(f"[EMERGENCY] trigger by {user_id} — emergencies table not found, returning stub\n")
        sys.stderr.flush()
        return {
            "status": "success",
            "emergency_id": "stub-" + str(uuid.uuid4())[:8],
            "message": "Emergency recorded. (Database table 'emergencies' not set up — contact support to enable full alerts.)",
            "caregivers_notified": 0
        }

    try:
        emergency_id = str(uuid.uuid4())
        now_iso = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        # Schema: user_id, caregiver_id (who acknowledged), location, status, acknowledged_at, resolved_at
        row = {
            "id": emergency_id,
            "user_id": user_id,
            "location": location,
            "status": "active",
            "caregiver_id": None,
            "acknowledged_at": None,
            "resolved_at": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        supabase_admin.table("emergencies").insert(row).execute()

        # Resolve care recipient name
        care_recipient_name = "Care recipient"
        try:
            ur = supabase_admin.table("users").select("full_name").eq("id", user_id).limit(1).execute()
            if ur.data and len(ur.data) > 0:
                care_recipient_name = ur.data[0].get("full_name") or care_recipient_name
        except Exception:
            pass

        caregivers_notified = 0
        caregiver_ids = []
        # Notify caregivers from active bookings for this care recipient
        # Statuses: requested, pending (legacy), accepted, confirmed, in_progress
        try:
            bookings = supabase_admin.table("bookings") \
                .select("caregiver_id") \
                .eq("care_recipient_id", str(user_id)) \
                .in_("status", ["requested", "pending", "accepted", "confirmed", "in_progress"]) \
                .execute()
            caregiver_ids = list({str(b["caregiver_id"]) for b in (bookings.data or []) if b.get("caregiver_id")})
            sys.stderr.write(f"[EMERGENCY] Found {len(caregiver_ids)} caregiver(s) from bookings for user {user_id}\n")
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f"[EMERGENCY] fetch caregivers failed: {e}\n")
            sys.stderr.flush()

        # Fallback: if no caregivers from bookings, notify first few caregivers so alert is never silent
        if not caregiver_ids:
            try:
                fallback = supabase_admin.table("users") \
                    .select("id") \
                    .eq("role", "caregiver") \
                    .eq("is_active", True) \
                    .limit(20) \
                    .execute()
                caregiver_ids = list({str(r["id"]) for r in (fallback.data or []) if r.get("id")})
                sys.stderr.write(f"[EMERGENCY] No bookings; notifying {len(caregiver_ids)} caregiver(s) as fallback\n")
                sys.stderr.flush()
            except Exception as e2:
                sys.stderr.write(f"[EMERGENCY] fallback caregiver fetch failed: {e2}\n")
                sys.stderr.flush()

        for cid in caregiver_ids:
            try:
                await notify_emergency_alert(
                    caregiver_id=str(cid),
                    care_recipient_name=care_recipient_name,
                    emergency_id=emergency_id,
                    location=location
                )
                caregivers_notified += 1
            except Exception as nerr:
                sys.stderr.write(f"[EMERGENCY] notify caregiver {cid} failed: {nerr}\n")
                sys.stderr.flush()

        return {
            "status": "success",
            "emergency_id": emergency_id,
            "message": "Emergency alert sent.",
            "caregivers_notified": caregivers_notified
        }
    except Exception as e:
        sys.stderr.write(f"[EMERGENCY] trigger error: {e}\n")
        sys.stderr.flush()
        return {
            "status": "error",
            "emergency_id": None,
            "message": "Could not create emergency record. Please try again or call emergency services directly.",
            "caregivers_notified": 0
        }


@router.post("/{emergency_id}/acknowledge")
async def acknowledge_emergency(
    emergency_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not _ensure_emergencies_table():
        return {"status": "success", "message": "Emergency acknowledged (stub — table not set up)."}

    try:
        user_id = current_user.get("id")
        res = supabase_admin.table("emergencies") \
            .select("id, user_id") \
            .eq("id", emergency_id) \
            .execute()
        if not res.data or len(res.data) == 0:
            return {"status": "error", "message": "Emergency not found."}
        row = res.data[0]
        if row.get("status") == "resolved":
            return {"status": "success", "message": "Emergency already resolved."}
        now_iso = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        supabase_admin.table("emergencies") \
            .update({"status": "acknowledged", "caregiver_id": user_id, "acknowledged_at": now_iso, "updated_at": now_iso}) \
            .eq("id", emergency_id) \
            .execute()
        care_recipient_id = row.get("user_id")
        caregiver_name = "A caregiver"
        try:
            ur = supabase_admin.table("users").select("full_name").eq("id", user_id).limit(1).execute()
            if ur.data and len(ur.data) > 0:
                caregiver_name = ur.data[0].get("full_name") or caregiver_name
        except Exception:
            pass
        try:
            await notify_emergency_acknowledged(str(care_recipient_id), caregiver_name, emergency_id)
        except Exception:
            pass
        return {"status": "success", "message": "Emergency acknowledged."}
    except Exception as e:
        sys.stderr.write(f"[EMERGENCY] acknowledge error: {e}\n")
        sys.stderr.flush()
        return {"status": "error", "message": "Could not acknowledge emergency."}


@router.post("/{emergency_id}/resolve")
async def resolve_emergency(
    emergency_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not _ensure_emergencies_table():
        return {"status": "success", "message": "Emergency resolved (stub)."}

    try:
        now_iso = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        res = supabase_admin.table("emergencies").select("id").eq("id", emergency_id).execute()
        if not res.data or len(res.data) == 0:
            return {"status": "error", "message": "Emergency not found."}
        supabase_admin.table("emergencies") \
            .update({"status": "resolved", "resolved_at": now_iso, "updated_at": now_iso}) \
            .eq("id", emergency_id) \
            .execute()
        return {"status": "success", "message": "Emergency resolved."}
    except Exception as e:
        sys.stderr.write(f"[EMERGENCY] resolve error: {e}\n")
        sys.stderr.flush()
        return {"status": "error", "message": "Could not resolve emergency."}


@router.get("/status/{emergency_id}")
async def get_emergency_status(
    emergency_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not _ensure_emergencies_table():
        return {
            "id": emergency_id,
            "status": "unknown",
            "message": "Emergency tracking not set up (table missing).",
            "caregiver": None,
            "care_recipient": None,
            "location": None
        }

    try:
        res = supabase_admin.table("emergencies") \
            .select("id, user_id, status, caregiver_id, location, created_at") \
            .eq("id", emergency_id) \
            .execute()
        if not res.data or len(res.data) == 0:
            return {
                "id": emergency_id,
                "status": "unknown",
                "message": "Emergency not found.",
                "caregiver": None,
                "care_recipient": None,
                "location": None
            }
        row = res.data[0]
        caregiver = None
        care_recipient = None
        ack_by = row.get("caregiver_id")
        cr_id = row.get("user_id")
        if ack_by:
            try:
                ur = supabase_admin.table("users").select("id, full_name, profile_photo_url, phone").eq("id", ack_by).limit(1).execute()
                if ur.data and len(ur.data) > 0:
                    caregiver = ur.data[0]
            except Exception:
                pass
        if cr_id:
            try:
                cr_res = supabase_admin.table("users").select("id, full_name, profile_photo_url, phone, address").eq("id", cr_id).limit(1).execute()
                if cr_res.data and len(cr_res.data) > 0:
                    care_recipient = cr_res.data[0]
            except Exception:
                pass
        return {
            "id": row.get("id"),
            "status": row.get("status", "unknown"),
            "message": None,
            "caregiver": caregiver,
            "care_recipient": care_recipient,
            "location": row.get("location")
        }
    except Exception as e:
        sys.stderr.write(f"[EMERGENCY] status error: {e}\n")
        sys.stderr.flush()
        return {
            "id": emergency_id,
            "status": "unknown",
            "message": "Could not load status.",
            "caregiver": None,
            "care_recipient": None,
            "location": None
        }
