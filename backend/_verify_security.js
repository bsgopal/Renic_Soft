// End-to-end verification of:
//  (1) OAuth exact-only secret comparison (suffix/prefix must now FAIL)
//  (2) Strict tenant-scoped login (no cross-tenant user discovery)
// Uses raw http so the Host header can be set explicitly.
// Secrets are read from the DB and NEVER printed.
import mongoose from 'mongoose';
import http from 'http';

function call({ port, path, host, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          ...(host ? { Host: host } : {}),
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data = null;
          try { data = JSON.parse(raw); } catch { /* non-json */ }
          resolve({ status: res.statusCode, data, raw });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const verdict = (ok, label) => `${ok ? 'PASS' : 'FAIL'}  ${label}`;

async function main() {
  // ---- (1) OAuth exact-only secret ----
  await mongoose.connect('mongodb://127.0.0.1:27017/renic_soft', { serverSelectionTimeoutMS: 8000 });
  const client = await mongoose.connection.db.collection('clients').findOne({ clientSecret: { $exists: true, $ne: '' } });
  if (!client?.clientId || !client?.clientSecret) {
    console.log('SKIP  no client with a clientSecret found');
    process.exit(0);
  }
  const clientId = client.clientId;
  const secret = client.clientSecret;
  const code = client.customerCode;
  await mongoose.disconnect();

  console.log(`\n== OAuth token exchange (customerCode=${code}) ==`);
  const base = { grant_type: 'client_credentials', client_id: clientId };
  const cases = [
    ['full secret', secret, (s) => s === 200],
    ['last-30-char SUFFIX (was valid before)', secret.slice(-30), (s) => s === 401],
    ['first-30-char PREFIX (was valid before)', secret.slice(0, 30), (s) => s === 401],
    ['same-length wrong secret', 'x'.repeat(secret.length), (s) => s === 401],
    ['empty secret', '', (s) => s !== 200]
  ];
  for (const [label, attempted, expect] of cases) {
    const r = await call({ port: 5050, path: '/api/v1/oauth/token', body: { ...base, client_secret: attempted } });
    console.log(verdict(expect(r.status), `${label.padEnd(40)} -> HTTP ${r.status}`));
  }

  // ---- (2) Strict tenant-scoped login ----
  console.log('\n== Strict tenant-scoped login ==');
  await mongoose.connect('mongodb://127.0.0.1:27017/textilepos', { serverSelectionTimeoutMS: 8000 });
  const renicUser = await mongoose.connection.db.collection('users').findOne({});
  const saraDb = mongoose.connection.useDb('renic_tenant_saraswat-tx');
  const saraUser = await saraDb.db.collection('users').findOne({});
  await mongoose.disconnect();

  const wrongPw = '__definitely_not_the_password__';
  const isFoundHere = (r) => (r.data?.message || '').toLowerCase().includes('invalid password');
  const isRejected = (r) => r.status === 401 && (r.data?.message || '').toLowerCase().includes('does not exist in this store');

  if (renicUser) {
    const id = renicUser.mobile || renicUser.email;
    const own = await call({ port: 5002, path: '/api/auth/login', host: 'pos.renic-tx.renictech.com', body: { mobile: id, password: wrongPw } });
    console.log(verdict(isFoundHere(own), `RENIC-TX URL + RENIC user   -> "${own.data?.message}" (user FOUND)`));

    const cross = await call({ port: 5002, path: '/api/auth/login', host: 'pos.saraswat-tx.renictech.com', body: { mobile: id, password: wrongPw } });
    console.log(verdict(isRejected(cross), `SARASWAT URL + RENIC user   -> "${cross.data?.message}" (must REJECT)`));
  } else {
    console.log('SKIP  no textilepos user found');
  }

  if (saraUser) {
    const id = saraUser.mobile || saraUser.email;
    const own = await call({ port: 5002, path: '/api/auth/login', host: 'pos.saraswat-tx.renictech.com', body: { mobile: id, password: wrongPw } });
    console.log(verdict(isFoundHere(own), `SARASWAT URL + SARASWAT user-> "${own.data?.message}" (user FOUND)`));

    const cross = await call({ port: 5002, path: '/api/auth/login', host: 'pos.renic-tx.renictech.com', body: { mobile: id, password: wrongPw } });
    console.log(verdict(isRejected(cross), `RENIC-TX URL + SARASWAT user-> "${cross.data?.message}" (must REJECT)`));
  } else {
    console.log('SKIP  no saraswat tenant user found');
  }
}

main().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
