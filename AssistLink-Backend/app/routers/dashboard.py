from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from app.schemas import DashboardStats, BookingResponse
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user
from app.error_handler import DatabaseError

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics for current user using optimized direct SQL"""
    from src.config.db import execute_query
    try:
        user_id = current_user["id"]
        
        # Get user role from current_user directly if available, otherwise fetch
        role = current_user.get("user_metadata", {}).get("role")
        if not role:
            role_res = execute_query("SELECT role FROM users WHERE id = %s", (user_id,))
            role = role_res[0]["role"] if role_res else None
        
        if not role:
            return DashboardStats(upcoming_bookings=0, active_bookings=0, completed_bookings=0, pending_video_calls=0, active_chat_sessions=0)
        
        # Consolidate all stats into one efficient SQL query
        role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
        
        query = f"""
            WITH b_stats AS (
                SELECT 
                    COUNT(*) FILTER (WHERE status IN ('pending', 'accepted') AND scheduled_date > NOW()) as upcoming,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as active,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COALESCE(SUM(amount) FILTER (WHERE payment_status = 'completed'), 0) as earnings
                FROM bookings 
                WHERE {role_col} = %s
            ),
            v_stats AS (
                SELECT COUNT(*) as pending_calls
                FROM video_call_requests
                WHERE {role_col} = %s AND status = 'pending'
            ),
            c_stats AS (
                SELECT COUNT(*) as active_chats
                FROM chat_sessions
                WHERE {role_col} = %s AND is_enabled = true
            ),
            cp_stats AS (
                SELECT COALESCE(avg_rating, 0.0) as rating
                FROM caregiver_profile
                WHERE user_id = %s
                UNION ALL SELECT 0.0 WHERE NOT EXISTS (SELECT 1 FROM caregiver_profile WHERE user_id = %s)
                LIMIT 1
            )
            SELECT * FROM b_stats, v_stats, c_stats, cp_stats;
        """
        
        res = execute_query(query, (user_id, user_id, user_id, user_id, user_id))
        if not res:
             return DashboardStats(upcoming_bookings=0, active_bookings=0, completed_bookings=0, pending_video_calls=0, active_chat_sessions=0)
        
        row = res[0]
        return DashboardStats(
            upcoming_bookings=row["upcoming"],
            active_bookings=row["active"],
            completed_bookings=row["completed"],
            pending_video_calls=row["pending_calls"],
            active_chat_sessions=row["active_chats"],
            total_earnings=float(row["earnings"]),
            avg_rating=float(row["rating"])
        )
    

    except Exception as e:
        from src.config.db import DatabaseConnectionError
        if isinstance(e, DatabaseConnectionError):
            import sys
            sys.stderr.write("[DASHBOARD] [FALLBACK] Direct SQL failed, using Supabase client fallback for stats...\n")
            sys.stderr.flush()
            
            try:
                # Fallback implementation using Supabase Admin client
                user_id = current_user["id"]
                
                # Role fallback
                role = current_user.get("user_metadata", {}).get("role")
                if not role:
                    role_res = supabase_admin.table("users").select("role").eq("id", user_id).execute()
                    role = role_res.data[0]["role"] if role_res.data else None
                
                if not role:
                    return DashboardStats(upcoming_bookings=0, active_bookings=0, completed_bookings=0, pending_video_calls=0, active_chat_sessions=0)

                role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
                
                # 1. Bookings stats
                b_res = supabase_admin.table("bookings").select("status, scheduled_date, amount, payment_status").eq(role_col, user_id).execute()
                b_data = b_res.data or []
                
                now = datetime.now(timezone.utc)
                upcoming = sum(1 for b in b_data if b["status"] in ["pending", "accepted"] and datetime.fromisoformat(b["scheduled_date"].replace('Z', '+00:00')) > now)
                active = sum(1 for b in b_data if b["status"] == "in_progress")
                completed = sum(1 for b in b_data if b["status"] == "completed")
                earnings = sum(float(b["amount"] or 0) for b in b_data if b["payment_status"] == "completed")
                
                # 2. Video calls
                v_res = supabase_admin.table("video_call_requests").select("id", count="exact").eq(role_col, user_id).eq("status", "pending").execute()
                pending_calls = v_res.count or 0
                
                # 3. Chat sessions
                c_res = supabase_admin.table("chat_sessions").select("id", count="exact").eq(role_col, user_id).eq("is_enabled", True).execute()
                active_chats = c_res.count or 0
                
                # 4. Rating
                rating = 0.0
                if role == "caregiver":
                    cp_res = supabase_admin.table("caregiver_profile").select("avg_rating").eq("user_id", user_id).execute()
                    rating = float(cp_res.data[0]["avg_rating"] or 0.0) if cp_res.data else 0.0
                
                return DashboardStats(
                    upcoming_bookings=upcoming,
                    active_bookings=active,
                    completed_bookings=completed,
                    pending_video_calls=pending_calls,
                    active_chat_sessions=active_chats,
                    total_earnings=earnings,
                    avg_rating=rating
                )
            except Exception as fallback_err:
                sys.stderr.write(f"[DASHBOARD] [CRITICAL] Fallback failed: {str(fallback_err)}\n")
                raise DatabaseError(f"Database connection failed and fallback was unsuccessful: {str(e)}")
        
        import sys
        sys.stderr.write(f"[ERROR] Dashboard stats failed: {str(e)}\n")
        raise DatabaseError(str(e))


@router.get("/bookings", response_model=List[dict])
async def get_dashboard_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    is_recurring: Optional[bool] = Query(None),
    upcoming_only: Optional[bool] = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get bookings for dashboard using optimized direct SQL"""
    from src.config.db import execute_query
    try:
        user_id = current_user["id"]
        
        # Get role from current_user directly if available
        role = current_user.get("user_metadata", {}).get("role")
        if not role:
             role_res = execute_query("SELECT role FROM users WHERE id = %s", (user_id,))
             role = role_res[0]["role"] if role_res else None
        
        if not role:
            return []
        
        role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
        other_role_col = "care_recipient_id" if role == "caregiver" else "caregiver_id"
        other_role_alias = "care_recipient" if role == "caregiver" else "caregiver"
        
        # Build optimized SQL query
        where_clauses = [f"b.{role_col} = %s"]
        params = [user_id]
        
        if status_filter:
            statuses = status_filter.split(',')
            where_clauses.append(f"b.status = ANY(%s)")
            params.append(statuses)
        
        if is_recurring is not None:
            where_clauses.append("b.is_recurring = %s")
            params.append(is_recurring)
            
        if upcoming_only:
            where_clauses.append("b.scheduled_date >= NOW()")
            
        where_str = " AND ".join(where_clauses)
        
        query = f"""
            SELECT 
                b.*,
                (SELECT row_to_json(u) FROM (SELECT * FROM users WHERE id = b.{other_role_col}) u) as {other_role_alias},
                (SELECT row_to_json(v) FROM (SELECT * FROM video_call_requests WHERE id = b.video_call_request_id) v) as video_call_request,
                (SELECT row_to_json(c) FROM (SELECT * FROM chat_sessions WHERE id = b.chat_session_id) c) as chat_session
            FROM bookings b
            WHERE {where_str}
            ORDER BY b.scheduled_date ASC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        bookings = execute_query(query, tuple(params))
        return bookings or []
    

    except Exception as e:
        from src.config.db import DatabaseConnectionError
        if isinstance(e, DatabaseConnectionError):
            import sys
            sys.stderr.write("[DASHBOARD] [FALLBACK] Direct SQL failed, using Supabase client fallback for bookings...\n")
            sys.stderr.flush()
            
            try:
                user_id = current_user["id"]
                role = current_user.get("user_metadata", {}).get("role")
                if not role:
                    role_res = supabase_admin.table("users").select("role").eq("id", user_id).execute()
                    role = role_res.data[0]["role"] if role_res.data else None
                
                if not role: return []

                role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
                other_role_col = "care_recipient_id" if role == "caregiver" else "caregiver_id"
                other_role_alias = "care_recipient" if role == "caregiver" else "caregiver"
                
                query = supabase_admin.table("bookings").select(f"*, {other_role_alias}:{other_role_col}(*), video_call_request:video_call_request_id(*), chat_session:chat_session_id(*)").eq(role_col, user_id)
                
                if status_filter:
                    query = query.in_("status", status_filter.split(','))
                
                if is_recurring is not None:
                    query = query.eq("is_recurring", is_recurring)
                    
                if upcoming_only:
                    query = query.gte("scheduled_date", datetime.now(timezone.utc).isoformat())
                
                res = query.order("scheduled_date", desc=False).range(offset, offset + limit - 1).execute()
                return res.data or []
            except Exception as fallback_err:
                sys.stderr.write(f"[DASHBOARD] [CRITICAL] Fallback failed: {str(fallback_err)}\n")
                raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

        import sys
        sys.stderr.write(f"[ERROR] get_dashboard_bookings failed: {str(e)}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/upcoming", response_model=List[dict])
async def get_upcoming_bookings(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get upcoming bookings (next 7 days)"""
    try:
        user_id = current_user["id"]
        now = datetime.now(timezone.utc)
        next_week = now + timedelta(days=7)
        
        # Get user role
        user_response = supabase_admin.table("users").select("role").eq("id", user_id).execute()
        role = user_response.data[0].get("role") if user_response.data else None
        
        if not role:
            return []
        
        # Build query
        if role == "care_recipient":
            query = supabase_admin.table("bookings").select("*, caregiver:caregiver_id(*)").eq("care_recipient_id", user_id)
        else:
            query = supabase_admin.table("bookings").select("*, care_recipient:care_recipient_id(*)").eq("caregiver_id", user_id)
        
        query = query.gte("scheduled_date", now.isoformat()).lte("scheduled_date", next_week.isoformat()).in_("status", ["pending", "accepted", "in_progress"]).order("scheduled_date", desc=False).limit(limit)
        
        response = query.execute()
        
        return response.data or []
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/recurring", response_model=List[dict])
async def get_recurring_bookings(
    current_user: dict = Depends(get_current_user)
):
    """Get all recurring bookings using optimized direct SQL"""
    from src.config.db import execute_query
    try:
        user_id = current_user["id"]
        
        # Get role from current_user
        role = current_user.get("user_metadata", {}).get("role")
        if not role:
             role_res = execute_query("SELECT role FROM users WHERE id = %s", (user_id,))
             role = role_res[0]["role"] if role_res else None
        
        if not role:
            return []
        
        role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
        other_role_col = "care_recipient_id" if role == "caregiver" else "caregiver_id"
        other_role_alias = "care_recipient" if role == "caregiver" else "caregiver"
        
        query = f"""
            SELECT 
                b.*,
                (SELECT row_to_json(u) FROM (SELECT * FROM users WHERE id = b.{other_role_col}) u) as {other_role_alias}
            FROM bookings b
            WHERE b.{role_col} = %s AND b.is_recurring = true
            ORDER BY b.scheduled_date ASC
            LIMIT 500
        """
        
        bookings = execute_query(query, (user_id,))
        return bookings or []
    

    except Exception as e:
        from src.config.db import DatabaseConnectionError
        if isinstance(e, DatabaseConnectionError):
            import sys
            sys.stderr.write("[DASHBOARD] [FALLBACK] Direct SQL failed, using Supabase client fallback for recurring bookings...\n")
            sys.stderr.flush()
            
            try:
                user_id = current_user["id"]
                role = current_user.get("user_metadata", {}).get("role")
                if not role:
                    role_res = supabase_admin.table("users").select("role").eq("id", user_id).execute()
                    role = role_res.data[0]["role"] if role_res.data else None
                
                if not role: return []

                role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
                other_role_col = "care_recipient_id" if role == "caregiver" else "caregiver_id"
                other_role_alias = "care_recipient" if role == "caregiver" else "caregiver"
                
                res = supabase_admin.table("bookings").select(f"*, {other_role_alias}:{other_role_col}(*)").eq(role_col, user_id).eq("is_recurring", True).order("scheduled_date", desc=False).limit(500).execute()
                return res.data or []
            except Exception as fallback_err:
                sys.stderr.write(f"[DASHBOARD] [CRITICAL] Fallback failed: {str(fallback_err)}\n")
                raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

        import sys
        sys.stderr.write(f"[ERROR] get_recurring_bookings failed: {str(e)}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/video-calls", response_model=List[dict])
