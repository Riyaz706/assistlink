"""
AssistLink - Complete Backend
Phone OTP Auth (Twilio) + Razorpay + Video Calls + Maps + Real-time Chat
"""
from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import jwt
import bcrypt
import uuid
import os
import random
from database import db, init_db
from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VideoGrant

app = FastAPI(
    title="AssistLink API - Phone Auth",
    description="AssistLink with Phone Number OTP Authentication",
    version="3.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
security = HTTPBearer()
SECRET_KEY = os.getenv("SECRET_KEY")
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

# Twilio Config
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_API_KEY_SID = os.getenv("TWILIO_API_KEY_SID")
TWILIO_API_KEY_SECRET = os.getenv("TWILIO_API_KEY_SECRET")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# OTP storage (in production, use Redis)
otp_storage: Dict[str, Dict] = {}

# Models
class PhoneRegister(BaseModel):
    phone: str
    full_name: str
    role: str  # care_recipient or caregiver
    email: Optional[str] = None

class SendOTP(BaseModel):
    phone: str

class VerifyOTP(BaseModel):
    phone: str
    otp: str

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None

class VideoCallRequest(BaseModel):
    caregiver_id: str
    duration_seconds: int = 15

class ChatMessage(BaseModel):
    chat_session_id: str
    message: str

class PaymentOrder(BaseModel):
    amount: float
    currency: str = "INR"
    booking_id: Optional[str] = None

# Helper functions
def generate_otp() -> str:
    """Generate 6-digit OTP"""
    return str(random.randint(100000, 999999))

def create_token(user_id: str) -> str:
    return jwt.encode({"user_id": user_id, "exp": datetime.utcnow() + timedelta(days=30)}, SECRET_KEY, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user = await db.users.find_one({"user_id": payload.get("user_id")})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

# Startup
@app.on_event("startup")
async def startup():
    await init_db()
    print("🚀 AssistLink API Started - Phone OTP Auth")
    print("✅ MongoDB Ready")
    print("✅ Twilio SMS OTP Ready")
    print("✅ Twilio Video Calls Ready")
    print("✅ Real-time Chat Ready")
    print("✅ Location Tracking Ready")
    print("✅ Razorpay Payments Ready")

@app.get("/")
async def root():
    return {
        "message": "AssistLink API - Phone OTP Authentication",
        "version": "3.1.0",
        "features": [
            "Phone OTP Login (Twilio SMS)",
            "Twilio Video Calls",
            "Real-time Chat",
            "Location Tracking",
            "Razorpay Payments",
            "MongoDB"
        ],
        "status": "running"
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "database": "mongodb",
        "auth": "phone_otp",
        "sms": "twilio",
        "payment": "razorpay",
        "video": "twilio",
        "realtime": "websocket",
        "location": "enabled"
    }

# === PHONE OTP AUTHENTICATION ===
@app.post("/api/auth/send-otp")
async def send_otp(request: SendOTP):
    """Send OTP to phone number via Twilio SMS"""
    phone = request.phone
    
    # Generate OTP
    otp = generate_otp()
    
    # Store OTP with expiry (5 minutes)
    otp_storage[phone] = {
        "otp": otp,
        "expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
        "attempts": 0
    }
    
    # Send SMS via Twilio
    try:
        message = twilio_client.messages.create(
            body=f"Your AssistLink verification code is: {otp}. Valid for 5 minutes.",
            from_=TWILIO_PHONE_NUMBER,
            to=phone
        )
        
        return {
            "message": "OTP sent successfully",
            "phone": phone,
            "expires_in_minutes": 5,
            "message_sid": message.sid
        }
    except Exception as e:
        # For testing without Twilio phone number configured
        print(f"OTP for {phone}: {otp}")
        return {
            "message": "OTP generated (check server logs in test mode)",
            "phone": phone,
            "expires_in_minutes": 5,
            "test_mode": True,
            "otp": otp  # Remove in production!
        }

@app.post("/api/auth/verify-otp")
async def verify_otp(request: VerifyOTP):
    """Verify OTP and login/register user"""
    phone = request.phone
    otp = request.otp
    
    # Check if OTP exists
    if phone not in otp_storage:
        raise HTTPException(status_code=400, detail="OTP not found or expired. Request new OTP.")
    
    stored_data = otp_storage[phone]
    
    # Check expiry
    if datetime.utcnow() > datetime.fromisoformat(stored_data["expires_at"]):
        del otp_storage[phone]
        raise HTTPException(status_code=400, detail="OTP expired. Request new OTP.")
    
    # Check attempts
    if stored_data["attempts"] >= 3:
        del otp_storage[phone]
        raise HTTPException(status_code=400, detail="Too many attempts. Request new OTP.")
    
    # Verify OTP
    if stored_data["otp"] != otp:
        otp_storage[phone]["attempts"] += 1
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # OTP verified - clear it
    del otp_storage[phone]
    
    # Check if user exists
    user = await db.users.find_one({"phone": phone})
    
    if not user:
        # New user - need to complete registration
        return {
            "status": "new_user",
            "message": "Phone verified. Please complete registration.",
            "phone": phone,
            "requires_registration": True
        }
    
    # Existing user - login
    token = create_token(user["user_id"])
    return {
        "status": "success",
        "message": "Login successful",
        "access_token": token,
        "user": {
            "user_id": user["user_id"],
            "phone": user["phone"],
            "full_name": user["full_name"],
            "role": user["role"],
            "email": user.get("email")
        }
    }

@app.post("/api/auth/register")
async def register_phone(user: PhoneRegister):
    """Complete registration after OTP verification"""
    # Check if user already exists
    existing = await db.users.find_one({"phone": user.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user_doc = {
        "user_id": user_id,
        "phone": user.phone,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "auth_provider": "phone",
        "created_at": datetime.utcnow().isoformat(),
        "location": None
    }
    
    await db.users.insert_one(user_doc)
    
    # Create caregiver profile if needed
    if user.role == "caregiver":
        await db.caregivers.insert_one({
            "caregiver_id": str(uuid.uuid4()),
            "user_id": user_id,
            "skills": [],
            "experience_years": 0,
            "hourly_rate": 0,
            "availability_status": "available",
            "rating": 0,
            "total_bookings": 0
        })
    
    token = create_token(user_id)
    return {
        "status": "success",
        "message": "Registration successful",
        "access_token": token,
        "user": {
            "user_id": user_id,
            "phone": user.phone,
            "full_name": user.full_name,
            "role": user.role,
            "email": user.email
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "phone": current_user["phone"],
        "email": current_user.get("email"),
        "full_name": current_user["full_name"],
        "role": current_user["role"],
        "location": current_user.get("location")
    }

# === TWILIO VIDEO CALLS ===
@app.post("/api/video/create-room")
async def create_video_room(request: VideoCallRequest, current_user = Depends(get_current_user)):
    """Create Twilio video room for 15-second verification call"""
    room_name = f"verify_{current_user['user_id']}_{request.caregiver_id}_{uuid.uuid4().hex[:8]}"
    
    try:
        room = twilio_client.video.rooms.create(
            unique_name=room_name,
            type='peer-to-peer',
            max_participants=2
        )
        
        video_call_id = str(uuid.uuid4())
        await db.video_calls.insert_one({
            "video_call_id": video_call_id,
            "room_sid": room.sid,
            "room_name": room_name,
            "care_recipient_id": current_user["user_id"],
            "caregiver_id": request.caregiver_id,
            "duration_seconds": request.duration_seconds,
            "status": "created",
            "created_at": datetime.utcnow().isoformat()
        })
        
        return {
            "video_call_id": video_call_id,
            "room_sid": room.sid,
            "room_name": room_name,
            "duration_seconds": request.duration_seconds
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create video room: {str(e)}")

@app.get("/api/video/token/{room_name}")
async def get_video_token(room_name: str, current_user = Depends(get_current_user)):
    """Generate Twilio access token for video call"""
    try:
        token = AccessToken(
            TWILIO_ACCOUNT_SID,
            TWILIO_API_KEY_SID,
            TWILIO_API_KEY_SECRET,
            identity=current_user["user_id"]
        )
        
        video_grant = VideoGrant(room=room_name)
        token.add_grant(video_grant)
        
        return {
            "token": token.to_jwt(),
            "identity": current_user["user_id"],
            "room_name": room_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate token: {str(e)}")

@app.post("/api/video/{video_call_id}/complete")
async def complete_video_call(video_call_id: str, current_user = Depends(get_current_user)):
    await db.video_calls.update_one(
        {"video_call_id": video_call_id},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow().isoformat()}}
    )
    return {"status": "completed"}

# === LOCATION TRACKING ===
@app.post("/api/location/update")
async def update_location(location: LocationUpdate, current_user = Depends(get_current_user)):
    location_data = {
        "latitude": location.latitude,
        "longitude": location.longitude,
        "address": location.address,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"location": location_data}}
    )
    
    await db.location.insert_one({
        "location_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        **location_data
    })
    
    return {"message": "Location updated", "location": location_data}

@app.get("/api/location/{user_id}")
async def get_user_location(user_id: str, current_user = Depends(get_current_user)):
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": user_id, "location": user.get("location")}

@app.get("/api/caregivers/nearby")
async def get_nearby_caregivers(
    latitude: float,
    longitude: float,
    radius_km: float = 10,
    current_user = Depends(get_current_user)
):
    caregivers = await db.caregivers.find({"availability_status": "available"}).limit(50).to_list(50)
    nearby = []
    
    for cg in caregivers:
        user = await db.users.find_one({"user_id": cg["user_id"]})
        if user and user.get("location"):
            nearby.append({
                "caregiver_id": cg["caregiver_id"],
                "full_name": user["full_name"],
                "phone": user["phone"],
                "location": user["location"],
                "skills": cg.get("skills", []),
                "hourly_rate": cg.get("hourly_rate", 0),
                "rating": cg.get("rating", 0)
            })
    
    return nearby

# === REAL-TIME CHAT ===
@app.websocket("/api/chat/ws/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    await websocket.accept()
    active_connections[user_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            
            message_id = str(uuid.uuid4())
            await db.messages.insert_one({
                "message_id": message_id,
                "chat_session_id": data.get("chat_session_id"),
                "sender_id": user_id,
                "message": data.get("message"),
                "created_at": datetime.utcnow().isoformat()
            })
            
            recipient_id = data.get("recipient_id")
            if recipient_id in active_connections:
                await active_connections[recipient_id].send_json({
                    "message_id": message_id,
                    "sender_id": user_id,
                    "message": data.get("message"),
                    "timestamp": datetime.utcnow().isoformat()
                })
    
    except WebSocketDisconnect:
        del active_connections[user_id]

@app.post("/api/chat/create")
async def create_chat_session(recipient_id: str, current_user = Depends(get_current_user)):
    chat_session_id = str(uuid.uuid4())
    await db.chat_sessions.insert_one({
        "chat_session_id": chat_session_id,
        "participants": [current_user["user_id"], recipient_id],
        "created_at": datetime.utcnow().isoformat(),
        "is_enabled": True
    })
    return {"chat_session_id": chat_session_id}

@app.post("/api/chat/send")
async def send_message(message: ChatMessage, current_user = Depends(get_current_user)):
    message_id = str(uuid.uuid4())
    msg_doc = {
        "message_id": message_id,
        "chat_session_id": message.chat_session_id,
        "sender_id": current_user["user_id"],
        "message": message.message,
        "created_at": datetime.utcnow().isoformat()
    }
    await db.messages.insert_one(msg_doc)
    return msg_doc

@app.get("/api/chat/{chat_session_id}/messages")
async def get_messages(chat_session_id: str, current_user = Depends(get_current_user)):
    messages = await db.messages.find({"chat_session_id": chat_session_id}).sort("created_at", 1).limit(100).to_list(100)
    for m in messages:
        m["_id"] = str(m["_id"])
    return messages

# === NOTIFICATIONS ===
@app.post("/api/notifications/send")
async def send_notification(recipient_id: str, title: str, message: str, current_user = Depends(get_current_user)):
    notification_id = str(uuid.uuid4())
    await db.notifications.insert_one({
        "notification_id": notification_id,
        "recipient_id": recipient_id,
        "title": title,
        "message": message,
        "is_read": False,
        "created_at": datetime.utcnow().isoformat()
    })
    return {"notification_id": notification_id, "status": "sent"}

@app.get("/api/notifications")
async def get_notifications(current_user = Depends(get_current_user)):
    notifications = await db.notifications.find({"recipient_id": current_user["user_id"]}).sort("created_at", -1).limit(50).to_list(50)
    for n in notifications:
        n["_id"] = str(n["_id"])
    return notifications

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user = Depends(get_current_user)):
    await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"is_read": True}}
    )
    return {"status": "read"}

# === RAZORPAY PAYMENTS ===
@app.post("/api/payments/create-order")
async def create_payment_order(payment: PaymentOrder, current_user = Depends(get_current_user)):
    import razorpay
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    
    order_data = {
        "amount": int(payment.amount * 100),
        "currency": payment.currency,
        "receipt": f"order_{uuid.uuid4()}",
        "notes": {"user_id": current_user["user_id"], "booking_id": payment.booking_id or ""}
    }
    
    order = client.order.create(data=order_data)
    
    await db.payments.insert_one({
        "payment_id": str(uuid.uuid4()),
        "razorpay_order_id": order["id"],
        "user_id": current_user["user_id"],
        "amount": payment.amount,
        "currency": payment.currency,
        "status": "created",
        "created_at": datetime.utcnow().isoformat()
    })
    
    return {"order_id": order["id"], "amount": payment.amount, "currency": payment.currency, "key_id": RAZORPAY_KEY_ID}

@app.get("/api/payments/history")
async def payment_history(current_user = Depends(get_current_user)):
    payments = await db.payments.find({"user_id": current_user["user_id"]}).limit(50).to_list(50)
    for p in payments:
        p["_id"] = str(p["_id"])
    return payments

# === CAREGIVERS ===
@app.get("/api/caregivers")
async def list_caregivers():
    caregivers = await db.caregivers.find().limit(50).to_list(50)
    result = []
    for cg in caregivers:
        user = await db.users.find_one({"user_id": cg["user_id"]})
        if user:
            result.append({
                "caregiver_id": cg["caregiver_id"],
                "full_name": user["full_name"],
                "phone": user["phone"],
                "skills": cg.get("skills", []),
                "experience_years": cg.get("experience_years", 0),
                "hourly_rate": cg.get("hourly_rate", 0),
                "rating": cg.get("rating", 0),
                "availability_status": cg.get("availability_status", "available"),
                "location": user.get("location")
            })
    return result

# === BOOKINGS ===
@app.post("/api/bookings")
async def create_booking(
    service_type: str,
    scheduled_date: str,
    caregiver_id: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    booking_id = str(uuid.uuid4())
    await db.bookings.insert_one({
        "booking_id": booking_id,
        "care_recipient_id": current_user["user_id"],
        "caregiver_id": caregiver_id,
        "service_type": service_type,
        "scheduled_date": scheduled_date,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat()
    })
    return {"booking_id": booking_id, "status": "pending"}

@app.get("/api/bookings")
async def get_bookings(current_user = Depends(get_current_user)):
    if current_user["role"] == "care_recipient":
        bookings = await db.bookings.find({"care_recipient_id": current_user["user_id"]}).limit(100).to_list(100)
    else:
        bookings = await db.bookings.find({"caregiver_id": current_user["user_id"]}).limit(100).to_list(100)
    
    for b in bookings:
        b["_id"] = str(b["_id"])
    return bookings

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user = Depends(get_current_user)):
    if current_user["role"] == "care_recipient":
        total = await db.bookings.count_documents({"care_recipient_id": current_user["user_id"]})
        pending = await db.bookings.count_documents({"care_recipient_id": current_user["user_id"], "status": "pending"})
    else:
        total = await db.bookings.count_documents({"caregiver_id": current_user["user_id"]})
        pending = await db.bookings.count_documents({"caregiver_id": current_user["user_id"], "status": "pending"})
    
    return {"total_bookings": total, "pending_bookings": pending}
