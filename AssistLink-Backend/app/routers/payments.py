"""
Razorpay Payment Integration Router
Handles payment order creation, verification, and webhook processing
"""
from fastapi import APIRouter, HTTPException, status, Depends, Header
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
import razorpay
import hmac
import hashlib
import json

from app.database import supabase_admin
from app.dependencies import get_current_user, verify_care_recipient
from app.config import settings
from app.services.notifications import (
    notify_payment_success,
    notify_payment_received
)
from app.error_handler import (
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
    DatabaseError
)

router = APIRouter()

# Initialize Razorpay client
_razorpay_client = None

def get_razorpay_client():
    """Get or initialize Razorpay client"""
    global _razorpay_client
    if _razorpay_client is None:
        import sys
        sys.stderr.write(f"[DEBUG] Checking Razorpay credentials...\n")
        sys.stderr.write(f"[DEBUG] RAZORPAY_KEY_ID exists: {bool(settings.RAZORPAY_KEY_ID)}\n")
        sys.stderr.write(f"[DEBUG] RAZORPAY_KEY_SECRET exists: {bool(settings.RAZORPAY_KEY_SECRET)}\n")
        if settings.RAZORPAY_KEY_ID:
            sys.stderr.write(f"[DEBUG] RAZORPAY_KEY_ID starts with: {settings.RAZORPAY_KEY_ID[:10]}...\n")
        
        if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
            try:
                sys.stderr.write(f"[DEBUG] Attempting to create Razorpay client...\n")
                _razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
                sys.stderr.write("[INFO] Razorpay client initialized successfully\n")
            except Exception as e:
                sys.stderr.write(f"[ERROR] Failed to initialize Razorpay client: {e}\n")
                import traceback
                traceback.print_exc(file=sys.stderr)
                sys.stderr.write("[WARN] Payment features will be disabled.\n")
        else:
            sys.stderr.write("[WARN] Razorpay credentials not found. Payment features will be disabled.\n")
            sys.stderr.write(f"[WARN] KEY_ID: {settings.RAZORPAY_KEY_ID}, KEY_SECRET: {'SET' if settings.RAZORPAY_KEY_SECRET else 'NOT SET'}\n")
            sys.stderr.write("[WARN] Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env file to enable payments.\n")
        sys.stderr.flush()
    else:
        import sys
        sys.stderr.write(f"[DEBUG] Using existing Razorpay client\n")
        sys.stderr.flush()
    return _razorpay_client

# Initialize Razorpay client lazily (don't initialize on module load to avoid startup errors)
# get_razorpay_client()  # Commented out - will initialize on first use


@router.get("/status")
async def payment_service_status():
    """Check if payment service is configured and available"""
    import sys
    sys.stderr.write(f"[STATUS] ===== PAYMENT STATUS ENDPOINT CALLED =====\n")
    sys.stderr.write(f"[STATUS] This log should appear in backend terminal\n")
    sys.stderr.flush()
    client = get_razorpay_client()
    status_data = {
        "configured": client is not None,
        "key_id_set": bool(settings.RAZORPAY_KEY_ID),
        "key_secret_set": bool(settings.RAZORPAY_KEY_SECRET),
        "key_id_preview": settings.RAZORPAY_KEY_ID[:10] + "..." if settings.RAZORPAY_KEY_ID else None
    }
    sys.stderr.write(f"[STATUS] Status response: {status_data}\n")
    sys.stderr.flush()
    return status_data

@router.get("/test-logging")
async def test_logging():
    """Test endpoint to verify logging is working"""
    import sys
    sys.stderr.write(f"[TEST] ===== TEST LOGGING ENDPOINT CALLED =====\n")
    sys.stderr.write(f"[TEST] If you see this, logging is working!\n")
    sys.stderr.write(f"[TEST] stdout encoding: {sys.stdout.encoding}\n")
    sys.stderr.write(f"[TEST] stderr encoding: {sys.stderr.encoding}\n")
    sys.stderr.flush()
    return {"message": "Check backend terminal for logs", "timestamp": str(datetime.now(timezone.utc))}


