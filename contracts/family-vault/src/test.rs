#![cfg(test)]

use crate::error::Error;
use crate::{FamilyVault, FamilyVaultClient};

use soroban_sdk::testutils::Address as _;
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};
use soroban_sdk::{Address, Env};

struct Setup<'a> {
    env: Env,
    client: FamilyVaultClient<'a>,
    token: Address,
    token_client: TokenClient<'a>,
    sac_admin: StellarAssetClient<'a>,
    admin: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    // Stand-in for the native XLM Stellar Asset Contract.
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();

    let contract_id = env.register(FamilyVault, ());
    let client = FamilyVaultClient::new(&env, &contract_id);
    client.initialize(&admin, &token);

    Setup {
        token_client: TokenClient::new(&env, &token),
        sac_admin: StellarAssetClient::new(&env, &token),
        env,
        client,
        token,
        admin,
    }
}

fn funded_parent(s: &Setup, amount: i128) -> Address {
    let a = Address::generate(&s.env);
    s.sac_admin.mint(&a, &amount);
    a
}

#[test]
fn test_initialize() {
    let s = setup();
    assert_eq!(s.client.get_admin(), s.admin);
    assert_eq!(s.client.get_token(), s.token);
    assert!(!s.client.is_paused());
}

#[test]
fn cannot_initialize_twice() {
    let s = setup();
    let other = Address::generate(&s.env);
    let res = s.client.try_initialize(&other, &s.token);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn deposit_escrows_funds_and_tracks_balance() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);

    let balance = s.client.deposit(&parent, &600);
    assert_eq!(balance, 600);

    let v = s.client.get_vault(&parent);
    assert_eq!(v.balance, 600);
    assert_eq!(v.allocated, 0);
    assert_eq!(s.client.unallocated(&parent), 600);

    // Parent debited, contract custodies the escrow.
    assert_eq!(s.token_client.balance(&parent), 400);
    assert_eq!(s.token_client.balance(&s.client.address), 600);
}

#[test]
fn deposit_zero_or_negative_is_rejected() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    assert_eq!(s.client.try_deposit(&parent, &0), Err(Ok(Error::InvalidAmount)));
    assert_eq!(s.client.try_deposit(&parent, &-5), Err(Ok(Error::InvalidAmount)));
}

#[test]
fn set_allowance_and_claim_happy_path() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    s.client.deposit(&parent, &1_000);

    let kid = Address::generate(&s.env);
    let unallocated = s.client.set_allowance(&parent, &kid, &300);
    assert_eq!(unallocated, 700);
    assert_eq!(s.client.get_allowance(&parent, &kid), 300);

    let v = s.client.get_vault(&parent);
    assert_eq!(v.allocated, 300);

    // Recipient claims part of the allowance.
    let remaining = s.client.claim(&parent, &kid, &120);
    assert_eq!(remaining, 180);
    assert_eq!(s.token_client.balance(&kid), 120);
    assert_eq!(s.client.get_allowance(&parent, &kid), 180);

    let v = s.client.get_vault(&parent);
    assert_eq!(v.balance, 880);
    assert_eq!(v.allocated, 180);
    assert_eq!(s.client.unallocated(&parent), 700); // unallocated unchanged by claim

    // Claim the rest.
    let remaining = s.client.claim(&parent, &kid, &180);
    assert_eq!(remaining, 0);
    assert_eq!(s.token_client.balance(&kid), 300);
    assert_eq!(s.client.get_allowance(&parent, &kid), 0);
}

#[test]
fn set_allowance_over_balance_is_rejected() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    s.client.deposit(&parent, &500);

    let kid = Address::generate(&s.env);
    let res = s.client.try_set_allowance(&parent, &kid, &501);
    assert_eq!(res, Err(Ok(Error::InsufficientUnallocated)));
    assert_eq!(s.client.get_allowance(&parent, &kid), 0);
}

