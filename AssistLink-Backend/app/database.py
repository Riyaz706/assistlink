from supabase import create_client, Client
from app.config import settings

# Supabase client for user requests (uses anon key - respects RLS policies)
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

# Supabase admin client for server-side operations (uses service role key - bypasses RLS)
supabase_admin: Client = create_client(
    settings.SUPABASE_URL, 
    settings.SUPABASE_SERVICE_ROLE_KEY
)

