#!/usr/bin/env bash
set -euo pipefail

# Optional: set your team scope (from "Linked to botnet/lofi")
SCOPE="botnet"

# 1) Ensure you're linked to the correct Vercel project inside 'web'
cd /Users/jeremycai/Projects/lofi-studio/web
vercel whoami >/dev/null || vercel login
vercel link ${SCOPE:+--scope "$SCOPE"} --yes || true

# 2) Load values from environment (do NOT hardcode secrets in this repo)
# Provide the following env vars before running this script (export or via a private file you source):
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT
# - ELEVENLABS_API_KEY, FAL_KEY, RESEND_API_KEY
# - APP_ORIGIN
# Optional:
# - STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
required_env_vars=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  R2_ACCOUNT_ID
  R2_BUCKET
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_S3_ENDPOINT
  ELEVENLABS_API_KEY
  FAL_KEY
  RESEND_API_KEY
  APP_ORIGIN
)
missing=()
for var in "${required_env_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    missing+=("$var")
  fi
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required environment variables:"
  for var in "${missing[@]}"; do echo "  - $var"; done
  echo "Export them in your shell or source a private .env file, then rerun."
  exit 1
fi

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
