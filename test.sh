#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Local test script for Dokploy ECR Sync Action
#
# Usage:
#   export AWS_PROFILE=your-profile   (or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
#   export DOKPLOY_URL=https://your-dokploy.com
#   export DOKPLOY_API_KEY=your-api-key
#   export AWS_REGION=ap-southeast-1
#   bash test.sh
#
# Optional overrides:
#   REGISTRY_NAME="AWS ECR"        (default: "AWS ECR")
#   REGISTRY_USERNAME="AWS"        (default: "AWS")
#   IMAGE_PREFIX=""                (default: "")
#   APPLICATION_IDS="id1,id2"      (default: "" = auto-discover)
#   COMPOSE_IDS="id1,id2"          (default: "" = auto-discover)
#   TEST_CONNECTION="true"         (default: "false")
#   REDEPLOY="true"                (default: "false" for safety)
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✔ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✘ $1${NC}"; exit 1; }

# --- Validate env vars ---
step "Checking environment variables..."

[ -z "${DOKPLOY_URL:-}" ] && fail "DOKPLOY_URL is not set"
[ -z "${DOKPLOY_API_KEY:-}" ] && fail "DOKPLOY_API_KEY is not set"

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
REGISTRY_NAME="${REGISTRY_NAME:-AWS ECR}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-AWS}"
IMAGE_PREFIX="${IMAGE_PREFIX:-}"
APPLICATION_IDS="${APPLICATION_IDS:-}"
COMPOSE_IDS="${COMPOSE_IDS:-}"
TEST_CONNECTION="${TEST_CONNECTION:-false}"
REDEPLOY="${REDEPLOY:-false}"

ok "DOKPLOY_URL=$DOKPLOY_URL"
ok "AWS_REGION=$AWS_REGION"
ok "REGISTRY_NAME=$REGISTRY_NAME"
ok "REGISTRY_USERNAME=$REGISTRY_USERNAME"
ok "IMAGE_PREFIX=$IMAGE_PREFIX"
ok "APPLICATION_IDS=$APPLICATION_IDS"
ok "COMPOSE_IDS=$COMPOSE_IDS"
ok "REDEPLOY=$REDEPLOY"

# --- Build if needed ---
if [ ! -f "dist/index.js" ]; then
  step "Building action..."
  npm run build
  ok "Build complete"
fi

# --- Run ---
step "Running action..."

env \
  "INPUT_DOKPLOY-URL=$DOKPLOY_URL" \
  "INPUT_DOKPLOY-API-KEY=$DOKPLOY_API_KEY" \
  "INPUT_AWS-REGION=$AWS_REGION" \
  "INPUT_REGISTRY-NAME=$REGISTRY_NAME" \
  "INPUT_REGISTRY-USERNAME=$REGISTRY_USERNAME" \
  "INPUT_IMAGE-PREFIX=$IMAGE_PREFIX" \
  "INPUT_APPLICATION-IDS=$APPLICATION_IDS" \
  "INPUT_COMPOSE-IDS=$COMPOSE_IDS" \
  "INPUT_TEST-CONNECTION=$TEST_CONNECTION" \
  "INPUT_REDEPLOY=$REDEPLOY" \
  node dist/index.js

echo ""
ok "Action completed successfully"
