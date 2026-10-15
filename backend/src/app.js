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
import planTierRoutes from './routes/planTiers.js';

import Client from './models/Client.js';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { connectDB } from './config/db.js';
import { CUSTOMER_DOMAIN, hostBelongsToCustomerDomain } from './utils/customerUrl.js';
import { appPortFor, backendPortFor } from './config/appPorts.js';
import { proxyInstanceCache, clientTargetCache, invalidateProxyCache } from './utils/proxyCache.js';
import { isClientSubscriptionExpired, handleExpiredSubscription, isClientDisabled, handleDisabledCustomer, renderDeletedCustomerPage } from './utils/subscriptionGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Restore original request URL if rewritten by Vercel serverless function
app.use((req, res, next) => {
  if (req.url === '/api/index.js' || req.url.startsWith('/api/index.js')) {
    const original = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.url.replace(/^\/api\/index\.js/, '');
    if (original) {
      req.url = original.startsWith('/') ? original : `/${original}`;
    }
  }
  next();
});

app.use(cors());

// Dynamic Subdomain Proxy for *.renictech.com (canonical), plus legacy
// *.renic.store / *.lvh.me / *.sslip.io fallbacks (Zero-Overhead Cached)
app.use(async (req, res, next) => {
  const rawHost = req.headers.host || '';
  const host = rawHost.split(':')[0].toLowerCase();
  let sub = '';

  // Canonical customer domain:  {appSlug}.{customerCode}.renictech.com
  if (hostBelongsToCustomerDomain(host) && host !== CUSTOMER_DOMAIN) {
    sub = host.slice(0, -(CUSTOMER_DOMAIN.length + 1));
  } else if (host.endsWith('.renic.store')) {
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
      // SECURITY: tenant resolution is driven ONLY by the Host header.
      // No query parameter may select a client — OAuth clientId/clientSecret
      // are credentials and must never influence routing or appear in a URL.
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
        // Route by APPLICATION only. The Host header already identifies the
        // customer, so there is no per-customer port or IP — every customer
        // of a product shares that product's single process. Reading
        // client.portForwarding here was redundant and, when stale, could
        // send a customer's traffic into a different product's process.
        target = `http://localhost:${appPortFor(client.softwareProduct)}`;
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

// Ensure database connection is ready for serverless requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

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
app.use('/api/plan-tiers', planTierRoutes);
app.use('/api/v1/plan-tiers', planTierRoutes);

// Root status check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Renic Soft Central SaaS API',
    url: req.url,
    originalUrl: req.originalUrl,
    matchedPath: req.headers['x-matched-path'],
    forwardedUri: req.headers['x-forwarded-uri'],
    headers: req.headers,
    health: '/health',
    time: new Date().toISOString()
  });
});

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