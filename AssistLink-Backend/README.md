# AssistLink Backend API (FastAPI)

Backend API server for AssistLink - A Progressive Web App designed to provide specialized support for individuals with disabilities and elderly people.

## Overview

AssistLink connects care recipients with trained caregivers, with a primary focus on exam assistance for differently-abled individuals and everyday support for elderly users.

**This backend focuses on MVP features:**
1. User registration and profile management
2. Caregiver matching & booking
3. Location tracking
4. Dashboard with recurring and one-time assistance scheduling

## Tech Stack

- **Framework**: FastAPI (Python 3.8+)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Real-time (via client SDK)

## Prerequisites

- Python 3.8 or higher
- pip or poetry
- Supabase account and project
- Supabase project URL and API keys

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AssistLink-Backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   
   Create a `.env` file in the root directory (copy from `.env.example`):
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Database Configuration (Direct PostgreSQL Connection)
   # Option 1: Use full connection string (recommended)
   DATABASE_URL=postgresql://postgres:your_password@db.your-project-ref.supabase.co:5432/postgres?sslmode=require
   
   # Option 2: Use individual components
   # SUPABASE_DB_PASSWORD=your_database_password

   # Server Configuration
   PORT=8000
   HOST=0.0.0.0
   ENVIRONMENT=development

   # CORS Configuration (comma-separated)
   CORS_ORIGINS=http://localhost:3000,http://localhost:5173

   # Video Call Configuration
   VIDEO_CALL_DURATION_SECONDS=15
   ```
   
   **Important**: 
   - Never hardcode credentials. Always use environment variables.
   - `DATABASE_URL` takes precedence if provided, otherwise `SUPABASE_DB_PASSWORD` is required.
   - Get your database password from Supabase Dashboard > Settings > Database.

5. **Set up Supabase Database**
   
   Run the SQL schema from `database/schema.sql` in your Supabase SQL Editor to create all necessary tables, indexes, and RLS policies.

6. **Start the server**
   
   Development mode:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   Production mode:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   API documentation (Swagger UI) will be available at `http://localhost:8000/docs`
   Alternative API documentation (ReDoc) will be available at `http://localhost:8000/redoc`

## MVP Features

### 1. User Registration and Profile Management

- **POST** `/api/auth/register` - Register new user (care_recipient or caregiver)
- **POST** `/api/auth/login` - Login user and get access token
- **GET** `/api/auth/me` - Get current user profile
- **GET** `/api/users/profile` - Get user profile
- **PUT** `/api/users/profile` - Update user profile

### 2. Caregiver Matching & Booking

#### Video Call Flow (15-second video call)
When a care recipient selects a caregiver:
1. **POST** `/api/bookings/video-call/request` - Create video call request (15 seconds)
2. Both parties must accept:
   - **POST** `/api/bookings/video-call/{video_call_id}/accept` - Accept/decline video call
3. After both accept, chat session is created (initially disabled)
4. Both parties must accept to enable chat:
   - **POST** `/api/bookings/chat/{chat_session_id}/enable` - Enable chat session
5. Once chat is enabled, booking can be created:
   - **POST** `/api/bookings` - Create booking with assigned caregiver

#### Caregiver Endpoints
- **GET** `/api/caregivers` - List available caregivers (with filters)
- **GET** `/api/caregivers/{caregiver_id}` - Get caregiver details
- **POST** `/api/caregivers/profile` - Create/update caregiver profile
- **PUT** `/api/caregivers/profile` - Update caregiver profile

### 3. Location Tracking

- **PUT** `/api/location/update` - Update current user location
- **GET** `/api/location/me` - Get current user location

### 4. Dashboard

- **GET** `/api/dashboard/stats` - Get dashboard statistics
- **GET** `/api/dashboard/bookings` - Get bookings (with filters)
- **GET** `/api/dashboard/upcoming` - Get upcoming bookings (next 7 days)
- **GET** `/api/dashboard/recurring` - Get all recurring bookings

#### Booking Management
- **POST** `/api/bookings` - Create booking (one-time or recurring)
- **GET** `/api/bookings/{booking_id}` - Get booking details
- **PATCH** `/api/bookings/{booking_id}` - Update booking

### Chat (Enabled after both parties accept)

- **GET** `/api/chat/sessions` - Get all chat sessions
- **GET** `/api/chat/sessions/{chat_session_id}` - Get chat session details
- **GET** `/api/chat/sessions/{chat_session_id}/messages` - Get messages
- **POST** `/api/chat/sessions/{chat_session_id}/messages` - Send message
- **POST** `/api/chat/sessions/{chat_session_id}/read` - Mark messages as read

