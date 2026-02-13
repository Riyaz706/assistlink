from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from app.schemas import NotificationResponse, DeviceTokenCreate
from app.database import supabase, supabase_admin
from app.dependencies import get_current_user
from datetime import datetime, timezone

router = APIRouter()


@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    is_read: Optional[bool] = Query(None),
    type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for current user"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Use supabase_admin to bypass RLS and ensure notifications are accessible
        query = supabase_admin.table("notifications").select("*").eq("user_id", user_id)
        
        if unread_only or is_read is False:
            query = query.eq("is_read", False)
        elif is_read is True:
            query = query.eq("is_read", True)
        
        if type:
            query = query.eq("type", type)
        
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        return response.data or []
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving notifications: {str(e)}"
        )


@router.get("/unread-count", response_model=dict)
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        response = supabase_admin.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("is_read", False).execute()
        
        count = response.count if hasattr(response, 'count') else len(response.data or [])
        
        return {"unread_count": count}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting unread count: {str(e)}"
        )


@router.post("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Verify notification belongs to user
        # Verify notification belongs to user
        notification_check = supabase_admin.table("notifications").select("id").eq("id", notification_id).eq("user_id", user_id).limit(1).execute()
        
        if not notification_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Update notification
        response = supabase_admin.table("notifications").update({
            "is_read": True,
            "read_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", notification_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update notification"
            )
        
        return {"message": "Notification marked as read", "notification": response.data[0]}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notification: {str(e)}"
        )


@router.post("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read for current user"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Update all unread notifications
        response = supabase_admin.table("notifications").update({
            "is_read": True,
            "read_at": datetime.now(timezone.utc).isoformat()
        }).eq("user_id", user_id).eq("is_read", False).execute()
        
        return {"message": "All notifications marked as read", "count": len(response.data or [])}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating notifications: {str(e)}"
        )


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Verify notification belongs to user
        # Verify notification belongs to user
        notification_check = supabase_admin.table("notifications").select("id").eq("id", notification_id).eq("user_id", user_id).limit(1).execute()
        
        if not notification_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        # Delete notification
        supabase_admin.table("notifications").delete().eq("id", notification_id).execute()
        
        return {"message": "Notification deleted"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting notification: {str(e)}"
        )


@router.post("/devices", status_code=status.HTTP_201_CREATED)
async def register_device(
    device_data: DeviceTokenCreate,
    current_user: dict = Depends(get_current_user)
):
    """Register a device token for push notifications"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        device_dict = {
            "user_id": user_id,
            "device_token": device_data.device_token,
            "platform": device_data.platform,
            "device_info": device_data.device_info or {},
            "is_active": True,
            "last_used_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert (insert or update if exists)
        response = supabase_admin.table("user_devices").upsert(
            device_dict,
            on_conflict="user_id,device_token"
        ).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register device"
            )
        
        return {"message": "Device registered successfully", "device": response.data[0]}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error registering device: {str(e)}"
        )


@router.delete("/devices/{device_token}")
async def unregister_device(
    device_token: str,
    current_user: dict = Depends(get_current_user)
):
    """Unregister a device token"""
    try:
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )
        
        # Delete device token
        supabase_admin.table("user_devices").delete().eq("user_id", user_id).eq("device_token", device_token).execute()
        
        return {"message": "Device unregistered successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error unregistering device: {str(e)}"
        )

@router.post("/test")
async def create_test_notification(current_user: dict = Depends(get_current_user)):
    """Create a test notification for the current user"""
    import sys
    try:
        user_id = current_user.get("id")
        print(f"\n[DEBUG] create_test_notification called for user: {user_id}", file=sys.stderr, flush=True)
        
        notification_dict = {
            "user_id": str(user_id),
            "type": "system",
            "title": "System Test",
            "message": "This is a test notification to verify the dashboard is working.",
            "is_read": False,
            "data": {"test": True}
        }
        
        print(f"[DEBUG] Inserting into 'notifications' table: {notification_dict}", file=sys.stderr, flush=True)
        response = supabase_admin.table("notifications").insert(notification_dict).execute()
        
        print(f"[DEBUG] Supabase response: {response}", file=sys.stderr, flush=True)
        print(f"[DEBUG] Supabase response data: {response.data}", file=sys.stderr, flush=True)
        
        if not response.data:
            print("[ERROR] No data returned from Supabase insert!", file=sys.stderr, flush=True)
            return {"status": "error", "message": "No data returned from Supabase insert"}

        return {"status": "success", "notification": response.data[0]}
    except Exception as e:
        print(f"[ERROR] Exception in create_test_notification: {str(e)}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
