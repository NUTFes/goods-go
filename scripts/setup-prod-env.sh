#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

DOMAIN=""
APP_DOMAIN=""
API_DOMAIN=""
FORCE=false

while (($# > 0)); do
  case "$1" in
    --domain)
      DOMAIN="${2:-}"
      shift 2
      ;;
    --app-domain)
      APP_DOMAIN="${2:-}"
      shift 2
      ;;
    --api-domain)
      API_DOMAIN="${2:-}"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${DOMAIN}" ]]; then
  echo "usage: mise run prod:setup -- --domain <domain> [--app-domain <domain>] [--api-domain <domain>] [--force]" >&2
  exit 1
fi

require_commands git openssl node
bash "${SCRIPT_DIR}/prod-stack.sh" sync

if [[ -f "${STACK_DIR}/volumes/db/data/PG_VERSION" ]]; then
  echo "existing PostgreSQL data detected; prod:setup cannot rotate database credentials" >&2
  echo "restore the original .env or follow a reviewed credential-rotation runbook" >&2
  exit 1
fi

if [[ -f "${STACK_ENV_FILE}" && "${FORCE}" != "true" ]]; then
  echo "${STACK_ENV_FILE} already exists; use --force only when intentionally rotating all Supabase secrets" >&2
  exit 1
fi

if [[ -f "${STACK_ENV_FILE}" ]]; then
  cp "${STACK_ENV_FILE}" "${STACK_ENV_FILE}.before-rotation"
  chmod 600 "${STACK_ENV_FILE}.before-rotation"
fi

cp "${STACK_DIR}/.env.example" "${STACK_ENV_FILE}"
chmod 600 "${STACK_ENV_FILE}"

(
  cd "${STACK_DIR}"
  sh utils/generate-keys.sh --update-env >/dev/null
  sh utils/add-new-auth-keys.sh --update-env >/dev/null
)
git -C "${STACK_REPO_DIR}" restore docker/docker-compose.yml
rm -f "${STACK_ENV_FILE}.old" "${STACK_DIR}/docker-compose.yml.old"

APP_DOMAIN="${APP_DOMAIN:-${DOMAIN}}"
if [[ -z "${API_DOMAIN}" ]]; then
  API_DOMAIN="${DOMAIN%%.*}-api.${DOMAIN#*.}"
fi

set_env_value "${STACK_ENV_FILE}" "POOLER_TENANT_ID" "goods-go"
set_env_value "${STACK_ENV_FILE}" "SITE_URL" "https://${APP_DOMAIN}"
set_env_value "${STACK_ENV_FILE}" "ADDITIONAL_REDIRECT_URLS" "https://${APP_DOMAIN}/**"
set_env_value "${STACK_ENV_FILE}" "API_EXTERNAL_URL" "https://${API_DOMAIN}"
set_env_value "${STACK_ENV_FILE}" "SUPABASE_PUBLIC_URL" "https://${API_DOMAIN}"
set_env_value "${STACK_ENV_FILE}" "ENABLE_EMAIL_AUTOCONFIRM" "true"
set_env_value "${STACK_ENV_FILE}" "DISABLE_SIGNUP" "false"
chmod 600 "${STACK_ENV_FILE}"

echo "production Supabase environment created at ${STACK_ENV_FILE}"
echo "app URL: https://${APP_DOMAIN}"
echo "API URL: https://${API_DOMAIN}"
echo "generated secrets were written with mode 0600 and were not printed"
