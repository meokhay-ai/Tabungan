import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import {
  approveOnce,
  cleanup,
  getExtensionId,
  launchWithFreighter,
  onboardFreighter,
} from '../../../../../shared/freighter/freighter-fixture';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://tabungan-psi.vercel.app';
const DEPLOYER_PREFIX = 'GBL5';
const POPUP_BUTTON = '[data-testid=grant-access-connect-button], [data-testid=sign-transaction-sign]';

const SHOTS = path.resolve(__dirname, '../../../screen-shot');
mkdirSync(SHOTS, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(SHOTS, name), type: 'jpeg', quality: 85 });

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let userDataDir: string;

test.beforeAll(async () => {
  const launched = await launchWithFreighter(chromium);
  context = launched.context;
  userDataDir = launched.userDataDir;
  await onboardFreighter(context);
});

test.afterAll(async () => {
  if (context) await cleanup(context, userDataDir);
});

async function waitForFreighterPopup(timeout: number): Promise<Page | null> {
  const prefix = `chrome-extension://${getExtensionId(context)}`;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const p of context.pages()) {
      if (p.isClosed() || !p.url().startsWith(prefix)) continue;
      const visible = await p.locator(POPUP_BUTTON).first().isVisible().catch(() => false);
      if (visible) return p;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function snapAndApprove(name: string, timeout: number): Promise<void> {
  const popup = await waitForFreighterPopup(timeout);
  if (popup) {
    await popup.waitForTimeout(1200);
    await popup.screenshot({ path: path.join(SHOTS, name), type: 'jpeg', quality: 85 }).catch(() => {});
  }
  await approveOnce(context, { timeout });
}

async function connectWallet(page: Page): Promise<void> {
  await page.getByRole('button', { name: /connect/i }).first().click();
  await snapAndApprove('02-connect-popup.jpg', 60_000);
  await snapAndApprove('03-sign-challenge-popup.jpg', 90_000);
}

async function depositToVault(page: Page, amount: string): Promise<string> {
  await page.getByRole('button', { name: /deposit xlm/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.locator('input[inputmode="decimal"]').fill(amount);
  await dialog.getByRole('button', { name: /^deposit$/i }).click();
  await snapAndApprove('05-deposit-sign-popup.jpg', 120_000);

  const txLink = dialog.locator('a[href*="stellar.expert"][href*="/tx/"]');
  await expect(txLink).toBeVisible({ timeout: 120_000 });
  const href = (await txLink.getAttribute('href')) ?? '';
  expect(href).toContain('/explorer/testnet/tx/');
  return href.split('/tx/')[1] ?? '';
}

test('real Freighter: connect grant + SEP-10 sign + on-chain deposit -> real tx hash', async () => {
  test.setTimeout(320_000);
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.getByRole('button', { name: /connect/i }).first()).toBeVisible({
    timeout: 20_000,
  });
  await shot(page, '01-landing.jpg');

  await connectWallet(page);

  const chip = page.getByTestId('account-chip');
  await expect(chip).toBeVisible({ timeout: 60_000 });
  expect((await chip.textContent())?.trim() ?? '').toContain(DEPLOYER_PREFIX);
  await page.waitForTimeout(1500);
  await shot(page, '04-dashboard.jpg');

  const txHash = await depositToVault(page, '5');
  expect(txHash).toBeTruthy();
  await shot(page, '06-deposit-success.jpg');
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  await page.goto(`${BASE_URL}/stats`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Every number here is real/i)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await shot(page, '07-stats.jpg');

  // biome-ignore lint/suspicious/noConsole: surface the real tx hash for the run report
  console.log(`CORE_FLOW_TX=${txHash}`);
});

test('mobile landing renders', async () => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.getByText(/Testnet/i).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);
  await shot(page, '08-mobile.jpg');
});
