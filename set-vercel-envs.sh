#!/usr/bin/env bash
set -euo pipefail

# Optional: set your team scope (from "Linked to botnet/lofi")
SCOPE="botnet"

# 1) Ensure you're linked to the correct Vercel project inside 'web'
cd /Users/jeremycai/Projects/lofi-studio/web
vercel whoami >/dev/null || vercel login
vercel link ${SCOPE:+--scope "$SCOPE"} --yes || true

# 2) Your values
NEXT_PUBLIC_SUPABASE_URL='https://mnngsglhvaaemekasjyu.supabase.co'
NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ubmdzZ2xodmFhZW1la2Fzanl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTk5MjEsImV4cCI6MjA3MTEzNTkyMX0.Cz0LvoE_WeNq7MXcVJgPMCaZI5nEfweUzpsLFQx4gcs'
SUPABASE_SERVICE_ROLE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ubmdzZ2xodmFhZW1la2Fzanl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTU1OTkyMSwiZXhwIjoyMDcxMTM1OTIxfQ.LnBGWULqG0ojEFF73rowuUT-c7GwfPC5vVhQEvOJJcg'

R2_ACCOUNT_ID='599cb66ab5c235bb62eb59dc77ed2f42'
R2_BUCKET='lofi-studio-storage'
R2_ACCESS_KEY_ID='c60c466fe7328f9ab2265284b36a498e'
R2_SECRET_ACCESS_KEY='30d821eaf7c424ae8523893eb71cb9a0c71a62bf7e8e2663c7e0b25a88875b36'
R2_S3_ENDPOINT='https://599cb66ab5c235bb62eb59dc77ed2f42.r2.cloudflarestorage.com/'

ELEVENLABS_API_KEY='sk_8d468261a31f3238d94a59e107a6357e125e8b980a2d4341'
FAL_KEY='f5d1c93d-5364-4117-96f8-a33699e70eb0:4953396aac7b5bd14673003cea767c28'
RESEND_API_KEY='re_XenQDcFQ_2Y2S1CLGzAHdMn4nyPmaTb7X'

STRIPE_SECRET_KEY=''
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=''
STRIPE_WEBHOOK_SECRET=''

APP_ORIGIN='https://lofi.ai'

# 3) Sanitize endpoint (remove trailing slash)
R2_S3_ENDPOINT="${R2_S3_ENDPOINT%/}"

# 4) Helpers
set_one() {
  local key="$1" val="$2" env="$3"
  vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
  printf "%s" "$val" | vercel env add "$key" "$env" >/dev/null
  echo "Set $key ($env)"
}
set_all() {
  local key="$1" dev="$2" prev="$3" prod="$4"
  set_one "$key" "$dev" development
  set_one "$key" "$prev" preview
  set_one "$key" "$prod" production
}

# 5) Apply across environments
set_all NEXT_PUBLIC_SUPABASE_URL "$NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"
set_all NEXT_PUBLIC_SUPABASE_ANON_KEY "$NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
set_all SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"

set_all R2_ACCOUNT_ID "$R2_ACCOUNT_ID" "$R2_ACCOUNT_ID" "$R2_ACCOUNT_ID"
set_all R2_BUCKET "$R2_BUCKET" "$R2_BUCKET" "$R2_BUCKET"
set_all R2_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID" "$R2_ACCESS_KEY_ID" "$R2_ACCESS_KEY_ID"
set_all R2_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY" "$R2_SECRET_ACCESS_KEY" "$R2_SECRET_ACCESS_KEY"
set_all R2_S3_ENDPOINT "$R2_S3_ENDPOINT" "$R2_S3_ENDPOINT" "$R2_S3_ENDPOINT"

set_all ELEVENLABS_API_KEY "$ELEVENLABS_API_KEY" "$ELEVENLABS_API_KEY" "$ELEVENLABS_API_KEY"
set_all FAL_KEY "$FAL_KEY" "$FAL_KEY" "$FAL_KEY"
set_all RESEND_API_KEY "$RESEND_API_KEY" "$RESEND_API_KEY" "$RESEND_API_KEY"

# APP_ORIGIN: dev uses localhost; preview/prod use provided domain
set_all APP_ORIGIN "http://localhost:3000" "$APP_ORIGIN" "$APP_ORIGIN"

# Stripe (only if non-empty)
[ -n "$STRIPE_SECRET_KEY" ] && set_all STRIPE_SECRET_KEY "$STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
[ -n "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" ] && set_all NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
[ -n "$STRIPE_WEBHOOK_SECRET" ] && set_all STRIPE_WEBHOOK_SECRET "$STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"

# 6) Pull to local file for dev
vercel env pull .env.local

echo "✅ Env variables set for development/preview/production and pulled to web/.env.local"
