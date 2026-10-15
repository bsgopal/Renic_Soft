// Renic_Soft/backend/src/routes/oauthRoutes.js
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import Client from '../models/Client.js';
import { backendPortFor } from '../config/appPorts.js';
import TenantActivityLog from '../models/TenantActivityLog.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'RenicSoft_Secret_Key_2026_Enterprise';

const broadcastOtaUpdateToTenant = async (client) => {
  if (!client) return;
  const backendPort = backendPortFor(client.softwareProduct);
  if (!backendPort) return;
  try {
    await axios.post(`http://localhost:${backendPort}/api/tenant/sync-push`, {
      customerCode: client.customerCode,
      screenPermissions: client.screenPermissions,
      licenseStatus: client.licenseStatus,
      licenseEnd: client.licenseEnd,
      oauthEnforced: !!client.oauthEnforced,
      clientId: client.clientId
    }, { timeout: 2000 });
    console.log(`[OAuth Push] Sent update to ${client.softwareProduct} on port ${backendPort}`);
  } catch (err) {
    // Non-blocking
  }
};

/**
 * Generate a standard Renic Client ID and Cryptographic Secret
 */
export function generateClientCredentials(customerCode) {
  const code = (customerCode || 'CLI').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const randomId = crypto.randomBytes(4).toString('hex').toUpperCase();
  const rawSecret = `RC_SEC_${crypto.randomBytes(28).toString('hex')}`;
  const clientId = `RC_ID_${code}_${randomId}`;
  return { clientId, clientSecret: rawSecret };
}

/**
 * @route   POST /api/v1/oauth/token
 * @desc    OAuth 2.0 Client Credentials Token Exchange Endpoint
 * @access  Public (Authenticated via Client ID & Client Secret)
 */
