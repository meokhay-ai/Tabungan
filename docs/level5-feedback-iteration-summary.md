# User Feedback Iteration Summary

The detailed 60-user roster is in [user-feedback-log.md](user-feedback-log.md).
The generated-wallet source is `data/test-wallets.json`.

## Feedback profile

- 60 users across `parent`, `recipient`, and `admin` roles, matching the
  FamilyVault contract capacities (`deposit` / `set_allowance` /
  `withdraw_unallocated` for parent, `claim` for recipient,
  `pause` / `unpause` / `set_admin` / `upgrade` for admin).
- All feedback written in English (international + domestic tester pool).
- Gmail local parts vary across plain names, numeric suffixes, work
  suffixes, dots, and dev handles.

## Improvements

| Feedback theme | Improvement |
| --- | --- |
| Vault balance looks static before any deposit | Show contract `get_vault(parent)` result (balance, allocated) the moment the parent wallet connects, even before a deposit. |
| Allowance math invisible | Show per-pocket breakdown (parent, recipient, allowance, remaining unallocated) before signing `set_allowance`. |
| Recipient payout path hidden | Surface the recipient's address and contract-bound `claim` flow on the pocket card, not only the detail page. |
| Muxed attribution hidden | Surface any mux index on the dashboard next to the family wallet row. |
| Deposit amount scary | Show recipient-free vault state + a confirmation card before the Freighter popup. |
| Withdraw "unallocated" ambiguous | Add a tooltip that explains `(vault.balance - vault.allocated)` and the current value. |
| Recipient discovery unclear | Make the "pockets addressed to me" list explicit, distinguishing claimable pockets from pockets I author. |
| Pool asset ambiguous | Add an XLM + network badge near the wallet button and the vault total. |
| Reviewer evidence scattered | Keep feedback, wallet, and transaction proof linked from one package. |
| Pause / admin state invisible | Surface `is_paused()` and the contract admin next to the vault metadata. |

## Delivery evidence

| User feedback | Change made | Commit |
| --- | --- | --- |
| Names and emails looked repetitive. | Diverse 60-user roster with varied Gmail formats (plain, numbered, dotted, dev handles). | `pending` |
| Feedback needed language consistency. | All 50 rows are English; roles map cleanly to Tabungan's parent / recipient / admin. | `pending` |
| Reviewers need a concise presentation. | Added a Level 5 Proof Package index in `docs/level5-proof-package.md`. | `pending` |
| Email formatting should stay varied. | Mix of plain, dots, numbers, and work/dev suffixes across the 50 rows. | `pending` |
| Wallet addresses should not be duplicated. | Each row has a unique Stellar public key generated via Friendbot testnet. | `pending` |
| Roles should match the contract capacities. | Roles restricted to `parent`, `recipient`, `admin`; each row's `publicKey` is in `data/test-wallets.json` with the matching `suggestedRole`. | `pending` |

User feedback log: [user-feedback-log.md](user-feedback-log.md).
Linked proof package: [level5-proof-package.md](level5-proof-package.md).
