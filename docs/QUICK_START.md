# Quick Start Guide

## 🚀 Server is Running!

### Access Points

1. **Swagger UI (Interactive API Testing)**
   - URL: http://localhost:8000/docs
   - **This is the main interface for testing APIs**
   - Click "Try it out" on any endpoint to test it
   - Use "Authorize" button (🔒) to add your access token

2. **ReDoc (Alternative Documentation)**
   - URL: http://localhost:8000/redoc
   - Clean, readable API documentation

3. **Health Endpoints**
   - Basic: http://localhost:8000/health
   - Database: http://localhost:8000/health/db

---

## 🎯 Quick Test Flow

### 1. Register a User
- Go to Swagger UI: http://localhost:8000/docs
- Find `POST /api/auth/register`
- Click "Try it out"
- Use this example (Care Recipient):
```json
{
  "email": "test@example.com",
  "password": "Test123!",
  "full_name": "Test User",
  "role": "care_recipient"
}
```
- Click "Execute"
- **Copy the access_token from response**

### 2. Authorize in Swagger
- Click the **"Authorize"** button (🔒) at the top
- Enter: `Bearer YOUR_ACCESS_TOKEN`
- Click "Authorize" → "Close"

### 3. Test Authenticated Endpoints
- Now try `GET /api/auth/me` to see your profile
- Try `GET /api/caregivers` to see available caregivers

---

## 📚 Full Documentation

See **API_TESTING_GUIDE.md** for:
- Complete step-by-step examples
- All endpoint details
- Request/response examples
- Complete user flows

---

## 🛑 Stop Server

Press `Ctrl+C` in the terminal where the server is running.

---

## 🔄 Restart Server

```bash
python run.py
# or
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

