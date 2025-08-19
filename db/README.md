# Database Migrations (Supabase)

This folder contains the canonical SQL for the application schema and RLS policies.

Files
- `schema.sql`: Tables, indexes, triggers, constraints
- `policies.sql`: RLS enablement and policies (drop/create for idempotency)
- `migrations/0001_init.sql`: Combined, ordered migration (schema + policies)

Applying on a fresh database
1. In the Supabase SQL editor, paste the contents of `migrations/0001_init.sql` and run
2. Re-running is safe; DDL uses IF NOT EXISTS where possible and DROP POLICY IF EXISTS

Local development
- You can also run the two files separately in order: `schema.sql` first, then `policies.sql`

Notes
- The `spaces_single_background_chk` constraint enforces image XOR video on a space
- `set_updated_at()` trigger keeps `updated_at` current on `songs`, `spaces`, `user_subscriptions`

