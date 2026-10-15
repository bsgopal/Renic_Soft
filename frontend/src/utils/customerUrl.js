/**
 * Single source of truth for customer-facing URLs — frontend mirror of
 * backend/src/utils/customerUrl.js.
 *
 * Canonical format:  https://{appSlug}.{customerCode}.renictech.com
 * e.g.               https://pos.renic-tx.renictech.com
 */

export const CUSTOMER_DOMAIN = 'renictech.com';

/** Application slug for a softwareProduct value. */
export function appSlugForProduct(softwareProduct = '') {
  const p = String(softwareProduct).toUpperCase();
  const map = {
    TEXTILE_POS: 'pos',
    DELIVERY_CHALLAN: 'challan',
    PAWN_BROKING: 'pb',
    PAWNBOOK_PRO: 'pb',
    SIMPLE_BILLING: 'billing',
    WA_INSTA_AUTOMATION: 'wa'
  };
  return map[p] || '';
}

function cleanLabel(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
}

/**
 * Customer-facing URL. Carries ONLY the public customer id (e.g. RENIC-TX) —
 * never the OAuth clientId/clientSecret, which must stay out of shared links.
 */
export function buildCustomerUrl(client = {}, appSlug = '') {
  const slug = cleanLabel(appSlug) || appSlugForProduct(client.softwareProduct);
  const tenant = cleanLabel(client.customerCode || client.subdomain || client.shopSlug);
  if (!tenant) return '';

  // Direct Vercel / Cloud URL Mapping (e.g. VITE_PAWN_BROKING_URL / VITE_SIMPLE_BILLING_URL)
  const directAppUrls = {
    billing: import.meta.env.VITE_SIMPLE_BILLING_URL,
    pb: import.meta.env.VITE_PAWN_BROKING_URL,
    pos: import.meta.env.VITE_TEXTILE_POS_URL,
    challan: import.meta.env.VITE_DELIVERY_CHALLAN_URL,
    wa: import.meta.env.VITE_WHATSAPP_AUTOMATION_URL
  };

  const directBase = directAppUrls[slug];
  if (directBase) {
    const cleanBase = directBase.trim().replace(/\/+$/, '');
    return `${cleanBase}?tenant=${tenant}`;
  }

  if (client.fullSaaSDomain && client.fullSaaSDomain.startsWith('http')) {
    return client.fullSaaSDomain;
  }

  const host = slug ? `${slug}.${tenant}.${CUSTOMER_DOMAIN}` : `${tenant}.${CUSTOMER_DOMAIN}`;
  return `https://${host}`;
}

export const APP_PORTS = {
  TEXTILE_POS: 5174,
  DELIVERY_CHALLAN: 5176,
  PAWN_BROKING: 5177,
  PAWNBOOK_PRO: 5177,
  SIMPLE_BILLING: 5178,
  WHATSAPP_AUTOMATION: 5173,
  WA_INSTA_AUTOMATION: 5173
};

export const BACKEND_PORTS = {
  TEXTILE_POS: 5002,
  DELIVERY_CHALLAN: 5003,
  PAWN_BROKING: 5004,
  PAWNBOOK_PRO: 5004,
  SIMPLE_BILLING: 5005,
  WHATSAPP_AUTOMATION: 5000,
  WA_INSTA_AUTOMATION: 5000
};

export function appPortForProduct(softwareProduct = '') {
  const p = String(softwareProduct).toUpperCase();
  return APP_PORTS[p] || 5174;
}

export function backendPortForProduct(softwareProduct = '') {
  const p = String(softwareProduct).toUpperCase();
  return BACKEND_PORTS[p] || 5000;
}

/** Same as buildCustomerUrl — named explicitly for callers joining API paths. */
export const buildCustomerBaseUrl = (client = {}, appSlug = '') => buildCustomerUrl(client, appSlug);

/** Same, deriving the app slug from the client's softwareProduct. */
export const buildCustomerUrlForProduct = (client = {}) => buildCustomerUrl(client);
