import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Client from '../models/Client.js';
import { isClientSubscriptionExpired, handleExpiredSubscription, isClientDisabled, handleDisabledCustomer } from '../utils/subscriptionGuard.js';

const router = express.Router();

const cleanIp = (raw) => {
  if (!raw) return '127.0.0.1';
  let ip = raw.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  if (ip === '::1') return '127.0.0.1';
  return ip;
};

/**
 * Dynamic IP Matching Gateway:
 * GET /auto or GET /gateway/auto
 * Automatically matches the incoming caller's IP with the registered tenant in the database!
 */
router.get(['/auto', '/gateway/auto'], async (req, res) => {
  try {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const callerIp = cleanIp(rawIp);

    // Find client matching caller IP
    let client = await Client.findOne({
      $or: [
        { 'portForwarding.targetIp': callerIp },
        { 'securitySettings.ipWhitelist': callerIp }
      ]
    });

    // If caller is loopback or local LAN, find active client matching this LAN or most recent
    if (!client && (callerIp === '127.0.0.1' || callerIp === 'localhost')) {
      client = await Client.findOne({ 'portForwarding.targetIp': { $in: ['127.0.0.1', '192.168.1.19'] } }) ||
               await Client.findOne().sort({ updatedAt: -1 });
    }

    if (!client) {
      return res.status(404).send(`
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 520px; margin: 40px auto; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <div style="display: inline-block; padding: 8px 14px; background: #ecfdf5; color: #059669; border-radius: 20px; font-weight: 700; font-size: 12px; margin-bottom: 12px;">RENIC DYNAMIC GATEWAY</div>
          <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 20px;">No Showroom Registered for this IP</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">Your incoming IP: <strong style="color: #0f172a; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${callerIp}</strong> is not yet assigned to any client in Renic_Soft.</p>
          <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">
            💡 <strong>How to resolve:</strong><br/>
            1. Open Renic_Soft Network Manager at <a href="http://localhost:5175/network" style="color: #10b981; font-weight: bold;">http://localhost:5175/network</a><br/>
            2. Click <strong>"⚡ Relink IP"</strong> on your showroom card and assign IP <code>${callerIp}</code>.<br/>
            3. Or visit via specific code: <code>/gateway/TX10</code> or <code>/gateway/AU20</code>.
          </div>
        </div>
      `);
    }

    if (isClientDisabled(client)) {
      return handleDisabledCustomer(req, res, client);
    }

    if (isClientSubscriptionExpired(client)) {
      return handleExpiredSubscription(req, res, client);
    }

    const targetIp = client.portForwarding?.targetIp || callerIp;
    const assignedPort = client.portForwarding?.assignedPort || (client.softwareProduct === 'TEXTILE_POS' ? 5174 : (client.softwareProduct === 'DELIVERY_CHALLAN' ? 5176 : 5173));

    console.log(`[Dynamic IP Match] Caller IP ${callerIp} matched tenant ${client.customerCode} (${client.name}) -> http://${targetIp}:${assignedPort}`);
    
    if (req.query.mode === 'direct') {
      return res.redirect(`http://${targetIp}:${assignedPort}`);
    }
    return renderPortlessAppShell(res, client, targetIp, assignedPort);
  } catch (err) {
    return res.status(500).send(`<h3>Gateway Error</h3><p>${err.message}</p>`);
  }
});

/**
 * Portless Application Shell Renderer:
 * Masks the internal IP and port completely from the browser URL bar!
 * The user only sees the clean URL, but internally it connects to the target IP & port.
 */
const renderPortlessAppShell = (res, client, targetIp, assignedPort) => {
  const internalUrl = `http://${targetIp}:${assignedPort}`;
  const appTitle = `${client.name || 'Renic Showroom'} · ${client.softwareProduct === 'TEXTILE_POS' ? 'TextilePOS Plus' : (client.softwareProduct === 'DELIVERY_CHALLAN' ? 'Delivery Challan ERP' : 'WhatsApp Automation')}`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${appTitle}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #renic-app-viewport {
      border: 0;
      width: 100%;
      height: 100%;
      display: block;
      overflow: auto;
    }
  </style>
</head>
<body>
  <iframe 
    id="renic-app-viewport" 
    src="${internalUrl}" 
    allow="camera; microphone; geolocation; usb; clipboard-read; clipboard-write; serial; display-capture"
    title="${appTitle}"
  ></iframe>