#[test]
fn allowance_across_two_recipients_respects_balance() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    s.client.deposit(&parent, &1_000);

    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    s.client.set_allowance(&parent, &a, &600);
    // 600 + 500 = 1100 > 1000 -> rejected.
    assert_eq!(
        s.client.try_set_allowance(&parent, &b, &500),
        Err(Ok(Error::InsufficientUnallocated))
    );
    // 600 + 400 = 1000 -> ok.
    assert_eq!(s.client.set_allowance(&parent, &b, &400), 0);
    assert_eq!(s.client.get_vault(&parent).allocated, 1_000);
}

#[test]
fn lowering_allowance_frees_unallocated() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    s.client.deposit(&parent, &1_000);

    let kid = Address::generate(&s.env);
    s.client.set_allowance(&parent, &kid, &800);
    assert_eq!(s.client.unallocated(&parent), 200);

    // Adjust down to 300 — frees 500.
    let unallocated = s.client.set_allowance(&parent, &kid, &300);
    assert_eq!(unallocated, 700);
    assert_eq!(s.client.get_allowance(&parent, &kid), 300);
    assert_eq!(s.client.get_vault(&parent).allocated, 300);

    // Clear to zero.
    s.client.set_allowance(&parent, &kid, &0);
    assert_eq!(s.client.get_allowance(&parent, &kid), 0);
    assert_eq!(s.client.unallocated(&parent), 1_000);
}

#[test]
fn claim_over_allowance_is_rejected() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    s.client.deposit(&parent, &1_000);

    let kid = Address::generate(&s.env);
    s.client.set_allowance(&parent, &kid, &200);

    let res = s.client.try_claim(&parent, &kid, &201);
    assert_eq!(res, Err(Ok(Error::InsufficientAllowance)));
    // Nothing moved.
    assert_eq!(s.token_client.balance(&kid), 0);
    assert_eq!(s.client.get_allowance(&parent, &kid), 200);
}

#[test]
fn claim_without_vault_is_rejected() {
    let s = setup();
    let parent = Address::generate(&s.env);
    let kid = Address::generate(&s.env);
    assert_eq!(
        s.client.try_claim(&parent, &kid, &10),
        Err(Ok(Error::VaultNotFound))
    );
}

#[test]
fn withdraw_unallocated_returns_funds() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    s.client.deposit(&parent, &1_000);

    let kid = Address::generate(&s.env);
    s.client.set_allowance(&parent, &kid, &400);

    // Only the unallocated 600 can be pulled back.
    let res = s.client.try_withdraw_unallocated(&parent, &601);
    assert_eq!(res, Err(Ok(Error::InsufficientBalance)));

    let balance = s.client.withdraw_unallocated(&parent, &600);
    assert_eq!(balance, 400);
    assert_eq!(s.token_client.balance(&parent), 600);
    assert_eq!(s.client.unallocated(&parent), 0);
    // The allocated 400 is still reserved and claimable.
    assert_eq!(s.client.claim(&parent, &kid, &400), 0);
    assert_eq!(s.token_client.balance(&kid), 400);
}

#[test]
fn pause_blocks_deposit_and_claim_but_not_withdraw() {
    let s = setup();
    let parent = funded_parent(&s, 1_000);
    s.client.deposit(&parent, &1_000);
    let kid = Address::generate(&s.env);
    s.client.set_allowance(&parent, &kid, &500);

    s.client.pause();
    assert!(s.client.is_paused());
    assert_eq!(s.client.try_deposit(&parent, &10), Err(Ok(Error::Paused)));
    assert_eq!(s.client.try_claim(&parent, &kid, &10), Err(Ok(Error::Paused)));
    // Withdraw still works while paused — a parent's own funds are never frozen.
    assert_eq!(s.client.withdraw_unallocated(&parent, &500), 500);

    s.client.unpause();
    assert!(!s.client.is_paused());
}
