// Renic_Soft/backend/src/services/trialMigrationService.js
import mongoose from 'mongoose';
import Client from '../models/Client.js';
import { invalidateProxyCache } from '../utils/proxyCache.js';
import { notifyProductionActivated } from '../utils/whatsappNotifier.js';

const TRIAL_COLLECTIONS = [
  'users',
  'clients',
  'products',
  'stockunits',
  'masterdatas',
  'bills',
  'customers',
  'damageentries',
  'expenses',
  'floors',
  'paymentconfigs',
  'roles',
  'skuconfigs',
  'suppliers',
  'customerorders',
  'printtemplates'
];

/**
 * 1-Click Engine: Converts a Free Trial customer into a Dedicated Production Tenant.
 * Provisions 'renic_tenant_<code', copies all trial data, and activates full subscription.
 */
export async function convertTrialToProduction(clientId, options = {}) {
  const {
    planTier = 'enterprise',
    subscriptionDays = 365,
    paymentReference = ''
  } = options;

  const client = await Client.findById(clientId);
  if (!client) {
    throw new Error('Client not found');
  }

  const customerCode = client.customerCode || client.subdomain || 'CLIENT';
  const cleanCode = customerCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const targetDbName = `renic_tenant_${cleanCode}`;
  const sourceDbName = client.databaseName || 'renic_trial_sandbox';

  console.log(`\x1b[36m[Trial Migration]\x1b[0m Migrating trial client [${customerCode}] from '${sourceDbName}' to dedicated '${targetDbName}'...`);

  const sourceDb = mongoose.connection.useDb(sourceDbName, { useCache: true });
  const targetDb = mongoose.connection.useDb(targetDbName, { useCache: true });

  const migrationSummary = {};
  let totalRecordsMigrated = 0;

  // 1. Migrate each collection
  for (const colName of TRIAL_COLLECTIONS) {
    try {
      const sourceCol = sourceDb.collection(colName);
      const targetCol = targetDb.collection(colName);

      // Find documents matching this client
      const docs = await sourceCol.find({
        $or: [
          { clientId: client._id },
          { clientId: client._id.toString() }
        ]
      }).toArray();

      if (docs.length > 0) {
        // Upsert or insert into target
        for (const doc of docs) {
          await targetCol.replaceOne({ _id: doc._id }, doc, { upsert: true });
        }
        migrationSummary[colName] = docs.length;
        totalRecordsMigrated += docs.length;
      }
    } catch (colErr) {
      console.warn(`[Trial Migration Warning] Failed to migrate collection '${colName}':`, colErr.message);
    }
  }

  // 2. Ensure store Client document exists in targetDb
  try {
    const targetClients = targetDb.collection('clients');
    const existingStore = await targetClients.findOne({});
    if (!existingStore) {
      await targetClients.insertOne({
        name: client.name,
        phone: client.adminMobile || client.contact || '',
        contact: client.contact || client.ownerEmail || '',
        planTier,
        licenseStatus: 'active',
        maxFloors: 99,
        maxUsers: 999,
        maxProducts: 999999,
        screenPermissions: client.screenPermissions || {},
        stockConfig: client.stockConfig || {},
        billingConfig: client.billingConfig || {},
        pricingConfig: client.pricingConfig || {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  } catch (err) {
    console.warn('[Trial Migration] Target client store ensure warning:', err.message);
  }

  // 3. Update Client in Renic_Soft
  const now = new Date();
  const newLicenseEnd = new Date(now.getTime() + parseInt(subscriptionDays) * 24 * 60 * 60 * 1000);

  client.isTrial = false;
  client.databaseName = targetDbName;
  client.licenseStatus = 'active';
  client.planTier = planTier;
  client.licenseStart = now;
  client.licenseEnd = newLicenseEnd;
  client.expiryAlertSent = false;
  if (client.securitySettings) {
    client.securitySettings.emergencyLock = false;
    client.securitySettings.lockReason = '';
  }

  await client.save();

  // 4. Invalidate Gateway Proxy Cache so incoming traffic instantly connects
  if (client.customerCode) invalidateProxyCache(client.customerCode.toLowerCase());
  if (client.subdomain) invalidateProxyCache(client.subdomain.toLowerCase());
  if (client.shopSlug) invalidateProxyCache(client.shopSlug.toLowerCase());

  // 5. Dispatch celebration WhatsApp alert
  try {
    await notifyProductionActivated(client, newLicenseEnd);
  } catch (alertErr) {
    console.warn('[Trial Migration] WhatsApp alert failed:', alertErr.message);
  }

  console.log(`\x1b[32m[Trial Migration Success]\x1b[0m Client [${customerCode}] upgraded to production '${targetDbName}'. Records migrated: ${totalRecordsMigrated}`);

  return {
    success: true,
    customerCode,
    targetDbName,
    totalRecordsMigrated,
    migrationSummary,
    newLicenseEnd
  };
}
