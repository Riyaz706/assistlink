# Profile Photo Storage (Supabase Storage)

Profile photos are stored in the cloud using **Supabase Storage**. The app uploads images via the backend, which saves them to a bucket and saves the public URL in the user's `profile_photo_url` field.

## One-time setup: Create the bucket

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Storage** in the left sidebar.
3. Click **New bucket**.
4. Set:
   - **Name:** `profile-photos` (must match the backend constant).
   - **Public bucket:** **On** (so profile photo URLs are viewable without signed URLs).
5. Click **Create bucket**.

No RLS policies are required for uploads because the backend uses the **service role** client to upload; the bucket only needs to exist and be public for reads.

## Flow

1. User picks a photo in **Edit Profile** → the app sends it to `POST /api/users/profile/photo` (multipart).
2. Backend validates type (JPEG/PNG/WebP/GIF) and size (max 5 MB), uploads to `profile-photos/{user_id}/avatar.{ext}`, and updates `users.profile_photo_url`.
3. The returned URL is shown in the app and persisted in the database.

## Backend

- Endpoint: `POST /api/users/profile/photo` (auth required).
- File form field: `file`.
- Uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from backend `.env`; the same Supabase project as your database.

## Optional: private bucket

If you prefer a **private** bucket, you would:

1. Create the bucket with **Public** off.
2. Use **signed URLs** for reading (e.g. generate short-lived URLs when serving profile photos). The current implementation uses **public** URLs for simplicity.
