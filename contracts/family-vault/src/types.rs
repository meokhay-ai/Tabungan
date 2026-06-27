use soroban_sdk::contracttype;

/// The on-chain state of one parent's family vault.
///
/// `balance` is the total XLM the parent has deposited and the contract still
/// custodies for them. `allocated` is the sum of all outstanding per-recipient
/// allowances. The parent may freely withdraw `balance - allocated` (the
/// *unallocated* remainder); the allocated portion is reserved for recipients
/// to claim.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vault {
    /// Total deposited XLM still held in escrow for this parent (minor units).
    pub balance: i128,
    /// Sum of all live per-recipient allowances under this parent.
    pub allocated: i128,
}
