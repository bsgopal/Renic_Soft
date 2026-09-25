import express from 'express';
import jwt from 'jsonwebtoken';
import Client from '../models/Client.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'RenicSoft_Secret_Key_2026_Enterprise';

/**
 * @route   GET /api/v1/tenant/:customerCode/:shopSlug?
/**
 * @route   GET /api/v1/tenant/:customerCode/screens
 * @desc    Get authorized screens with 24-hour cryptographically signed license JWT
 * @access  Public / Client Engines
 */
router.get('/:customerCode/screens', async (req, res) => {
  try {
    const { customerCode } = req.params;
    const cleanCode = (customerCode || '').trim().toUpperCase();

    const client = await Client.findOne({
      $or: [
        { customerCode: cleanCode },
        { subdomain: cleanCode.toLowerCase() }
      ]
    });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    if (client.securitySettings?.emergencyLock) {
      return res.status(423).json({
        success: false,
        error: 'LOCKED',
        message: 'Tenant is temporarily locked by Platform Owner.'
      });
    }

    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((new Date(client.licenseEnd) - now) / (1000 * 60 * 60 * 24)));
    const isExpired = daysRemaining <= 0;

    // Build signed license payload for 24-hour offline grace caching
    const graceToken = jwt.sign(
      {
        customerCode: client.customerCode,
        tenantId: client._id,
        screenPermissions: client.screenPermissions,
        licenseStatus: isExpired ? 'locked' : client.licenseStatus,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      customerCode: client.customerCode,
      softwareProduct: client.softwareProduct,
      screenPermissions: client.screenPermissions || {},
      oauthEnforced: !!client.oauthEnforced,
      isExpired,
      daysRemaining,
      graceToken,
      offlineGraceHours: client.portForwarding?.offlineGraceHours || 24
    });
  } catch (error) {
    console.error('Error fetching screens:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/v1/tenant/:customerCode/:shopSlug?
 * @desc    Scoped multi-tenant lookup matching Customer Code or Dual-Slug
 * @access  Public / Client Engines (Strictly strips internal IPs and ports)
 */
router.get('/:customerCode/:shopSlug?', async (req, res) => {
  try {
    const { customerCode, shopSlug } = req.params;
    const cleanCode = (customerCode || '').trim().toUpperCase();
    const cleanSlug = (shopSlug || '').trim().toLowerCase();

    // Query by customerCode, or subdomain, or shopSlug
    const query = {
      $or: [
        { customerCode: cleanCode },
        { subdomain: cleanCode.toLowerCase() },
        { shopSlug: cleanSlug || cleanCode.toLowerCase() }
      ]
    };

    const client = await Client.findOne(query).select('-clientSecretHash -activationOtp -activationOtpExpires');

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'TENANT_NOT_FOUND',
        message: `No active tenant found matching code '${customerCode}'`
      });
    }

    // 4-Tier Security Shield Check: Emergency Lock
    if (client.securitySettings?.emergencyLock) {
      return res.status(423).json({
        success: false,
        error: 'TENANT_SUSPENDED',
        message: client.securitySettings.lockReason || 'Tenant is temporarily suspended for security maintenance. Please contact Renic HQ.'
      });
    }

    // Calculate license days remaining
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((new Date(client.licenseEnd) - now) / (1000 * 60 * 60 * 24)));
    const isExpired = daysRemaining <= 0;

    // Generate SaaS URL
    const slug = client.shopSlug || client.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const code = (client.customerCode || 'CLIENT').toLowerCase();
    const cleanDomain = client.fullSaaSDomain || `https://${code}-${slug}.renic.store`;

    // 100% IP & PORT SECRECY: Stripping all target IPs and internal ports
    res.json({
      success: true,
      tenant: {
        customerCode: client.customerCode || cleanCode,
        shopName: client.name,
        shopSlug: client.shopSlug || slug,
        saasUrl: cleanDomain,
        softwareProduct: client.softwareProduct || 'WA_INSTA_AUTOMATION',
        planTier: client.planTier,
        licenseStatus: isExpired ? 'locked' : client.licenseStatus,
        licenseEnd: client.licenseEnd,
        daysRemaining,
        screenPermissions: client.screenPermissions || {},
        featurePermissions: client.featurePermissions || {},
        offlineGraceHours: client.portForwarding?.offlineGraceHours || 24,
        status: client.portForwarding?.status || 'unknown'
      }
    });
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: error.message });
  }
});


/**
 * @route   POST /api/v1/tenant/heartbeat
 * @desc    Phone-Home Heartbeat from Showroom Terminal (Auto-Detects Changed IP)
 * @access  Client Engine
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { customerCode, appVersion, localPort } = req.body;

    if (!customerCode) {
      return res.status(400).json({ success: false, message: 'customerCode is required' });
    }

    const client = await Client.findOne({ customerCode: customerCode.trim().toUpperCase() });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Extract incoming public IP
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    let callerIp = rawIp;
    if (callerIp === '::1' || callerIp === '::ffff:127.0.0.1') {
      callerIp = '127.0.0.1';
    } else if (callerIp.includes('::ffff:')) {
      callerIp = callerIp.replace('::ffff:', '');
    }

    const currentTargetIp = client.portForwarding?.targetIp || '127.0.0.1';
    const now = new Date();

    let ipChanged = false;
    // If incoming IP changed and autoRelink is enabled, record history and update
    if (callerIp && callerIp !== '127.0.0.1' && callerIp !== currentTargetIp && client.portForwarding?.autoRelinkEnabled) {
      ipChanged = true;
      client.portForwarding.ipChangeHistory = client.portForwarding.ipChangeHistory || [];
      client.portForwarding.ipChangeHistory.push({
        previousIp: currentTargetIp,
        newIp: callerIp,
        changedAt: now,
        changedBy: 'Phone-Home Heartbeat Sensor',
        reason: 'Auto-detected broadband dynamic IP change'
      });
      client.portForwarding.targetIp = callerIp;
    }

    if (localPort && (!client.portForwarding.assignedPort || client.portForwarding.assignedPort === 5000)) {
      client.portForwarding.assignedPort = localPort;
    }

    client.portForwarding.status = 'online';
    client.portForwarding.lastHeartbeatAt = now;
    if (appVersion && client.telemetry) {
      client.telemetry.appVersion = appVersion;
      client.telemetry.lastHeartbeat = now;
    }

    await client.save();

    res.json({
      success: true,
      message: 'Heartbeat acknowledged',
      ipChanged,
      detectedIp: callerIp,
      screenPermissions: client.screenPermissions,
      emergencyLock: client.securitySettings?.emergencyLock || false
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