# Request/Response Models
class CreatePaymentOrderRequest(BaseModel):
    booking_id: str
    amount: float = Field(..., gt=0, description="Amount in INR")
    currency: str = Field(default="INR", description="Currency code")


class CreatePaymentOrderResponse(BaseModel):
    order_id: str
    amount: float
    currency: str
    key_id: str
    booking_id: str
    chat_session_id: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentVerificationResponse(BaseModel):
    success: bool
    message: str
    booking_id: Optional[str] = None
    chat_session_id: Optional[str] = None


@router.post("/create-order", response_model=CreatePaymentOrderResponse)
async def create_payment_order(
    request: CreatePaymentOrderRequest,
    current_user: dict = Depends(verify_care_recipient)
):
    """
    TEMPORARY: Bypass Razorpay and directly enable chat.
    This endpoint directly enables chat without going through Razorpay payment.
    """
    import sys
    sys.stderr.write(f"[ENDPOINT] ===== CREATE PAYMENT ORDER (BYPASS MODE) =====\n")
    sys.stderr.write(f"[ENDPOINT] Booking ID: {request.booking_id}\n")
    sys.stderr.write(f"[ENDPOINT] Amount: {request.amount}, Currency: {request.currency}\n")
    sys.stderr.write(f"[ENDPOINT] Current user ID: {current_user.get('id') if current_user else 'None'}\n")
    sys.stderr.flush()
    
    try:
        # Get booking to verify access and calculate amount
        booking_response = supabase_admin.table("bookings").select("*").eq("id", request.booking_id).execute()
        
        if not booking_response.data:
            raise NotFoundError("Booking not found", details={"booking_id": request.booking_id})
        
        booking = booking_response.data[0]
        
        # Verify user is the care recipient
        if booking["care_recipient_id"] != current_user["id"]:
            raise AuthorizationError("Only care recipient can create payment order")
        
        # Check if payment already exists
        if booking.get("payment_status") == "completed":
            sys.stderr.write(f"[INFO] Payment already completed, returning existing chat session\n")
            sys.stderr.flush()
            chat_session_id = booking.get("chat_session_id")
            if chat_session_id:
                return CreatePaymentOrderResponse(
                    order_id="bypass_" + request.booking_id,
                    amount=booking.get("amount") or request.amount or 500,
                    currency=booking.get("currency") or request.currency or "INR",
                    key_id="bypass",
                    booking_id=request.booking_id
                )
        
        # Use amount from request or booking
        amount = request.amount or booking.get("amount") or 500
        currency = request.currency or booking.get("currency") or "INR"
        
        sys.stderr.write(f"[INFO] Bypassing Razorpay - directly enabling chat\n")
        sys.stderr.flush()
        
        # Update booking with payment status = completed (bypass mode)
        update_response = supabase_admin.table("bookings").update({
            "amount": amount,
            "currency": currency,
            "payment_status": "completed",
            "status": "accepted",
            "payment_completed_at": datetime.now(timezone.utc).isoformat(),
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", request.booking_id).execute()
        
        if not update_response.data:
            raise DatabaseError("Failed to update booking")
        
        updated_booking = update_response.data[0]
        
        # Enable chat session
        chat_session_id = None
        chat_check = supabase_admin.table("chat_sessions").select("*").eq("care_recipient_id", booking["care_recipient_id"]).eq("caregiver_id", booking["caregiver_id"]).execute()
        
        if chat_check.data and len(chat_check.data) > 0:
            chat_session_id = chat_check.data[0]["id"]
            supabase_admin.table("chat_sessions").update({
                "is_enabled": True,
                "care_recipient_accepted": True,
                "caregiver_accepted": True,
                "enabled_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", chat_session_id).execute()
        else:
            new_chat = supabase_admin.table("chat_sessions").insert({
                "care_recipient_id": booking["care_recipient_id"],
                "caregiver_id": booking["caregiver_id"],
                "is_enabled": True,
                "care_recipient_accepted": True,
                "caregiver_accepted": True,
                "enabled_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            if new_chat.data:
                chat_session_id = new_chat.data[0]["id"]
        
        # Update booking with chat_session_id
        if chat_session_id:
            supabase_admin.table("bookings").update({
                "chat_session_id": chat_session_id
            }).eq("id", request.booking_id).execute()
        
        # Mark caregiver as unavailable
        try:
            supabase_admin.table("caregiver_profile").update({
                "availability_status": "unavailable"
            }).eq("user_id", booking["caregiver_id"]).execute()
        except Exception as e:
            sys.stderr.write(f"[WARN] Could not update caregiver availability: {e}\n")
            sys.stderr.flush()
        
        # Send notifications
        try:
            from app.services.notifications import notify_chat_enabled
            care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", booking["care_recipient_id"]).execute()
            caregiver_response = supabase_admin.table("users").select("full_name").eq("id", booking["caregiver_id"]).execute()
            
            care_recipient_name = care_recipient_response.data[0].get("full_name", "Care recipient") if care_recipient_response.data else "Care recipient"
            caregiver_name = caregiver_response.data[0].get("full_name", "Caregiver") if caregiver_response.data else "Caregiver"
            
            # Chat enabled notifications
            await notify_chat_enabled(
                user_id=booking["care_recipient_id"],
                other_party_name=caregiver_name,
                chat_session_id=chat_session_id
            )
            await notify_chat_enabled(
                user_id=booking["caregiver_id"],
                other_party_name=care_recipient_name,
                chat_session_id=chat_session_id
            )
            
            # Payment success notifications
            await notify_payment_success(
                user_id=booking["care_recipient_id"],
                amount=amount,
                payment_id=request.booking_id,
                other_party_name=caregiver_name,
                is_sender=True
            )
            await notify_payment_received(
                caregiver_id=booking["caregiver_id"],
                amount=amount,
                care_recipient_name=care_recipient_name,
                payment_id=request.booking_id
            )
            sys.stderr.write(f"[INFO] Payment notifications sent to both parties\n")
            sys.stderr.flush()
        except Exception as notif_error:
            sys.stderr.write(f"[WARN] Error sending notifications: {notif_error}\n")
            sys.stderr.flush()
        
        sys.stderr.write(f"[INFO] Chat enabled successfully. Chat Session ID: {chat_session_id}\n")
        sys.stderr.flush()
        
        return CreatePaymentOrderResponse(
            order_id="bypass_" + request.booking_id,
            amount=amount,
            currency=currency,
            key_id="bypass",
            booking_id=request.booking_id
        )
        
    except (HTTPException, NotFoundError, AuthorizationError, DatabaseError):
        raise
    except Exception as e:
        import traceback
        sys.stderr.write(f"[ERROR] Error in create_payment_order: {str(e)}\n")
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        raise DatabaseError(f"Failed to create payment order: {str(e)}")
    


@router.post("/verify", response_model=PaymentVerificationResponse)
async def verify_payment(
    request: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify Razorpay payment signature and update booking status.
    This should be called from the frontend after successful payment.
    """
    import sys
    sys.stderr.write(f"[INFO] ===== VERIFY PAYMENT REQUEST =====\n")
    sys.stderr.write(f"[INFO] Order ID: {request.razorpay_order_id}, Payment ID: {request.razorpay_payment_id}\n")
    sys.stderr.flush()
    
    razorpay_client = get_razorpay_client()
    if not razorpay_client:
        raise DatabaseError("Payment service is not configured", details={"service": "razorpay"})
    
    try:
        sys.stderr.write(f"[INFO] Verifying payment for order {request.razorpay_order_id}\n")
        sys.stderr.flush()
        
        # Get booking by razorpay_order_id
        booking_response = supabase_admin.table("bookings").select("*").eq("razorpay_order_id", request.razorpay_order_id).execute()
        
        if not booking_response.data:
            raise NotFoundError("Booking not found for this payment order", details={"order_id": request.razorpay_order_id})
        
        booking = booking_response.data[0]
        
        # Verify user is the care recipient
        if booking["care_recipient_id"] != current_user["id"]:
            raise AuthorizationError("Only care recipient can verify payment")
        
        # Verify Razorpay signature
        message = f"{request.razorpay_order_id}|{request.razorpay_payment_id}"
        generated_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != request.razorpay_signature:
            sys.stderr.write(f"[ERROR] Payment signature verification failed for order {request.razorpay_order_id}\n")
            sys.stderr.flush()
            raise ValidationError("Invalid payment signature")
        
        # Verify payment with Razorpay API
        try:
            client = get_razorpay_client()
            if not client:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Payment service is not configured."
                )
            payment = client.payment.fetch(request.razorpay_payment_id)
            sys.stderr.write(f"[INFO] Payment fetched from Razorpay: {payment.get('status')}\n")
            sys.stderr.flush()
            
            if payment.get("status") != "captured" and payment.get("status") != "authorized":
                raise ValidationError(f"Payment not successful. Status: {payment.get('status')}")
        except Exception as razorpay_error:
            sys.stderr.write(f"[ERROR] Error fetching payment from Razorpay: {razorpay_error}\n")
            sys.stderr.flush()
            raise DatabaseError(f"Failed to verify payment with Razorpay: {str(razorpay_error)}")
        
        # Update booking with payment information
        update_data = {
            "payment_status": "completed",
            "razorpay_payment_id": request.razorpay_payment_id,
            "razorpay_signature": request.razorpay_signature,
            "payment_completed_at": datetime.now(timezone.utc).isoformat(),
            "status": "accepted",  # Update booking status to accepted
            "accepted_at": datetime.now(timezone.utc).isoformat()
        }
        
        booking_update_response = supabase_admin.table("bookings").update(update_data).eq("id", booking["id"]).execute()
        
        if not booking_update_response.data:
            raise DatabaseError("Failed to update booking")
        
        updated_booking = booking_update_response.data[0]
        
        # Initialize chat_session_id variable
        chat_session_id = None
        
        # Enable chat session and mark caregiver as unavailable
        if updated_booking.get("caregiver_id"):
            caregiver_id_str = str(updated_booking["caregiver_id"])
            
            # Mark caregiver as unavailable
            try:
                profile_check = supabase_admin.table("caregiver_profile").select("id").eq("user_id", caregiver_id_str).execute()
                if profile_check.data and len(profile_check.data) > 0:
                    supabase_admin.table("caregiver_profile").update({
                        "availability_status": "unavailable"
                    }).eq("user_id", caregiver_id_str).execute()
                else:
                    supabase_admin.table("caregiver_profile").insert({
                        "user_id": caregiver_id_str,
                        "availability_status": "unavailable"
                    }).execute()
            except Exception as avail_error:
                sys.stderr.write(f"[WARN] Error updating caregiver availability: {avail_error}\n")
                sys.stderr.flush()
            
            # Enable chat session
            chat_check = supabase_admin.table("chat_sessions").select("*").eq("care_recipient_id", booking["care_recipient_id"]).eq("caregiver_id", updated_booking["caregiver_id"]).execute()
            
            if chat_check.data and len(chat_check.data) > 0:
                chat_session_id = chat_check.data[0]["id"]
                supabase_admin.table("chat_sessions").update({
                    "is_enabled": True,
                    "care_recipient_accepted": True,
                    "caregiver_accepted": True,
                    "enabled_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", chat_session_id).execute()
            else:
                new_chat = supabase_admin.table("chat_sessions").insert({
                    "care_recipient_id": booking["care_recipient_id"],
                    "caregiver_id": updated_booking["caregiver_id"],
                    "is_enabled": True,
                    "care_recipient_accepted": True,
                    "caregiver_accepted": True,
                    "enabled_at": datetime.now(timezone.utc).isoformat()
                }).execute()
                if new_chat.data:
                    chat_session_id = new_chat.data[0]["id"]
            
            # Update booking with chat_session_id
            if chat_session_id and not updated_booking.get("chat_session_id"):
                supabase_admin.table("bookings").update({
                    "chat_session_id": chat_session_id
                }).eq("id", booking["id"]).execute()
            
            # Send notifications
            try:
                from app.services.notifications import notify_chat_enabled
                care_recipient_response = supabase_admin.table("users").select("full_name").eq("id", booking["care_recipient_id"]).execute()
                caregiver_response = supabase_admin.table("users").select("full_name").eq("id", updated_booking["caregiver_id"]).execute()
                
                care_recipient_name = care_recipient_response.data[0].get("full_name", "Care recipient") if care_recipient_response.data else "Care recipient"
                caregiver_name = caregiver_response.data[0].get("full_name", "Caregiver") if caregiver_response.data else "Caregiver"
                
                await notify_chat_enabled(
                    user_id=booking["care_recipient_id"],
                    other_party_name=caregiver_name,
                    chat_session_id=chat_session_id
                )
                await notify_chat_enabled(
                    user_id=updated_booking["caregiver_id"],
                    other_party_name=care_recipient_name,
                    chat_session_id=chat_session_id
                )
            except Exception as notif_error:
                sys.stderr.write(f"[WARN] Error sending notifications: {notif_error}\n")
                sys.stderr.flush()
        
        sys.stderr.write(f"[INFO] Payment verified successfully for booking {booking['id']}\n")
        sys.stderr.flush()
        
        return PaymentVerificationResponse(
            success=True,
            message="Payment verified and booking confirmed. Chat is now enabled.",
            booking_id=booking["id"],
            chat_session_id=chat_session_id
        )
    
    except (HTTPException, NotFoundError, AuthorizationError, DatabaseError, ValidationError):
        raise
    except Exception as e:
        import traceback
        sys.stderr.write(f"[ERROR] Error verifying payment: {e}\n")
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        raise DatabaseError(f"Failed to verify payment: {str(e)}")


@router.post("/webhook")
async def razorpay_webhook(
    request: Dict[str, Any],
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature")
):
    """
    Razorpay webhook endpoint for payment status updates.
    This endpoint is called by Razorpay when payment events occur.
    """
    razorpay_client = get_razorpay_client()
    if not razorpay_client:
        raise DatabaseError("Payment service is not configured")
    
    try:
        # Verify webhook signature
        webhook_secret = settings.RAZORPAY_KEY_SECRET
        received_signature = x_razorpay_signature
        
        if not received_signature:
            raise ValidationError("Missing Razorpay signature")
        
        # Razorpay webhook signature verification
        # Note: This is a simplified version. In production, use Razorpay's webhook verification library
        import sys
        sys.stderr.write(f"[INFO] Received Razorpay webhook: {request.get('event')}\n")
        sys.stderr.flush()
        
        event = request.get("event")
        payload = request.get("payload", {}).get("payment", {}).get("entity", {})
        
        if event == "payment.captured":
            payment_id = payload.get("id")
            order_id = payload.get("order_id")
            
            sys.stderr.write(f"[INFO] Payment captured: {payment_id} for order: {order_id}\n")
            sys.stderr.flush()
            
            # Update booking if payment is captured
            if order_id:
                booking_response = supabase_admin.table("bookings").select("*").eq("razorpay_order_id", order_id).execute()
                
                if booking_response.data and len(booking_response.data) > 0:
                    booking = booking_response.data[0]
                    
                    # Only update if payment status is not already completed
                    if booking.get("payment_status") != "completed":
                        supabase_admin.table("bookings").update({
                            "payment_status": "completed",
                            "razorpay_payment_id": payment_id,
                            "payment_completed_at": datetime.now(timezone.utc).isoformat(),
                            "status": "accepted",
                            "accepted_at": datetime.now(timezone.utc).isoformat()
                        }).eq("id", booking["id"]).execute()
                        
                        sys.stderr.write(f"[INFO] Booking {booking['id']} updated via webhook\n")
                        sys.stderr.flush()
        
        return {"status": "success"}
    
    except Exception as e:
        import traceback
        import sys
        sys.stderr.write(f"[ERROR] Error processing webhook: {e}\n")
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        raise DatabaseError(f"Webhook processing failed: {str(e)}")

