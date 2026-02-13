from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional, Dict, Any
from app.database import supabase_admin
from app.dependencies import get_current_user
from app.services.notifications import (
    notify_new_message, 
    create_notification,
    notify_emergency_alert,
    notify_emergency_acknowledged
)
from app.error_handler import DatabaseError
from datetime import datetime, timezone
import sys

router = APIRouter()

@router.post("/trigger")
async def trigger_emergency(
    location_data: Optional[Dict[str, Any]] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger an emergency SOS alert.
    Notifies all caregivers associated with the care recipient.
    """
    try:
        user_id = current_user.get("id")
        user_name = current_user.get("full_name") or "A Care Recipient"
        
        print(f"\n🚨 EMERGENCY TRIGGERED BY: {user_name} ({user_id})", file=sys.stderr, flush=True)
        
        # 1. Identify caregivers associated with this user
        print(f"[DEBUG] Fetching bookings for care_recipient_id: {user_id}", file=sys.stderr, flush=True)
        bookings_response = supabase_admin.table("bookings") \
            .select("caregiver_id") \
            .eq("care_recipient_id", user_id) \
            .execute()
        
        print(f"[DEBUG] Found {len(bookings_response.data) if bookings_response.data else 0} bookings", file=sys.stderr, flush=True)
        
        caregiver_ids = list(set([b["caregiver_id"] for b in bookings_response.data if b.get("caregiver_id")]))
        
        print(f"[DEBUG] caregiver_ids to notify: {caregiver_ids}", file=sys.stderr, flush=True)
        
        if not caregiver_ids:
            print(f"⚠️ No caregivers found for user {user_id}", file=sys.stderr, flush=True)
            return {"status": "success", "message": "Emergency recorded, but no caregivers found to notify."}

        print(f"📢 Notifying {len(caregiver_ids)} caregivers...", file=sys.stderr, flush=True)

        # 2. Create notifications for each caregiver
        notifications_sent = 0
        for caregiver_id in caregiver_ids:
            try:
                print(f"[DEBUG] Creating notification for caregiver: {caregiver_id}", file=sys.stderr, flush=True)
                res = await notify_emergency_alert(
                    caregiver_id=caregiver_id,
                    care_recipient_name=user_name,
                    emergency_id=str(user_id),  # Using user_id as emergency identifier
                    location=location_data
                )
                if res:
                    print(f"✅ Notification created in DB for {caregiver_id}", file=sys.stderr, flush=True)
                    notifications_sent += 1
                else:
                    print(f"❌ create_notification returned None for {caregiver_id}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"❌ Failed to notify caregiver {caregiver_id}: {e}", file=sys.stderr, flush=True)

        return {
            "status": "success", 
            "message": f"Emergency alert triggered. {notifications_sent} caregivers notified.",
            "caregivers_notified": notifications_sent
        }

    except Exception as e:
        print(f"❌ Error triggering emergency: {e}", file=sys.stderr, flush=True)
        raise DatabaseError(f"Failed to trigger emergency: {str(e)}")
