# Render Deployment Guide

## Issue
Render is trying to run `pip install -r requirements.txt` from the repository root, but `requirements.txt` is located in the `AssistLink-Backend` subdirectory.

## Solution Options

### Option 1: Use render.yaml (Recommended)
A `render.yaml` file has been created in the repository root. This automatically configures Render to:
- Use the `AssistLink-Backend` directory as the root
- Install dependencies from the correct `requirements.txt`
- Start the server with the correct command

**Steps:**
1. Make sure `render.yaml` is committed to your repository
2. In Render dashboard, when creating/updating the service:
   - Select "Apply render.yaml configuration"
   - Render will automatically use the configuration

### Option 2: Manual Configuration in Render Dashboard
If you prefer to configure manually in Render's dashboard:

1. **Root Directory**: Set to `AssistLink-Backend`
   - In Render dashboard → Your Service → Settings
   - Under "Build & Deploy", set "Root Directory" to `AssistLink-Backend`

2. **Build Command**: 
   ```
   pip install -r requirements.txt
   ```

3. **Start Command**:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```

### Option 3: Update Build Command (Quick Fix)
If you can't change the root directory, update the build command to:
```
cd AssistLink-Backend && pip install -r requirements.txt
```

And the start command to:
```
cd AssistLink-Backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Required Environment Variables
Make sure to set these in Render's dashboard (Environment tab):

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://postgres:password@host:5432/postgres?sslmode=require
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=production
CORS_ORIGINS=https://your-frontend-domain.com,https://assistlink.onrender.com
```

## Python Version
Render will use Python 3.13.4 by default. If you need a specific version, you can:
- Set `PYTHON_VERSION` environment variable in Render
- Or specify in `render.yaml` (already configured for 3.11.0)

## Health Check
The service includes a health check endpoint at `/health` which Render can use to verify the service is running.

## Troubleshooting

### Build fails with "requirements.txt not found"
- Make sure the root directory is set to `AssistLink-Backend`
- Or use the `cd AssistLink-Backend &&` prefix in build commands

### Service starts but returns 503
- Check environment variables are set correctly
- Verify database connection (check `/health/db` endpoint)
- Check Render logs for specific error messages

### CORS errors
- Make sure `CORS_ORIGINS` includes your frontend domain
- For local development, include `http://localhost:3000` or your local port

