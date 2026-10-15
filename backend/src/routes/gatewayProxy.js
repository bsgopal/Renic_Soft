import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Client from '../models/Client.js';
import { isClientSubscriptionExpired, handleExpiredSubscription, isClientDisabled, handleDisabledCustomer } from '../utils/subscriptionGuard.js';
import { appPortFor } from '../config/appPorts.js';
import { buildCustomerUrlForProduct } from '../utils/customerUrl.js';

const router = express.Router();

/**
 * WHAT CHANGED IN THIS FILE, AND WHY
 *
 * Every route here used to resolve a tenant to a per-customer
 * `portForwarding.targetIp` + `portForwarding.assignedPort` and then either
 * bounce the browser to that host:port or wrap it in an iframe pointing at it.
 *
 * Customers do not own an IP or a port. The Host header
 * (`{appSlug}.{customerCode}.renictech.com`) identifies the customer and their
 * `softwareProduct` decides which shared process answers — see
 * `config/appPorts.js`. Consequently:
 *
 *   - `GET /forward/:targetIp/:targetPort` was deleted. It redirected to
 *     whatever host:port a caller typed into the URL bar with no validation at
 *     all — an open redirect usable as an SSRF staging point — and nothing in
 *     the codebase ever linked to it.
 *   - `GET /auto` was deleted. It guessed the tenant from the caller's IP and,
 *     when the IP matched no tenant, fell back to "whichever tenant was updated
 *     last", so an unknown visitor could be handed another customer's tenant.
 *   - The remaining short links now302 to the customer's canonical URL instead
 *     of rendering an iframe at `http://<private-ip>:<port>`, which only ever
 *     worked when the browser happened to run on the server itself.
 */

/** Resolve a tenant by customer code, slug, subdomain, or previous slug. */
const findClient = (rawCode) => {
  const raw = String(rawCode || '').trim();
  const lower = raw.toLowerCase();
  return Client.findOne({
    $or: [
      { customerCode: raw.toUpperCase() },
      { shopSlug: lower },
      { subdomain: lower },
      { 'securitySettings.previousSlugs.slug': raw.toUpperCase() }
    ]
  });
};

/**
 * Shared gate: a disabled or expired customer's URL must stop working whether
 * they arrive by hostname or through one of these short links. Returns false
 * when the response has already been written.
 */
const guardClient = (req, res, client) => {
  if (isClientDisabled(client)) {
    handleDisabledCustomer(req, res, client);
    return false;
  }
  if (isClientSubscriptionExpired(client)) {
    handleExpiredSubscription(req, res, client);
    return false;
  }
  return true;
};

/** The product's shared process — never a per-customer IP or port. */
const productTarget = (client) => `http://localhost:${appPortFor(client.softwareProduct)}`;

const notFoundPage = (code) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; max-width: 500px; margin: 50px auto; border: 1px solid #e2e8f0; border-radius: 12px;">
    <h3 style="color: #ef4444; margin-top: 0;">404 Tenant Not Found</h3>
    <p style="color: #64748b;">No registered showroom found matching code or slug: <strong>${code}</strong></p>
    <p style="color: #94a3b8; font-size: 13px;">Customer URLs look like <code>https://pos.RENIC-TX.renictech.com</code>.</p>
  </div>`;

/**
 * Short links -> the customer's canonical URL.
 *   GET /gateway/:customerCode
 *   GET /dm/:customerCode
 */
router.get(['/gateway/:customerCode', '/dm/:customerCode'], async (req, res) => {
  try {
    const client = await findClient(req.params.customerCode);
    if (!client) return res.status(404).send(notFoundPage(req.params.customerCode));
    if (!guardClient(req, res, client)) return;

    const canonical = buildCustomerUrlForProduct(client);
    if (!canonical) return res.status(404).send(notFoundPage(req.params.customerCode));
    return res.redirect(302, canonical);
  } catch (err) {
    return res.status(500).send(`<h3>Gateway Error</h3><p>${err.message}</p>`);
  }
});

/**
 * Transparent streaming reverse proxy: ALL /app/:customerCode/*
 *
 * Path-prefix proxy to the customer's *product* process. Kept because it is the
 * one entry point that works without a Host header (scripts, uptime checks).
 * The target is derived from the product, so no customer-specific network
 * detail is stored or read anywhere in this route.
 */
router.use('/app/:customerCode', async (req, res, next) => {
  try {
    const client = await findClient(req.params.customerCode);
    if (!client) {
      return res.status(404).json({ success: false, message: `Tenant '${req.params.customerCode}' not found` });
    }
    if (!guardClient(req, res, client)) return;

    const target = productTarget(client);
    const proxy = createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
      pathRewrite: {
        [`^/app/${req.params.customerCode}`]: ''
      },
      onError: (err, req, res) => {
        res.status(502).json({
          success: false,
          error: 'BAD_GATEWAY',
          message: `Unable to reach the ${client.softwareProduct} process for ${client.customerCode}.`,
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
 * Short Direct Root Link Matcher: GET /:codeOrSlug
 * e.g. http://localhost:5050/RENIC-TX -> https://pos.renic-tx.renictech.com
 */
const RESERVED_ROUTES = new Set([
  'api', 'health', 'gateway', 'app', 'forward', 'auto', 'proxy', 'assets',
  'static', 'favicon.ico', 'network', 'login', 'dashboard', 'settings', 'dm'
]);

router.get('/:codeOrSlug', async (req, res, next) => {
  const { codeOrSlug } = req.params;
  const lower = (codeOrSlug || '').trim().toLowerCase();

  if (!codeOrSlug || RESERVED_ROUTES.has(lower) || lower.includes('.')) {
    return next();
  }

  try {
    const client = await findClient(codeOrSlug);
    if (!client) return next();

    if (client.securitySettings?.emergencyLock) {
      return res.status(423).send(`<h3>423 Tenant Suspended</h3><p>${client.securitySettings.lockReason || 'Tenant is temporarily frozen by Platform Owner.'}</p>`);
    }
    if (!guardClient(req, res, client)) return;

    const canonical = buildCustomerUrlForProduct(client);
    if (!canonical) return next();

    return res.redirect(302, canonical);
  } catch (err) {
    next();
  }
});

export default router;
