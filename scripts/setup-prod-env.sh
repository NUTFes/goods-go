#!/usr/bin/env bash
set -euo pipefail

# Generate production-ready secrets for the Supabase self-host stack.
#
# Usage:
#   bash scripts/setup-prod-env.sh                          # preview only
#   bash scripts/setup-prod-env.sh --apply                  # write to .env
#   bash scripts/setup-prod-env.sh --apply --domain example.com

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_ENV_FILE="${ROOT_DIR}/supabase/self-host-stack/.env"

DOMAIN=""
APP_DOMAIN=""
API_DOMAIN=""
STUDIO_DOMAIN=""
APPLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=true
      shift
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --app-domain)
      APP_DOMAIN="$2"
      shift 2
      ;;
    --api-domain)
      API_DOMAIN="$2"
      shift 2
      ;;
    --studio-domain)
      STUDIO_DOMAIN="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

for cmd in openssl node; do
  if ! command -v "${cmd}" > /dev/null 2>&1; then
    echo "[setup] missing required command: ${cmd}" >&2
    exit 1
  fi
done

if [[ -z "${DOMAIN}" ]]; then
  echo "[setup] --domain is required (e.g. --domain goods-go.nutfes.net)" >&2
  exit 1
fi

if [[ -z "${APP_DOMAIN}" ]]; then
  APP_DOMAIN="${DOMAIN}"
fi

# Derive api/studio domains from base domain if not set
# e.g. goods-go.nutfes.net -> goods-go-api.nutfes.net
if [[ -z "${API_DOMAIN}" ]]; then
  local_prefix="${DOMAIN%%.*}"
  local_suffix="${DOMAIN#*.}"
  API_DOMAIN="${local_prefix}-api.${local_suffix}"
fi

if [[ -z "${STUDIO_DOMAIN}" ]]; then
  local_prefix="${DOMAIN%%.*}"
  local_suffix="${DOMAIN#*.}"
  STUDIO_DOMAIN="${local_prefix}-studio.${local_suffix}"
fi

# ---------------------------------------------------------------------------
# Generate random secrets (hex-safe for sed substitution)
# ---------------------------------------------------------------------------
JWT_SECRET="$(openssl rand -hex 32)"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
DASHBOARD_PASSWORD="$(openssl rand -hex 16)"
SECRET_KEY_BASE="$(openssl rand -base64 48 | tr -d '\n')"
VAULT_ENC_KEY="$(openssl rand -hex 16)"
PG_META_CRYPTO_KEY="$(openssl rand -hex 16)"
LOGFLARE_PUBLIC_TOKEN="$(openssl rand -hex 32)"
LOGFLARE_PRIVATE_TOKEN="$(openssl rand -hex 32)"
S3_KEY_ID="$(openssl rand -hex 16)"
S3_KEY_SECRET="$(openssl rand -hex 32)"

# ---------------------------------------------------------------------------
# Generate JWT tokens (ANON_KEY / SERVICE_ROLE_KEY) using Node.js built-ins
# ---------------------------------------------------------------------------
generate_jwt() {
  local role="$1" secret="$2"
  JWT_ROLE="${role}" JWT_KEY="${secret}" node -e '
    const crypto = require("crypto");
    const h = Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const p = Buffer.from(JSON.stringify({
      role: process.env.JWT_ROLE,
      iss: "supabase",
      iat: now,
      exp: now + 315360000
    })).toString("base64url");
    const s = crypto.createHmac("sha256", process.env.JWT_KEY)
      .update(h+"."+p).digest("base64url");
    process.stdout.write(h+"."+p+"."+s);
  '
}

ANON_KEY="$(generate_jwt "anon" "${JWT_SECRET}")"
SERVICE_ROLE_KEY="$(generate_jwt "service_role" "${JWT_SECRET}")"

# ---------------------------------------------------------------------------
# Build substitution map  (ENV_KEY -> new value)
# ---------------------------------------------------------------------------
declare -A SECRETS=(
  [POSTGRES_PASSWORD]="${POSTGRES_PASSWORD}"
  [JWT_SECRET]="${JWT_SECRET}"
  [ANON_KEY]="${ANON_KEY}"
  [SERVICE_ROLE_KEY]="${SERVICE_ROLE_KEY}"
  [DASHBOARD_USERNAME]="supabase"
  [DASHBOARD_PASSWORD]="${DASHBOARD_PASSWORD}"
  [SECRET_KEY_BASE]="${SECRET_KEY_BASE}"
  [VAULT_ENC_KEY]="${VAULT_ENC_KEY}"
  [PG_META_CRYPTO_KEY]="${PG_META_CRYPTO_KEY}"
  [LOGFLARE_PUBLIC_ACCESS_TOKEN]="${LOGFLARE_PUBLIC_TOKEN}"
  [LOGFLARE_PRIVATE_ACCESS_TOKEN]="${LOGFLARE_PRIVATE_TOKEN}"
  [S3_PROTOCOL_ACCESS_KEY_ID]="${S3_KEY_ID}"
  [S3_PROTOCOL_ACCESS_KEY_SECRET]="${S3_KEY_SECRET}"
  [POOLER_TENANT_ID]="goods-go"
  [SITE_URL]="https://${APP_DOMAIN}"
  [API_EXTERNAL_URL]="https://${API_DOMAIN}"
  [SUPABASE_PUBLIC_URL]="https://${API_DOMAIN}"
)

# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------
echo "============================================"
echo " Generated production secrets"
echo "============================================"
for key in "${!SECRETS[@]}"; do
  printf "  %-40s = %s\n" "${key}" "${SECRETS[${key}]}"
done
echo "============================================"
echo ""
echo "  Domain (App):    https://${APP_DOMAIN}"
echo "  Domain (API):    https://${API_DOMAIN}"
echo "  Domain (Studio): https://${STUDIO_DOMAIN}"
echo ""

# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------
if [[ "${APPLY}" != "true" ]]; then
  echo "[setup] Preview only. Run with --apply to write to ${STACK_ENV_FILE}"
  exit 0
fi

if [[ ! -f "${STACK_ENV_FILE}" ]]; then
  echo "[setup] ${STACK_ENV_FILE} not found." >&2
  echo "[setup] Run 'mise run supabase:update-stack' first." >&2
  exit 1
fi

cp "${STACK_ENV_FILE}" "${STACK_ENV_FILE}.bak"
echo "[setup] Backup saved to ${STACK_ENV_FILE}.bak"

for key in "${!SECRETS[@]}"; do
  local_val="${SECRETS[${key}]}"
  # Escape special chars for sed
  escaped_val="$(printf '%s' "${local_val}" | sed 's/[&/\]/\\&/g')"
  sed -i "s|^${key}=.*|${key}=${escaped_val}|" "${STACK_ENV_FILE}"
done

echo "[setup] ✅ ${STACK_ENV_FILE} updated."
echo ""
echo "Next steps:"
echo "  1. Restart the stack:  mise run prod:supabase:down && mise run prod:deploy"
echo "  2. Configure Cloudflare Tunnel public hostnames:"
echo "     - ${APP_DOMAIN}          -> http://goods-go-prod:3000"
echo "     - ${API_DOMAIN}          -> http://supabase-kong:8000"
echo "     - ${STUDIO_DOMAIN}       -> http://supabase-studio:3000"
