// Renic_Soft/backend/src/config/appPorts.js

/**
 * Port routing is PER APPLICATION, never per customer.
 *
 * Every customer of the same product runs on one shared process, and the
 * customer is already identified by the Host header
 * ({appSlug}.{customerCode}.{domain}). A port stored on the individual
 * customer record was therefore redundant — and dangerous: the old schema
 * defaulted it to 5000 (the WhatsApp process), so a customer record missing
 * its port would silently route Textile POS traffic into the wrong product.
 *
 * These maps are the single source of truth and are shared by the subdomain
 * proxy and the OTA push dispatch.
 */

/** softwareProduct -> the single FRONTEND process port that serves it. */
export const APP_PORTS = {
  TEXTILE_POS: 5174,
  DELIVERY_CHALLAN: 5176,
  PAWN_BROKING: 5177,
  PAWNBOOK_PRO: 5177,
  SIMPLE_BILLING: 5178,
  WHATSAPP_AUTOMATION: 5173,
  WA_INSTA_AUTOMATION: 5173
};

export const DEFAULT_APP_PORT = 5173;

/** softwareProduct -> the BACKEND process port Renic Soft pushes OTA to. */
export const BACKEND_PORTS = {
  TEXTILE_POS: 5002,
  DELIVERY_CHALLAN: 5003,
  PAWN_BROKING: 5004,
  PAWNBOOK_PRO: 5004,
  SIMPLE_BILLING: 5005,
  WHATSAPP_AUTOMATION: 5000,
  WA_INSTA_AUTOMATION: 5000
};

export const appPortFor = (softwareProduct) =>
  APP_PORTS[softwareProduct] ?? DEFAULT_APP_PORT;

export const backendPortFor = (softwareProduct) =>
  BACKEND_PORTS[softwareProduct] ?? null;
