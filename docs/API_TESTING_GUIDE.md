# AssistLink Backend API - Step-by-Step Testing Guide

## 🚀 Server Access

Once the server is running, access:

- **Swagger UI (Interactive API Docs)**: http://localhost:8000/docs
- **ReDoc (Alternative Docs)**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **Database Health**: http://localhost:8000/health/db

---

## 📋 Step-by-Step API Testing Examples

### Step 1: User Registration

**Endpoint**: `POST /api/auth/register`

**Request Body** (Care Recipient):
```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "phone": "+1234567890",
  "date_of_birth": "1990-01-15T00:00:00",
  "role": "care_recipient",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  }
}
```

**Request Body** (Caregiver):
```json
{
  "email": "jane.caregiver@example.com",
  "password": "SecurePass123!",
  "full_name": "Jane Smith",
  "phone": "+1234567891",
  "date_of_birth": "1985-05-20T00:00:00",
  "role": "caregiver",
  "address": {
    "street": "456 Oak Ave",
    "city": "New York",
    "state": "NY",
    "zip": "10002"
  }
}
```

**Response** (201 Created):
```json
{
  "id": "uuid-here",
  "email": "john.doe@example.com",
  "full_name": "John Doe",
  "role": "care_recipient",
  "is_active": true,
  "created_at": "2025-01-15T10:30:00Z"
}
```

**In Swagger UI:**
1. Expand `POST /api/auth/register`
2. Click "Try it out"
3. Paste the JSON in the request body
4. Click "Execute"
5. Copy the `access_token` from response (if provided)

---

### Step 2: User Login

**Endpoint**: `POST /api/auth/login`

**Request Body** (JSON):
```json
{
  "email": "test1@testmail.com",
  "password": "SecurePass123!"
}
```