## Workflow: Care Recipient Selecting a Caregiver

1. Care recipient browses available caregivers (`GET /api/caregivers`)
2. Care recipient selects a caregiver and creates a video call request (`POST /api/bookings/video-call/request`)
   - Video call duration: 15 seconds
   - Status: `pending`
3. Both care recipient and caregiver receive notification
4. Both parties accept the video call (`POST /api/bookings/video-call/{id}/accept`)
   - When both accept: Status changes to `accepted`
   - Chat session is created (initially disabled)
5. Both parties must accept to enable chat (`POST /api/bookings/chat/{chat_session_id}/enable`)
   - When both accept: `is_enabled = true`
6. Care recipient creates booking (`POST /api/bookings`)
   - Caregiver is automatically assigned
   - Chat is linked to the booking
7. Both parties can now chat (`POST /api/chat/sessions/{id}/messages`)

## Database Schema

The database includes the following main tables for MVP:

- **users** - User profiles (extends Supabase auth.users)
- **caregiver_profile** - Caregiver-specific information
- **video_call_requests** - 15-second video call requests
- **chat_sessions** - Chat sessions (enabled only when both parties accept)
- **bookings** - Service bookings (one-time or recurring)
- **messages** - Messages in enabled chat sessions
- **location** - Stored in users.current_location (JSONB)

See `database/schema.sql` for complete schema definition.

## Authentication

The API uses Supabase Auth for authentication. Clients should:

1. Register/login via `/api/auth/register` or `/api/auth/login`
2. Include the access token in the `Authorization` header: `Bearer <token>`
3. Token is validated automatically via FastAPI dependencies

## Security Features

- Row Level Security (RLS) policies on all tables
- JWT token validation via Supabase Auth
- CORS configuration
- Input validation using Pydantic models
- Role-based access control

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `PORT` | Server port | No (default: 8000) |
| `HOST` | Server host | No (default: 0.0.0.0) |
| `ENVIRONMENT` | Environment (development/production) | No |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | No |
| `VIDEO_CALL_DURATION_SECONDS` | Video call duration | No (default: 15) |

## Project Structure

```
AssistLink-Backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── config.py               # Configuration settings
│   ├── database.py             # Supabase client configuration
│   ├── schemas.py              # Pydantic models
│   ├── dependencies.py         # FastAPI dependencies (auth, etc.)
│   └── routers/
│       ├── __init__.py
│       ├── auth.py             # Authentication routes
│       ├── users.py            # User routes
│       ├── caregivers.py       # Caregiver routes
│       ├── bookings.py         # Booking & video call routes
│       ├── location.py         # Location tracking routes
│       ├── dashboard.py        # Dashboard routes
│       └── chat.py             # Chat routes
├── src/
│   ├── config/
│   │   └── db.py               # Direct PostgreSQL connection (single source of truth)
│   └── test_db_schema.py       # Smoke test script for schema verification
├── database/
│   └── schema.sql              # Database schema (run in Supabase SQL Editor)
├── requirements.txt
├── .env.example
├── run.py                       # Development server script
├── .gitignore
└── README.md
```

## API Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Development

### Running in Development Mode

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The `--reload` flag enables auto-reload on file changes.

### Health Check

The API includes health check endpoints:

**Basic Health Check:**
```bash
GET http://localhost:8000/health
```

**Database Health Check (Canary Endpoint):**
```bash
GET http://localhost:8000/health/db
```

The `/health/db` endpoint is a critical canary endpoint. If it fails, the application should be considered unhealthy. This endpoint:
- Tests database connectivity
- Verifies critical tables exist
- Returns 503 if database is unavailable

### Database Schema Smoke Test

Before running the application, verify your database schema:

```bash
python src/test_db_schema.py
```

This script will:
- Connect to the database
- List all tables in the public schema
- Verify expected tables exist
- Test a simple query

If tables are missing, run `database/schema.sql` in your Supabase SQL Editor.

## Testing

To test the API, you can use:

1. **Swagger UI** - Interactive API documentation at `/docs`
2. **cURL** - Command-line tool
3. **Postman** - API testing tool
4. **Python requests** - Python HTTP library

## Next Steps / Future Enhancements

- [ ] Implement WebRTC video call functionality (currently placeholder URL)
- [ ] Add real-time notifications using Supabase Real-time
- [ ] Add file upload functionality for profile photos
- [ ] Implement push notifications
- [ ] Add comprehensive error logging
- [ ] Write unit and integration tests
- [ ] Set up CI/CD pipeline
- [ ] Add rate limiting
- [ ] Implement caching for frequently accessed data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue on the repository.
