#!/usr/bin/env bash
#
# Deploy FamilyVault to Stellar Testnet (or Mainnet) with the Stellar CLI.
#
# Prereqs:
#   - Rust 1.89.0 + wasm32-unknown-unknown target
#   - Stellar CLI >= v27
#   - A funded identity (testnet auto-funds via friendbot)
#
# Usage:
#   ./scripts/deploy.sh                 # testnet, identity "deployer"
#   NETWORK=public IDENTITY=prod ./scripts/deploy.sh
set -euo pipefail

NETWORK="${1:-${NETWORK:-testnet}}"
IDENTITY="${IDENTITY:-deployer}"
WASM="target/wasm32-unknown-unknown/release/family_vault.optimized.wasm"

cd "$(dirname "$0")/.."

echo "▶ Network: $NETWORK   Identity: $IDENTITY"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"
echo "▶ Admin address: $ADMIN_ADDR"

# 1. Build + optimize.
echo "▶ Building contract…"
cargo +1.89.0 build --release --target wasm32-unknown-unknown
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/family_vault.wasm

# 2. Resolve the native XLM Stellar Asset Contract (SAC) id for the network.
TOKEN="$(stellar contract id asset --asset native --network "$NETWORK")"
echo "▶ Token (native XLM SAC): $TOKEN"

# 3. Deploy → contract id.
echo "▶ Deploying…"
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "▶ Contract id: $CONTRACT_ID"

# 4. Initialize with admin + token.
echo "▶ Initializing…"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize --admin "$ADMIN_ADDR" --token "$TOKEN"

echo ""
echo "✅ Done. Add to the app env (.env.local / Vercel):"
echo "   SOROBAN_CONTRACT_ID=$CONTRACT_ID"
echo "   NEXT_PUBLIC_SOROBAN_CONTRACT_ID=$CONTRACT_ID"
echo "   VAULT_TOKEN_SAC=$TOKEN"
echo "   SOROBAN_RPC_URL=https://soroban-${NETWORK}.stellar.org"
