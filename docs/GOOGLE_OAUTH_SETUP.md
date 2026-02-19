# Google OAuth Setup with Supabase

## Overview
This document explains how to set up and use Google OAuth authentication with Supabase in the AssistLink backend.

## Prerequisites
1. Google OAuth must be configured in your Supabase project
2. Redirect URLs must be configured in both Google Cloud Console and Supabase

## Backend Endpoints

### 1. Get Google OAuth URL
**Endpoint:** `GET /api/auth/google/url?redirect_to=<your_redirect_url>`

**Description:** Returns the Google OAuth URL that the frontend should redirect to.

**Query Parameters:**
- `redirect_to` (optional): The URL where Google should redirect after authentication. Defaults to `http://localhost:19006` (Expo default).

**Response:**
```json
{
  "url": "https://your-project.supabase.co/auth/v1/authorize?provider=google&redirect_to=...",
  "redirect_to": "http://localhost:19006",
  "provider": "google"
}
```

### 2. Google OAuth Callback
**Endpoint:** `GET /api/auth/google/callback`

**Description:** Handles the OAuth callback from Google. This is mainly for reference - the frontend should handle the callback directly using Supabase client.

### 3. Verify Google Session
**Endpoint:** `POST /api/auth/google/verify`

**Description:** Verifies the session token received from Supabase OAuth and ensures the user profile exists in the database.

**Request Body:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1.xxx..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1.xxx...",
  "token_type": "bearer",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    ...
  }
}
```

## Frontend Integration

### Using Supabase Client (Recommended)

The frontend should use the Supabase client directly for OAuth:

```typescript
import { supabase } from './supabase-client';

// Sign in with Google
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'your-app://callback'
  }
});

// After OAuth callback, Supabase will handle the session
// Extract the session from the URL hash or use:
const { data: { session } } = await supabase.auth.getSession();

// Then verify with backend if needed:
const response = await fetch('http://localhost:8000/api/auth/google/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  })
});
```

## Setup Steps

### 1. Configure Google OAuth in Supabase Dashboard
1. Go to Authentication > Providers in Supabase Dashboard
2. Enable Google provider
3. Add your Google OAuth Client ID and Secret
4. Configure redirect URLs

### 2. Configure Google Cloud Console
1. Go to Google Cloud Console > APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
   - Your app's redirect URLs

### 3. Update Environment Variables
No additional environment variables needed - Supabase handles OAuth configuration.

## Auto-Provisioning
When a user signs in with Google for the first time, the backend automatically:
1. Creates a user profile in the `users` table
2. Extracts name and email from Google profile
3. Sets default role to `care_recipient`
4. Stores profile photo URL if available

## Error Handling
All endpoints include proper error handling and logging. Errors are logged to stderr for debugging.

## Notes
- The backend endpoints are helpers - the actual OAuth flow is handled by Supabase
- User profiles are auto-created on first Google sign-in
- The frontend should use Supabase client for the best OAuth experience

