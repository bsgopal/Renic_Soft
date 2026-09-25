import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import quoteRoutes from './routes/quotes.js';
import billRoutes from './routes/bills.js';
import statsRoutes from './routes/stats.js';
import notificationRoutes from './routes/notifications.js';
import exportRoutes from './routes/export.js';
import settingsRoutes from './routes/settings.js';
import syncRoutes from './routes/sync.js';
import tenantRoutes from './routes/tenants.js';
import networkRoutes from './routes/networkRouter.js';
import gatewayRoutes from './routes/gatewayProxy.js';
import applicationRoutes from './routes/applications.js';
import oauthRoutes from './routes/oauthRoutes.js';
import activityRoutes from './routes/activityRoutes.js';

import Client from './models/Client.js';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { proxyInstanceCache, clientTargetCache, invalidateProxyCache } from './utils/proxyCache.js';
import { isClientSubscriptionExpired, handleExpiredSubscription, isClientDisabled, handleDisabledCustomer, renderDeletedCustomerPage } from './utils/subscriptionGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());

// Dynamic Subdomain Proxy for *.renic.store, *.lvh.me, and *.sslip.io (Zero-Overhead Cached)
app.use(async (req, res, next) => {
  const rawHost = req.headers.host || '';
  const host = rawHost.split(':')[0].toLowerCase();
  let sub = '';

  if (host.endsWith('.renic.store')) {
    sub = host.replace('.renic.store', '');
  } else if (host.endsWith('.lvh.me')) {
    sub = host.replace('.lvh.me', '');
  } else if (host.includes('.sslip.io')) {
    sub = host.split('.')[0];
  } else if (host.includes('.nip.io')) {
    sub = host.split('.')[0];
  } else if (host.endsWith('.dm.renicsoft.com')) {
    sub = host.replace('.dm.renicsoft.com', '');
  } else if (host.endsWith('.trycloudflare.com')) {
    const rawPath = (req.path.split('/')[1] || '').toLowerCase();
    const systemKeywords = ['api', 'health', 'assets', '@vite', '@fs', '@react-refresh', 'src', 'node_modules', 'favicon.svg', 'favicon.ico'];
    if (rawPath && !systemKeywords.includes(rawPath)) {
      sub = rawPath;
    } else if (req.query.client) {
      sub = String(req.query.client).toLowerCase();
    } else {
      sub = 'renic';
    }
  }

  // System subdomains should fall through to Renic Soft Master console
  const systemSubdomains = ['hq', 'api', 'admin', 'localhost', 'master', 'renicsoft', 'dashboard'];

  if (sub && !systemSubdomains.includes(sub)) {
    const cleanSub = sub.toLowerCase();
    const cleanCode = sub.toUpperCase();

    // Extract tenant identifier for smart subdomains like "pos.tx10" or "wa.tx10"
    const parts = cleanSub.split('.');
    const tenantKey = parts[parts.length - 1]; // e.g. "tx10"
    const tenantCode = tenantKey.toUpperCase(); // e.g. "TX10"

    try {
      const client = await Client.findOne({
        $or: [
          { shopSlug: cleanSub },
          { subdomain: cleanSub },
          { customerCode: cleanCode },
          { shopSlug: tenantKey },
          { subdomain: tenantKey },
          { customerCode: tenantCode },
          { fullSaaSDomain: new RegExp(cleanSub, 'i') },
          { fullSaaSDomain: new RegExp(tenantKey, 'i') },
          { 'securitySettings.previousSlugs.slug': cleanSub },
          { 'securitySettings.previousSlugs.slug': tenantKey }
        ]
      });

      // 1. IF CUSTOMER IS DELETED OR DOES NOT EXIST -> URL MUST NOT WORK!
      if (!client) {
        invalidateProxyCache(cleanSub);
        invalidateProxyCache(tenantKey);

        const acceptsJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.path.startsWith('/api/');
        if (acceptsJson) {
          return res.status(404).json({
            success: false,
            error: 'CUSTOMER_NOT_FOUND',
            message: `Customer instance for host '${rawHost}' does not exist or has been deleted.`
          });
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(renderDeletedCustomerPage(rawHost, sub));
      }

      // 2. IF CUSTOMER IS DISABLED / LOCKED / SUSPENDED -> URL MUST NOT WORK!
      if (isClientDisabled(client)) {
        invalidateProxyCache(cleanSub);
        invalidateProxyCache(tenantKey);
        return handleDisabledCustomer(req, res, client);
      }

      // 3. IF CUSTOMER SUBSCRIPTION IS EXPIRED -> URL MUST NOT WORK!
      if (isClientSubscriptionExpired(client)) {
        invalidateProxyCache(cleanSub);
        invalidateProxyCache(tenantKey);
        return handleExpiredSubscription(req, res, client);
      }

      // 4. ACTIVE CUSTOMER -> PROXY TO INSTANCE
      let target = clientTargetCache.get(cleanSub);
      if (!target) {
        const defaultPort = (client.softwareProduct === 'TEXTILE_POS') ? 5174 
          : (client.softwareProduct === 'DELIVERY_CHALLAN') ? 5176 
          : 5173;
        const assignedPort = client.portForwarding?.assignedPort || client.assignedPort || defaultPort;
        const targetIp = client.portForwarding?.targetIp || '127.0.0.1';
        const ip = (targetIp === '127.0.0.1') ? 'localhost' : targetIp;
        target = `http://${ip}:${assignedPort}`;
        clientTargetCache.set(cleanSub, target);
      }

      if (target) {
        let proxy = proxyInstanceCache.get(target);
        if (!proxy) {
          proxy = createProxyMiddleware({ target, changeOrigin: true, ws: true });
          proxyInstanceCache.set(target, proxy);
        }
        return proxy(req, res, next);
      }
    } catch (err) {
      console.error('Subdomain proxy lookup error:', err);
    }
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use(gatewayRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/licenses', clientRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/v1/tenant', tenantRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/v1/oauth', oauthRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/v1/activity', activityRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: process.env.MOCK_DB === 'true' ? 'Mock JSON File-Store' : 'MongoDB Connected',
    time: new Date().toISOString()
  });
});

// Serve static assets from frontend/dist if it exists (production build)
const distPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

export default app;