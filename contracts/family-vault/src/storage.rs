use soroban_sdk::{contracttype, Address};

/// Storage keys.
///
/// `Admin`, `Token` and `Paused` are configuration and live in *instance*
/// storage so they share the contract instance's TTL. `Vault` and `Allowance`
/// hold user funds/claims and live in *persistent* storage so they outlive the
/// instance and are never garbage-collected out from under a pending claim.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Paused,
    /// parent -> Vault
    Vault(Address),
    /// (parent, recipient) -> i128 claimable allowance
    Allowance(Address, Address),
}

// Soroban ledgers close ~every 5s → 17,280 ledgers/day.
pub const DAY_IN_LEDGERS: u32 = 17_280;

// Keep the contract instance (admin/token/paused) alive ~30 days, re-bumped on
// every state-changing call.
pub const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

// Vault balances and allowances are bumped to ~90 days so escrowed funds can
// never be stranded by entry expiry before a recipient claims.
pub const PERSIST_BUMP_AMOUNT: u32 = 90 * DAY_IN_LEDGERS;
pub const PERSIST_LIFETIME_THRESHOLD: u32 = PERSIST_BUMP_AMOUNT - DAY_IN_LEDGERS;
