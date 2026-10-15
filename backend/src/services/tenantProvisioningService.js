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
  planTier = 'basic',
  isTrial = false,
  databaseName = '',
  solutionMode = '',
  solutionModes = [],
  businessType = '',
  customTerminology = {},
  screenPermissions = {},
  whatsappSenderMode = 'DOCKER',
  dockerThrottleSeconds = 6
}) {
  if (!customerCode) {
    throw new Error('customerCode is required to provision tenant database');
  }

  const cleanCode = customerCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  let dbName = databaseName?.trim();
  if (!dbName) {
    if (softwareProduct === 'SIMPLE_BILLING') {
      dbName = Boolean(isTrial) ? `simple_billing_trial-${cleanCode}` : `simple_billing-${cleanCode}`;
    } else if (softwareProduct === 'PAWN_BROKING' || softwareProduct === 'PAWNBOOK_PRO') {
      dbName = Boolean(isTrial) ? `pawnbroking_trial-${cleanCode}` : `pawnbroking-${cleanCode}`;
    } else {
      dbName = Boolean(isTrial) ? `renic_trial_${cleanCode}` : `renic_tenant_${cleanCode}`;
    }
  }

  console.log(`\x1b[35m[Tenant Provisioning]\x1b[0m Initializing isolated database '${dbName}' (${isTrial ? 'TRIAL SANDBOX' : 'PRODUCTION'}) for customer [${customerCode}] (Mode: ${whatsappSenderMode})...`);

  // Switch to or create isolated tenant DB using the shared connection pool
  const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });

  const results = {
    dbName,
    customerCode: customerCode.toUpperCase(),
    isTrial: Boolean(isTrial),
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
          solutionMode,
          solutionModes: Array.isArray(solutionModes) ? solutionModes : (solutionMode ? [solutionMode] : []),
          businessType,
          customTerminology,
          clientId: clientId || '',
          planTier,
          screenPermissions: screenPermissions || {},
          whatsappSenderMode: (whatsappSenderMode || 'DOCKER').toUpperCase(),
          dockerThrottleSeconds: Number(dockerThrottleSeconds) || 6,
          isTrial: Boolean(isTrial),
          provisionedAt: new Date(),
          status: 'ACTIVE'
        }
      },
      { upsert: true }
    );
    results.collectionsInitialized.push('tenant_settings');

    // 2. Seed Admin User in Tenant DB
    const usersCollection = tenantDb.collection('users');
    const existingUser = await usersCollection.findOne({
      $or: [
        { email: (ownerEmail || '').toLowerCase().trim() },
        { phone: (ownerMobile || '').trim() },
        { mobile: (ownerMobile || '').trim() }
      ]
    });
    let adminUserId = existingUser?._id;
    const hashedPassword = ownerPassword ? (ownerPassword.startsWith('$2') ? ownerPassword : await bcrypt.hash(ownerPassword, 10)) : '';

    if (existingUser) {
      // Ensure password and role are updated
      await usersCollection.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            password: hashedPassword || existingUser.password,
            phone: (ownerMobile || existingUser.phone || existingUser.mobile || '').trim(),
            mobile: (ownerMobile || existingUser.mobile || existingUser.phone || '').trim(),
            role: 'ADMIN',
            isActive: true,
            updatedAt: new Date()
          }
        }
      );
    } else if (ownerEmail || ownerMobile) {
      const userRes = await usersCollection.insertOne({
        name: shopName ? `${shopName} Admin` : 'Administrator',
        firstName: shopName || 'Admin',
        lastName: 'User',
        email: (ownerEmail || `${cleanCode}@client.com`).toLowerCase().trim(),
        phone: (ownerMobile || '').trim(),
        mobile: (ownerMobile || '').trim(),
        password: hashedPassword,
        role: 'ADMIN',
        companyName: shopName || customerCode,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      adminUserId = userRes.insertedId;
      results.collectionsInitialized.push('users');
    }

    // 2a. Also sync admin user into the local app database (renic-automation) for instant single-process testing
    if (softwareProduct === 'WA_INSTA_AUTOMATION') {
      try {
        const appDb = mongoose.connection.useDb('renic-automation', { useCache: true });
        await appDb.collection('users').updateOne(
          {
            $or: [
              { email: (ownerEmail || '').toLowerCase().trim() },
              { phone: (ownerMobile || '').trim() },
              { mobile: (ownerMobile || '').trim() }
            ]
          },
          {
            $set: {
              name: shopName ? `${shopName} Admin` : 'Administrator',
              firstName: shopName || 'Admin',
              lastName: 'User',
              email: (ownerEmail || `${cleanCode}@client.com`).toLowerCase().trim(),
              phone: (ownerMobile || '').trim(),
              mobile: (ownerMobile || '').trim(),
              password: hashedPassword,
              role: 'ADMIN',
              companyName: shopName || customerCode,
              isActive: true,
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
      } catch (appDbErr) {
        console.warn('[Tenant Provisioning] Local app DB user sync note:', appDbErr.message);
      }
    }

    // 2b. Seed Workspace ShopConfig with strict OAuth Enforced across ALL client applications
    const shopConfigsCollection = tenantDb.collection('shopconfigs');
    await shopConfigsCollection.updateOne(
      { customerCode: customerCode.toUpperCase() },
      {
        $set: {
          userId: adminUserId,
          shopName: shopName || customerCode,
          companyName: shopName || customerCode,
          customerCode: customerCode.toUpperCase(),
          oauthEnforced: true,
          screenPermissions: screenPermissions || {},
          whatsappSenderMode: (whatsappSenderMode || 'DOCKER').toUpperCase(),
          metaApiEnabled: (whatsappSenderMode || 'DOCKER').toUpperCase() === 'META',
          dockerThrottleSeconds: Number(dockerThrottleSeconds) || 6,
          oauthConfig: {
            clientId: '',
            clientSecret: '',
            verified: false,
            lastVerifiedAt: null
          },
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    results.collectionsInitialized.push('shopconfigs');

    // 3. Seed Appointment Terminology & Defaults for WA_INSTA_AUTOMATION
    if (softwareProduct === 'WA_INSTA_AUTOMATION') {
      const sLabel = customTerminology.serviceLabel || 'Service';
      const stLabel = customTerminology.staffLabel || 'Staff';
      const cLabel = customTerminology.clientLabel || 'Customer';

      const terminologyObj = {
        businessType: businessType || 'GENERAL_SERVICE',
        businessTypeName: customTerminology.displayName || shopName || 'Booking Portal',
        staffLabel: stLabel,
        staffLabelPlural: customTerminology.staffPluralLabel || `${stLabel} Members`,
        serviceLabel: sLabel,
        serviceLabelPlural: customTerminology.servicePluralLabel || `${sLabel} Offerings`,
        clientLabel: cLabel,
        clientLabelPlural: customTerminology.clientPluralLabel || `${cLabel}s`,
        bookingActionLabel: customTerminology.bookingActionLabel || 'Book Appointment',
        addServiceBtnText: customTerminology.addServiceBtnText || `Add ${sLabel}`,
        addStaffBtnText: customTerminology.addStaffBtnText || `Add ${stLabel}`,
        ...customTerminology
      };

      const apptSettingsCol = tenantDb.collection('appointmentsettings');
      await apptSettingsCol.updateOne(
        { userId: adminUserId },
        {
          $set: {
            userId: adminUserId,
            terminology: terminologyObj,
            customTerminology: terminologyObj,
            slotIntervalMinutes: Number(customTerminology.defaultSlotDuration) || 30,
            bufferMinutesBetweenSlots: Number(customTerminology.defaultBookingBuffer) || 0,
            botEnabled: true,
            reminder24hEnabled: true,
            welcomeMessage: `👋 Welcome to ${shopName}! I can help you schedule your ${sLabel.toLowerCase()} with our ${customTerminology.staffPluralLabel || stLabel}. Please choose an option below:`,
            confirmationTemplate: `✅ *Booking Confirmed!*\n\n📅 Date: {date}\n⏰ Time: {time}\n👤 ${stLabel}: {staffName}\n🩺 ${sLabel}: {serviceName}\n🆔 Booking ID: #{bookingRef}\n\nTo manage your visit, reply *MANAGE*.`,
            staffAlertTemplate: `🔔 *New Booking Confirmed!*\n\n👤 ${cLabel}: {customerName} ({customerPhone})\n📅 Date: {date}\n⏰ Time: {time}\n🩺 ${sLabel}: {serviceName}\n🆔 Ref: #{bookingRef}`
          }
        },
        { upsert: true }
      );
      results.collectionsInitialized.push('appointmentsettings');

      // Seed Initial Service & Staff matching the business type
      const servicesCol = tenantDb.collection('appointmentservices');
      const srvCount = await servicesCol.countDocuments();
      if (srvCount === 0) {
        await servicesCol.insertOne({
          userId: adminUserId,
          name: `Standard ${sLabel}`,
          description: `Primary ${sLabel.toLowerCase()} provided by ${shopName}`,
          category: 'Standard Offerings',
          durationMinutes: Number(customTerminology.defaultSlotDuration) || 30,
          price: 500,
          currency: 'INR',
          isActive: true,
          colorCode: '#10b981',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        results.collectionsInitialized.push('appointmentservices');
      }

      const staffCol = tenantDb.collection('appointmentstaffs');
      const staffCount = await staffCol.countDocuments();
      if (staffCount === 0) {
        await staffCol.insertOne({
          userId: adminUserId,
          name: `Lead ${stLabel}`,
          designation: `Senior ${stLabel}`,
          whatsappAlertPhone: ownerMobile || '',
          email: ownerEmail || '',
          experienceYears: 5,
          colorTag: '#3b82f6',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        results.collectionsInitialized.push('appointmentstaffs');
      }

      // Seed Default AI / Keyword Rules
      const rulesCollection = tenantDb.collection('rules');
      const rulesCount = await rulesCollection.countDocuments();
      if (rulesCount === 0) {
        await rulesCollection.insertMany([
          {
            name: 'Welcome Greeting',
            triggerType: 'keyword',
            keywords: ['hi', 'hello', 'hey', 'start', 'book'],
            matchType: 'contains',
            responseType: 'text',
            responseContent: `Hello! Welcome to ${shopName || 'our desk'}. How can we assist you today? Reply *BOOK* to reserve a slot.`,
            isActive: true,
            createdAt: new Date()
          }
        ]);
        results.collectionsInitialized.push('rules');
      }
    }

    // 3b. Seed PawnBroking Initial Setup for PAWN_BROKING / PAWNBOOK_PRO
    if (softwareProduct === 'PAWN_BROKING' || softwareProduct === 'PAWNBOOK_PRO') {
      // 1. Seed Main Branch
      const branchCol = tenantDb.collection('branches');
      const branchCount = await branchCol.countDocuments();
      if (branchCount === 0) {
        await branchCol.insertOne({
          code: `${cleanCode.toUpperCase()}-01`,
          name: shopName ? `${shopName} Main Branch` : 'Main Branch',
          manager: 'Branch Manager',
          mobile: ownerMobile || '',
          email: ownerEmail || '',
          address: 'Main Commercial Street',
          city: 'City Central',
          openTime: '09:30 AM',
          closeTime: '07:30 PM',
          vaults: ['Main Vault Safe A', 'Secondary Vault Safe B'],
          staff: ['Cashier 1', 'Valuer 1'],
          isActive: true,
          createdAt: new Date()
        });
        results.collectionsInitialized.push('branches');
      }

      // 2. Seed Default Daily Metal Rates
      const ratesCol = tenantDb.collection('metalrates');
      const ratesCount = await ratesCol.countDocuments();
      if (ratesCount === 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        await ratesCol.insertOne({
          date: todayStr,
          gold22K: 6850,
          gold24K: 7450,
          gold18K: 5600,
          silver: 92,
          platinum: 3600,
          updatedBy: 'System Auto-Seed',
          updatedAt: new Date(),
          history: [
            { date: todayStr, gold22K: 6850, gold24K: 7450, gold18K: 5600, silver: 92, platinum: 3600 }
          ]
        });
        results.collectionsInitialized.push('metalrates');
      }

      // 3. Seed Pawn Broking System Settings & ShopConfig
      const ticketConfigObj = {
        enabled: true,
        prefix: 'PWN',
        suffix: '',
        separator: '-',
        yearFormat: 'YYYY',
        monthFormat: 'NONE',
        paddingDigits: 4,
        nextSequence: 1,
        patternTemplate: '{PREFIX}-{YEAR}-{SEQ}',
        strictEnforcement: true
      };

      const pawnSettingsCol = tenantDb.collection('pawnsettings');
      await pawnSettingsCol.updateOne(
        { customerCode: customerCode.toUpperCase() },
        {
          $set: {
            customerCode: customerCode.toUpperCase(),
            shopName: shopName || 'PawnBook Pro Showroom',
            rbiLicenseNo: 'RB/PB/' + cleanCode.toUpperCase() + '/2026',
            gstinNo: '',
            address: 'Main Commercial Street',
            eligibleCollateralPct: 75,
            rbiInterestCapPa: 24,
            defaultGracePeriodDays: 7,
            defaultPenaltyPct: 1,
            defaultInterestScheme: 'MONTHLY_SIMPLE',
            smsRemindersEnabled: true,
            whatsappAlertsEnabled: true,
            thermalPrinterName: 'Default Printer',
            thermalPaperWidth: '80mm',
            ticketConfig: ticketConfigObj,
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      results.collectionsInitialized.push('pawnsettings');

      // Also ensure shopconfigs in tenant DB has ticketConfig
      await shopConfigsCollection.updateOne(
        { customerCode: customerCode.toUpperCase() },
        {
          $set: {
            ticketConfig: ticketConfigObj,
            eligibleCollateralPct: 75,
            rbiInterestCapPa: 24,
            defaultMonthlyInterestPct: 2.0,
            defaultGracePeriodDays: 7,
            defaultPenaltyPct: 1.0,
            rbiLicenseNo: 'RB/PB/' + cleanCode.toUpperCase() + '/2026',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
    }

    // 3c. Seed Simple Retail & Petti Shop Initial Setup for SIMPLE_BILLING
    if (softwareProduct === 'SIMPLE_BILLING') {
      const hashedPin = await bcrypt.hash('1234', 10);
      
      // 1. Ensure User in Tenant DB has both password and pin
      await usersCollection.updateOne(
        {
          $or: [
            { mobile: (ownerMobile || '').trim() },
            { phone: (ownerMobile || '').trim() },
            { email: (ownerEmail || `${cleanCode}@client.com`).toLowerCase().trim() }
          ]
        },
        {
          $set: {
            name: shopName ? `${shopName} Owner` : 'Shop Owner',
            mobile: (ownerMobile || '').trim(),
            phone: (ownerMobile || '').trim(),
            password: hashedPassword,
            pin: hashedPin,
            role: 'owner',
            isActive: true,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      results.collectionsInitialized.push('users');

      // 2. Seed ShopSettings
      const shopSettingsCol = tenantDb.collection('shopsettings');
      await shopSettingsCol.updateOne(
        { customerCode: customerCode.toUpperCase() },
        {
          $set: {
            customerCode: customerCode.toUpperCase(),
            shopName: shopName || 'Simple Retail Store',
            ownerName: shopName || 'Owner',
            phone: ownerMobile || '9842512143',
            address: 'Main Bazaar',
            shopType: 'petti',
            chargeGst: false,
            priceIncludesGst: true,
            paperSize: '80mm',
            headerLines: ['Fresh Quality Products', `Phone: ${ownerMobile || '9842512143'}`],
            footerMessage: 'Thank you! Visit again!',
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      results.collectionsInitialized.push('shopsettings');

      // 3. Ensure Walk-in customer exists
      const customersCol = tenantDb.collection('customers');
      const walkInExists = await customersCol.findOne({ name: 'Walk-in Customer' });
      if (!walkInExists) {
        await customersCol.insertOne({
          name: 'Walk-in Customer',
          phone: '',
          creditLimit: 0,
          balanceDue: 0,
          createdAt: new Date()
        });
        results.collectionsInitialized.push('customers');
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
