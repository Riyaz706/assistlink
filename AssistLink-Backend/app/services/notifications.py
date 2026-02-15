"""
Notification service for creating and managing notifications
"""
from typing import Optional, Dict, Any
from app.database import supabase_admin
from datetime import datetime
import json
import httpx


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """
    Create a notification for a user
    
    Args:
        user_id: UUID of the user to notify
        notification_type: Type of notification (video_call, message, booking, etc.)
        title: Notification title
        body: Notification body/message
        data: Additional data (JSONB) - can include IDs, metadata, etc.
    
    Returns:
        Created notification dict or None if failed
    """
    try:
        import sys
        print(f"\n🔔 CREATING NOTIFICATION", file=sys.stderr, flush=True)
        print(f"User ID: {user_id}", file=sys.stderr, flush=True)
        print(f"Type: {notification_type}", file=sys.stderr, flush=True)
        print(f"Title: {title}", file=sys.stderr, flush=True)
        
        notification_dict = {
            "user_id": str(user_id),
            "type": notification_type,
            "title": title,
            "message": body,
            "is_read": False,
            "data": data or {}
        }
        
        response = supabase_admin.table("notifications").insert(notification_dict).execute()
        
        if response.data and len(response.data) > 0:
            notification = response.data[0]
            print(f"✅ Notification created in database with ID: {notification.get('id')}", file=sys.stderr, flush=True)
            print(f"   User ID: {notification.get('user_id')}", file=sys.stderr, flush=True)
            print(f"   Type: {notification.get('type')}", file=sys.stderr, flush=True)
            # Trigger push notification (async, don't wait)
            print(f"📤 Triggering push notification...", file=sys.stderr, flush=True)
            try:
                push_result = await send_push_notification(user_id, title, body, data)
                print(f"Push notification result: {push_result}", file=sys.stderr, flush=True)
            except Exception as push_error:
                print(f"⚠️ Push notification failed (but in-app notification created): {push_error}", file=sys.stderr, flush=True)
            return notification
        else:
            print(f"❌ Failed to create notification in database - no data returned", file=sys.stderr, flush=True)
            print(f"   Response: {response}", file=sys.stderr, flush=True)
        
        return None
    except Exception as e:
        import sys
        import traceback
        print(f"❌ Error creating notification: {e}", file=sys.stderr, flush=True)
        traceback.print_exc()
        return None


