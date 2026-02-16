
@router.get("/{booking_id}", response_model=BookingResponse, status_code=status.HTTP_200_OK)
async def get_booking_details(
    booking_id: uuid.UUID,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed information for a specific booking.
    Accessible by:
    - The care recipient who created it
    - The caregiver assigned to it
    """
    try:
        # Get user_id
        user_id = current_user.get("id") if isinstance(current_user, dict) else str(current_user.get("id", ""))
        
        # Query booking with relations
        # We need to join care_recipient and caregiver tables
        # Supabase syntax for joins in python client:
        # .select("*, care_recipient:users!care_recipient_id(*), caregiver:users!caregiver_id(*)")
        
        query = supabase.table("bookings").select(
            "*, care_recipient:users!care_recipient_id(*), caregiver:users!caregiver_id(*)"
        ).eq("id", str(booking_id))
        
        response = query.execute()
        
        if not response.data:
            raise NotFoundError("Booking not found")
            
        booking = response.data[0]
        
        # Authorization Check
        care_recipient_id = booking.get("care_recipient_id")
        caregiver_id = booking.get("caregiver_id")
        
        # Check if user is either the recipient or the caregiver
        # Also allow if user is an admin (future proofing, if we had admin role check)
        is_authorized = (str(care_recipient_id) == str(user_id)) or \
                        (str(caregiver_id) == str(user_id) if caregiver_id else False)
                        
        if not is_authorized:
            raise AuthorizationError("You are not authorized to view this booking")
            
        return booking

    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"booking_id": str(booking_id), "user_id": user_id})
        raise DatabaseError(f"Error retrieving booking details: {str(e)}")
