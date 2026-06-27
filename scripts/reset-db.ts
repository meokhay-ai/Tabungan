import { Pool } from 'pg';

const url = process.env.DRIZZLE_DATABASE_URL;
if (!url) throw new Error('DRIZZLE_DATABASE_URL missing');

const pool = new Pool({ connectionString: url, max: 1 });

const DROP = [
  'allowances',
  'spends',
  'children',
  'parents',
  'recipients',
  'auth_nonces',
  'sessions',
];

async function main() {
  for (const t of DROP) {
    await pool.query(`DROP TABLE IF EXISTS "${t}" CASCADE;`);
    console.log('dropped', t);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
