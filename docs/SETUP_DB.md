# Database Connection Setup

## Using SUPABASE_URL + SUPABASE_DB_PASSWORD (Recommended for Development)

### Step 1: Update your `.env` file

Add or update these variables in your `.env` file:

```env
# Remove or comment out the malformed DATABASE_URL
# DATABASE_URL=...

# Add these instead:
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_DB_PASSWORD=your_database_password
```

### Step 2: Get your values from Supabase

1. **SUPABASE_URL**: 
   - Go to your Supabase project dashboard
   - Settings > API
   - Copy the "Project URL" (e.g., `https://xyzabc123.supabase.co`)

2. **SUPABASE_DB_PASSWORD**:
   - Go to Settings > Database
   - Under "Connection string", click "Reveal" next to the password
   - Or reset it if needed: Settings > Database > Reset database password

### Step 3: Verify your setup

Run the environment check:
```bash
python src/check_env.py
```

Run the smoke test:
```bash
python src/test_db_schema.py
```

## Format Examples

### ✅ Correct format:
```env
SUPABASE_URL=https://aqmzdcxmylbaooymtwri.supabase.co
SUPABASE_DB_PASSWORD=your_password_here
```

### ❌ Wrong format:
```env
SUPABASE_URL=https://aqmzdcxmylbaooymtwri.supabase.co@db.aqmzdcxmylbaooymtwri.supabase.co
```

The URL should only contain your project URL, not the database host.


