#![no_std]
//! # Family Vault
//!
//! The on-chain core of **Tabungan**, a family-allowance app.
//!
//! Instead of the backend custodying money or sending raw payments, a parent
//! locks XLM *in this contract* and allocates a per-recipient allowance. Each
//! recipient then pulls their own share directly from the contract — no
//! intermediary can move the funds, and every balance is verifiable on-chain.
//!
//! ## Model
//! - A **parent** opens a vault by depositing XLM (`deposit`). The contract
//!   becomes the custodian of that balance.
//! - The parent sets an absolute **allowance** per recipient (`set_allowance`).
//!   The sum of allowances can never exceed the deposited balance.
//! - A **recipient** claims up to their current allowance (`claim`); the
//!   contract pays them from its own balance and decrements both the allowance
//!   and the vault balance.
//! - The parent can always reclaim the **unallocated** remainder
//!   (`withdraw_unallocated`) — funds are never stuck.
//!
//! ## Asset
//! The vault holds a single token, configured once at `initialize`. Tabungan
//! deploys it against the **native XLM** Stellar Asset Contract (SAC), so no
//! trustline is ever required.
//!
//! ## Safety
//! - `require_auth` on the parent (deposit / set_allowance / withdraw) and on
//!   the recipient (claim) — payouts are always bound to the right signer.
//! - Pausable + upgradeable by an admin for operational safety.
//! - Storage TTL bumping so escrow never expires before a claim.

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

use error::Error;
use storage::{
    DataKey, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD, PERSIST_BUMP_AMOUNT,
    PERSIST_LIFETIME_THRESHOLD,
};
use types::Vault;

use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, BytesN, Env};

#[contract]
pub struct FamilyVault;

