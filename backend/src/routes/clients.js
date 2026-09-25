import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { dbHelper } from '../models/dbHelper.js';
import Client from '../models/Client.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendLicenseEmail, sendActivationOtpEmail } from '../utils/mailer.js';
import { encryptLicense, decryptLicense } from '../utils/licenseCrypto.js';
import { invalidateProxyCache } from '../utils/proxyCache.js';
import { notifyClientOnboarded, notifyLicenseStatus } from '../utils/whatsappNotifier.js';
import { provisionTenantDatabase } from '../services/tenantProvisioningService.js';
import { convertTrialToProduction } from '../services/trialMigrationService.js';
import { generateClientCredentials } from './oauthRoutes.js';

const router = express.Router();

const broadcastOtaUpdateToTenant = async (client) => {
  if (!client) return;
  const portMap = {
    'DELIVERY_CHALLAN': 5003,
    'TEXTILE_POS': 5002,
    'WA_INSTA_AUTOMATION': 5000
  };
  const backendPort = portMap[client.softwareProduct];
  if (!backendPort) return;
  try {
    await axios.post(`http://localhost:${backendPort}/api/tenant/sync-push`, {
      customerCode: client.customerCode,
      screenPermissions: client.screenPermissions,
      licenseStatus: client.licenseStatus,
      licenseEnd: client.licenseEnd,
      oauthEnforced: !!client.oauthEnforced,
      clientId: client.clientId,
      whatsappSenderMode: client.whatsappSenderMode || 'META',
      dockerThrottleSeconds: client.dockerThrottleSeconds || 6
    }, { timeout: 2000 });
    console.log(`[OTA Instant Push] Broadcasted update to ${client.softwareProduct} on port ${backendPort}`);
  } catch (err) {
    // Non-blocking if tenant backend is offline
  }
};

// @desc    Extract and decrypt license details from a pasted key
// @route   POST /api/clients/activate/extract
// @access  Public
router.post('/activate/extract', async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ message: 'License key is required' });
  }
  try {
    const decoded = decryptLicense(licenseKey.trim());
    const details = {
      name: decoded.name,
      gstNumber: decoded.gstNumber || '',
      address: decoded.address || '',
      contact: decoded.contact || '',
      planTier: decoded.planTier || 'basic',
      licenseStart: decoded.licenseStart,
      licenseEnd: decoded.licenseEnd,
      pendingOwnerName: decoded.pendingOwnerName,
      pendingOwnerEmail: decoded.pendingOwnerEmail,
      pendingOwnerMobile: decoded.pendingOwnerMobile,
      pendingOwnerRole: decoded.pendingOwnerRole || 'admin'
    };
    res.json({ success: true, details });
  } catch (error) {
    res.status(400).json({ message: 'Invalid or corrupted license key' });
  }
});