**Important**: Use the **Request body** section in Swagger UI, NOT query parameters.

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh-token-here",
  "token_type": "bearer",
  "user": {
    "id": "uuid-here",
    "email": "john.doe@example.com"
  }
}
```

**Important**: Copy the `access_token` - you'll need it for authenticated requests!

**In Swagger UI:**
1. Expand `POST /api/auth/login`
2. Click "Try it out"
3. Enter email and password
4. Click "Execute"
5. Copy the `access_token`

---

### Step 3: Set Up Authentication in Swagger UI

**To use authenticated endpoints:**

1. Click the **"Authorize"** button at the top of Swagger UI (🔒 icon)
2. In the "Value" field, enter: `Bearer YOUR_ACCESS_TOKEN`
   - Example: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. Click **"Authorize"**
4. Click **"Close"**
5. Now all authenticated endpoints will use this token automatically

---

### Step 4: Get Current User Profile

**Endpoint**: `GET /api/auth/me`

**Headers** (if not using Swagger Authorize):
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid-here",
    "email": "john.doe@example.com",
    "full_name": "John Doe",
    "role": "care_recipient",
    "phone": "+1234567890",
    "is_active": true,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

---

### Step 5: Update User Profile

**Endpoint**: `PUT /api/users/profile`

**Request Body**:
```json
{
  "full_name": "John Updated Doe",
  "phone": "+1234567899",
  "address": {
    "street": "789 New St",
    "city": "Boston",
    "state": "MA",
    "zip": "02101"
  }
}
```

**Response** (200 OK):
```json
{
  "id": "uuid-here",
  "email": "john.doe@example.com",
  "full_name": "John Updated Doe",
  "phone": "+1234567899",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

---

### Step 6: Create Caregiver Profile (For Caregivers Only)

**Endpoint**: `POST /api/caregivers/profile`

**Request Body**:
```json
{
  "skills": ["exam_assistance", "elderly_care", "mobility_support"],
  "availability_status": "available",
  "availability_schedule": {
    "monday": {"start": "09:00", "end": "17:00"},
    "tuesday": {"start": "09:00", "end": "17:00"},
    "wednesday": {"start": "09:00", "end": "17:00"},
    "thursday": {"start": "09:00", "end": "17:00"},
    "friday": {"start": "09:00", "end": "17:00"}
  },
  "qualifications": ["NSS Volunteer", "First Aid Certified"],
  "experience_years": 3,
  "bio": "Experienced caregiver specializing in exam assistance and elderly care.",
  "hourly_rate": 25.00
}
```

**Response** (201 Created):
```json
{
  "id": "profile-uuid",
  "user_id": "caregiver-uuid",
  "skills": ["exam_assistance", "elderly_care", "mobility_support"],
  "availability_status": "available",
  "avg_rating": 0.00,
  "total_reviews": 0,
  "created_at": "2025-01-15T11:00:00Z"
}
```

---

### Step 7: List Available Caregivers

**Endpoint**: `GET /api/caregivers`

**Query Parameters** (optional):
- `availability_status`: `available`, `unavailable`, or `busy`
- `min_rating`: Minimum rating (0-5)
- `skills`: Comma-separated list (e.g., `exam_assistance,elderly_care`)
- `limit`: Number of results (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)

**Example Request**:
```
GET /api/caregivers?availability_status=available&min_rating=4.0&limit=10
```

**Response** (200 OK):
```json
{
  "caregivers": [
    {
      "id": "caregiver-uuid",
      "email": "jane.caregiver@example.com",
      "full_name": "Jane Smith",
      "role": "caregiver",
      "caregiver_profile": {
        "skills": ["exam_assistance", "elderly_care"],
        "availability_status": "available",
        "avg_rating": 4.5,
        "total_reviews": 10,
        "hourly_rate": 25.00
      }
    }
  ],
  "count": 1
}
```

---

### Step 8: Create Video Call Request (15-second call)

**Endpoint**: `POST /api/bookings/video-call/request`

**Request Body**:
```json
{
  "caregiver_id": "caregiver-uuid-here",
  "scheduled_time": "2025-01-20T14:00:00Z",
  "duration_seconds": 15
}
```

**Response** (201 Created):
```json
{
  "id": "video-call-uuid",
  "care_recipient_id": "your-user-id",
  "caregiver_id": "caregiver-uuid",
  "scheduled_time": "2025-01-20T14:00:00Z",
  "duration_seconds": 15,
  "status": "pending",
  "care_recipient_accepted": false,
  "caregiver_accepted": false,
  "video_call_url": "https://video-call.assistlink.app/uuid-here",
  "created_at": "2025-01-15T11:00:00Z"
}
```

**Note**: This creates a 15-second video call request. Both parties must accept.

---

### Step 9: Accept Video Call Request

**Endpoint**: `POST /api/bookings/video-call/{video_call_id}/accept`

**Path Parameter**: `video_call_id` (from Step 8 response)

**Request Body**:
```json
{
  "accept": true
}
```

**Response** (200 OK):
```json
{
  "id": "video-call-uuid",
  "status": "accepted",
  "care_recipient_accepted": true,
  "caregiver_accepted": true,
  "updated_at": "2025-01-15T11:05:00Z"
}
```

**Important**: 
- Care recipient accepts first
- Then caregiver accepts
- When both accept, status becomes "accepted" and chat session is created

---

### Step 10: Enable Chat Session

**Endpoint**: `POST /api/bookings/chat/{chat_session_id}/enable`

**Path Parameter**: `chat_session_id` (created automatically after video call acceptance)

**Request Body**:
```json
{
  "accept": true
}
```

**Response** (200 OK):
```json
{
  "id": "chat-session-uuid",
  "care_recipient_id": "user-uuid",
  "caregiver_id": "caregiver-uuid",
  "is_enabled": true,
  "care_recipient_accepted": true,
  "caregiver_accepted": true,
  "enabled_at": "2025-01-15T11:10:00Z"
}
```

**Note**: Both parties must accept to enable chat. Chat is only enabled when `is_enabled: true`.

---

### Step 11: Create Booking

**Endpoint**: `POST /api/bookings`

**Request Body** (One-time booking):
```json
{
  "caregiver_id": "caregiver-uuid-here",
  "service_type": "exam_assistance",
  "scheduled_date": "2025-01-25T09:00:00Z",
  "duration_hours": 3.0,
  "location": {
    "address": "123 Exam Hall, University Campus",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "specific_needs": "Need assistance with writing and reading exam questions",
  "is_recurring": false
}
```

**Request Body** (Recurring booking):
```json
{
  "caregiver_id": "caregiver-uuid-here",
  "service_type": "daily_care",
  "scheduled_date": "2025-01-20T09:00:00Z",
  "duration_hours": 2.0,
  "location": {
    "address": "123 Main St, New York, NY",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "specific_needs": "Daily assistance with medication and meal preparation",
  "is_recurring": true,
  "recurring_pattern": {
    "frequency": "daily",
    "days_of_week": [1, 2, 3, 4, 5],
    "end_date": "2025-06-30T00:00:00Z"
  }
}
```

**Response** (201 Created):
```json
{
  "id": "booking-uuid",
  "care_recipient_id": "user-uuid",
  "caregiver_id": "caregiver-uuid",
  "service_type": "exam_assistance",
  "scheduled_date": "2025-01-25T09:00:00Z",
  "duration_hours": 3.0,
  "status": "pending",
  "is_recurring": false,
  "created_at": "2025-01-15T11:15:00Z"
}
```

---

### Step 12: Update Location

**Endpoint**: `PUT /api/location/update`

**Request Body**:
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "address": "123 Main Street, New York, NY 10001"
}
```

**Response** (200 OK):
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "address": "123 Main Street, New York, NY 10001",
  "timestamp": "2025-01-15T11:20:00Z"
}
```