router.post('/token', async (req, res) => {
  try {
    let reqGrantType = req.body?.grant_type || req.query?.grant_type || 'client_credentials';
    let reqClientId = req.body?.client_id || req.body?.clientId || req.query?.client_id;
    let reqClientSecret = req.body?.client_secret || req.body?.clientSecret || req.query?.client_secret;

    // Check HTTP Basic Authentication header (RFC 6749 Section 2.3.1) - used by Postman & standard SDKs
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
        const colonIdx = credentials.indexOf(':');
        if (colonIdx !== -1) {
          reqClientId = reqClientId || credentials.substring(0, colonIdx);
          reqClientSecret = reqClientSecret || credentials.substring(colonIdx + 1);
        }
      } catch (e) {
        // Fallback to body
      }
    }

    if (reqGrantType !== 'client_credentials') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only grant_type=client_credentials is supported'
      });
    }

    if (!reqClientId || !reqClientSecret) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'client_id and client_secret are required (via request body or Basic Auth header)'
      });
    }

    // Locate client by clientId
    const client = await Client.findOne({ clientId: reqClientId.trim() });
    if (!client) {
      try {
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const passedCustomerCode = (req.body?.customerCode || req.query?.customerCode || 'unknown').trim().toLowerCase();
        const passedClientName = req.body?.clientName || req.query?.clientName || '';
        
        let inferredClient = null;
        if (passedCustomerCode && passedCustomerCode !== 'unknown') {
          inferredClient = await Client.findOne({ 
            $or: [
              { customerCode: passedCustomerCode },
              { customerCode: new RegExp(`^${passedCustomerCode}$`, 'i') }
            ]
          });
        }

        const effectiveName = inferredClient?.name || passedClientName || 'Unknown Client';
        const effectiveCode = (inferredClient?.customerCode || passedCustomerCode || 'unknown').toLowerCase();

        await TenantActivityLog.create({
          customerCode: effectiveCode,
          clientId: reqClientId.trim(),
          clientName: effectiveName,
          softwareProduct: inferredClient?.softwareProduct || req.body?.softwareProduct || 'WA_INSTA_AUTOMATION',
          screenName: 'OAUTH_TOKEN_EXCHANGE',
          actionType: 'SECURITY_ALERT',
          actionDescription: `Unauthorized OAuth Attempt: Non-existent Client ID '${reqClientId.trim()}' attempted from client '${effectiveName}' (Code: ${effectiveCode}) from IP ${ipAddress}. Access rejected.`,
          userName: 'OAuth Guard',
          userRole: 'system',
          ipAddress: String(ipAddress),
          userAgent: String(req.headers['user-agent'] || '').slice(0, 200)
        });
      } catch (logErr) {
        console.error('[OAuth Guard] Error creating security alert log:', logErr.message);
      }
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed: Client ID not found'
      });
    }

    // Check emergency lock & license status
    if (client.securitySettings?.emergencyLock) {
      return res.status(423).json({
        error: 'tenant_suspended',
        error_description: `Tenant '${client.customerCode}' is suspended by Platform Owner.`
      });
    }

    if (client.licenseStatus === 'locked' || client.licenseStatus === 'cancelled') {
      return res.status(403).json({
        error: 'license_inactive',
        error_description: `License for tenant '${client.customerCode}' is inactive (${client.licenseStatus})`
      });
    }

    // Verify secret — EXACT match only (timing-safe).
    const cleanReqSecret = String(reqClientSecret || '').trim();
    const secretEquals = (stored) => {
      if (typeof stored !== 'string' || stored.length === 0) return false;
      const a = Buffer.from(stored, 'utf8');
      const b = Buffer.from(cleanReqSecret, 'utf8');
      if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    };

    let isSecretValid = false;

    if (client.clientSecretHash) {
      isSecretValid = Boolean(cleanReqSecret) && (await bcrypt.compare(cleanReqSecret, client.clientSecretHash));
    }
    if (!isSecretValid) {
      isSecretValid = secretEquals(client.clientSecret);
    }
    if (!isSecretValid) {
      isSecretValid = secretEquals(client.apiSecretKey);
    }

    if (!isSecretValid) {
      try {
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const clientDisplayName = client.name || client.companyName || client.customerCode;
        const custCode = (client.customerCode || 'unknown').toLowerCase();
        await TenantActivityLog.create({
          customerCode: custCode,
          clientId: client.clientId,
          clientName: clientDisplayName,
          softwareProduct: client.softwareProduct || 'WA_INSTA_AUTOMATION',
          screenName: 'OAUTH_TOKEN_EXCHANGE',
          actionType: 'SECURITY_ALERT',
          actionDescription: `Unauthorized OAuth Attempt: Invalid Client Secret entered for client "${clientDisplayName}" (Code: ${custCode}, Client ID: ${client.clientId}) from IP ${ipAddress}. Access rejected.`,
          userName: 'OAuth Guard',
          userRole: 'system',
          ipAddress: String(ipAddress),
          userAgent: String(req.headers['user-agent'] || '').slice(0, 200)
        });
      } catch (logErr) {
        console.error('[OAuth Guard] Error creating security alert log:', logErr.message);
      }
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed: Invalid Client Secret'
      });
    }

    const expiresInSeconds = 86400; // 24 hours
    const tokenPayload = {
      sub: client.customerCode,
      customerCode: client.customerCode,
      tenantId: client._id,
      clientId: client.clientId,
      softwareProduct: client.softwareProduct || 'WA_INSTA_AUTOMATION',
      planTier: client.planTier,
      role: 'tenant_api',
      scope: 'read write'
    };

    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: `${expiresInSeconds}s` });

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresInSeconds,
      scope: 'read write',
      customer_code: client.customerCode,
      software_product: client.softwareProduct,
      hosting_url: resolveClientHostingUrl(client, req)
    });
  } catch (error) {
    console.error('OAuth Token Exchange Error:', error);
    res.status(500).json({ error: 'server_error', error_description: error.message });
  }
});

/**
 * @route   POST /api/v1/oauth/credentials/generate
 * @desc    Generate or regenerate Renic Client ID and Secret Key for a customer
 * @access  Private (Platform Owner / Admin)
 */
