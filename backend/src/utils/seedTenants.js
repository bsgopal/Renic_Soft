import mongoose from 'mongoose';
import Client from '../models/Client.js';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/renic_soft');
  console.log('Connected to MongoDB');

  // Update Royal Jewelers (AU20 - WA_INSTA_AUTOMATION)
  const rj = await Client.findOne({ name: 'Royal Jewelers' });
  if (rj) {
    rj.customerCode = 'AU20';
    rj.shopSlug = 'royaljewelers';
    rj.fullSaaSDomain = 'https://au20-royaljewelers.renic.store';
    rj.softwareProduct = 'WA_INSTA_AUTOMATION';
    rj.portForwarding = {
      targetIp: '127.0.0.1',
      assignedPort: 5000,
      connectionType: 'PORT_FORWARD_ROUTER',
      status: 'online',
      latencyMs: 12,
      autoRelinkEnabled: true,
      offlineGraceHours: 24,
      ipChangeHistory: []
    };
    rj.screenPermissions = {
      dashboard: true,
      messages: true,
      campaigns: true,
      templates: true,
      catalog: true,
      workflows: true,
      responseRules: true,
      aiSalesAgent: false,
      settings: true
    };
    rj.securitySettings = {
      emergencyLock: false,
      lockReason: '',
      requireShowroomIp: false,
      previousSlugs: []
    };
    await rj.save();
    console.log('Successfully updated Royal Jewelers (AU20)');
  }

  // Upsert Chennai Silks & Textiles (TX10 - TEXTILE_POS)
  const existingTx = await Client.findOne({ customerCode: 'TX10' });
  if (!existingTx) {
    await Client.create({
      name: 'Chennai Silks & Textiles',
      customerCode: 'TX10',
      shopSlug: 'chennaisilks',
      fullSaaSDomain: 'https://tx10-chennaisilks.renic.store',
      softwareProduct: 'TEXTILE_POS',
      licenseKey: 'TX10-CHENNAI-TEXTILES-ENTERPRISE-2026',
      licenseStatus: 'active',
      licenseStart: new Date(),
      licenseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      planTier: 'enterprise',
      portForwarding: {
        targetIp: '127.0.0.1',
        assignedPort: 5002,
        connectionType: 'PORT_FORWARD_ROUTER',
        status: 'online',
        latencyMs: 8,
        autoRelinkEnabled: true,
        offlineGraceHours: 24,
        ipChangeHistory: []
      },
      screenPermissions: {
        posBilling: true,
        inventory: true,
        customerOrders: true,
        customers: true,
        suppliers: true,
        purchaseOrders: true,
        damageEntry: true,
        floors: true,
        reports: true,
        expenses: true,
        hsnSetup: true,
        settings: true
      },
      securitySettings: {
        emergencyLock: false,
        lockReason: '',
        requireShowroomIp: false,
        previousSlugs: []
      }
    });
    console.log('Successfully created Chennai Silks & Textiles (TX10)');
  } else {
    console.log('Chennai Silks (TX10) already exists');
  }

  // Upsert Renic Garments Logistics & Dispatch Suite (DC10 - DELIVERY_CHALLAN)
  const existingDc = await Client.findOne({ customerCode: 'DC10' });
  if (!existingDc) {
    await Client.create({
      name: 'Renic Garments Logistics & Dispatch',
      customerCode: 'DC10',
      shopSlug: 'renicdispatch',
      fullSaaSDomain: 'https://dc10-dispatch.renic.store',
      softwareProduct: 'DELIVERY_CHALLAN',
      licenseKey: 'DC10-RENIC-DISPATCH-ENTERPRISE-2026',
      licenseStatus: 'active',
      licenseStart: new Date(),
      licenseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      planTier: 'enterprise',
      portForwarding: {
        targetIp: '127.0.0.1',
        assignedPort: 5176,
        connectionType: 'PORT_FORWARD_ROUTER',
        status: 'online',
        latencyMs: 6,
        autoRelinkEnabled: true,
        offlineGraceHours: 24,
        ipChangeHistory: []
      },
      screenPermissions: {
        dashboard: true,
        challans: true,
        packaging: true,
        barcodes: true,
        billings: true,
        quotations: true,
        vendors: true,
        products: true
      },
      securitySettings: {
        emergencyLock: false,
        lockReason: '',
        requireShowroomIp: false,
        previousSlugs: []
      }
    });
    console.log('Successfully created Renic Garments Logistics (DC10)');
  } else {
    console.log('Renic Garments Logistics (DC10) already exists');
  }

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
