import mongoose from 'mongoose';
import { buildCustomerUrlForProduct } from './src/utils/customerUrl.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/renic_soft', { serverSelectionTimeoutMS: 8000 });
  const col = mongoose.connection.db.collection('clients');
  const docs = await col.find({}).toArray();

  for (const c of docs) {
    const canonical = buildCustomerUrlForProduct(c);
    const before = c.fullSaaSDomain || '(empty)';
    if (!canonical) {
      console.log(`SKIP ${c.customerCode || c.name} — could not build URL`);
      continue;
    }
    if (before !== canonical) {
      await col.updateOne({ _id: c._id }, { $set: { fullSaaSDomain: canonical } });
      console.log(`FIXED ${c.customerCode}  ${before}  ->  ${canonical}`);
    } else {
      console.log(`OK    ${c.customerCode}  ${canonical}`);
    }
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
