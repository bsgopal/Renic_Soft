import dotenv from 'dotenv';
import { dbHelper } from '../models/dbHelper.js';

dotenv.config();

/**
 * Company profile used on quotation / invoice PDFs.
 * Stored in the database (Setting collection) and seeded from .env —
 * nothing is hardcoded. Edit it from Settings > Company in the UI.
 */
export const getCompany = async () => {
  const stored = await dbHelper.findOne('Setting', { key: 'company' });
  const cfg = (stored && stored.value) || {};
  return {
    name: cfg.name || process.env.COMPANY_NAME || process.env.OWNER_NAME || '',
    address: cfg.address || process.env.COMPANY_ADDRESS || '',
    phone: cfg.phone || process.env.COMPANY_PHONE || process.env.OWNER_MOBILE || '',
    email: cfg.email || process.env.COMPANY_EMAIL || process.env.OWNER_EMAIL || '',
    gst: cfg.gst || process.env.COMPANY_GSTIN || '',
    paymentDetails: cfg.paymentDetails || '',
    termsConditions: cfg.termsConditions || ''
  };
};

export const saveCompany = async (data = {}) => {
  const value = {
    name: String(data.name || '').trim(),
    address: String(data.address || '').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    gst: String(data.gst || '').trim(),
    paymentDetails: String(data.paymentDetails || '').trim(),
    termsConditions: String(data.termsConditions || '').trim()
  };
  const existing = await dbHelper.findOne('Setting', { key: 'company' });
  if (existing) {
    await dbHelper.findByIdAndUpdate('Setting', existing._id, { value });
  } else {
    await dbHelper.create('Setting', { key: 'company', value });
  }
  return value;
};

/**
 * Picks the company letterhead for a document:
 *  - if the document is linked to a store (clientId), the store's own
 *    name / address / GSTIN / contact details are used;
 *  - otherwise the configured platform company profile is used.
 */
export const resolveDocCompany = async (doc) => {
  if (doc && doc.clientId) {
    const client = await dbHelper.findById('Client', doc.clientId);
    if (client) {
      return {
        name: client.name || '',
        address: client.address || '',
        phone: client.pendingOwnerMobile || client.contact || '',
        email: client.pendingOwnerEmail || '',
        gst: client.gstNumber || ''
      };
    }
  }
  return getCompany();
};