---

### Step 13: Get Dashboard Statistics

**Endpoint**: `GET /api/dashboard/stats`

**Response** (200 OK):
```json
{
  "upcoming_bookings": 3,
  "active_bookings": 1,
  "completed_bookings": 5,
  "pending_video_calls": 1,
  "active_chat_sessions": 2
}
```

---

### Step 14: Get Dashboard Bookings

**Endpoint**: `GET /api/dashboard/bookings`

**Query Parameters** (optional):
- `status`: Filter by status (`pending`, `accepted`, `completed`, etc.)
- `is_recurring`: `true` or `false`
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

**Example Request**:
```
GET /api/dashboard/bookings?status=pending&limit=10
```

**Response** (200 OK):
```json
[
  {
    "id": "booking-uuid",
    "service_type": "exam_assistance",
    "scheduled_date": "2025-01-25T09:00:00Z",
    "status": "pending",
    "caregiver": {
      "full_name": "Jane Smith",
      "email": "jane.caregiver@example.com"
    }
  }
]
```

---

### Step 15: Send a Message (After Chat is Enabled)

**Endpoint**: `POST /api/chat/sessions/{chat_session_id}/messages`

**Path Parameter**: `chat_session_id` (from Step 10)

**Request Body**:
```json
{
  "content": "Hello! Looking forward to our session tomorrow.",
  "message_type": "text"
}
```

**Response** (201 Created):
```json
{
  "id": "message-uuid",
  "chat_session_id": "chat-session-uuid",
  "sender_id": "user-uuid",
  "recipient_id": "caregiver-uuid",
  "content": "Hello! Looking forward to our session tomorrow.",
  "message_type": "text",
  "created_at": "2025-01-15T11:25:00Z"
}
```

**Note**: Chat must be enabled (both parties accepted) before messages can be sent.

---

### Step 16: Get Messages

**Endpoint**: `GET /api/chat/sessions/{chat_session_id}/messages`

**Query Parameters** (optional):
- `limit`: Number of messages (default: 50, max: 100)
- `offset`: Pagination offset (default: 0)

**Response** (200 OK):
```json
[
  {
    "id": "message-uuid-1",
    "sender_id": "user-uuid",
    "content": "Hello!",
    "message_type": "text",
    "created_at": "2025-01-15T11:25:00Z"
  },
  {
    "id": "message-uuid-2",
    "sender_id": "caregiver-uuid",
    "content": "Hi! I'm ready to help.",
    "message_type": "text",
    "created_at": "2025-01-15T11:26:00Z"
  }
]
```

---

## 🔄 Complete User Flow Example

### As a Care Recipient:

1. **Register**: `POST /api/auth/register` (role: `care_recipient`)
2. **Login**: `POST /api/auth/login` → Get `access_token`
3. **Authorize in Swagger**: Click "Authorize" → Enter `Bearer YOUR_TOKEN`
4. **Update Profile**: `PUT /api/users/profile`
5. **Browse Caregivers**: `GET /api/caregivers`
6. **Request Video Call**: `POST /api/bookings/video-call/request`
7. **Accept Video Call**: `POST /api/bookings/video-call/{id}/accept`
8. **Enable Chat**: `POST /api/bookings/chat/{id}/enable`
9. **Create Booking**: `POST /api/bookings`
10. **Send Message**: `POST /api/chat/sessions/{id}/messages`

### As a Caregiver:

1. **Register**: `POST /api/auth/register` (role: `caregiver`)
2. **Login**: `POST /api/auth/login` → Get `access_token`
3. **Create Profile**: `POST /api/caregivers/profile`
4. **Accept Video Call**: `POST /api/bookings/video-call/{id}/accept`
5. **Enable Chat**: `POST /api/bookings/chat/{id}/enable`
6. **View Bookings**: `GET /api/dashboard/bookings`
7. **Send Message**: `POST /api/chat/sessions/{id}/messages`

---

## 🧪 Testing Tips

1. **Use Swagger UI**: Interactive testing at http://localhost:8000/docs
2. **Copy Tokens**: Save access tokens for authenticated requests
3. **Check Responses**: Look for error messages in response body
4. **Test Both Roles**: Create accounts for both `care_recipient` and `caregiver`
5. **Follow the Flow**: Complete the full flow (video call → chat → booking)

---

## 📝 Common Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input/data
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource doesn't exist
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Database unavailable

---

## 🔗 Quick Links

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **DB Health**: http://localhost:8000/health/db