// @desc    Verify License Key and send OTP
// @route   POST /api/licenses/activate/verify-key
// @access  Public
router.post('/activate/verify-key', async (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return res.status(400).json({ message: 'License key is required' });
  }
  try {
    let decoded;
    try {
      decoded = decryptLicense(licenseKey.trim());
    } catch (err) {
      return res.status(400).json({ message: 'Invalid License Key or signature verification failed.' });
    }

    const {
      name, gstNumber, address, contact, planTier, licenseStart, licenseEnd,
      pendingOwnerName, pendingOwnerEmail, pendingOwnerMobile, pendingOwnerPassword, pendingOwnerRole
    } = decoded;

    let localClient = await dbHelper.findOne('Client', { licenseKey: licenseKey.trim() });

    let maxFloors = 1, maxUsers = 3, maxProducts = 2000;
    if (planTier === 'pro') { maxFloors = 3; maxUsers = 10; maxProducts = 10000; }
    else if (planTier === 'enterprise') { maxFloors = 99; maxUsers = 999; maxProducts = 999999; }

    if (!localClient) {
      localClient = await dbHelper.create('Client', {
        name,
        gstNumber: gstNumber || '',
        address: address || '',
        contact: contact || '',
        licenseKey: licenseKey.trim(),
        licenseStatus: 'pending_activation',
        licenseStart: licenseStart || new Date().toISOString(),
        licenseEnd,
        planTier: planTier || 'basic',
        maxFloors, maxUsers, maxProducts,
        pendingOwnerName, pendingOwnerEmail, pendingOwnerMobile, pendingOwnerPassword,
        pendingOwnerRole: pendingOwnerRole || 'admin'
      });
    } else {
      if (localClient.licenseStatus === 'active') {
        return res.status(400).json({ message: 'License is already active' });
      }
      await dbHelper.findByIdAndUpdate('Client', localClient._id, {
        licenseStatus: 'pending_activation',
        pendingOwnerName, pendingOwnerEmail, pendingOwnerMobile, pendingOwnerPassword,
        pendingOwnerRole: pendingOwnerRole || 'admin'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date();
    otpExpires.setMinutes(otpExpires.getMinutes() + 10);

    await dbHelper.findByIdAndUpdate('Client', localClient._id, {
      activationOtp: otp,
      activationOtpExpires: otpExpires
    });

    await sendActivationOtpEmail(pendingOwnerEmail, otp);

    res.json({
      success: true,
      email: pendingOwnerEmail,
      message: 'License verified. Activation code sent to your registered email.'
    });
  } catch (error) {
    console.error('License key verify error:', error);
    res.status(500).json({ message: 'Error verifying license key' });
  }
});

// @desc    Verify Activation OTP and register Admin user
// @route   POST /api/licenses/activate/verify-otp
// @access  Public
router.post('/activate/verify-otp', async (req, res) => {
  const { licenseKey, otp } = req.body;
  if (!licenseKey || !otp) {
    return res.status(400).json({ message: 'License key and OTP are required' });
  }
  try {
    const client = await dbHelper.findOne('Client', { licenseKey: licenseKey.trim() });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    if (client.activationOtp !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid OTP code' });
    }
    if (new Date() > new Date(client.activationOtpExpires)) {
      return res.status(400).json({ message: 'OTP code has expired' });
    }

    await dbHelper.findByIdAndUpdate('Client', client._id, {
      licenseStatus: 'active',
      activationOtp: '',
      activationOtpExpires: null,
      defaultRolesSeeded: true
    });

    const existingUser = await dbHelper.findOne('User', { mobile: client.pendingOwnerMobile });
    if (!existingUser) {
      await dbHelper.create('User', {
        clientId: client._id,
        name: client.pendingOwnerName,
        mobile: client.pendingOwnerMobile,
        email: client.pendingOwnerEmail,
        password: client.pendingOwnerPassword,
        role: client.pendingOwnerRole || 'admin',
        permissions: { create_product: true, edit_prices: true, view_reports: true, approve_returns: true, access_suppliers: true },
        isActive: true
      });
    } else {
      await dbHelper.findByIdAndUpdate('User', existingUser._id, {
        role: client.pendingOwnerRole || 'admin',
        isActive: true
      });
    }

    res.json({ success: true, message: 'License activated and administrator profile registered successfully!' });
  } catch (error) {
    console.error('Activation OTP verify error:', error);
    res.status(500).json({ message: 'Error verifying activation OTP code' });
  }
});

// @desc    Get all shops / clients (licenses)
// @route   GET /api/licenses
// @access  Private (Platform Owner only)
router.get('/', protect, authorize('platform_owner'), async (req, res) => {
  try {
    const clients = await dbHelper.find('Client', {});
    res.json(clients);

    // Asynchronously backfill any legacy clients lacking credentials in background without blocking response
    const missing = clients.filter(c => !c.clientId || !c.clientSecret);
    if (missing.length > 0) {
      setImmediate(async () => {
        for (const c of missing) {
          try {
            const { clientId, clientSecret } = generateClientCredentials(c.customerCode);
            const clientSecretHash = await bcrypt.hash(clientSecret, 10);
            await Client.findByIdAndUpdate(c._id, {
              clientId,
              clientSecret,
              clientSecretHash,
              apiSecretKey: clientSecret
            });
          } catch (err) {
            console.error('Background credential migration error:', err);
          }
        }
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving clients' });
  }
});

// @desc    Pre-Flight Health & Uniqueness Check before instance launch
// @route   POST /api/licenses/preflight-check
router.post('/preflight-check', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const { customerCode, shopSlug, assignedPort, softwareProduct, whatsappSenderMode, excludeId } = req.body;
    const checks = {
      subdomainUnique: true,
      portReachable: false,
      portLatencyMs: 0,
      dbReady: true,
      wahaReady: true,
      wahaMessage: 'Not applicable'
    };

    const code = (customerCode || '').trim().toUpperCase();
    const slug = (shopSlug || (code ? code.toLowerCase() : '')).trim().toLowerCase();

    // 1. Check Subdomain / Code Uniqueness
    if (code) {
      const query = { customerCode: code };
      if (excludeId) query._id = { $ne: excludeId };
      const existing = await Client.findOne(query);
      if (existing) checks.subdomainUnique = false;
    }

    // 2. Check Port Reachability
    const port = Number(assignedPort);
    if (port && port > 1000) {
      const probeStart = Date.now();
      try {
        await axios.get(`http://127.0.0.1:${port}/`, { timeout: 1500 });
        checks.portReachable = true;
        checks.portLatencyMs = Date.now() - probeStart;
      } catch (err) {
        if (err.response) {
          checks.portReachable = true;
          checks.portLatencyMs = Date.now() - probeStart;
        } else {
          checks.portReachable = false;
          checks.portMessage = `Port ${port} offline or not bound yet`;
        }
      }
    }

    // 3. Check WAHA if WhatsApp is in Docker mode
    if (softwareProduct === 'WA_INSTA_AUTOMATION' && whatsappSenderMode === 'DOCKER') {
      try {
        await axios.get('http://127.0.0.1:3000/api/sessions', { timeout: 1500 });
        checks.wahaReady = true;
        checks.wahaMessage = 'Docker WAHA online on port 3000';
      } catch (wErr) {
        checks.wahaReady = false;
        checks.wahaMessage = 'Docker WAHA unreachable on port 3000';
      }
    }

    const allPassed = checks.subdomainUnique;
    res.json({ success: true, ready: allPassed, checks });
  } catch (err) {
    console.error('Preflight check error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Create new client shop license
// @route   POST /api/licenses
// @access  Private (Platform Owner only)
router.post('/', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  const {
    name, gstNumber, address, contact, planTier, licenseDurationDays,
    ownerEmail, ownerMobile, ownerPassword,
    softwareProduct = 'TEXTILE_POS',
    customerCode,
    shopSlug,
    subdomain,
    billingCycle = '1_MONTH',
    featurePermissions,
    screenPermissions,
    targetIp = '127.0.0.1',
    assignedPort,
    connectionType = 'PORT_FORWARD_ROUTER',
    activateImmediately = false,
    licenseStatus,
    isTrial = false,
    trialDays = 7,
    stockConfig,
    billingConfig,
    pricingConfig
  } = req.body;

  if (!name || !ownerEmail || !ownerMobile || !ownerPassword) {
    return res.status(400).json({ message: 'Shop name, owner email, mobile, and password are required' });
  }

  try {
    const rawCode = (customerCode || subdomain || name).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const code = rawCode || 'CLIENT01';
    const slug = (shopSlug || subdomain || code).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    const trialDuration = Boolean(isTrial) ? (Number(trialDays) || 7) : parseInt(licenseDurationDays || 30);
    const licenseEnd = new Date();
    licenseEnd.setDate(licenseEnd.getDate() + trialDuration);

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);

    const portNum = Number(assignedPort) || (softwareProduct === 'TEXTILE_POS' ? 5174 : softwareProduct === 'DELIVERY_CHALLAN' ? 5176 : 5173);

    const defaultFeatures = {
      quickReplies: true,
      workflows: true,
      catalog: true,
      templates: true,
      responseRules: true,
      bulkBroadcast: true,
      aiAgent: planTier === 'enterprise',
      metaCloudApi: true,
      exportReports: true,
      ...(featurePermissions || {})
    };

    const isImmediatelyActive = activateImmediately === true || licenseStatus === 'active';

    let maxFloors = 1, maxUsers = 3, maxProducts = 2000;
    if (planTier === 'pro') { maxFloors = 3; maxUsers = 10; maxProducts = 10000; }
    else if (planTier === 'enterprise') { maxFloors = 99; maxUsers = 999; maxProducts = 999999; }

    // Auto-generate Renic Client ID and Secret if not provided
    const { clientId: genClientId, clientSecret: genClientSecret } = generateClientCredentials(code);
    const finalClientId = (req.body.clientId || genClientId).trim();
    const finalClientSecret = (req.body.clientSecret || genClientSecret).trim();
    const finalSecretHash = await bcrypt.hash(finalClientSecret, 10);

    const defaultBaseDomain = process.env.HOSTING_BASE_DOMAIN;
    const computedHostingUrl = defaultBaseDomain
      ? `https://${slug}.${defaultBaseDomain}`
      : `http://${slug}.lvh.me:${process.env.PORT || 5050}`;
    const finalHostingUrl = req.body.fullSaaSDomain || (req.body.customDomain ? `https://${req.body.customDomain.trim()}` : computedHostingUrl);

    const targetDbName = Boolean(isTrial) ? 'renic_trial_sandbox' : `renic_tenant_${code.toLowerCase()}`;

    const newClient = await Client.create({
      name: name.trim(),
      customerCode: code,
      shopSlug: slug,
      subdomain: slug,
      fullSaaSDomain: finalHostingUrl,
      databaseName: targetDbName,
      isTrial: Boolean(isTrial),
      trialDays: Number(trialDays) || 7,
      softwareProduct,
      billingCycle,
      whatsappSenderMode: req.body.whatsappSenderMode || 'META',
      dockerThrottleSeconds: Number(req.body.dockerThrottleSeconds) || 6,
      featurePermissions: defaultFeatures,
      screenPermissions: screenPermissions || {},
      stockConfig: stockConfig || {
        entryMode: 'simple',
        enableSizes: false,
        enableColors: false,
        enableMeters: false,
        enableBulkCsv: true
      },
      billingConfig: billingConfig || {
        discountMode: 'both'
      },
      pricingConfig: pricingConfig || {
        trackProfit: true,
        allowStaffProfitView: false
      },
      gstNumber: gstNumber || '',
      address: address || '',
      contact: contact || '',
      licenseKey: req.body.licenseKey || ('RENIC-' + code + '-' + crypto.randomBytes(4).toString('hex').toUpperCase()),
      licenseStatus: isImmediatelyActive ? 'active' : 'pending_activation',
      licenseStart: new Date().toISOString(),
      licenseEnd: licenseEnd.toISOString(),
      planTier: planTier || 'basic',
      maxFloors, maxUsers, maxProducts,
      assignedPort: portNum,
      clientId: finalClientId,
      clientSecret: finalClientSecret,
      clientSecretHash: finalSecretHash,
      apiSecretKey: finalClientSecret,
      oauthEnforced: Boolean(req.body.oauthEnforced),
      portForwarding: {
        targetIp: (targetIp || '127.0.0.1').trim(),
        assignedPort: portNum,
        connectionType: connectionType || 'PORT_FORWARD_ROUTER',
        publicWebUrl: `https://${slug}.dm.renicsoft.com`,
        status: 'online',
        lastPingAt: new Date()
      },
      pendingOwnerName: contact || `${name} Owner`,
      pendingOwnerEmail: ownerEmail,
      pendingOwnerMobile: ownerMobile,
      pendingOwnerPassword: hashedPassword,
      pendingOwnerRole: 'admin',
      telemetry: {
        whatsappStatus: 'unknown',
        monthlyMessagesSent: 0,
        totalContacts: 0,
        appVersion: '1.0.0'
      }
    });

    // Automatically provision dedicated or trial tenant database (1-to-many isolation)
    let provisioning = null;
    try {
      provisioning = await provisionTenantDatabase({
        customerCode: Boolean(isTrial) ? 'renic_trial_sandbox' : code,
        shopName: name.trim(),
        ownerEmail,
        ownerMobile,
        ownerPassword,
        softwareProduct,
        clientId: finalClientId,
        planTier
      });
    } catch (provErr) {
      console.error('[Tenant Auto-Provisioning Error]:', provErr);
    }

    invalidateProxyCache(code);
    invalidateProxyCache(slug);

    // Auto-dispatch WhatsApp onboarding alert to client's mobile
    notifyClientOnboarded(newClient, {
      mobile: ownerMobile,
      password: ownerPassword
    }).catch(err => console.warn('[Renic WhatsApp Onboard Alert] Error:', err.message));

    res.status(201).json({
      success: true,
      message: isImmediatelyActive 
        ? `Client '${newClient.name}' [${code}] onboarded, dedicated DB '${provisioning?.dbName || ('renic_tenant_' + code.toLowerCase())}' created, and ACTIVATED successfully!` 
        : `Client '${newClient.name}' [${code}] onboarded with isolated database.`,
      client: newClient,
      credentials: {
        customerCode: code,
        clientId: finalClientId,
        clientSecret: finalClientSecret,
        hostingUrl: newClient.fullSaaSDomain,
        tokenEndpoint: `${req.protocol}://${req.get('host')}/api/v1/oauth/token`
      },
      provisioning
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ message: 'Error creating client shop profile', error: error.message });
  }
});

// @desc    1-Click Instant License Activation (Platform Owner Cockpit)
// @route   PUT /api/clients/:id/activate or PUT /api/licenses/:id/activate
// @access  Private (Platform Owner / Admin)
router.put('/:id/activate', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    client.licenseStatus = 'active';
    if (!client.licenseStart) client.licenseStart = new Date();
    if (!client.licenseEnd || new Date(client.licenseEnd) <= new Date()) {
      const end = new Date();
      end.setDate(end.getDate() + 365);
      client.licenseEnd = end;
    }

    await client.save();
    invalidateProxyCache(client.customerCode);
    if (client.shopSlug) invalidateProxyCache(client.shopSlug);

    // Auto-dispatch WhatsApp license activation confirmation
    notifyLicenseStatus(client, 'ACTIVATED')
      .catch(err => console.warn('[Renic WhatsApp Activate Alert] Error:', err.message));

    res.json({
      success: true,
      message: `⚡ License for '${client.name}' (${client.customerCode}) activated successfully!`,
      client
    });
  } catch (error) {
    console.error('Activate client error:', error);
    res.status(500).json({ success: false, message: 'Error activating license', error: error.message });
  }
});

// @desc    Full client profile, network, credentials, and screen-gate editor
// @route   PUT /api/clients/:id or PUT /api/licenses/:id
// @access  Private (Platform Owner / Admin)
router.put('/:id', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const {
      name, customerCode, shopSlug, subdomain, customDomain, fullSaaSDomain,
      pendingOwnerName, pendingOwnerEmail, pendingOwnerMobile, pendingOwnerPassword, pendingOwnerRole,
      targetIp, assignedPort, connectionType,
      planTier, licenseStatus, licenseEnd, durationDays, billingCycle, maxFloors, maxUsers, maxProducts,
      softwareProduct, screenPermissions, featurePermissions,
      stockConfig, billingConfig, pricingConfig, isTrial, trialDays, databaseName
    } = req.body;

    const oldCode = client.customerCode;
    const oldSlug = client.shopSlug;

    if (name) client.name = name.trim();

    if (customerCode) {
      const cleanCode = customerCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (cleanCode && cleanCode !== client.customerCode) {
        client.securitySettings = client.securitySettings || {};
        client.securitySettings.previousSlugs = client.securitySettings.previousSlugs || [];
        client.securitySettings.previousSlugs.push({
          slug: client.customerCode || 'UNASSIGNED',
          rotatedAt: new Date(),
          reason: 'Customer Code manually updated'
        });
        client.customerCode = cleanCode;
      }
    }

    if (shopSlug) client.shopSlug = shopSlug.trim().toLowerCase();
    if (subdomain) client.subdomain = subdomain.trim().toLowerCase();
    if (customDomain !== undefined) client.customDomain = customDomain.trim().toLowerCase();
    if (fullSaaSDomain) client.fullSaaSDomain = fullSaaSDomain.trim();
    if (databaseName !== undefined) client.databaseName = databaseName.trim();
    if (isTrial !== undefined) client.isTrial = Boolean(isTrial);
    if (trialDays !== undefined) client.trialDays = Number(trialDays);

    // Modular Configurations
    if (stockConfig !== undefined) client.stockConfig = stockConfig;
    if (billingConfig !== undefined) client.billingConfig = billingConfig;
    if (pricingConfig !== undefined) client.pricingConfig = pricingConfig;

    // Admin Credentials
    if (pendingOwnerName) client.pendingOwnerName = pendingOwnerName.trim();
    if (pendingOwnerEmail) client.pendingOwnerEmail = pendingOwnerEmail.trim();
    if (pendingOwnerMobile) client.pendingOwnerMobile = pendingOwnerMobile.trim();
    if (pendingOwnerRole) client.pendingOwnerRole = pendingOwnerRole.trim();
    if (pendingOwnerPassword && pendingOwnerPassword.trim()) {
      client.pendingOwnerPassword = await bcrypt.hash(pendingOwnerPassword.trim(), 10);
    }

    // Network / Port Forwarding
    client.portForwarding = client.portForwarding || {};
    if (targetIp) client.portForwarding.targetIp = targetIp.trim();
    if (assignedPort) {
      client.portForwarding.assignedPort = Number(assignedPort);
      client.assignedPort = Number(assignedPort);
    }
    if (connectionType) client.portForwarding.connectionType = connectionType;

    // License & Plan
    if (planTier) {
      client.planTier = planTier;
      if (planTier === 'basic') client.maxFloors = 1, client.maxUsers = 3, client.maxProducts = 2000;
      else if (planTier === 'pro') client.maxFloors = 3, client.maxUsers = 10, client.maxProducts = 10000;
      else if (planTier === 'enterprise') client.maxFloors = 99, client.maxUsers = 999, client.maxProducts = 999999;
    }
    if (licenseStatus) client.licenseStatus = licenseStatus;
    if (billingCycle) client.billingCycle = billingCycle;
    if (maxFloors !== undefined) client.maxFloors = Number(maxFloors);
    if (maxUsers !== undefined) client.maxUsers = Number(maxUsers);
    if (maxProducts !== undefined) client.maxProducts = Number(maxProducts);

    if (licenseEnd) {
      client.licenseEnd = new Date(licenseEnd);
    } else if (durationDays) {
      const base = new Date(client.licenseEnd) > new Date() ? new Date(client.licenseEnd) : new Date();
      base.setDate(base.getDate() + parseInt(durationDays));
      client.licenseEnd = base;
    }

    // Software Product & Permissions
    if (softwareProduct) {
      client.softwareProduct = softwareProduct.trim();
      if (!assignedPort) {
        const prodPort = (client.softwareProduct === 'TEXTILE_POS') ? 5174 
          : (client.softwareProduct === 'DELIVERY_CHALLAN') ? 5176 
          : 5173;
        client.assignedPort = prodPort;
        if (client.portForwarding) client.portForwarding.assignedPort = prodPort;
      }
    }
    if (screenPermissions !== undefined) client.screenPermissions = screenPermissions;
    if (req.body.whatsappSenderMode) client.whatsappSenderMode = req.body.whatsappSenderMode;
    if (req.body.dockerThrottleSeconds !== undefined) client.dockerThrottleSeconds = Number(req.body.dockerThrottleSeconds) || 6;
    if (req.body.oauthEnforced !== undefined) client.oauthEnforced = Boolean(req.body.oauthEnforced);
    if (req.body.clientId && req.body.clientId.trim()) client.clientId = req.body.clientId.trim();
    if (req.body.clientSecret && req.body.clientSecret.trim()) {
      client.clientSecret = req.body.clientSecret.trim();
      client.clientSecretHash = await bcrypt.hash(req.body.clientSecret.trim(), 10);
      client.apiSecretKey = req.body.clientSecret.trim();
    }

    await client.save();

    // Over-The-Air Sync to Tenant's isolated database
    try {
      const targetDbName = client.databaseName || `renic_tenant_${(client.customerCode || '').toLowerCase()}`;
      const tenantDb = mongoose.connection.useDb(targetDbName, { useCache: true });
      await tenantDb.collection('clients').updateMany(
        {},
        {
          $set: {
            screenPermissions: client.screenPermissions,
            oauthEnforced: client.oauthEnforced,
            stockConfig: client.stockConfig,
            billingConfig: client.billingConfig,
            pricingConfig: client.pricingConfig,
            planTier: client.planTier,
            licenseStatus: client.licenseStatus,
            licenseEnd: client.licenseEnd
          }
        }
      );
    } catch (syncErr) {
      console.warn('[Tenant OTA Sync Warning]:', syncErr.message);
    }

    // Invalidate caches
    invalidateProxyCache(oldCode);
    invalidateProxyCache(oldSlug);
    invalidateProxyCache(client.customerCode);
    invalidateProxyCache(client.shopSlug);

    // Instant OTA Live Push to Tenant Instance
    broadcastOtaUpdateToTenant(client);

    res.json({
      success: true,
      message: `Client '${client.name}' [${client.customerCode}] updated successfully`,
      client
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ success: false, message: 'Error updating client details', error: error.message });
  }
});

// @desc    Adjust trial or subscription days (+3, -1, +7, +30 etc.)
// @route   POST /api/clients/:id/adjust-days or POST /api/licenses/:id/adjust-days
// @access  Private (Platform Owner / Admin)
router.post('/:id/adjust-days', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { deltaDays } = req.body;
  const days = parseInt(deltaDays, 10);
  if (isNaN(days)) {
    return res.status(400).json({ success: false, message: 'Invalid deltaDays parameter' });
  }

  try {
    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const now = new Date();
    let currentEnd = client.licenseEnd ? new Date(client.licenseEnd) : now;

    // If already expired and adding days, base calculation from today
    if (days > 0 && currentEnd < now) {
      currentEnd = new Date(now);
    }

    currentEnd.setDate(currentEnd.getDate() + days);
    client.licenseEnd = currentEnd;

    // Re-activate if extended beyond now
    if (currentEnd > now) {
      client.licenseStatus = 'active';
      client.expiryAlertSent = false;
    }

    if (client.isTrial && client.trialDays) {
      client.trialDays = Math.max(1, (client.trialDays || 7) + days);
    }

    await client.save();

    // Sync to tenant DB
    try {
      const targetDbName = client.databaseName || `renic_tenant_${(client.customerCode || '').toLowerCase()}`;
      const tenantDb = mongoose.connection.useDb(targetDbName, { useCache: true });
      await tenantDb.collection('clients').updateMany(
        {},
        {
          $set: {
            licenseStatus: client.licenseStatus,
            licenseEnd: client.licenseEnd
          }
        }
      );
    } catch (err) {
      // silent
    }

    invalidateProxyCache(client.customerCode);
    if (client.shopSlug) invalidateProxyCache(client.shopSlug);
    if (client.subdomain) invalidateProxyCache(client.subdomain);

    res.json({
      success: true,
      message: `Adjusted client subscription by ${days > 0 ? '+' : ''}${days} days`,
      client
    });
  } catch (err) {
    console.error('[Adjust Days Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    1-Click Convert Free Trial into Full Dedicated Production Tenant
// @route   POST /api/clients/:id/convert-to-production or POST /api/licenses/:id/convert-to-production
// @access  Private (Platform Owner / Admin)
router.post('/:id/convert-to-production', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await convertTrialToProduction(id, req.body);
    res.json({
      success: true,
      message: `Client successfully converted to Production! Tenant database: ${result.targetDbName}`,
      result
    });
  } catch (err) {
    console.error('[Trial Convert Error]:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Renew or stack client license days
// @route   PUT /api/licenses/:id/renew
// @access  Private (Platform Owner only)
router.put('/:id/renew', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  const { id } = req.params;
  const {
    durationDays, planTier, licenseStatus, name, gstNumber, address, contact,
    subdomain, softwareProduct, billingCycle, featurePermissions
  } = req.body;

  try {
    const client = await Client.findById(id);
    if (!client) return res.status(404).json({ message: 'Client shop not found' });

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (gstNumber !== undefined) updates.gstNumber = gstNumber;
    if (address !== undefined) updates.address = address;
    if (contact !== undefined) updates.contact = contact;
    if (subdomain !== undefined) updates.subdomain = subdomain.toLowerCase().trim();
    if (softwareProduct !== undefined) updates.softwareProduct = softwareProduct;
    if (billingCycle !== undefined) updates.billingCycle = billingCycle;
    if (featurePermissions !== undefined) updates.featurePermissions = featurePermissions;

    let updatedEnd = new Date(client.licenseEnd);
    if (durationDays) {
      const baseDate = new Date(client.licenseEnd) > new Date() ? new Date(client.licenseEnd) : new Date();
      baseDate.setDate(baseDate.getDate() + parseInt(durationDays));
      updatedEnd = baseDate;
    }
    updates.licenseEnd = updatedEnd.toISOString();
    if (licenseStatus) updates.licenseStatus = licenseStatus;
    if (planTier) {
      updates.planTier = planTier;
      if (planTier === 'basic') updates.maxFloors = 1, updates.maxUsers = 3, updates.maxProducts = 2000;
      else if (planTier === 'pro') updates.maxFloors = 3, updates.maxUsers = 10, updates.maxProducts = 10000;
      else if (planTier === 'enterprise') updates.maxFloors = 99, updates.maxUsers = 999, updates.maxProducts = 999999;
    }

    const updatedClient = await Client.findByIdAndUpdate(id, updates, { new: true });
    invalidateProxyCache(client.customerCode);
    res.json(updatedClient);
  } catch (error) {
    console.error('Update client profile error:', error);
    res.status(500).json({ message: 'Error updating client profile' });
  }
});

// @desc    Delete a customer instance and deactivate all URLs
// @route   DELETE /api/clients/:id or DELETE /api/licenses/:id
// @access  Private (Admin / Platform Owner)
router.delete('/:id', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Immediately purge all proxy caches so URL stops routing instantly
    invalidateProxyCache(client.customerCode);
    if (client.shopSlug) invalidateProxyCache(client.shopSlug);
    if (client.subdomain) invalidateProxyCache(client.subdomain);
    invalidateProxyCache(); // full global proxy cache flush

    const portMap = {
      'DELIVERY_CHALLAN': 5003,
      'TEXTILE_POS': 5002,
      'WA_INSTA_AUTOMATION': 5000
    };
    const backendPort = portMap[client.softwareProduct];
    if (backendPort) {
      axios.post(`http://localhost:${backendPort}/api/tenant/sync-push`, {
        customerCode: client.customerCode,
        revoked: true,
        disabled: true,
        oauthEnforced: true,
        clientId: null,
        screenPermissions: {}
      }, { timeout: 2000 }).catch(() => {});
    }

    await Client.findByIdAndDelete(req.params.id);
    await dbHelper.deleteById('Client', req.params.id);

    res.json({
      success: true,
      message: `Customer instance '${client.name}' [${client.customerCode}] permanently deleted and all URL routes terminated.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting client: ' + error.message });
  }
});

// @desc    1-Click Disable / Lock / Reactivate Customer Showroom
// @route   POST /api/clients/:id/toggle-lock
// @access  Private (Admin / Platform Owner)
router.post('/:id/toggle-lock', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    client.securitySettings = client.securitySettings || {};
    const isCurrentlyLocked = client.licenseStatus === 'locked' || client.licenseStatus === 'disabled' || client.securitySettings.emergencyLock;

    if (isCurrentlyLocked) {
      // Re-enable / Unlock
      client.licenseStatus = 'active';
      client.securitySettings.emergencyLock = false;
      client.securitySettings.lockReason = '';
    } else {
      // Disable / Lock
      client.licenseStatus = 'locked';
      client.securitySettings.emergencyLock = true;
      client.securitySettings.lockReason = req.body.reason || 'Deactivated by Platform Administrator';
    }

    await client.save();

    // Immediately flush proxy caches so URL reflects the new lock state
    invalidateProxyCache(client.customerCode);
    if (client.shopSlug) invalidateProxyCache(client.shopSlug);
    if (client.subdomain) invalidateProxyCache(client.subdomain);
    invalidateProxyCache();

    // Broadcast OTA update to client terminal
    broadcastOtaUpdateToTenant(client);

    res.json({
      success: true,
      licenseStatus: client.licenseStatus,
      isLocked: !isCurrentlyLocked,
      message: !isCurrentlyLocked
        ? `Customer '${client.name}' [${client.customerCode}] is now DISABLED. Given URL routing has been blocked.`
        : `Customer '${client.name}' [${client.customerCode}] is now RE-ACTIVATED. Given URL routing is restored.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper to push credentials over-the-air to the client instance
async function pushOAuthToClient(client, clientId, clientSecretHash) {
  try {
    const SYNC_SECRET = process.env.SYNC_SECRET_KEY || 'Renic_BiDirectional_Sync_Key_2026_Secure';
    const payload = {
      clientId: String(client._id),
      clientName: client.name,
      subdomain: client.subdomain || '',
      softwareProduct: client.softwareProduct || 'WA_INSTA_AUTOMATION',
      planTier: client.planTier || 'pro',
      billingCycle: client.billingCycle || '3_MONTHS',
      licenseStart: client.licenseStart,
      licenseEnd: client.licenseEnd,
      licenseStatus: client.licenseStatus || 'active',
      featurePermissions: client.featurePermissions,
      limits: client.limits,
      clientId,
      clientSecretHash,
      timestamp: Date.now()
    };
    const signature = crypto.createHmac('sha256', SYNC_SECRET).update(JSON.stringify(payload)).digest('hex');
    const targetUrl = client.clientInstanceUrl || 'http://127.0.0.1:5000/api/v1/license/sync';
    await axios.post(targetUrl, payload, {
      headers: {
        'x-renic-hq-signature': signature,
        'x-renic-timestamp': String(payload.timestamp),
        'Content-Type': 'application/json'
      },
      timeout: 4000
    });
    console.log(`[Auto-Sync OAuth]: Synced ${clientId} to ${targetUrl}`);
  } catch (err) {
    console.warn(`[Auto-Sync OAuth Notice]: Target instance not reachable right now: ${err.message}`);
  }
}

// @desc    Get OAuth credentials and Postman integration kit for a client
// @route   GET /api/licenses/:id/oauth-credentials
// @access  Private (Platform Owner only)
router.get('/:id/oauth-credentials', protect, authorize('platform_owner'), async (req, res) => {
  try {
    const client = await dbHelper.findById('Client', req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const slug = client.subdomain || client.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    let clientId = client.clientId;
    let clientSecret = client.clientSecret;
    let clientSecretHash = client.clientSecretHash;

    // Auto-generate if missing
    if (!clientId || !clientSecret) {
      clientId = `renic_client_${slug}`;
      clientSecret = `rsec_live_${crypto.randomBytes(20).toString('hex')}`;
      clientSecretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');
      await dbHelper.findByIdAndUpdate('Client', client._id, {
        clientId,
        clientSecret,
        clientSecretHash
      });
      await pushOAuthToClient(client, clientId, clientSecretHash);
    }

    const liveUrl = `https://${slug}.renic.store`;
    const localUrl = `http://localhost:5000`;

    res.json({
      success: true,
      clientName: client.name,
      subdomain: slug,
      clientId,
      clientSecret,
      liveUrl,
      localUrl,
      postmanCurl: {
        getToken: `curl -X POST "${localUrl}/api/v1/oauth/token" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "grant_type": "client_credentials",\n    "client_id": "${clientId}",\n    "client_secret": "${clientSecret}"\n  }'`,
        testUnauthorized: `curl -X GET "${localUrl}/api/v1/oauth/profile"`,
        getProfile: `curl -X GET "${localUrl}/api/v1/oauth/profile" \\\n  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"`,
        getProfileAlias: `curl -X GET "${localUrl}/api/v1/client/profile" \\\n  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"`
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching OAuth credentials' });
  }
});

// @desc    Regenerate OAuth Client Secret and sync over the air
// @route   POST /api/licenses/:id/oauth-credentials/regenerate
// @access  Private (Platform Owner only)
router.post('/:id/oauth-credentials/regenerate', protect, authorize('platform_owner'), async (req, res) => {
  try {
    const client = await dbHelper.findById('Client', req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const slug = client.subdomain || client.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clientId = client.clientId || `renic_client_${slug}`;
    const newClientSecret = `rsec_live_${crypto.randomBytes(20).toString('hex')}`;
    const newClientSecretHash = crypto.createHash('sha256').update(newClientSecret).digest('hex');

    await dbHelper.findByIdAndUpdate('Client', client._id, {
      clientId,
      clientSecret: newClientSecret,
      clientSecretHash: newClientSecretHash
    });

    await pushOAuthToClient(client, clientId, newClientSecretHash);

    res.json({
      success: true,
      message: 'Client secret regenerated and synchronized over the air!',
      clientId,
      clientSecret: newClientSecret
    });
  } catch (error) {
    res.status(500).json({ message: 'Error regenerating secret' });
  }
});

export default router;