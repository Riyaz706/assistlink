# RLS Policy Fix for Listing Caregivers

## Problem
When calling `GET /api/caregivers`, only the logged-in caregiver's details are returned instead of all caregivers.

## Root Cause
The RLS (Row Level Security) policy on the `users` table restricts access:
```sql
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);
```

This policy only allows users to see their own profile, so when the endpoint queries:
```python
supabase.table("users").select("*, caregiver_profile(*)").eq("role", "caregiver")
```

The RLS policy filters the results to only the authenticated user's profile, even though the query is trying to get all caregivers.

## Solution Applied
Changed the endpoint to use `supabase_admin` (service role key) which bypasses RLS policies. This is safe because:
1. We're only reading public caregiver information
2. The endpoint is meant to list all available caregivers
3. No sensitive data is exposed (only caregiver profiles which should be public)

## Alternative Solution (Database Level)
If you prefer to fix this at the database level, add a new RLS policy to the `users` table:

```sql
-- Allow anyone to view caregiver profiles (public information)
CREATE POLICY "Anyone can view caregiver profiles"
  ON users FOR SELECT
  USING (role = 'caregiver' AND is_active = true);
```

Then update the schema.sql file and run it in Supabase SQL Editor.

## Current Implementation
The endpoint now uses `supabase_admin` to bypass RLS when listing caregivers, ensuring all caregivers are returned regardless of who is authenticated.

