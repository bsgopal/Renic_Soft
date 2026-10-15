import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/renic_soft', { serverSelectionTimeoutMS: 8000 });
  const col = mongoose.connection.db.collection('clients');
  const docs = await col.find({}).toArray();
  console.log(`clients: ${docs.length}`);
  for (const c of docs) {
    console.log('----------------------------------------');
    console.log(' _id              :', String(c._id));
    console.log(' name             :', c.name);
    console.log(' customerCode     :', c.customerCode);
    console.log(' subdomain        :', c.subdomain);
    console.log(' shopSlug         :', c.shopSlug);
    console.log(' fullSaaSDomain   :', c.fullSaaSDomain);
    console.log(' softwareProduct  :', c.softwareProduct);
    console.log(' databaseName     :', c.databaseName);
    console.log(' licenseStatus    :', c.licenseStatus);
    console.log(' assignedPort     :', c.assignedPort);
    console.log(' portForwarding   :', JSON.stringify(c.portForwarding));
    console.log(' fieldConfig      :', JSON.stringify(c.fieldConfig));
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });

