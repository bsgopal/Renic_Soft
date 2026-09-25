// Renic_Soft/backend/src/services/tenantProvisioningService.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Automatically provisions an isolated MongoDB database for a new customer/tenant.
 * Creates db `renic_tenant_<customerCode>` and pre-seeds essential schemas and admin user.
 */
export async function provisionTenantDatabase({
  customerCode,
  shopName,
  ownerEmail,
  ownerMobile,
  ownerPassword,
  softwareProduct = 'WA_INSTA_AUTOMATION',
  clientId,
  planTier = 'basic'
}) {
  if (!customerCode) {
    throw new Error('customerCode is required to provision tenant database');
  }

  const cleanCode = customerCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const dbName = `renic_tenant_${cleanCode}`;

  console.log(`\x1b[35m[Tenant Provisioning]\x1b[0m Initializing isolated database '${dbName}' for customer [${customerCode}]...`);

  // Switch to or create isolated tenant DB using the shared connection pool
  const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

  const results = {
    dbName,
    customerCode: customerCode.toUpperCase(),
    collectionsInitialized: []
  };

  try {
    // 1. Seed Tenant Settings / Meta Collection
    const settingsCollection = tenantDb.collection('tenant_settings');
    await settingsCollection.updateOne(
      { customerCode: customerCode.toUpperCase() },
      {
        $set: {
          customerCode: customerCode.toUpperCase(),
          shopName: shopName || customerCode,
          softwareProduct,
          clientId: clientId || '',
          planTier,
          provisionedAt: new Date(),
          status: 'ACTIVE'
        }
      },
      { upsert: true }
    );
    results.collectionsInitialized.push('tenant_settings');

    // 2. Seed Admin User in Tenant DB
    const usersCollection = tenantDb.collection('users');
    const existingUser = await usersCollection.findOne({ email: ownerEmail });
    if (!existingUser && ownerEmail) {
      const hashedPassword = ownerPassword ? (ownerPassword.startsWith('$2') ? ownerPassword : await bcrypt.hash(ownerPassword, 10)) : '';
      await usersCollection.insertOne({
        name: shopName ? `${shopName} Admin` : 'Administrator',
        email: ownerEmail,
        mobile: ownerMobile || '',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      results.collectionsInitialized.push('users');
    }

    // 3. Seed Default AI / Response Rules for WA_INSTA_AUTOMATION
    if (softwareProduct === 'WA_INSTA_AUTOMATION' || !softwareProduct) {
      const rulesCollection = tenantDb.collection('rules');
      const rulesCount = await rulesCollection.countDocuments();
      if (rulesCount === 0) {
        await rulesCollection.insertMany([
          {
            name: 'Welcome Greeting',
            triggerType: 'keyword',
            keywords: ['hi', 'hello', 'hey', 'start'],
            matchType: 'contains',
            responseType: 'text',
            responseContent: `Hello! Welcome to ${shopName || 'our store'}. How can we assist you today?`,
            isActive: true,
            createdAt: new Date()
          },
          {
            name: 'Business Hours & Location',
            triggerType: 'keyword',
            keywords: ['timing', 'hours', 'address', 'location'],
            matchType: 'contains',
            responseType: 'text',
            responseContent: `We are open Monday - Saturday, 9:00 AM to 9:00 PM. Please visit us or reply with your query!`,
            isActive: true,
            createdAt: new Date()
          }
        ]);
        results.collectionsInitialized.push('rules');
      }
    }

    // 4. Seed Counters collection for Invoicing / Order Numbering
    const countersCollection = tenantDb.collection('counters');
    await countersCollection.updateOne(
      { _id: 'invoice_number' },
      { $setOnInsert: { seq: 1000 } },
      { upsert: true }
    );
    results.collectionsInitialized.push('counters');

    console.log(`\x1b[32m[Tenant Provisioning Complete]\x1b[0m DB '${dbName}' ready with collections: ${results.collectionsInitialized.join(', ')}`);
    return { success: true, ...results };
  } catch (error) {
    console.error(`[Tenant Provisioning Error] Failed to provision '${dbName}':`, error);
    throw error;
  }
}
