use soroban_sdk::contracterror;

/// Every failure mode is an explicit, contiguous `u32` so the TypeScript client
/// can map a contract error straight to a user-facing message without guessing.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    Paused = 4,
    /// Amount must be strictly positive.
    InvalidAmount = 5,
    /// A negative allowance was requested.
    InvalidAllowance = 6,
    /// No vault has been opened for this parent yet.
    VaultNotFound = 7,
    /// Allocating this allowance would exceed the parent's deposited balance.
    InsufficientUnallocated = 8,
    /// The recipient tried to claim more than their current allowance.
    InsufficientAllowance = 9,
    /// The parent tried to withdraw more than the unallocated balance.
    InsufficientBalance = 10,
}