router.post('/credentials/generate', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const { customerCode } = req.body;
    if (!customerCode) {
      return res.status(400).json({ success: false, message: 'customerCode is required' });
    }

    const cleanCode = customerCode.trim().toUpperCase();
    const client = await Client.findOne({
      $or: [
        { customerCode: cleanCode },
        { subdomain: cleanCode.toLowerCase() }
      ]
    });

    if (!client) {
      return res.status(404).json({ success: false, message: `Customer '${customerCode}' not found` });
    }

    const { clientId, clientSecret } = generateClientCredentials(cleanCode);
    const clientSecretHash = await bcrypt.hash(clientSecret, 10);

    client.clientId = clientId;
    client.clientSecret = clientSecret; // Preserved for admin reference
    client.clientSecretHash = clientSecretHash;
    client.apiSecretKey = clientSecret;

    const hostingUrl = resolveClientHostingUrl(client, req);
    client.fullSaaSDomain = client.fullSaaSDomain || hostingUrl;

    await client.save();

    // Broadcast instant OTA push to tenant application
    broadcastOtaUpdateToTenant(client);

    res.json({
      success: true,
      message: `Credentials generated successfully for [${cleanCode}]`,
      credentials: {
        customerCode: cleanCode,
        clientName: client.name,
        softwareProduct: client.softwareProduct,
        clientId,
        clientSecret, // Returned in clear once on generation
        hostingUrl: client.fullSaaSDomain,
        tokenEndpoint: `${req.protocol}://${req.get('host')}/api/v1/oauth/token`
      }
    });
  } catch (error) {
    console.error('Credentials generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/v1/oauth/toggle-enforcement/:customerCode
 * @desc    Toggle whether OAuth authentication is mandatory for this customer's screens
 * @access  Private (Platform Owner / Admin)
 */
router.post('/toggle-enforcement/:customerCode', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const { customerCode } = req.params;
    const cleanCode = customerCode.trim().toUpperCase();
    const client = await Client.findOne({
      $or: [
        { customerCode: cleanCode },
        { subdomain: cleanCode.toLowerCase() }
      ]
    });

    if (!client) {
      return res.status(404).json({ success: false, message: `Customer '${customerCode}' not found` });
    }

    client.oauthEnforced = !client.oauthEnforced;
    await client.save();

    broadcastOtaUpdateToTenant(client);

    res.json({
      success: true,
      oauthEnforced: client.oauthEnforced,
      message: client.oauthEnforced
        ? `OAuth 2.0 Security ENFORCED for ${cleanCode}. Screens will require valid Client ID & Secret in Settings.`
        : `OAuth 2.0 Security set to permissive for ${cleanCode}.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const resolveTokenEndpoint = (client, req) => {
  if (client?.oauthTokenEndpoint && client.oauthTokenEndpoint.trim()) {
    return client.oauthTokenEndpoint.trim();
  }
  if (process.env.PUBLIC_API_URL && process.env.PUBLIC_API_URL.trim()) {
    return `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/oauth/token`;
  }
  return `${req.protocol}://${req.get('host')}/api/v1/oauth/token`;
};

export const resolveClientHostingUrl = (client, req) => {
  if (client?.fullSaaSDomain && !client.fullSaaSDomain.includes('yourdomain.com')) {
    return client.fullSaaSDomain;
  }
  if (client?.customDomain && client.customDomain.trim()) {
    const cd = client.customDomain.trim();
    return cd.startsWith('http') ? cd : `https://${cd}`;
  }
  const slug = (client?.subdomain || client?.shopSlug || client?.customerCode || 'tenant').toLowerCase();
  if (process.env.HOSTING_BASE_DOMAIN) {
    const proto = process.env.HOSTING_PROTOCOL || 'https';
    return `${proto}://${slug}.${process.env.HOSTING_BASE_DOMAIN}`;
  }
  const port = process.env.PORT || 5050;
  return `http://${slug}.lvh.me:${port}`;
};

/**
 * @route   PUT /api/v1/oauth/credentials/:customerCode
 * @desc    Edit and update credentials, custom hosting URLs, and token endpoints
 * @access  Private (Platform Owner / Admin)
 */
router.put('/credentials/:customerCode', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const { customerCode } = req.params;
    const { hostingUrl, oauthTokenEndpoint, clientId, clientSecret, customDomain, subdomain, name } = req.body;

    const cleanCode = customerCode.trim().toUpperCase();
    const client = await Client.findOne({
      $or: [
        { customerCode: cleanCode },
        { subdomain: cleanCode.toLowerCase() }
      ]
    });

    if (!client) {
      return res.status(404).json({ success: false, message: `Customer '${customerCode}' not found` });
    }

    if (name) client.name = name.trim();
    if (hostingUrl) client.fullSaaSDomain = hostingUrl.trim();
    if (oauthTokenEndpoint !== undefined) client.oauthTokenEndpoint = oauthTokenEndpoint.trim();
    if (customDomain !== undefined) client.customDomain = customDomain.trim();
    if (subdomain) client.subdomain = subdomain.trim().toLowerCase();
    if (clientId) client.clientId = clientId.trim();
    if (clientSecret && clientSecret !== '••••••••••••••••••••••••••••••••') {
      client.clientSecret = clientSecret.trim();
      client.clientSecretHash = await bcrypt.hash(clientSecret.trim(), 10);
      client.apiSecretKey = clientSecret.trim();
    }

    await client.save();

    // Broadcast instant OTA push to tenant application
    broadcastOtaUpdateToTenant(client);

    res.json({
      success: true,
      message: `Credentials & Hosting URLs for [${cleanCode}] updated successfully!`,
      client: {
        id: client._id,
        name: client.name,
        customerCode: client.customerCode,
        hostingUrl: client.fullSaaSDomain,
        oauthTokenEndpoint: client.oauthTokenEndpoint,
        tokenEndpoint: resolveTokenEndpoint(client, req),
        clientId: client.clientId,
        clientSecret: client.clientSecret
      }
    });
  } catch (error) {
    console.error('Update credentials error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/v1/oauth/credentials/:customerCode
 * @desc    Retrieve credentials and hosting details for a customer
 * @access  Private (Platform Owner / Admin)
 */
router.get('/credentials/:customerCode', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const { customerCode } = req.params;
    const cleanCode = customerCode.trim().toUpperCase();

    const client = await Client.findOne({
      $or: [
        { customerCode: cleanCode },
        { subdomain: cleanCode.toLowerCase() }
      ]
    });

    if (!client) {
      return res.status(404).json({ success: false, message: `Customer '${customerCode}' not found` });
    }

    // Auto-generate credentials if client doesn't have them yet
    if (!client.clientId || !client.clientSecret) {
      const { clientId, clientSecret } = generateClientCredentials(client.customerCode);
      client.clientId = clientId;
      client.clientSecret = clientSecret;
      client.clientSecretHash = await bcrypt.hash(clientSecret, 10);
      client.apiSecretKey = clientSecret;
      await client.save();
    }

    const hostingUrl = resolveClientHostingUrl(client, req);

    res.json({
      success: true,
      credentials: {
        customerCode: client.customerCode,
        clientName: client.name,
        softwareProduct: client.softwareProduct,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        hostingUrl,
        tokenEndpoint: resolveTokenEndpoint(client, req),
        oauthTokenEndpoint: client.oauthTokenEndpoint || '',
        licenseStatus: client.licenseStatus,
        isLocked: !!client.securitySettings?.emergencyLock
      }
    });
  } catch (error) {
    console.error('Fetch credentials error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/v1/oauth/clients-summary
 * @desc    List all clients with their API credential status for the OAuth Hub
 * @access  Private (Platform Owner / Admin)
 */
router.get('/clients-summary', protect, authorize('platform_owner', 'admin'), async (req, res) => {
  try {
    const clients = await Client.find({}).select(
      'name customerCode shopSlug subdomain customDomain softwareProduct clientId clientSecret clientSecretHash oauthTokenEndpoint fullSaaSDomain licenseStatus securitySettings contact pendingOwnerEmail pendingOwnerMobile oauthEnforced'
    ).sort({ createdAt: -1 });

    // Auto-generate credentials for any client missing them
    for (const c of clients) {
      if (!c.clientId || !c.clientSecret) {
        const { clientId, clientSecret } = generateClientCredentials(c.customerCode);
        c.clientId = clientId;
        c.clientSecret = clientSecret;
        c.clientSecretHash = await bcrypt.hash(clientSecret, 10);
        c.apiSecretKey = clientSecret;
        await Client.findByIdAndUpdate(c._id, {
          clientId,
          clientSecret,
          clientSecretHash: c.clientSecretHash,
          apiSecretKey: clientSecret
        });
      }
    }

    const summary = clients.map((c) => {
      const slug = (c.subdomain || c.shopSlug || c.customerCode || '').toLowerCase();
      return {
        id: c._id,
        name: c.name,
        customerCode: c.customerCode || slug.toUpperCase(),
        softwareProduct: c.softwareProduct || 'WA_INSTA_AUTOMATION',
        clientId: c.clientId || '',
        hasSecret: !!(c.clientSecret || c.clientSecretHash),
        clientSecret: c.clientSecret || '',
        hostingUrl: resolveClientHostingUrl(c, req),
        oauthTokenEndpoint: c.oauthTokenEndpoint || '',
        tokenEndpoint: resolveTokenEndpoint(c, req),
        licenseStatus: c.licenseStatus,
        isLocked: !!c.securitySettings?.emergencyLock,
        contactMobile: c.pendingOwnerMobile || c.contact || '',
        oauthEnforced: !!c.oauthEnforced
      };
    });

    res.json({ success: true, clients: summary });
  } catch (error) {
    console.error('Fetch clients summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
