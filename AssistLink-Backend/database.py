"""MongoDB Database Configuration"""
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import os
from datetime import datetime

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "assistlink")

# Async MongoDB client (for FastAPI)
client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]

# Sync MongoDB client (for non-async operations)
sync_client = MongoClient(MONGO_URL)
sync_db = sync_client[DATABASE_NAME]

# Collections
users_collection = db.users
caregivers_collection = db.caregivers
bookings_collection = db.bookings
video_calls_collection = db.video_calls
chat_sessions_collection = db.chat_sessions
messages_collection = db.messages
notifications_collection = db.notifications
location_collection = db.location

def get_db():
    """Get database instance"""
    return db

async def init_db():
    """Initialize database with indexes"""
    # Users indexes - phone is unique, email is optional
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("user_id", unique=True)
    # Remove email unique index if exists
    try:
        await db.users.drop_index("email_1")
    except:
        pass
    
    # Caregivers indexes
    await db.caregivers.create_index("caregiver_id", unique=True)
    await db.caregivers.create_index("user_id")
    
    # Bookings indexes
    await db.bookings.create_index("booking_id", unique=True)
    await db.bookings.create_index("care_recipient_id")
    await db.bookings.create_index("caregiver_id")
    
    # Video calls indexes
    await db.video_calls.create_index("video_call_id", unique=True)
    
    # Chat sessions indexes
    await db.chat_sessions.create_index("chat_session_id", unique=True)
    
    # Messages indexes
    await db.messages.create_index("message_id", unique=True)
    await db.messages.create_index("chat_session_id")
    
    # Notifications indexes
    await db.notifications.create_index("notification_id", unique=True)
    await db.notifications.create_index("user_id")
    
    print("✅ MongoDB indexes created successfully")
