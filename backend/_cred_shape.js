// Reports only SHAPE/LENGTH metadata about stored credentials — never the values.
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/renic_soft', { serverSelectionTimeoutMS: 8000 });
  const docs = await mongoose.connection.db.collection('clients').find({}).toArray();
  console.log(`clients: ${docs.length}`);
  for (const c of docs) {
    const oc = c.oauthConfig || {};
    const cs = c.clientSecret ?? oc.clientSecret;
    const api = c.apiSecretKey;
    const hash = c.clientSecretHash ?? oc.clientSecretHash;
    console.log([
      `code=${c.customerCode}`,
      `clientId.len=${(c.clientId || oc.clientId || '').length}`,
      `clientId.pfx=${(c.clientId || oc.clientId || '').slice(0, 8)}`,
      `secret.len=${cs ? cs.length : 0}`,
      `secret.pfx=${cs ? String(cs).slice(0, 6) : '-'}`,
      `secret==apiSecretKey:${cs === api}`,
      `hash.pfx=${hash ? String(hash).slice(0, 4) : 'none'}`
    ].join(' | '));
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
