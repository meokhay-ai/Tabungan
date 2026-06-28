ARCHITECTURE

Tabungan is a Stellar family-allowance app whose custody model is a Soroban
smart contract: a parent deposits XLM into the FamilyVault contract, allocates
a per-recipient allowance, and each recipient pulls their own share straight
from the contract. No backend ever holds funds, every balance is verifiable
on-chain, and every dashboard metric is produced by a real wallet flow.

STACK

1. Frontend: Next.js 16.2.7 (App Router) + React 19.2.4 + TypeScript 5
   (strict). Tailwind CSS v4 with a hand-built design system. Sonner for
   toasts. No component-library reskin.

2. Backend: Next.js Route Handlers under src/app/api/*. Each handler is a
   small wrapper that parses JSON with Zod, resolves the wallet via the
   session cookie guard, calls a service, and returns the standard envelope
   { ok: true, data } or { ok: false, error }. Long-running Soroban routes
   set maxDuration = 60 to clear Vercel's 10s function budget.

3. Database: Drizzle ORM 0.45 on node-postgres (pg 8.21) talking to a
   Postgres instance. Schema lives in src/server/db/schema/, migrations in
   drizzle/ via drizzle-kit, connection pooled with max 10 and reused via a
   global across HMR reloads.

4. Blockchain: Stellar Testnet. Soroban RPC at soroban-testnet.stellar.org
   for contract invoke build/submit/poll; Horizon at
   horizon-testnet.stellar.org for account reads and classic tx submit. The
   FamilyVault contract is deployed and live at
   CBCA73FAZFZUR5NFXOSC45WRHBUY7WKQBII7PVFTJLRY3IHREVQPD7RB with the
   native XLM SAC CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
   as the escrowed token.

5. Wallet: Freighter via @stellar/freighter-api 6.0.1. The hook
   src/ui/hooks/useFreighter.ts wraps requestAccess / signTransaction /
   isConnected / getAddress with timeouts and an app-pinned network
   passphrase so signing works even when the wallet sits on Mainnet.

DIRECTORY LAYOUT

1. src/app/layout.tsx — root layout with Inter + Fraunces fonts and the
   Sonner Toaster.

2. src/app/page.tsx — landing page (renders <Home />).

3. src/app/(app)/ — empty App Router route group placeholder for future
   shell pages (kept so /app/* routes can be added without restructuring).

4. src/app/stats/page.tsx — public live stats page (renders <StatsView />).

5. src/app/api/health/route.ts — health probe, returns
   { status: 'healthy', service: 'tabungan' }.

6. src/app/api/auth/challenge/route.ts — POST, returns a never-submitted
   SEP-10 style challenge XDR carrying a one-time nonce.

7. src/app/api/auth/verify/route.ts — POST, verifies the wallet signature
   on the challenge, consumes the nonce, opens a session, sets the cookie.

8. src/app/api/auth/me/route.ts — GET, returns the current session wallet
   (or null).

9. src/app/api/auth/logout/route.ts — POST, ends the session and clears
   the cookie.

10. src/app/api/account/route.ts — GET, returns connected wallet XLM
    balance, USDC balance, and USDC trustline state.

11. src/app/api/recipients/route.ts — GET (list) / POST (create) pockets.

12. src/app/api/recipients/[id]/route.ts — DELETE (archive) a pocket.

13. src/app/api/vault/route.ts — GET, returns the connected wallet's full
    on-chain + DB state (contractId, vault, pockets, claimable, events).

14. src/app/api/vault/build/route.ts — POST, builds an unsigned Soroban
    invoke for deposit / allowance / withdraw / claim. maxDuration = 60.

15. src/app/api/vault/submit/route.ts — POST, submits a signed invoke and
    polls the RPC until it settles, then records the event. maxDuration = 60.

16. src/app/api/trustline/build/route.ts — POST, builds an unsigned
    changeTrust XDR that opts a wallet into USDC.

17. src/app/api/trustline/submit/route.ts — POST, submits the signed
    classic changeTrust to Horizon.

18. src/app/api/stats/route.ts — GET, public real-interaction metrics.

19. src/server/controller/ — intentionally not used; route handlers call
    services directly to keep the surface small.

20. src/server/service/ — business logic: auth.service, recipient.service,
    vault.service, stats.service.

21. src/server/stellar/ — the internal Stellar module: network.ts (Horizon
    account reads + classic submit + USDC trustline build), vault.ts
    (Soroban invoke build/submit/read + error mapping), amounts.ts
    (XLM <-> stroop), index.ts (re-exports).

22. src/server/db/client.ts — Drizzle + node-postgres pool.

23. src/server/db/schema/ — sessions, authNonces, recipients, allowances,
    vaultEvents (re-exported from index.ts).

24. src/server/config/env.ts — Zod-validated environment, throws at boot if
    anything is missing.

25. src/server/config/stellar.ts — Horizon server, network passphrase,
    USDC asset, explorer URL helpers.

26. src/server/lib/http.ts — AppError + ok/created/fail/fromError envelope
    helpers.

27. src/server/lib/cookies.ts — session cookie read / write / clear
    (HttpOnly, SameSite=Lax, Secure in prod).

28. src/server/lib/auth-guard.ts — requireWallet(req) resolves the session
    cookie into the public key or throws 401.

29. src/server/lib/validators.ts — Zod schemas + parseJson helper
    (amountSchema, assetSchema, labelSchema).

30. src/ui/components/ — landing, dashboard, stats-view, wallet-provider,
    brand, site-header, site-footer, ui kit (Button, Field, Modal, Pill,
    Spinner), home, layout.

31. src/ui/hooks/ — useFreighter (Freighter wrapper with timeouts and
    network pinning), useSession (cookie-backed session via
    useSyncExternalStore), useFamilyData (account + recipients + vault).

32. src/ui/lib/api.ts — typed fetch client that unwraps the
    { ok, data } / { ok, error } envelope.

33. src/ui/lib/format.ts — truncateAddress, fmtAmount, timeAgo, and
    stellar.expert URL helpers for accounts / txs / contracts.

34. src/i18n/ — reserved for future locale messages; currently empty.

35. contracts/family-vault/src/lib.rs — Soroban contract: initialize,
    deposit, set_allowance, claim, withdraw_unallocated, get_vault,
    get_allowance, unallocated, get_token, get_admin, is_paused, pause,
    unpause, set_admin, upgrade.

36. contracts/family-vault/src/types.rs — the on-chain Vault struct
    { balance: i128, allocated: i128 }.

37. contracts/family-vault/src/storage.rs — DataKey enum + TTL bumps
    (instance ~30d, persistent ~90d).

38. contracts/family-vault/src/error.rs — 10 numbered Error variants,
    matched in the TS client for user-facing messages.

39. contracts/family-vault/src/test.rs — 12 Rust unit tests.

40. contracts/scripts/deploy.sh — build + optimize + deploy + initialize.

41. contracts/DEPLOYMENT.md — live testnet contract id + proof txs.

42. tests/setup.ts — vitest setup (jest-dom matchers, MediaQueryList mock).

43. tests/unit/lib.test.ts — validators, address, stroop conversion,
    formatting.

44. tests/e2e/prod-real.spec.ts — Playwright against the live URL with a
    real Freighter extension.

45. tests/e2e/demo-video.spec.ts — Playwright demo video capture.

46. scripts/reset-db.ts — local DB reset utility.

47. drizzle/ — generated SQL migrations from drizzle-kit push.

DATA MODEL

1. sessions — one row per SEP-10 verify. Columns: id (uuid PK),
   public_key (text, the authenticated wallet), created_at
   (timestamptz, default now), expires_at (timestamptz). Powers
   /api/auth/me and the uniqueWallets / logins counters in /api/stats.

2. auth_nonces — one-time SEP-10 challenge nonces. Columns: nonce (text PK,
   24 random bytes base64url), public_key (text), expires_at (timestamptz),
   consumed_at (timestamptz, null until used). Unused nonces expire after
   NONCE_TTL_SECONDS (default 300s).

3. recipients — pockets (allowance recipients) owned by a family wallet.
   Columns: id (uuid PK), owner_public_key (text), label (text),
   address (text, the recipient's Stellar address), asset (text, 'XLM'
   or 'USDC', default 'XLM'), weekly_amount (text decimal, default '5'),
   created_at (timestamptz), archived_at (timestamptz nullable — soft
   delete). Created only by an authenticated wallet, never seeded.

4. allowances — confirmed on-chain allowance payments. Columns: id (uuid
   PK), owner_public_key, recipient_id (uuid), recipient_label,
   recipient_address, asset ('XLM' | 'USDC'), amount (decimal string,
   e.g. '5'), tx_hash (real Horizon tx hash), kind ('payment' |
   'create_account'), created_at. Each row is produced by a real
   wallet-signed Horizon tx.

5. vault_events — confirmed FamilyVault contract actions. Columns: id (uuid
   PK), owner_public_key (wallet that signed the action), kind ('deposit'
   | 'allowance' | 'claim' | 'withdraw'), parent_address (the vault owner
   the action targets), recipient_id, recipient_label, recipient_address,
   amount (decimal XLM string), tx_hash (real Soroban tx hash), created_at.
   Every row corresponds to a wallet-signed, RPC-confirmed contract invoke.

STELLAR INTEGRATION

1. SEP-10 style auth — the app never sends the wallet to a hosted auth
   server. Instead /api/auth/challenge returns a never-submitted
   TransactionEnvelope carrying a ManageData op with a one-time nonce as
   the value, addressed to the wallet's own account. The wallet signs it
   with Freighter, /api/auth/verify checks the ed25519 signature against
   the tx hash, then consumes the nonce and opens a session. Network is
   pinned to Test SDF Network ; September 2015 so Mainnet wallets still
   produce valid testnet signatures.

2. Soroban contract invoke — the FamilyVault contract at
   CBCA73FAZFZUR5NFXOSC45WRHBUY7WKQBII7PVFTJLRY3IHREVQPD7RB is the
   custodian. /api/vault/build prepares an UNSIGNED invoke for deposit,
   set_allowance, claim, or withdraw_unallocated via
   TransactionBuilder + rpc.Server.prepareTransaction. The wallet signs
   in the browser; /api/vault/submit decodes the XDR, sends via
   rpc.Server.sendTransaction, retries up to 3 times on TRY_AGAIN_LATER,
   then polls getTransaction for up to 54s (well under the 60s route
   budget). The transaction source is always the address whose
   require_auth the contract checks, so a single envelope signature
   authorizes the inner contract call.

3. Native XLM SAC — the vault holds the native XLM Stellar Asset Contract
   (CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) so users
   never need a trustline to deposit or be paid.

4. Trustlines — /api/trustline/build produces an unsigned changeTrust for
   the testnet USDC issuer (GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5);
   /api/trustline/submit sends the signed classic tx to Horizon so the
   wallet strip can one-tap opt-in to USDC.

5. Horizon account reads — /api/account calls Horizon.loadAccount and
   returns the native XLM balance, the USDC balance, and whether the
   USDC trustline exists.

6. Explorer links — every tx hash links to stellar.expert/explorer/testnet,
   and the contract id links to the contract page there. Helpers live in
   src/server/config/stellar.ts and src/ui/lib/format.ts.

7. Contract entry points (FamilyVault, deployed testnet):
   7.1. initialize(admin, token) — admin auth, one-time setup. Records
        the admin address and the escrowed token SAC, unpauses.
   7.2. deposit(parent, amount) — parent auth. Inner SAC transfer
        parent -> contract, then vault.balance += amount. Returns new
        balance.
   7.3. set_allowance(parent, recipient, amount) — parent auth. Absolute
        allowance per recipient; total allocated <= vault.balance is
        enforced on-chain. Returns the parent's unallocated balance.
   7.4. claim(parent, recipient, amount) — RECIPIENT auth (binds the
        payout to them). Inner SAC transfer contract -> recipient;
        decrements allowance, vault.balance, vault.allocated. Returns
        remaining allowance.
   7.5. withdraw_unallocated(parent, amount) — parent auth. Inner SAC
        transfer contract -> parent of the unallocated remainder.
        Returns new vault.balance.
   7.6. get_vault(parent) / get_allowance(parent, recipient) /
        unallocated(parent) / get_token() / get_admin() / is_paused() —
        read-only views via simulation.
   7.7. pause / unpause / set_admin(new) / upgrade(new_wasm_hash) — admin
        ops.

KEY FLOWS

1. Connect wallet
   1.1. The user clicks Connect. src/ui/components/wallet-provider.tsx
        calls freighter.requestAccess() (with a 120s timeout). The
        Freighter popup returns the wallet address.
   1.2. The app POSTs { publicKey } to /api/auth/challenge.
   1.3. auth.service.createChallenge generates a 24-byte base64url nonce,
        inserts an auth_nonces row with NONCE_TTL_SECONDS expiry, and
        returns an UNSIGNED TransactionEnvelope containing a single
        ManageData('tabungan_auth', nonce) op addressed to the wallet.
   1.4. Freighter signs the challenge. The wallet provider POSTs
        { publicKey, signedTxXdr } to /api/auth/verify.
   1.5. auth.service.verify rehydrates the tx, looks up the wallet's
        ed25519 Keypair, and verifies each signature against the tx
        hash. It then finds the ManageData op, pulls the nonce, looks
        up a matching unconsumed auth_nonces row, and consumes it.
   1.6. A sessions row is inserted with SESSION_TTL_SECONDS expiry
        (default 7d). The server sets a HttpOnly SameSite=Lax cookie
        named tabungan_session. Subsequent requests resolve the
        wallet via requireWallet in src/server/lib/auth-guard.ts.

2. Deposit + set allowance (parent flow)
   2.1. The dashboard posts { action: 'deposit', amount } to
        /api/vault/build. vault.service.build calls buildDeposit(wallet,
        toStroops(amount)) which builds an UNSIGNED invoke for
        FamilyVault.deposit(parent, amount).
   2.2. Freighter signs the XDR. The dashboard posts
        { action: 'deposit', amount, signedXdr } to /api/vault/submit.
   2.3. submitVaultXdr sends to Soroban RPC, retries on
        TRY_AGAIN_LATER, polls getTransaction until SUCCESS, and
        returns the confirmed hash. vault.service.submit inserts a
        vault_events row with kind='deposit' and the parent_address set
        to the wallet.
   2.4. The dashboard posts { action: 'allowance', amount, recipientId }
        to /api/vault/build. buildSetAllowance produces an invoke for
        set_allowance(parent, recipient, amount).
   2.5. Same build -> sign -> submit cycle. The vault_events row gets
        kind='allowance' with the recipient's label and address.

3. Claim allowance (recipient flow)
   3.1. /api/vault returns both the wallet's own pockets AND any pockets
        addressed to the wallet by other parents (claimable). For each
        pocket, readAllowance is called via Soroban simulation.
   3.2. When the recipient clicks Claim, the dashboard posts
        { action: 'claim', amount, recipientId } to /api/vault/build.
   3.3. vault.service.build calls recipientService.getById, checks
        that r.address === wallet (the recipient is who they claim to
        be), then calls buildClaim(parent, wallet, amount). The
        transaction source is the recipient — the contract requires
        the recipient's auth.
   3.4. The signed invoke is submitted, polled, and a vault_events row
        with kind='claim' is inserted (parent_address is the original
        parent's wallet, not the recipient's).

4. Withdraw unallocated
   4.1. The dashboard posts { action: 'withdraw', amount } to
        /api/vault/build. buildWithdraw produces an invoke for
        withdraw_unallocated(parent, amount).
   4.2. Same build -> sign -> submit cycle. The contract enforces
        amount <= (vault.balance - vault.allocated). A vault_events
        row with kind='withdraw' is recorded.

5. USDC trustline opt-in
   5.1. The wallet strip POSTs to /api/trustline/build, which calls
        buildUsdcTrustlineXdr(wallet) to produce an unsigned changeTrust
        for the testnet USDC issuer.
   5.2. Freighter signs the classic XDR. The wallet strip POSTs to
        /api/trustline/submit, which sends via Horizon.submitTransaction
        and returns the confirmed tx hash.

6. Stats — /api/stats query + render
   6.1. GET /api/stats calls statsService.getPublic.
   6.2. It runs four queries on Drizzle: COUNT(DISTINCT public_key) and
        COUNT(*) from sessions (optional DEMO_EXCLUDE_KEYS filter),
        COUNT(*) from recipients where archived_at is null, COUNT(*)
        plus SUM(amount) CASE WHEN kind='deposit' / 'claim' from
        vault_events, and the 6 most recent vault_events rows for the
        activity feed.
   6.3. The response is { uniqueWallets, logins, pockets,
        onchainActions, xlmDeposited, xlmClaimed, recent[] }. The
        /stats page renders <StatsView /> which fetches via apiGet and
        shows the totals + recent activity list (with stellar.expert
        links per tx).

ENVIRONMENT VARIABLES

1. NODE_ENV — 'development' | 'test' | 'production'. Drives the Secure
   cookie flag in src/server/lib/cookies.ts.

2. NEXT_PUBLIC_APP_NAME — public, displayed in metadata + UI.

3. NEXT_PUBLIC_APP_URL — public, the origin used for metadataBase.

4. NEXT_PUBLIC_STELLAR_NETWORK — public, 'testnet' | 'public' |
   'futurenet'. Defaults 'testnet'. Drives useFreighter's
   network passphrase pinning.

5. NEXT_PUBLIC_SOROBAN_CONTRACT_ID — public mirror of
   SOROBAN_CONTRACT_ID for any client-side display.

6. DRIZZLE_DATABASE_URL — server only, Postgres connection string for
   Drizzle.

7. STELLAR_NETWORK — server, 'testnet' | 'public' | 'futurenet'.

8. STELLAR_HORIZON_URL — server, Horizon endpoint URL.

9. STELLAR_NETWORK_PASSPHRASE — server, defaults to
   'Test SDF Network ; September 2015'.

10. SOROBAN_RPC_URL — server, defaults to
    https://soroban-testnet.stellar.org.

11. SOROBAN_CONTRACT_ID — server, defaults to the live FamilyVault id.

12. VAULT_TOKEN_SAC — server, the native XLM SAC address the vault
    holds.

13. SESSION_SECRET — server, must be >= 32 chars (Zod validated). Used
    for cookie signing context. NEVER commit; reference only.

14. SESSION_COOKIE_NAME — server, defaults 'tabungan_session'.

15. SESSION_TTL_SECONDS — server, defaults 604800 (7 days).

16. NONCE_TTL_SECONDS — server, defaults 300 (5 minutes).

17. USDC_ASSET_CODE — server, defaults 'USDC'.

18. USDC_ASSET_ISSUER_TESTNET — server, defaults to the Stellar
    testnet USDC issuer public key.

19. DEMO_EXCLUDE_KEYS — server, comma-separated public keys to exclude
    from /api/stats (empty by default — there is NO seeded data, so
    every metric is real).

DEPLOY

1. Vercel project name: tabungan. Scope: thiha (or per-deployment owner).

2. Production URL: https://tabungan-psi.vercel.app.

3. Build command: pnpm install && pnpm build. Start command: pnpm start
   on PORT (default 3001).

4. Database: Postgres on Supabase. Connection string lives in
   DRIZZLE_DATABASE_URL; applied via pnpm db:push (dotenv -e .env.local --
   drizzle-kit push --force).

5. Key URLs
   5.1. App: https://tabungan-psi.vercel.app
   5.2. Stats: https://tabungan-psi.vercel.app/stats
   5.3. Health: https://tabungan-psi.vercel.app/api/health
   5.4. Stats API: https://tabungan-psi.vercel.app/api/stats
   5.5. FamilyVault on stellar.expert:
        https://stellar.expert/explorer/testnet/contract/CBCA73FAZFZUR5NFXOSC45WRHBUY7WKQBII7PVFTJLRY3IHREVQPD7RB
   5.6. Soroban RPC: https://soroban-testnet.stellar.org
   5.7. Horizon: https://horizon-testnet.stellar.org

6. Soroban contract deployment is NOT part of the Vercel deploy. It is
   a one-time op via contracts/scripts/deploy.sh using the Stellar CLI
   v27+ and a funded identity; the live contract id is pinned via
   SOROBAN_CONTRACT_ID.

LIMITATIONS + KNOWN GAPS

1. Testnet only. The deployed FamilyVault lives on Stellar Testnet.
   Mainnet deployment would require a fresh contract id, an updated
   VAULT_TOKEN_SAC for the public XLM SAC, and a re-audit of the
   TTL bumps.

2. Single-token vault. The contract holds one token (native XLM in
   the current deployment). Adding USDC or another SAC would require
   a multi-token design (currently `set_allowance` is global to the
   vault, not per-asset).

3. Allowances are absolute, not recurring. set_allowance is a one-shot
   write; there is no on-chain scheduler that re-credits an allowance
   every week. Recurring top-ups today = the parent runs set_allowance
   periodically (or a backend cron could, but the contract does not
   enforce it).

4. No multi-sig or social recovery on the contract side. pause /
   unpause / set_admin / upgrade are admin-gated; if the admin key is
   lost there is no built-in rotation beyond set_admin.

5. Frontend is English-only. src/i18n/ exists but is empty; no
   locale routing on /[lang]/ today.

6. Dashboard "claimable" discovery is wallet-scoped. The /api/vault
   endpoint lists pockets addressed to the connected wallet by
   matching recipients.address === wallet. A recipient who has never
   logged in to Tabungan still sees the allowance, but the recipient
   must know which parent owns the pocket.

7. RPC polling budget. submit polls for up to 54s. Network congestion
   on Stellar Testnet occasionally pushes confirmations close to that
   cap; maxDuration = 60 absorbs it on Vercel, but a longer settle
   would need a queue + webhook.

8. No background job runner. The build and submit steps are
   synchronous per request. A production hardening would move
   long-running submits to a durable queue.

9. Vault errors are mapped on the client side via mapContractError in
   src/server/stellar/vault.ts. Some upstream Soroban errors do not
   carry an Error(Contract, #N) shape and fall through to a generic
   "rejected this transaction" message.

10. Allowance history in vault_events is append-only; there is no
    audit view in the dashboard beyond the 20 most recent events
    returned by /api/vault.

11. USDC flow is a wallet trustline opt-in only; Tabungan does not
    issue, distribute, or convert USDC. The trustline is built
    against a fixed testnet issuer (GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5).

12. sessions rows are never garbage-collected by the app; only the
    cookie expiry check prevents reuse. A scheduled prune on
    sessions.expires_at < now() is a future op.

13. The (app) route group is an empty placeholder; there is no
    dedicated authenticated shell layout yet.

14. tests/unit/ contains a single lib.test.ts (validators + amounts +
    format). The contract has 12 Rust tests; broader coverage of
    services (auth, vault, stats) is a future op.

15. The Stellar CLI deployment script assumes a single identity
    ('deployer'). Multi-signer governance and rotation is out of
    scope.