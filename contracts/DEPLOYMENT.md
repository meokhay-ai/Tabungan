# FamilyVault — Testnet deployment record

Live, verified deployment of the `family-vault` Soroban contract on **Stellar Testnet**.
It is the on-chain core of Tabungan: a parent deposits XLM, allocates a per-recipient
allowance, and each recipient claims their share straight from the contract.

## Addresses

| Item | Value |
|---|---|
| **Contract ID** | `CBCA73FAZFZUR5NFXOSC45WRHBUY7WKQBII7PVFTJLRY3IHREVQPD7RB` |
| Optimized Wasm sha256 | `6d13ff5d235a3abda2ac9d135c110c70e54c14296b4e4c78028e865a5aaf2a46` |
| Admin | `GBL5RJKF4QNJ4ZPLJZ7PS7K5A4J44VEZJRV2CRTFFDRVSY2N76AIIE47` |
| Token (escrowed asset) | native XLM SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Network | Test SDF Network ; September 2015 |
| RPC | https://soroban-testnet.stellar.org |
| Wasm size | 16,273 bytes (optimized) |

Explorer: https://stellar.expert/explorer/testnet/contract/CBCA73FAZFZUR5NFXOSC45WRHBUY7WKQBII7PVFTJLRY3IHREVQPD7RB

## On-chain proof (end-to-end)

| Step | Tx |
|---|---|
| Deploy | [`843c980f…`](https://stellar.expert/explorer/testnet/tx/843c980f955bd63557a469ad1e103525d889290d1d4c6095fcf7193b598f55f6) |
| `initialize(admin, token=XLM SAC)` | [`e0e7ef4a…`](https://stellar.expert/explorer/testnet/tx/e0e7ef4a529546bdf164ea9ce46a035f2c513fdd0164893c33487d008f94c09f) |
| `claim` (recipient pulls 2 XLM from allowance) | [`2e79fa86…`](https://stellar.expert/explorer/testnet/tx/2e79fa86011f240915e21ce0ea166246d35edf1f8d7b8caa4ffc68c28fabe3f1) |

A full deposit → set_allowance → withdraw_unallocated → claim cycle was run against the
live contract; `get_vault(parent)` settles deterministically (e.g. after the proof run:
`{ balance: 10000000, allocated: 10000000 }` = 1 XLM still escrowed, 1 XLM still claimable).

## Entrypoints

| Fn | Auth | Effect |
|---|---|---|
| `initialize(admin, token)` | admin | one-time setup |
| `deposit(parent, amount)` | parent | XLM parent → contract; `balance += amount` |
| `set_allowance(parent, recipient, amount)` | parent | absolute allowance; `allocated ≤ balance` enforced |
| `claim(parent, recipient, amount)` | recipient | XLM contract → recipient; decrements allowance + balance |
| `withdraw_unallocated(parent, amount)` | parent | XLM contract → parent of the unallocated remainder |
| `get_vault / get_allowance / unallocated / get_token / get_admin / is_paused` | — | views |
| `pause / unpause / set_admin / upgrade` | admin | ops |

## Toolchain

- Rust `1.89.0`, target `wasm32-unknown-unknown`.
- Stellar CLI `27.0.0`.
- `soroban-sdk 22`.

## Reproduce

```bash
cd contracts
cargo +1.89.0 test                                           # 12/12 pass
cargo +1.89.0 build --release --target wasm32-unknown-unknown
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/family_vault.wasm
./scripts/deploy.sh testnet                                  # deploy + initialize
```

## Mainnet

The contract is upgradeable (`upgrade(wasm_hash)`, admin-gated). For mainnet, deploy with
`./scripts/deploy.sh public`, point the app's `SOROBAN_CONTRACT_ID` at the new id, and set
the token to the native XLM SAC for the public network.
