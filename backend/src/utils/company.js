import dotenv from 'dotenv';
import { dbHelper } from '../models/dbHelper.js';

dotenv.config();

/**
 * Enterprise Company Profile used on quotation / invoice PDFs and Master HQ branding.
 * Stored in the database (Setting collection) and seeded from .env.
 */
export const getCompany = async () => {
  const stored = await dbHelper.findOne('Setting', { key: 'company' });
  const cfg = (stored && stored.value) || {};
  return {
    name: cfg.name || process.env.COMPANY_NAME || process.env.OWNER_NAME || 'Renic Soft Tech Private Limited',
    address: cfg.address || process.env.COMPANY_ADDRESS || 'Bangalore, Karnataka, India',
    city: cfg.city || 'Bangalore',
    state: cfg.state || 'Karnataka',
    pincode: cfg.pincode || '560001',
    phone: cfg.phone || process.env.COMPANY_PHONE || process.env.OWNER_MOBILE || '+91 93455 78103',
    email: cfg.email || process.env.COMPANY_EMAIL || process.env.OWNER_EMAIL || 'contact@renic.store',
    website: cfg.website || 'https://renictech.com',
    gst: cfg.gst || process.env.COMPANY_GSTIN || '',
    currency: cfg.currency || 'INR',
    bankName: cfg.bankName || 'HDFC Bank Ltd',
    accountNumber: cfg.accountNumber || '50200088991122',
    ifscCode: cfg.ifscCode || 'HDFC0001234',
    branchName: cfg.branchName || 'Bangalore Main Branch',
    upiId: cfg.upiId || 'renicsoft@hdfcbank',
    paymentDetails: cfg.paymentDetails || 'Advance payment of 50% is required to confirm order.\nBalance amount to be paid upon license activation.\nAccepted payment modes: UPI / NEFT / RTGS / Card.',
    termsConditions: cfg.termsConditions || '1. Quotation validity is 14 days from issue date.\n2. Prices are subject to GST as applicable.\n3. Software license is provisioned immediately upon realization of payment.',
    invoiceNotes: cfg.invoiceNotes || 'Thank you for choosing Renic Soft Multi-Tenant SaaS Platform.',
    defaultTrialDays: Number(cfg.defaultTrialDays) || 7,
    otaAutoSync: cfg.otaAutoSync !== undefined ? Boolean(cfg.otaAutoSync) : true
  };
};

export const saveCompany = async (data = {}) => {
  const value = {
    name: String(data.name || '').trim(),
    address: String(data.address || '').trim(),
    city: String(data.city || '').trim(),
    state: String(data.state || '').trim(),
    pincode: String(data.pincode || '').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    website: String(data.website || '').trim(),
    gst: String(data.gst || '').trim().toUpperCase(),
    currency: String(data.currency || 'INR').trim().toUpperCase(),
    bankName: String(data.bankName || '').trim(),
    accountNumber: String(data.accountNumber || '').trim(),
    ifscCode: String(data.ifscCode || '').trim().toUpperCase(),
    branchName: String(data.branchName || '').trim(),
    upiId: String(data.upiId || '').trim(),
    paymentDetails: String(data.paymentDetails || '').trim(),
    termsConditions: String(data.termsConditions || '').trim(),
    invoiceNotes: String(data.invoiceNotes || '').trim(),
    defaultTrialDays: Number(data.defaultTrialDays) || 7,
    otaAutoSync: data.otaAutoSync !== undefined ? Boolean(data.otaAutoSync) : true
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