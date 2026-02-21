"""
dashboard.py — Supabase client only. No direct SQL.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from app.schemas import DashboardStats, BookingResponse
from app.database import supabase_admin
from app.dependencies import get_current_user
import sys

router = APIRouter()

# DB booking_status enum: draft, requested, accepted, confirmed, in_progress, completed, cancelled (no "pending")
def _normalize_booking_status_filter(status_list: List[str]) -> List[str]:
    """Map legacy 'pending' to 'requested' so DB enum accepts the filter."""
    out = []
    for s in status_list:
        s = (s or "").strip()
        if s == "pending":
            s = "requested"
        if s and s not in out:
            out.append(s)
    return out


def _get_role_col(role: str):
    return ("caregiver_id" if role == "caregiver" else "care_recipient_id",
            "care_recipient_id" if role == "caregiver" else "caregiver_id",
            "care_recipient" if role == "caregiver" else "caregiver")


async def _resolve_role(user_id: str, current_user: dict) -> Optional[str]:
    """Get role from DB first (source of truth), then fall back to auth metadata."""
    try:
        res = supabase_admin.table("users").select("role").eq("id", user_id).limit(1).execute()
        if res.data and len(res.data) > 0 and res.data[0].get("role"):
            return res.data[0].get("role")
    except Exception:
        pass
    role = (current_user.get("user_metadata") or {}).get("role")
    return role if role in ("care_recipient", "caregiver") else None


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics for current user — Supabase client only."""
    try:
        user_id = current_user["id"]
        role = await _resolve_role(user_id, current_user)

        if not role:
            return DashboardStats(upcoming_bookings=0, active_bookings=0,
                                  completed_bookings=0, pending_video_calls=0,
                                  active_chat_sessions=0)

        role_col, other_role_col, other_role_alias = _get_role_col(role)

        # 1. Bookings stats
        b_res = supabase_admin.table("bookings") \
            .select("status, scheduled_date, amount, payment_status") \
            .eq(role_col, user_id).execute()
        b_data = b_res.data or []

        now = datetime.now(timezone.utc)
        upcoming = sum(
            1 for b in b_data
            if b.get("status") in ["requested", "pending", "accepted"]
            and (b.get("scheduled_date") is None or (
                datetime.fromisoformat(b["scheduled_date"].replace("Z", "+00:00")) > now
            ))
        )
        active = sum(1 for b in b_data if b.get("status") == "in_progress")
        completed = sum(1 for b in b_data if b.get("status") == "completed")
        earnings = sum(
            float(b.get("amount") or 0) for b in b_data
            if b.get("payment_status") in ["captured", "completed"]
        )

        # 2. Video calls
        try:
            v_res = supabase_admin.table("video_call_requests") \
                .select("id", count="exact").eq(role_col, user_id).eq("status", "pending").execute()
            pending_calls = v_res.count or 0
        except Exception:
            pending_calls = 0

        # 3. Chat sessions
        try:
            c_res = supabase_admin.table("chat_sessions") \
                .select("id", count="exact").eq(role_col, user_id).eq("is_enabled", True).execute()
            active_chats = c_res.count or 0
        except Exception:
            active_chats = 0

        # 4. Rating (caregivers only)
        rating = 0.0
        if role == "caregiver":
            try:
                cp_res = supabase_admin.table("caregiver_profile") \
                    .select("avg_rating").eq("user_id", user_id).execute()
                rating = float((cp_res.data[0] or {}).get("avg_rating") or 0.0) if cp_res.data else 0.0
            except Exception:
                rating = 0.0

        return DashboardStats(
            upcoming_bookings=upcoming, active_bookings=active,
            completed_bookings=completed, pending_video_calls=pending_calls,
            active_chat_sessions=active_chats, total_earnings=earnings, avg_rating=rating
        )

    except Exception as e:
        sys.stderr.write(f"[DASHBOARD] stats error: {e}\n"); sys.stderr.flush()
        return DashboardStats(upcoming_bookings=0, active_bookings=0,
                              completed_bookings=0, pending_video_calls=0,
                              active_chat_sessions=0)


