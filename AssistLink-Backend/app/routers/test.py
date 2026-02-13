"""
Test endpoint for creating notifications manually
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_current_user
from app.services.notifications import create_notification
from pydantic import BaseModel
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/test", tags=["test"])


class TestNotificationRequest(BaseModel):
    user_id: Optional[str] = None  # If not provided, use current user
    type: str = "test"
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None


@router.post("/notification")
async def create_test_notification(
    request: TestNotificationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a test notification for debugging
    """
    try:
        # Use provided user_id or current user's id
        target_user_id = request.user_id or current_user.get('id')
        
        if not target_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No user_id provided and current user has no id"
            )
        
        print(f"\n🧪 TEST NOTIFICATION REQUEST")
        print(f"Target User ID: {target_user_id}")
        print(f"Type: {request.type}")
        print(f"Title: {request.title}")
        print(f"Body: {request.body}")
        print(f"Data: {request.data}")
        
        notification = await create_notification(
            user_id=target_user_id,
            notification_type=request.type,
            title=request.title,
            body=request.body,
            data=request.data
        )
        
        if notification:
            return {
                "success": True,
                "message": "Test notification created",
                "notification": notification
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create notification"
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating test notification: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating test notification: {str(e)}"
        )