async def send_push_notification(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Send push notification to all user's active devices.
    Supports Expo Push Tokens via Expo Push API and native tokens via Firebase Admin SDK.
    
    Args:
        user_id: UUID of the user
        title: Notification title
        body: Notification body
        data: Additional data payload
    
    Returns:
        True if sent successfully to at least one device, False otherwise
    """
    try:
        import sys
        
        import httpx
        from app.config import settings
        import os
        from pathlib import Path
        
        print(f"\n=== PUSH NOTIFICATION DEBUG ===", file=sys.stderr, flush=True)
        print(f"User ID: {user_id}", file=sys.stderr, flush=True)
        print(f"Title: {title}", file=sys.stderr, flush=True)
        
        # Get all active device tokens for user
        print(f"Fetching devices for user_id: {user_id}", file=sys.stderr, flush=True)
        devices_response = supabase_admin.table("user_devices").select("device_token, platform").eq("user_id", user_id).eq("is_active", True).execute()
        
        if not devices_response.data:
            print("❌ No devices registered for this user", file=sys.stderr, flush=True)
            return False

        devices = devices_response.data
        print(f"Devices found: {len(devices)}", file=sys.stderr, flush=True)
        
        expo_tokens = []
        native_tokens = []

        for device in devices:
            token = device.get("device_token")
            platform = device.get("platform")
            if token and token.startswith("ExponentPushToken"):
                expo_tokens.append(token)
            else:
                native_tokens.append(device)
        
        success = False
        
        # 1. Handle Expo Push Tokens
        if expo_tokens:
            print(f"Sending to {len(expo_tokens)} Expo Push Tokens...", file=sys.stderr, flush=True)
            try:
                message = {
                    "to": expo_tokens,
                    "sound": "default",
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "priority": "high",
                    "badge": 1,
                    "channelId": "default",
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        "https://exp.host/--/api/v2/push/send",
                        json=message,
                        headers={
                            "Accept": "application/json",
                            "Accept-Encoding": "gzip, deflate",
                            "Content-Type": "application/json",
                        }
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        result_data = result.get('data', [])
                        print(f"✅ Expo API Response: {len(result_data)} receipts", file=sys.stderr, flush=True)
                        success = True
                        
                        # Check for errors in individual receipts
                        for i, receipt in enumerate(result_data):
                            if receipt.get('status') == 'error':
                                error_code = receipt.get('details', {}).get('error')
                                print(f"❌ Error sending to token {expo_tokens[i]}: {error_code}", file=sys.stderr, flush=True)
                                if error_code == 'DeviceNotRegistered':
                                    # Deactivate invalid token
                                    supabase_admin.table("user_devices").update({"is_active": False}).eq("device_token", expo_tokens[i]).execute()
                    else:
                        print(f"❌ Expo API Request Failed: {response.status_code} - {response.text}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"❌ Error sending Expo notifications: {e}", file=sys.stderr, flush=True)

        # 2. Handle Native Tokens (Firebase Admin SDK)
        if native_tokens:
            print(f"Process {len(native_tokens)} native tokens (FCM/APNS)...", file=sys.stderr, flush=True)
            # Check if FCM is configured
            service_account_path = settings.FCM_SERVICE_ACCOUNT_PATH
            google_app_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            
            if not service_account_path and not google_app_creds:
                 print("⚠️ FCM NOT CONFIGURED: Neither FCM_SERVICE_ACCOUNT_PATH nor GOOGLE_APPLICATION_CREDENTIALS set.", file=sys.stderr, flush=True)
            else:
                 # Initialize Firebase Admin SDK
                 try:
                    import firebase_admin
                    from firebase_admin import credentials, messaging
                    
                    if not firebase_admin._apps:
                        print(f"🔧 Initializing Firebase Admin SDK...", file=sys.stderr, flush=True)
                        if service_account_path:
                             print(f"   Using service account path: {service_account_path}", file=sys.stderr, flush=True)
                             if not os.path.isabs(service_account_path):
                                 project_root = Path(__file__).parent.parent.parent
                                 service_account_path = str(project_root / service_account_path)
                             
                             if not os.path.exists(service_account_path):
                                 print(f"❌ ERROR: Service account file not found at {service_account_path}", file=sys.stderr, flush=True)
                                 return False
                                 
                             cred = credentials.Certificate(service_account_path)
                             firebase_admin.initialize_app(cred)
                        elif google_app_creds:
                            print(f"   Using Application Default Credentials (ADC)", file=sys.stderr, flush=True)
                            cred = credentials.ApplicationDefault()
                            firebase_admin.initialize_app(cred)
                        print("✅ Firebase Admin SDK initialized successfully.", file=sys.stderr, flush=True)
                    
                    # Send loop for native tokens
                    data_payload = data or {}
                    data_payload["type"] = data.get("type", "general") if data else "general"

                    for device in native_tokens:
                        device_token = device["device_token"]
                        platform = device["platform"]
                        try:
                            if platform == "ios":
                                msg = messaging.Message(
                                    token=device_token,
                                    notification=messaging.Notification(title=title, body=body),
                                    data={str(k): str(v) for k, v in data_payload.items()},
                                    apns=messaging.APNSConfig(payload=messaging.APNSPayload(aps=messaging.Aps(sound="default", badge=1)))
                                )
                            elif platform == "android":
                                msg = messaging.Message(
                                    token=device_token,
                                    notification=messaging.Notification(title=title, body=body),
                                    data={str(k): str(v) for k, v in data_payload.items()},
                                    android=messaging.AndroidConfig(priority="high", notification=messaging.AndroidNotification(sound="default", channel_id="default"))
                                )
                            else: # web
                                msg = messaging.Message(
                                    token=device_token,
                                    notification=messaging.Notification(title=title, body=body),
                                    webpush=messaging.WebpushConfig(notification=messaging.WebpushNotification(title=title, body=body, icon="/icon-192x192.png"))
                                )
                            response = messaging.send(msg)
                            print(f"✅ FCM sent to {platform}: {response}", file=sys.stderr, flush=True)
                            success = True
                        except messaging.UnregisteredError:
                             supabase_admin.table("user_devices").update({"is_active": False}).eq("device_token", device_token).execute()
                        except Exception as e:
                            print(f"❌ FCM Error: {e}", file=sys.stderr, flush=True)
                 except Exception as e:
                    print(f"❌ Firebase Init Error: {e}", file=sys.stderr, flush=True)

        return success
    except Exception as e:
        print(f"❌ Error in send_push_notification: {e}", file=sys.stderr, flush=True)
        import traceback
        traceback.print_exc()
        return False


# Helper functions for specific notification types

async def notify_video_call_request(caregiver_id: str, care_recipient_name: str, video_call_id: str):
    """Notify caregiver about new video call request"""
    return await create_notification(
        user_id=caregiver_id,
        notification_type="video_call",
        title="New Video Call Request",
        body=f"{care_recipient_name} wants to schedule a 15-second video call with you",
        data={
            "video_call_id": video_call_id,
            "action": "view_video_call"
        }
    )


async def notify_video_call_created_for_recipient(care_recipient_id: str, caregiver_name: str, video_call_id: str):
    """Notify care recipient that their video call request was created"""
    return await create_notification(
        user_id=care_recipient_id,
        notification_type="video_call",
        title="Video Call Requested",
        body=f"Your video call request to {caregiver_name} has been created",
        data={
            "video_call_id": video_call_id,
            "action": "view_video_call"
        }
    )


async def notify_video_call_accepted(user_id: str, other_party_name: str, video_call_id: str, is_caregiver: bool):
    """Notify when video call is accepted"""
    role = "caregiver" if is_caregiver else "care recipient"
    return await create_notification(
        user_id=user_id,
        notification_type="video_call",
        title="Video Call Accepted",
        body=f"{other_party_name} ({role}) has accepted the video call request",
        data={
            "video_call_id": video_call_id,
            "action": "view_video_call"
        }
    )


async def notify_video_call_status_change(user_id: str, other_party_name: str, video_call_id: str, status: str):
    """Notify user about video call status updates (e.g., declined)."""
    status_text = "accepted" if status == "accepted" else "declined"
    return await create_notification(
        user_id=user_id,
        notification_type="video_call",
        title="Video Call Update",
        body=f"{other_party_name} has {status_text} the video call request",
        data={
            "video_call_id": video_call_id,
            "status": status,
            "action": "view_video_call"
        }
    )


async def notify_new_message(recipient_id: str, sender_name: str, message_id: str, chat_session_id: str, message_preview: str):
    """Notify user about new message"""
    return await create_notification(
        user_id=recipient_id,
        notification_type="message",
        title=f"New message from {sender_name}",
        body=message_preview[:100],  # First 100 chars
        data={
            "message_id": message_id,
            "chat_session_id": chat_session_id,
            "action": "open_chat"
        }
    )


async def notify_booking_created(caregiver_id: str, care_recipient_name: str, booking_id: str):
    """Notify caregiver about new booking"""
    return await create_notification(
        user_id=caregiver_id,
        notification_type="booking",
        title="New Booking Request",
        body=f"{care_recipient_name} has created a new booking request",
        data={
            "booking_id": booking_id,
            "action": "view_booking"
        }
    )


async def notify_booking_status_change(user_id: str, booking_id: str, status: str, other_party_name: str):
    """Notify user about booking status change"""
    status_messages = {
        "accepted": "has accepted your booking",
        "declined": "has declined your booking",
        "cancelled": "has cancelled the booking",
        "in_progress": "booking has started",
        "completed": "booking has been completed"
    }
    
    message = status_messages.get(status, f"booking status changed to {status}")
    
    return await create_notification(
        user_id=user_id,
        notification_type="booking",
        title="Booking Status Update",
        body=f"{other_party_name} {message}",
        data={
            "booking_id": booking_id,
            "status": status,
            "action": "view_booking"
        }
    )


async def notify_chat_enabled(user_id: str, other_party_name: str, chat_session_id: str):
    """Notify user that chat session is now enabled"""
    return await create_notification(
        user_id=user_id,
        notification_type="chat_session",
        title="Chat Enabled",
        body=f"Chat with {other_party_name} is now enabled. You can start messaging!",
        data={
            "chat_session_id": chat_session_id,
            "action": "open_chat"
        }
    )


async def notify_video_call_joined(user_id: str, other_party_name: str, video_call_id: str):
    """Notify user that the other party has joined the video call"""
    return await create_notification(
        user_id=user_id,
        notification_type="video_call",
        title="Video Call Started",
        body=f"{other_party_name} has joined the video call",
        data={
            "video_call_id": video_call_id,
            "action": "join_call" 
        }
    )


async def notify_booking_reminder(user_id: str, other_party_name: str, booking_id: str, role: str, start_time: str):
    """Send booking reminder 1 hour before start time"""
    return await create_notification(
        user_id=user_id,
        notification_type="booking_reminder",
        title="Upcoming Booking",
        body=f"Your booking with {other_party_name} starts in 1 hour at {start_time}",
        data={
            "booking_id": booking_id,
            "role": role,
            "action": "view_booking"
        }
    )


async def notify_emergency_alert(caregiver_id: str, care_recipient_name: str, emergency_id: str, location: dict = None):
    """Notify caregiver of emergency SOS - HIGH PRIORITY"""
    location_text = ""
    if location:
        lat = location.get("latitude", "")
        lng = location.get("longitude", "")
        if lat and lng:
            location_text = f" at location ({lat}, {lng})"
    
    return await create_notification(
        user_id=caregiver_id,
        notification_type="emergency",
        title="🚨 Emergency Alert",
        body=f"{care_recipient_name} triggered an emergency SOS!{location_text}",
        data={
            "emergency_id": emergency_id,
            "care_recipient_name": care_recipient_name,
            "location": location or {},
            "action": "view_emergency",
            "priority": "high"
        }
    )


async def notify_emergency_acknowledged(care_recipient_id: str, caregiver_name: str, emergency_id: str):
    """Notify care recipient that caregiver acknowledged the emergency"""
    return await create_notification(
        user_id=care_recipient_id,
        notification_type="emergency",
        title="Help is Coming",
        body=f"{caregiver_name} acknowledged your emergency alert and is responding",
        data={
            "emergency_id": emergency_id,
            "caregiver_name": caregiver_name,
            "action": "view_emergency"
        }
    )


async def notify_payment_success(user_id: str, amount: float, payment_id: str, other_party_name: str, is_sender: bool):
    """Notify about successful payment"""
    if is_sender:
        title = "Payment Confirmed"
        body = f"Payment of ${amount:.2f} to {other_party_name} processed successfully"
    else:
        title = "Payment Received"
        body = f"You received ${amount:.2f} from {other_party_name}"
    
    return await create_notification(
        user_id=user_id,
        notification_type="payment",
        title=title,
        body=body,
        data={
            "payment_id": payment_id,
            "amount": amount,
            "is_sender": is_sender,
            "action": "view_payment"
        }
    )


async def notify_payment_received(caregiver_id: str, amount: float, care_recipient_name: str, payment_id: str):
    """Notify caregiver of payment received"""
    return await create_notification(
        user_id=caregiver_id,
        notification_type="payment",
        title="Payment Received",
        body=f"You received ${amount:.2f} from {care_recipient_name}",
        data={
            "payment_id": payment_id,
            "amount": amount,
            "care_recipient_name": care_recipient_name,
            "action": "view_payment"
        }
    )
