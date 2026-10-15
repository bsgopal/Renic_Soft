/**
 * Single source of truth for customer-facing URLs.
 *
 * Canonical format (decided):
 *
 *     https://{appSlug}.{customerCode}.{domain}
 *
 * e.g.  https://pos.renic-tx.renictech.com        (Textile POS)
 *       https://challan.dc10.renictech.com        (Delivery Challan)
 *       https://wa.saraswat-tx.renictech.com      (WhatsApp Automation)
 *
 * Every screen, message template and API response must build URLs through this
 * module so a customer never sees two different links for the same tenant.
 */

/** Base domain all customer instances live under. */
export const CUSTOMER_DOMAIN = (process.env.CUSTOMER_DOMAIN || 'renictech.com')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '');

/** Fixed scheme — always HTTPS in production. */
export const CUSTOMER_URL_SCHEME = process.env.CUSTOMER_URL_SCHEME || 'https';

/**
 * The stable DNS label that identifies a tenant (2nd label of the hostname).
 * customerCode is preferred because it is what gets printed on the licence.
 */
export function tenantKeyOf(client = {}) {
  const raw =
    client.customerCode ||
    client.subdomain ||
    client.shopSlug ||
    client.name ||
    '';
  return String(raw).trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
}

/**
 * Build the customer-facing URL for a tenant.
 *
 * SECURITY: the URL carries ONLY the public customer identifier
 * (e.g. RENIC-TX). The OAuth clientId and clientSecret must NEVER appear in a
 * customer-facing URL — these links get pasted into WhatsApp threads, browser
 * history, referrer headers and proxy logs. Credentials are exchanged solely
 * over the OAuth token endpoint, never via the URL.
 *
 * @param {object} client   A Client document (or a plain object with its fields)
 * @param {string} appSlug  Application slug: 'pos' | 'challan' | 'wa' | 'hq'
 * @returns {string}        e.g. "https://pos.renic-tx.renictech.com"
 */
export function buildCustomerUrl(client = {}, appSlug = '') {
  const slug = String(appSlug || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const tenant = tenantKeyOf(client);
  if (!tenant) return '';

  if (
    client.fullSaaSDomain &&
    client.fullSaaSDomain.startsWith('http') &&
    !client.fullSaaSDomain.includes('renictech.com') &&
    !client.fullSaaSDomain.includes('lvh.me')
  ) {
    return client.fullSaaSDomain;
  }

  // Direct Vercel / Cloud URL Mapping (e.g. SIMPLE_BILLING_URL=https://simplest-billing.vercel.app)
  const directAppUrls = {
    billing: process.env.SIMPLE_BILLING_URL || 'https://simplest-billing.vercel.app',
    pb: process.env.PAWN_BROKING_URL || 'https://pawn-broking-svr6.vercel.app',
    pos: process.env.TEXTILE_POS_URL,
    challan: process.env.DELIVERY_CHALLAN_URL,
    wa: process.env.WHATSAPP_AUTOMATION_URL
  };

  const directBase = directAppUrls[slug];
  if (directBase) {
    const cleanBase = directBase.trim().replace(/\/+$/, '');
    return `${cleanBase}?tenant=${tenant}`;
  }

  const host = slug ? `${slug}.${tenant}.${CUSTOMER_DOMAIN}` : `${tenant}.${CUSTOMER_DOMAIN}`;
  return `${CUSTOMER_URL_SCHEME}://${host}`;
}

/** Same as buildCustomerUrl — named explicitly for callers joining API paths. */
export const buildCustomerBaseUrl = (client = {}, appSlug = '') => buildCustomerUrl(client, appSlug);

/**
 * appCode -> urlSlug, resolved from the Applications registry.
 *
 * A newly registered application must get its URL slug automatically, so this
 * map is loaded from `applications` rather than written into source. The
 * historical map below seeds it, so behaviour is identical before the first
 * registry load (and if Mongo happens to be briefly unavailable) — it is a
 * safety net, not the source of truth.
 *
 * Loaded synchronously via a cached Map because `buildCustomerUrlForProduct`
 * is called from synchronous response builders; `refreshAppSlugRegistry()`
 * runs at startup and whenever the registry changes.
 */
const FALLBACK_SLUG_BY_PRODUCT = {
  TEXTILE_POS: 'pos',
  DELIVERY_CHALLAN: 'challan',
  PAWN_BROKING: 'pb',
  PAWNBOOK_PRO: 'pb',
  SIMPLE_BILLING: 'billing',
  WA_INSTA_AUTOMATION: 'wa'
};

let slugByAppCode = new Map(
  Object.entries(FALLBACK_SLUG_BY_PRODUCT).map(([k, v]) => [k.toUpperCase(), v])
);

let lastRefreshAt = 0;
const REGISTRY_REFRESH_TTL_MS = 60 * 1000;

/**
 * Re-read appCode -> urlSlug from the Applications collection.
 * Returns true when the map was refreshed from the database.
 */
export async function refreshAppSlugRegistry() {
  // Claim the refresh window before awaiting so concurrent callers collapse
  // into a single query instead of stampeding the database.
  lastRefreshAt = Date.now();
  try {
    // Lazy import keeps this util free of a static model dependency (it is
    // imported by routes that the Application model also reaches).
    const { default: Application } = await import('../models/Application.js');
    const apps = await Application.find({ urlSlug: { $exists: true, $ne: '' } })
      .select('appCode urlSlug')
      .lean();
    if (apps.length) {
      slugByAppCode = new Map(
        apps.map((a) => [
          String(a.appCode || '').toUpperCase(),
          String(a.urlSlug || '').trim().toLowerCase()
        ])
      );
      return true;
    }
  } catch {
    // Keep the seeded map — never break URL building because of a lookup failure.
  }
  return false;
}

/** urlSlug for a softwareProduct, '' when the product is unknown. */
export function appSlugForProduct(softwareProduct = '') {
  return slugByAppCode.get(String(softwareProduct || '').trim().toUpperCase()) || '';
}

/**
 * Canonical customer URL derived from the client's softwareProduct.
 * Falls back to the customer root URL when the product is unknown.
 */
export function buildCustomerUrlForProduct(client = {}, appSlugOverride = '') {
  // Opportunistic self-refresh: registering or renaming an application in
  // Renic Soft is picked up within a minute without every mutation site
  // having to remember to call refreshAppSlugRegistry().
  if (Date.now() - lastRefreshAt > REGISTRY_REFRESH_TTL_MS) {
    refreshAppSlugRegistry(); // fire-and-forget; failures keep the current map
  }
  if (appSlugOverride) return buildCustomerUrl(client, appSlugOverride);
  return buildCustomerUrl(client, appSlugForProduct(client.softwareProduct));
}

/**
 * True when a Host header belongs to a customer instance (rather than the
 * Renic Soft HQ console). Used by the subdomain proxy in app.js.
 */
export function hostBelongsToCustomerDomain(host = '') {
  const h = String(host || '').split(':')[0].toLowerCase();
  return h === CUSTOMER_DOMAIN || h.endsWith(`.${CUSTOMER_DOMAIN}`);
}
