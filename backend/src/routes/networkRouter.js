import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import os from 'os';
import Client from '../models/Client.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply auth protection for platform owner
router.use(protect);

/**
 * @route   GET /api/network/mappings
 * @desc    Get all client fleet routing mappings (Platform Owner Cockpit)
 * @access  Private (Admin / Platform Owner)
 */
router.get('/mappings', authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const clients = await Client.find().sort({ updatedAt: -1 });

    const mappings = clients.map(client => {
      const code = client.customerCode || client.subdomain?.toUpperCase() || client.name.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'RENIC';
      const slug = client.shopSlug || client.subdomain || code.toLowerCase();
      // SaaS Production URL: https://<clientId>.cloud.renicsoft.com
      const saasUrl = client.fullSaaSDomain || `https://${code.toLowerCase()}.cloud.renicsoft.com`;

      return {
        _id: client._id,
        name: client.name,
        customerCode: code,
        shopSlug: slug,
        softwareProduct: client.softwareProduct || 'WA_INSTA_AUTOMATION',
        saasUrl,
        planTier: client.planTier,
        licenseStatus: client.licenseStatus,
        portForwarding: {
          targetIp: client.portForwarding?.targetIp || '127.0.0.1',
          assignedPort: client.portForwarding?.assignedPort || client.assignedPort || 5000,
          connectionType: client.portForwarding?.connectionType || 'PORT_FORWARD_ROUTER',
          status: client.portForwarding?.status || 'unknown',
          latencyMs: client.portForwarding?.latencyMs || 0,
          lastPingAt: client.portForwarding?.lastPingAt,
          lastHeartbeatAt: client.portForwarding?.lastHeartbeatAt,
          autoRelinkEnabled: client.portForwarding?.autoRelinkEnabled !== false,
          offlineGraceHours: client.portForwarding?.offlineGraceHours || 24,
          ipChangeHistory: client.portForwarding?.ipChangeHistory || []
        },
        securitySettings: {
          emergencyLock: client.securitySettings?.emergencyLock || false,
          lockReason: client.securitySettings?.lockReason || '',
          requireShowroomIp: client.securitySettings?.requireShowroomIp || false,
          ipWhitelist: client.securitySettings?.ipWhitelist || [],
          previousSlugs: client.securitySettings?.previousSlugs || []
        }
      };
    });

    res.json({ success: true, count: mappings.length, mappings });
  } catch (error) {
    console.error('Error fetching network mappings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/network/relink/:clientId
 * @desc    1-Click Zero-Downtime Dynamic IP Relink & Cloud URL Configuration
 * @access  Private (Admin / Platform Owner)
 */
router.put('/relink/:clientId', authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { targetIp, assignedPort, reason, connectionType, name, customerCode, saasUrl, fullSaaSDomain } = req.body;
    const client = await Client.findById(req.params.clientId);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    if (name) client.name = name.trim();
    if (customerCode) {
      const cleanCode = customerCode.trim().toUpperCase();
      if (client.customerCode && client.customerCode !== cleanCode) {
        client.securitySettings = client.securitySettings || {};
        client.securitySettings.previousSlugs = client.securitySettings.previousSlugs || [];
        client.securitySettings.previousSlugs.push({
          slug: client.customerCode,
          rotatedAt: new Date(),
          reason: 'Customer Code changed via Network Manager'
        });
      }
      client.customerCode = cleanCode;
      client.subdomain = cleanCode.toLowerCase();
      client.shopSlug = cleanCode.toLowerCase();
    }

    const domainToSet = fullSaaSDomain || saasUrl;
    if (domainToSet) {
      client.fullSaaSDomain = domainToSet.trim();
      client.portForwarding = client.portForwarding || {};
      client.portForwarding.publicWebUrl = domainToSet.trim();
    }

    client.portForwarding = client.portForwarding || {};
    const previousIp = client.portForwarding.targetIp || '127.0.0.1';
    const newIp = (targetIp || previousIp).trim();

    // Audit log to ipChangeHistory
    client.portForwarding.ipChangeHistory = client.portForwarding.ipChangeHistory || [];
    client.portForwarding.ipChangeHistory.push({
      previousIp,
      newIp,
      changedAt: new Date(),
      changedBy: req.user?.name || 'Platform Owner',
      reason: reason || 'Dynamic IP Relink / Cloud Network Configuration'
    });

    client.portForwarding.targetIp = newIp;
    if (assignedPort) {
      client.portForwarding.assignedPort = Number(assignedPort);
      client.assignedPort = Number(assignedPort);
    }
    if (connectionType) {
      client.portForwarding.connectionType = connectionType;
    }

    // Trigger immediate ping verification to the new IP
    let pingLatency = 0;
    let pingStatus = 'unknown';
    const port = client.portForwarding.assignedPort || 5000;
    const startTime = Date.now();

    try {
      await axios.get(`http://${newIp}:${port}/health`, { timeout: 2500 });
      pingLatency = Date.now() - startTime;
      pingStatus = 'online';
    } catch (err) {
      // Try /api/health fallback
      try {
        await axios.get(`http://${newIp}:${port}/api/health`, { timeout: 1500 });
        pingLatency = Date.now() - startTime;
        pingStatus = 'online';
      } catch (fallbackErr) {
        pingStatus = 'offline';
      }
    }

    client.portForwarding.status = pingStatus;
    client.portForwarding.latencyMs = pingLatency;
    client.portForwarding.lastPingAt = new Date();

    await client.save();

    res.json({
      success: true,
      message: `Relinked successfully to ${newIp}:${port}. Status: ${pingStatus} (${pingLatency}ms)`,
      portForwarding: client.portForwarding
    });
  } catch (error) {
    console.error('Relink error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/network/rotate-slug/:clientId
 * @desc    1-Click URL Slug Rotation (Instantly Invalidates Leaked URL)
 * @access  Private (Admin / Platform Owner)
 */
router.post('/rotate-slug/:clientId', authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { customSlug } = req.body;
    const client = await Client.findById(req.params.clientId);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    client.securitySettings = client.securitySettings || {};
    client.securitySettings.previousSlugs = client.securitySettings.previousSlugs || [];

    const oldSlug = client.shopSlug || client.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Archive old slug
    client.securitySettings.previousSlugs.push({
      slug: oldSlug,
      rotatedAt: new Date(),
      reason: 'URL Rotation / Security Refresh'
    });

    // Generate new unique slug
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    const newSlug = customSlug 
      ? customSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') 
      : `${oldSlug.replace(/-[a-f0-9]{4}$/, '')}-${randomSuffix}`;

    client.shopSlug = newSlug;
    const code = (client.customerCode || 'CLIENT').toLowerCase();
    client.fullSaaSDomain = `https://${code}-${newSlug}.renic.store`;

    await client.save();

    res.json({
      success: true,
      message: 'URL slug rotated successfully! Previous URL is now invalid.',
      oldSlug,
      newSlug,
      newSaaSUrl: client.fullSaaSDomain
    });
  } catch (error) {
    console.error('Slug rotation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/network/emergency-lock/:clientId
 * @desc    1-Click Emergency Killswitch (Tenant Freeze)
 * @access  Private (Admin / Platform Owner)
 */
router.post('/emergency-lock/:clientId', authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { lockReason } = req.body;
    const client = await Client.findById(req.params.clientId);

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    client.securitySettings = client.securitySettings || {};
    const currentLock = client.securitySettings.emergencyLock || false;
    client.securitySettings.emergencyLock = !currentLock;
    client.securitySettings.lockReason = !currentLock ? (lockReason || 'Tenant temporarily suspended for security maintenance by Platform Owner.') : '';

    await client.save();

    res.json({
      success: true,
      emergencyLock: client.securitySettings.emergencyLock,
      message: client.securitySettings.emergencyLock 
        ? '🚨 Emergency Killswitch ACTIVATED. Tenant is now locked.' 
        : '🟢 Tenant lock RELEASED. Service resumed.'
    });
  } catch (error) {
    console.error('Emergency lock error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/network/ping/:clientId
 * @desc    Live Health Ping & Latency Check to Showroom Port
 * @access  Private (Admin / Platform Owner)
 */
router.post('/ping/:clientId', authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.clientId);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    const targetIp = client.portForwarding?.targetIp || '127.0.0.1';
    const port = client.portForwarding?.assignedPort || client.assignedPort || 5000;
    const startTime = Date.now();

    let isOnline = false;
    let latencyMs = 0;

    try {
      const resp = await axios.get(`http://${targetIp}:${port}/`, {
        timeout: 2000,
        validateStatus: () => true
      });
      latencyMs = Date.now() - startTime;
      isOnline = resp.status < 500;
    } catch (e1) {
      try {
        const resp2 = await axios.get(`http://${targetIp}:${port}/health`, {
          timeout: 1500,
          validateStatus: () => true
        });
        latencyMs = Date.now() - startTime;
        isOnline = resp2.status < 500;
      } catch (e2) {
        isOnline = false;
        latencyMs = 0;
      }
    }

    client.portForwarding = client.portForwarding || {};
    client.portForwarding.status = isOnline ? 'online' : 'offline';
    client.portForwarding.latencyMs = latencyMs;
    client.portForwarding.lastPingAt = new Date();

    await client.save();

    res.json({
      success: true,
      status: client.portForwarding.status,
      latencyMs,
      target: `${targetIp}:${port}`,
      lastPingAt: client.portForwarding.lastPingAt
    });
  } catch (error) {
    console.error('Ping test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/network/detect-ip
 * @desc    Auto-detect active laptop / server LAN IPv4 addresses
 * @access  Private (Admin / Platform Owner)
 */
router.get('/detect-ip', authorize('admin', 'platform_owner'), (req, res) => {
  try {
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
    let callerIp = rawIp.replace('::ffff:', '');
    if (callerIp === '::1') callerIp = '127.0.0.1';

    const ifaces = os.networkInterfaces();
    let serverLanIp = '127.0.0.1';
    const detectedInterfaces = [];

    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          detectedInterfaces.push({ name, ip: iface.address });
          if (serverLanIp === '127.0.0.1') {
            serverLanIp = iface.address;
          }
        }
      }
    }
    res.json({
      success: true,
      serverLanIp,
      callerIp,
      detectedInterfaces
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/network/ping-url
 * @desc    Real-time Live URL & Target Node Ping Telemetry
 * @access  Private (Admin / Platform Owner)
 */
router.post('/ping-url', authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { url, clientId } = req.body;
    let targetUrl = (url || '').trim();
    let client = null;

    if (clientId) {
      client = await Client.findById(clientId);
      if (!targetUrl && client) {
        targetUrl = `http://localhost:5050/gateway/${client.customerCode}`;
      }
    }

    if (!targetUrl) {
      targetUrl = 'http://localhost:5050/gateway/RENIC';
    }

    // Ping the URL with live timing
    let urlOnline = false;
    let urlLatency = 0;
    let urlStatus = 0;
    let urlError = null;
    const t0 = Date.now();

    try {
      const response = await axios.get(targetUrl, {
        timeout: 4000,
        validateStatus: () => true // accept any HTTP status code without throwing
      });
      urlLatency = Date.now() - t0;
      urlStatus = response.status;
      urlOnline = response.status < 500;
    } catch (err) {
      urlLatency = Date.now() - t0;
      urlError = err.message;
      urlOnline = false;
    }

    // Ping internal machine target node if client found
    let nodeReachable = false;
    let nodeLatency = 0;
    let nodeEndpoint = '';

    if (client && client.portForwarding?.targetIp && client.portForwarding?.assignedPort) {
      nodeEndpoint = `${client.portForwarding.targetIp}:${client.portForwarding.assignedPort}`;
      const tNode = Date.now();
      try {
        const nodeRes = await axios.get(`http://${nodeEndpoint}/`, {
          timeout: 2500,
          validateStatus: () => true
        });
        nodeLatency = Date.now() - tNode;
        nodeReachable = nodeRes.status < 500;
      } catch (err) {
        nodeReachable = false;
        nodeLatency = Date.now() - tNode;
      }

      // Update client portForwarding telemetry in DB
      client.portForwarding.status = (urlOnline && nodeReachable) ? 'online' : (nodeReachable ? 'online' : 'offline');
      client.portForwarding.latencyMs = urlLatency || nodeLatency;
      client.portForwarding.lastPingAt = new Date();
      await client.save();
    }

    let speedRating = '⚡ Ultra-Fast (< 50ms)';
    if (urlLatency > 250) speedRating = '🟡 Moderate (> 250ms)';
    else if (urlLatency > 100) speedRating = '🟢 Fast (< 250ms)';

    res.json({
      success: true,
      url: targetUrl,
      isOnline: urlOnline,
      httpStatus: urlStatus,
      latencyMs: urlLatency,
      speedRating,
      error: urlError,
      nodeEndpoint,
      nodeReachable,
      nodeLatencyMs: nodeLatency,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Real-time URL ping error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