async def get_dashboard_video_calls(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get video call requests for dashboard using optimized direct SQL"""
    from src.config.db import execute_query
    try:
        user_id = current_user["id"]
        
        # Get role from current_user
        role = current_user.get("user_metadata", {}).get("role")
        if not role:
             role_res = execute_query("SELECT role FROM users WHERE id = %s", (user_id,))
             role = role_res[0]["role"] if role_res else None
        
        if not role:
            return []
        
        role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
        other_role_col = "care_recipient_id" if role == "caregiver" else "caregiver_id"
        other_role_alias = "care_recipient" if role == "caregiver" else "caregiver"
        
        where_clauses = [f"v.{role_col} = %s"]
        params = [user_id]
        
        if status_filter:
            where_clauses.append("v.status = %s")
            params.append(status_filter)
            
        where_str = " AND ".join(where_clauses)
        
        query = f"""
            SELECT 
                v.*,
                (SELECT row_to_json(u) FROM (SELECT * FROM users WHERE id = v.{other_role_col}) u) as {other_role_alias}
            FROM video_call_requests v
            WHERE {where_str}
            ORDER BY v.scheduled_time ASC
            LIMIT %s OFFSET %s
        """
        params.extend([limit, offset])
        
        video_calls = execute_query(query, tuple(params))
        return video_calls or []
    

    except Exception as e:
        from src.config.db import DatabaseConnectionError
        if isinstance(e, DatabaseConnectionError):
            import sys
            sys.stderr.write("[DASHBOARD] [FALLBACK] Direct SQL failed, using Supabase client fallback for video calls...\n")
            sys.stderr.flush()
            
            try:
                user_id = current_user["id"]
                role = current_user.get("user_metadata", {}).get("role")
                if not role:
                    role_res = supabase_admin.table("users").select("role").eq("id", user_id).execute()
                    role = role_res.data[0]["role"] if role_res.data else None
                
                if not role: return []

                role_col = "caregiver_id" if role == "caregiver" else "care_recipient_id"
                other_role_col = "care_recipient_id" if role == "caregiver" else "caregiver_id"
                other_role_alias = "care_recipient" if role == "caregiver" else "caregiver"
                
                query = supabase_admin.table("video_call_requests").select(f"*, {other_role_alias}:{other_role_alias}_id(*)").eq(role_col, user_id)
                
                if status_filter:
                    query = query.eq("status", status_filter)
                
                res = query.order("scheduled_time", desc=False).range(offset, offset + limit - 1).execute()
                return res.data or []
            except Exception as fallback_err:
                sys.stderr.write(f"[DASHBOARD] [CRITICAL] Fallback failed: {str(fallback_err)}\n")
                raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")

        import sys
        sys.stderr.write(f"[ERROR] get_dashboard_video_calls failed: {str(e)}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
