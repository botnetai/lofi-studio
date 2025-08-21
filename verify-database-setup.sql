-- Database Migration Verification Script
-- Run this in your Supabase SQL Editor to verify all migrations are applied correctly

-- Check if all required tables exist
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'artwork', 'videos', 'spaces', 'songs', 'space_messages',
    'user_subscriptions', 'sfx_effects', 'space_sfx'
  )
ORDER BY tablename;

-- Check table structures
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'artwork', 'videos', 'spaces', 'songs', 'space_messages',
    'user_subscriptions', 'sfx_effects', 'space_sfx'
  )
ORDER BY table_name, ordinal_position;

-- Check if reorder_songs function exists
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'reorder_songs';

-- Check indexes
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'artwork', 'videos', 'spaces', 'songs', 'space_messages',
    'user_subscriptions', 'sfx_effects', 'space_sfx'
  )
ORDER BY tablename, indexname;

-- Check constraints
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'artwork', 'videos', 'spaces', 'songs', 'space_messages',
    'user_subscriptions', 'sfx_effects', 'space_sfx'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- Check triggers
SELECT
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'artwork', 'videos', 'spaces', 'songs', 'space_messages',
    'user_subscriptions', 'space_sfx'
  )
ORDER BY event_object_table, trigger_name;

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'artwork', 'videos', 'spaces', 'songs', 'space_messages',
    'user_subscriptions', 'sfx_effects', 'space_sfx'
  )
ORDER BY tablename, policyname;

-- Check SFX seed data (should have 10 effects if migration ran)
SELECT
  category,
  COUNT(*) as effect_count
FROM public.sfx_effects
GROUP BY category
ORDER BY category;

-- Total SFX effects count
SELECT COUNT(*) as total_sfx_effects FROM public.sfx_effects;

-- Check for any potential issues
SELECT
  'Missing pgcrypto extension' as issue
WHERE NOT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
)

UNION ALL

SELECT
  'Missing set_updated_at function' as issue
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = 'set_updated_at'
)

UNION ALL

SELECT
  'Missing reorder_songs function' as issue
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = 'reorder_songs'
)

UNION ALL

SELECT
  'SFX effects table is empty' as issue
WHERE NOT EXISTS (SELECT 1 FROM public.sfx_effects LIMIT 1);

-- Show any RLS issues (tables without RLS enabled)
SELECT
  tablename as "Tables without RLS enabled"
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'artwork', 'videos', 'spaces', 'songs', 'space_messages',
    'user_subscriptions', 'sfx_effects', 'space_sfx'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = pg_tables.tablename
      AND n.nspname = 'public'
      AND c.relrowsecurity = true
  );
