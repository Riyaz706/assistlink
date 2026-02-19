from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from app.schemas import LocationUpdate, LocationResponse
from app.database import supabase
from app.dependencies import get_current_user

router = APIRouter()


@router.put("/update", response_model=LocationResponse)
async def update_location(
    location_data: LocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's location"""
    try:
        location_dict = {
            "latitude": location_data.latitude,
            "longitude": location_data.longitude,
            "address": location_data.address,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Update user's current location
        response = supabase.table("users").update({
            "current_location": location_dict
        }).eq("id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return location_dict
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/me", response_model=LocationResponse)
async def get_my_location(current_user: dict = Depends(get_current_user)):
    """Get current user's location"""
    try:
        response = supabase.table("users").select("current_location").eq("id", current_user["id"]).execute()
        
        if not response.data or len(response.data) == 0 or not response.data[0].get("current_location"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Location not found"
            )
        
        return response.data[0]["current_location"]
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

