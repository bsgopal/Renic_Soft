import mongoose from 'mongoose';
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/renic_soft', { serverSelectionTimeoutMS: 8000 });
  const docs = await mongoose.connection.db.collection('clients').find({}).project({ customerCode: 1, isTrial: 1, databaseName: 1, licenseStatus: 1 }).toArray();
  for (const c of docs) console.log(`code=${c.customerCode} isTrial=${c.isTrial} db=${c.databaseName} status=${c.licenseStatus}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
