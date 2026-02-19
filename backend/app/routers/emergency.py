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
        
        # 1. Persist emergency in DB
        emergency_dict = {
            "user_id": user_id,
            "status": "active",
            "location": location_data
        }
        emergency_res = supabase_admin.table("emergencies").insert(emergency_dict).execute()
        if not emergency_res.data:
            raise DatabaseError("Failed to persist emergency alert")
        
        emergency_id = emergency_res.data[0]["id"]
        
        # 2. Identify caregivers associated with this user (filtering for active/accepted bookings)
        print(f"[DEBUG] Fetching active bookings for care_recipient_id: {user_id}", file=sys.stderr, flush=True)
        bookings_response = supabase_admin.table("bookings") \
            .select("caregiver_id") \
            .eq("care_recipient_id", user_id) \
            .in_("status", ["accepted", "in_progress"]) \
            .execute()
        
        print(f"[DEBUG] Found {len(bookings_response.data) if bookings_response.data else 0} relevant bookings", file=sys.stderr, flush=True)
        
        caregiver_ids = list(set([b["caregiver_id"] for b in bookings_response.data if b.get("caregiver_id")]))
        
        print(f"[DEBUG] caregiver_ids to notify: {caregiver_ids}", file=sys.stderr, flush=True)
        
        if not caregiver_ids:
            print(f"⚠️ No active caregivers found for user {user_id}", file=sys.stderr, flush=True)
            return {
                "status": "success", 
                "emergency_id": emergency_id,
                "message": "Emergency recorded, but no active caregivers found to notify."
            }

        print(f"📢 Notifying {len(caregiver_ids)} caregivers...", file=sys.stderr, flush=True)

        # 3. Create notifications for each caregiver
        notifications_sent = 0
        for caregiver_id in caregiver_ids:
            try:
                print(f"[DEBUG] Creating notification for caregiver: {caregiver_id}", file=sys.stderr, flush=True)
                res = await notify_emergency_alert(
                    caregiver_id=caregiver_id,
                    care_recipient_name=user_name,
                    emergency_id=emergency_id,
                    location=location_data
                )
                if res:
                    print(f"✅ Notification created in DB for {caregiver_id}", file=sys.stderr, flush=True)
                    notifications_sent += 1
            except Exception as e:
                print(f"❌ Failed to notify caregiver {caregiver_id}: {e}", file=sys.stderr, flush=True)

        return {
            "status": "success", 
            "emergency_id": emergency_id,
            "message": f"Emergency alert triggered. {notifications_sent} caregivers notified.",
            "caregivers_notified": notifications_sent
        }

    except Exception as e:
        print(f"❌ Error triggering emergency: {e}", file=sys.stderr, flush=True)
        raise DatabaseError(f"Failed to trigger emergency: {str(e)}")


@router.post("/{emergency_id}/acknowledge")
async def acknowledge_emergency(
    emergency_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Acknowledge an emergency SOS alert as a caregiver.
    """
    try:
        user_id = current_user.get("id")
        user_name = current_user.get("full_name") or "A Caregiver"
        
        # 1. Update emergency status
        update_dict = {
            "status": "acknowledged",
            "caregiver_id": user_id,
            "acknowledged_at": datetime.now(timezone.utc).isoformat()
        }
        response = supabase_admin.table("emergencies") \
            .update(update_dict) \
            .eq("id", emergency_id) \
            .eq("status", "active") \
            .execute()
            
        if not response.data:
            # Check if it was already acknowledged
            current = supabase_admin.table("emergencies").select("*").eq("id", emergency_id).execute()
            if current.data and current.data[0]["status"] != "active":
                return {"status": "info", "message": f"Emergency is already {current.data[0]['status']}"}
            raise HTTPException(status_code=404, detail="Emergency alert not found or already acknowledged")

        emergency = response.data[0]
        care_recipient_id = emergency["user_id"]

        # 2. Notify care recipient
        await notify_emergency_acknowledged(
            care_recipient_id=care_recipient_id,
            caregiver_name=user_name,
            emergency_id=emergency_id
        )

        return {"status": "success", "message": "Emergency acknowledged. Care recipient notified."}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error acknowledging emergency: {e}", file=sys.stderr, flush=True)
        raise DatabaseError(f"Failed to acknowledge emergency: {str(e)}")


@router.post("/{emergency_id}/resolve")
async def resolve_emergency(
    emergency_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark an emergency SOS alert as resolved.
    """
    try:
        user_id = current_user.get("id")
        
        # 1. Update emergency status
        update_dict = {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Both CR and CG (if assigned) can resolve
        response = supabase_admin.table("emergencies") \
            .update(update_dict) \
            .eq("id", emergency_id) \
            .execute()
            
        if not response.data:
            raise HTTPException(status_code=404, detail="Emergency alert not found")

        return {"status": "success", "message": "Emergency resolved"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error resolving emergency: {e}", file=sys.stderr, flush=True)
        raise DatabaseError(f"Failed to resolve emergency: {str(e)}")


@router.get("/status/{emergency_id}")
async def get_emergency_status(
    emergency_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current status of an emergency alert.
    """
    try:
        response = supabase_admin.table("emergencies") \
            .select("*, caregiver:caregiver_id(id, full_name, phone, profile_photo_url)") \
            .eq("id", emergency_id) \
            .execute()
            
        if not response.data:
            raise HTTPException(status_code=404, detail="Emergency alert not found")
            
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseError(str(e))
