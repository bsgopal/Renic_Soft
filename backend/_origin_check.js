import mongoose from 'mongoose';
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/renic_soft', { serverSelectionTimeoutMS: 8000 });
  const docs = await mongoose.connection.db.collection('clients').find({}).project({
    customerCode: 1, fullSaaSDomain: 1, softwareProduct: 1, assignedPort: 1, portForwarding: 1, licenseStatus: 1
  }).toArray();
  for (const c of docs) {
    const pf = c.portForwarding || {};
    console.log(`${c.customerCode} [${c.softwareProduct}/${c.licenseStatus}]`);
    console.log(`   url       = ${c.fullSaaSDomain || '-'}`);
    console.log(`   port      = ${c.assignedPort ?? pf.assignedPort ?? '-'}   targetIp=${pf.targetIp || '-'}   conn=${pf.connectionType || '-'}`);
    console.log(`   publicWeb = ${pf.publicWebUrl || '-'}`);
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