</body>
</html>`);
};

/**
 * 1-Click Gateway & Cloud Direct Link Matcher:
 * GET /gateway/:customerCode or GET /dm/:customerCode
 * Zero IP exposure in browser URL! Internally proxies/loads the assigned Target IP and Port.
 */
router.get(['/gateway/:customerCode', '/dm/:customerCode'], async (req, res) => {
  try {
    const { customerCode } = req.params;
    const cleanCode = (customerCode || '').trim().toUpperCase();

    const client = await Client.findOne({
      $or: [
        { customerCode: cleanCode },
        { shopSlug: cleanCode.toLowerCase() },
        { subdomain: cleanCode.toLowerCase() },
        { 'securitySettings.previousSlugs.slug': cleanCode }
      ]
    });

    if (!client) {
      return res.status(404).send(`
        <div style="font-family: sans-serif; padding: 30px; max-width: 500px; margin: 50px auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h3 style="color: #ef4444;">404 Tenant Not Found</h3>
          <p style="color: #64748b;">No registered showroom found matching code or slug: <strong>${customerCode}</strong></p>
        </div>
      `);
    }

    if (isClientDisabled(client)) {
      return handleDisabledCustomer(req, res, client);
    }

    if (isClientSubscriptionExpired(client)) {
      return handleExpiredSubscription(req, res, client);
    }

    const targetIp = client.portForwarding?.targetIp || '127.0.0.1';
    const assignedPort = client.portForwarding?.assignedPort || (client.softwareProduct === 'TEXTILE_POS' ? 5174 : (client.softwareProduct === 'DELIVERY_CHALLAN' ? 5176 : 5173));

    console.log(`[Dynamic Gateway] Routing ${client.customerCode} (${client.name}) internally to http://${targetIp}:${assignedPort}`);
    
    if (req.query.mode === 'direct') {
      return res.redirect(`http://${targetIp}:${assignedPort}`);
    }
    return renderPortlessAppShell(res, client, targetIp, assignedPort);
  } catch (err) {
    return res.status(500).send(`<h3>Gateway Error</h3><p>${err.message}</p>`);
  }
});

/**
 * Direct Dynamic Forwarder:
 * GET /forward/:targetIp/:targetPort
 * Directly redirects or forwards to any dynamic IP and port
 */
router.get('/forward/:targetIp/:targetPort', (req, res) => {
  const { targetIp, targetPort } = req.params;
  const url = `http://${targetIp}:${targetPort}`;
  console.log(`[Direct Forwarder] Routing to ${url}`);
  return res.redirect(url);
});

/**
 * Transparent Streaming Reverse Proxy:
 * ALL /app/:customerCode/*
 * Forwards any request to http://targetIp:assignedPort without revealing the destination IP to client
 */
router.use('/app/:customerCode', async (req, res, next) => {
  try {
    const { customerCode } = req.params;
    const cleanCode = (customerCode || '').trim().toUpperCase();

    const client = await Client.findOne({
      $or: [
        { customerCode: cleanCode },
        { shopSlug: cleanCode.toLowerCase() },
        { subdomain: cleanCode.toLowerCase() }
      ]
    });

    if (!client) {
      return res.status(404).json({ success: false, message: `Tenant '${customerCode}' not found` });
    }

    if (isClientDisabled(client)) {
      return handleDisabledCustomer(req, res, client);
    }

    if (isClientSubscriptionExpired(client)) {
      return handleExpiredSubscription(req, res, client);
    }

    const targetIp = client.portForwarding?.targetIp || '127.0.0.1';
    const assignedPort = client.portForwarding?.assignedPort || (client.softwareProduct === 'TEXTILE_POS' ? 5174 : (client.softwareProduct === 'DELIVERY_CHALLAN' ? 5176 : 5173));
    const target = `http://${targetIp}:${assignedPort}`;

    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      pathRewrite: {
        [`^/app/${customerCode}`]: ''
      },
      onError: (err, req, res) => {
        res.status(502).json({
          success: false,
          error: 'BAD_GATEWAY',
          message: `Unable to connect to showroom terminal at ${target}. Please verify target IP and port are reachable.`,
          details: err.message
        });
      }
    });

    return proxy(req, res, next);
  } catch (err) {
    next(err);
  }
});

/**
 * Short Direct Root Link Matcher:
 * GET /:codeOrSlug
 * Allows opening e.g. http://localhost:5050/TX10 or http://192.168.1.19:5050/TX10
 */
const RESERVED_ROUTES = new Set([
  'api', 'health', 'gateway', 'app', 'forward', 'auto', 'proxy', 'assets',
  'static', 'favicon.ico', 'network', 'login', 'dashboard', 'settings'
]);

router.get('/:codeOrSlug', async (req, res, next) => {
  const { codeOrSlug } = req.params;
  const lower = (codeOrSlug || '').trim().toLowerCase();

  if (!codeOrSlug || RESERVED_ROUTES.has(lower) || lower.includes('.')) {
    return next();
  }

  try {
    const client = await Client.findOne({
      $or: [
        { customerCode: codeOrSlug.trim().toUpperCase() },
        { shopSlug: lower },
        { subdomain: lower },
        { 'securitySettings.previousSlugs.slug': codeOrSlug.trim().toUpperCase() }
      ]
    });

    if (!client) {
      return next();
    }

    if (client.securitySettings?.emergencyLock) {
      return res.status(423).send(`<h3>423 Tenant Suspended</h3><p>${client.securitySettings.lockReason || 'Tenant is temporarily frozen by Platform Owner.'}</p>`);
    }

    if (isClientSubscriptionExpired(client)) {
      return handleExpiredSubscription(req, res, client);
    }

    const targetIp = client.portForwarding?.targetIp || '127.0.0.1';
    const assignedPort = client.portForwarding?.assignedPort || (client.softwareProduct === 'TEXTILE_POS' ? 5174 : (client.softwareProduct === 'DELIVERY_CHALLAN' ? 5176 : 5173));

    console.log(`[Short Link Matcher] '${codeOrSlug}' matched ${client.name} internally -> http://${targetIp}:${assignedPort}`);
    if (req.query.mode === 'direct') {
      return res.redirect(`http://${targetIp}:${assignedPort}`);
    }
    return renderPortlessAppShell(res, client, targetIp, assignedPort);
  } catch (err) {
    next();
  }
});

export default router;