#[contractimpl]
impl FamilyVault {
    /// One-time setup. Records the admin and the escrowed token (the native XLM
    /// SAC on Tabungan), and unpauses the contract.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Paused, &false);
        bump_instance(&env);
        env.events().publish((symbol_short!("init"),), (admin, token));
        Ok(())
    }

    /// Parent deposits `amount` of the vault token into their family vault.
    /// Returns the new total vault balance.
    ///
    /// Auth: the parent's signature, which also covers the inner SAC
    /// `transfer(parent -> contract)`.
    pub fn deposit(env: Env, parent: Address, amount: i128) -> Result<i128, Error> {
        parent.require_auth();
        require_not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        token::Client::new(&env, &token_addr(&env)?).transfer(
            &parent,
            &env.current_contract_address(),
            &amount,
        );

        let mut vault = load_vault(&env, &parent);
        vault.balance += amount;
        save_vault(&env, &parent, &vault);
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("deposit"), parent), (amount, vault.balance));
        Ok(vault.balance)
    }

    /// Parent sets the **absolute** allowance a `recipient` can claim. Passing a
    /// smaller value lowers it; passing `0` clears it. The total of all
    /// allowances may never exceed the parent's deposited balance.
    /// Returns the parent's unallocated (still-withdrawable) balance.
    ///
    /// Auth: the parent's signature.
    pub fn set_allowance(
        env: Env,
        parent: Address,
        recipient: Address,
        amount: i128,
    ) -> Result<i128, Error> {
        parent.require_auth();
        require_not_paused(&env)?;
        if amount < 0 {
            return Err(Error::InvalidAllowance);
        }

        let mut vault = load_existing_vault(&env, &parent)?;
        let previous = get_allowance_raw(&env, &parent, &recipient);
        // allocated - previous + amount, computed carefully to stay >= 0.
        let new_allocated = vault.allocated - previous + amount;
        if new_allocated > vault.balance {
            return Err(Error::InsufficientUnallocated);
        }

        set_allowance_raw(&env, &parent, &recipient, amount);
        vault.allocated = new_allocated;
        save_vault(&env, &parent, &vault);
        bump_instance(&env);

        env.events().publish(
            (symbol_short!("allowance"), parent, recipient),
            (previous, amount),
        );
        Ok(vault.balance - vault.allocated)
    }

    /// Recipient claims `amount` from the allowance `parent` set for them. The
    /// contract pays out from its own balance. Returns the recipient's remaining
    /// allowance.
    ///
    /// Auth: the recipient's signature — binds the payout to them.
    pub fn claim(
        env: Env,
        parent: Address,
        recipient: Address,
        amount: i128,
    ) -> Result<i128, Error> {
        recipient.require_auth();
        require_not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut vault = load_existing_vault(&env, &parent)?;
        let allowance = get_allowance_raw(&env, &parent, &recipient);
        if amount > allowance {
            return Err(Error::InsufficientAllowance);
        }

        token::Client::new(&env, &token_addr(&env)?).transfer(
            &env.current_contract_address(),
            &recipient,
            &amount,
        );

        let remaining = allowance - amount;
        set_allowance_raw(&env, &parent, &recipient, remaining);
        vault.balance -= amount;
        vault.allocated -= amount;
        save_vault(&env, &parent, &vault);
        bump_instance(&env);

        env.events().publish(
            (symbol_short!("claim"), parent, recipient),
            (amount, remaining),
        );
        Ok(remaining)
    }

    /// Parent withdraws `amount` of the **unallocated** balance back to their
    /// wallet. Allocated allowances stay reserved for recipients. Returns the
    /// new total vault balance.
    ///
    /// Auth: the parent's signature.
    pub fn withdraw_unallocated(
        env: Env,
        parent: Address,
        amount: i128,
    ) -> Result<i128, Error> {
        parent.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut vault = load_existing_vault(&env, &parent)?;
        let unallocated = vault.balance - vault.allocated;
        if amount > unallocated {
            return Err(Error::InsufficientBalance);
        }

        token::Client::new(&env, &token_addr(&env)?).transfer(
            &env.current_contract_address(),
            &parent,
            &amount,
        );

        vault.balance -= amount;
        save_vault(&env, &parent, &vault);
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("withdraw"), parent), (amount, vault.balance));
        Ok(vault.balance)
    }

    // --- Views -------------------------------------------------------------

    /// The parent's vault (balance + allocated). Returns a zeroed vault if the
    /// parent has never deposited, so the UI can render an empty state.
    pub fn get_vault(env: Env, parent: Address) -> Vault {
        load_vault(&env, &parent)
    }

    /// The unallocated (withdrawable) portion of a parent's vault.
    pub fn unallocated(env: Env, parent: Address) -> i128 {
        let v = load_vault(&env, &parent);
        v.balance - v.allocated
    }

    /// The current claimable allowance for a (parent, recipient) pair.
    pub fn get_allowance(env: Env, parent: Address, recipient: Address) -> i128 {
        get_allowance_raw(&env, &parent, &recipient)
    }

    pub fn get_token(env: Env) -> Result<Address, Error> {
        token_addr(&env)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    // --- Admin -------------------------------------------------------------

    pub fn pause(env: Env) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        bump_instance(&env);
        env.events().publish((symbol_short!("pause"),), true);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        bump_instance(&env);
        env.events().publish((symbol_short!("pause"),), false);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);
        Ok(())
    }

    /// Replace the contract's own Wasm (admin-gated). Lets us ship fixes without
    /// migrating vault state — important for a future mainnet deploy.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        admin(&env)?.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}

// --- Internal helpers ------------------------------------------------------

fn admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

fn token_addr(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Token)
        .ok_or(Error::NotInitialized)
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .ok_or(Error::NotInitialized)?;
    if paused {
        return Err(Error::Paused);
    }
    Ok(())
}

fn load_vault(env: &Env, parent: &Address) -> Vault {
    env.storage()
        .persistent()
        .get(&DataKey::Vault(parent.clone()))
        .unwrap_or(Vault {
            balance: 0,
            allocated: 0,
        })
}

fn load_existing_vault(env: &Env, parent: &Address) -> Result<Vault, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Vault(parent.clone()))
        .ok_or(Error::VaultNotFound)
}

fn save_vault(env: &Env, parent: &Address, vault: &Vault) {
    let key = DataKey::Vault(parent.clone());
    env.storage().persistent().set(&key, vault);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSIST_LIFETIME_THRESHOLD, PERSIST_BUMP_AMOUNT);
}

fn get_allowance_raw(env: &Env, parent: &Address, recipient: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Allowance(parent.clone(), recipient.clone()))
        .unwrap_or(0)
}

fn set_allowance_raw(env: &Env, parent: &Address, recipient: &Address, amount: i128) {
    let key = DataKey::Allowance(parent.clone(), recipient.clone());
    if amount == 0 {
        env.storage().persistent().remove(&key);
        return;
    }
    env.storage().persistent().set(&key, &amount);
    env.storage()
        .persistent()
        .extend_ttl(&key, PERSIST_LIFETIME_THRESHOLD, PERSIST_BUMP_AMOUNT);
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}