@router.get("/bookings", response_model=List[dict])
async def get_dashboard_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    is_recurring: Optional[bool] = Query(None),
    upcoming_only: Optional[bool] = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get bookings for dashboard — Supabase client only."""
    try:
        user_id = current_user["id"]
        role = await _resolve_role(user_id, current_user)
        if not role:
            return []

        role_col, other_role_col, other_role_alias = _get_role_col(role)

        query = supabase_admin.table("bookings") \
            .select(f"*, {other_role_alias}:{other_role_col}(*), "
                    f"video_call_request:video_call_request_id(*), "
                    f"chat_session:chat_session_id(*)") \
            .eq(role_col, user_id)

        if status_filter:
            statuses = _normalize_booking_status_filter(status_filter.split(","))
            if statuses:
                query = query.in_("status", statuses)
        if is_recurring is not None:
            query = query.eq("is_recurring", is_recurring)

        # When upcoming_only: fetch more rows then filter in Python, because PostgREST or_()
        # with ISO timestamps (colons) can be unreliable; we want scheduled_date >= now OR null.
        if upcoming_only:
            now_utc = datetime.now(timezone.utc)
            # Fetch enough to allow filtering (status already limits the set)
            res = query.order("scheduled_date", desc=False).range(offset, offset + limit * 3 - 1).execute()
            raw = res.data or []
            filtered = []
            for b in raw:
                sd = b.get("scheduled_date")
                if sd is None:
                    filtered.append(b)
                else:
                    try:
                        dt = datetime.fromisoformat(sd.replace("Z", "+00:00"))
                        if dt >= now_utc:
                            filtered.append(b)
                    except (TypeError, ValueError):
                        filtered.append(b)
            # Sort: dated first (asc), then nulls; then apply limit
            filtered.sort(key=lambda x: (x.get("scheduled_date") is None, x.get("scheduled_date") or ""))
            return filtered[:limit]
        res = query.order("scheduled_date", desc=False).range(offset, offset + limit - 1).execute()
        return res.data or []

    except Exception as e:
        sys.stderr.write(f"[DASHBOARD] bookings error: {e}\n"); sys.stderr.flush()
        return []


@router.get("/upcoming", response_model=List[dict])
async def get_upcoming_bookings(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get upcoming bookings (next 7 days)."""
    try:
        user_id = current_user["id"]
        role = await _resolve_role(user_id, current_user)
        if not role:
            return []

        now = datetime.now(timezone.utc)
        next_week = now + timedelta(days=7)
        role_col, other_role_col, other_role_alias = _get_role_col(role)

        res = supabase_admin.table("bookings") \
            .select(f"*, {other_role_alias}:{other_role_col}(*)") \
            .eq(role_col, user_id) \
            .gte("scheduled_date", now.isoformat()) \
            .lte("scheduled_date", next_week.isoformat()) \
            .in_("status", ["requested", "accepted", "in_progress"]) \
            .order("scheduled_date", desc=False).limit(limit).execute()

        return res.data or []

    except Exception as e:
        sys.stderr.write(f"[DASHBOARD] upcoming error: {e}\n"); sys.stderr.flush()
        return []


@router.get("/recurring", response_model=List[dict])
async def get_recurring_bookings(current_user: dict = Depends(get_current_user)):
    """Get all recurring bookings — Supabase client only."""
    try:
        user_id = current_user["id"]
        role = await _resolve_role(user_id, current_user)
        if not role:
            return []

        role_col, other_role_col, other_role_alias = _get_role_col(role)

        res = supabase_admin.table("bookings") \
            .select(f"*, {other_role_alias}:{other_role_col}(*)") \
            .eq(role_col, user_id).eq("is_recurring", True) \
            .order("scheduled_date", desc=False).limit(500).execute()

        return res.data or []

    except Exception as e:
        sys.stderr.write(f"[DASHBOARD] recurring error: {e}\n"); sys.stderr.flush()
        return []


@router.get("/video-calls", response_model=List[dict])
async def get_dashboard_video_calls(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get video call requests for dashboard — Supabase client only."""
    try:
        user_id = current_user["id"]
        role = await _resolve_role(user_id, current_user)
        if not role:
            return []

        role_col, other_role_col, other_role_alias = _get_role_col(role)

        query = supabase_admin.table("video_call_requests") \
            .select(f"*, {other_role_alias}:{other_role_col}(*)") \
            .eq(role_col, user_id)

        if status_filter:
            query = query.eq("status", status_filter)

        res = query.order("scheduled_time", desc=False).range(offset, offset + limit - 1).execute()
        return res.data or []

    except Exception as e:
        sys.stderr.write(f"[DASHBOARD] video-calls error: {e}\n"); sys.stderr.flush()
        return []
