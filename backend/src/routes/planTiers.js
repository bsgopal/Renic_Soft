import express from 'express';
import dbHelper from '../models/dbHelper.js';
import PlanTier from '../models/PlanTier.js';
import Application from '../models/Application.js';

const router = express.Router();

export const APP_SCREENS_REGISTRY = {
  WA_INSTA_AUTOMATION: [
    { key: 'dashboard', label: 'Live Dashboard & Overview', category: 'Core', default: true },
    { key: 'conversations', label: 'Conversations & Live Chat Inbox', category: 'Messaging', default: true },
    { key: 'customers', label: 'Customer CRM & Contact Sync', category: 'CRM', default: true },
    { key: 'campaigns', label: 'Broadcast Campaigns & Scheduler', category: 'Marketing', default: true },
    { key: 'campaignHistory', label: 'Campaign Logs & Delivery Analytics', category: 'Marketing', default: true },
    { key: 'templates', label: 'Interactive Message Templates', category: 'Marketing', default: true },
    { key: 'catalog', label: 'Product Catalog & Cart Dispatch', category: 'E-Commerce', default: true },
    { key: 'quickReplies', label: 'Quick Replies & Shortcuts', category: 'Messaging', default: true },
    { key: 'workflows', label: 'Visual Flow Studio & Sequence Builder', category: 'Automation', default: false },
    { key: 'responseRules', label: 'Keyword Response Rules & Auto-Bot', category: 'Automation', default: true },
    { key: 'aiFeatures', label: 'AI Sales Assistant & Auto-Pilot', category: 'AI & Intelligence', default: false },
    { key: 'quotations', label: 'Quotations & Proposal PDF Generator', category: 'Sales & Billing', default: true },
    { key: 'settings', label: 'System, Meta Cloud & Docker Settings', category: 'Administration', default: true }
  ],
  TEXTILE_POS: [
    { key: 'dashboard', label: 'Executive & Sales Dashboard', category: 'Core', default: true },
    { key: 'posBilling', label: 'High-Speed Billing Desk (POS)', category: 'Sales & Billing', default: true },
    { key: 'inventory', label: 'Stock Inventory & Barcode Manager', category: 'Inventory', default: true },
    { key: 'customerOrders', label: 'Customer Advance Orders', category: 'Sales & Billing', default: true },
    { key: 'purchaseEntry', label: 'Vendor Purchase Inward', category: 'Purchasing', default: true },
    { key: 'damageEntry', label: 'Damage & Return Entry', category: 'Inventory', default: true },
    { key: 'suppliers', label: 'Supplier & Vendor Directory', category: 'Purchasing', default: true },
    { key: 'customers', label: 'Customer Database & Loyalty', category: 'CRM', default: true },
    { key: 'floors', label: 'Multi-Floor & Rack Locations', category: 'Showroom', default: false },
    { key: 'hsnSetup', label: 'HSN Codes & GST Tax Rates', category: 'Tax & Compliance', default: true },
    { key: 'expenses', label: 'Daily Expense Tracker', category: 'Accounting', default: true },
    { key: 'printTemplates', label: 'Thermal & A4 Print Templates', category: 'Printing', default: true },
    { key: 'reports', label: 'Sales & Profit Margin Reports', category: 'Analytics', default: true },
    { key: 'roles', label: 'Staff Roles & Access Control', category: 'Administration', default: false },
    { key: 'settings', label: 'Showroom & Store Preferences', category: 'Administration', default: true }
  ],
  DELIVERY_CHALLAN: [
    { key: 'dashboard', label: 'Dispatch Dashboard & Analytics', category: 'Core', default: true },
    { key: 'createChallan', label: 'Create Delivery Challan', category: 'Dispatch', default: true },
    { key: 'challanList', label: 'Challan History & Dispatch Logs', category: 'Dispatch', default: true },
    { key: 'returnTracking', label: 'Returnable Goods Tracking & Gatepass', category: 'Dispatch', default: true },
    { key: 'vendors', label: 'Vendor & Client Directory', category: 'Management', default: true },
    { key: 'packagingCategories', label: 'Packaging Material Categories', category: 'Inventory', default: true },
    { key: 'products', label: 'Item Master & Stock Catalog', category: 'Inventory', default: true },
    { key: 'quotations', label: 'Material Movement Quotations', category: 'Finance', default: true },
    { key: 'billing', label: 'GST Invoicing & Billing Generation', category: 'Finance', default: true },
    { key: 'settings', label: 'Tenant & PDF Print Settings', category: 'System', default: true }
  ],
  RENIC_SOFT: [
    { key: 'dashboard', label: 'Master HQ Multi-Tenant Dashboard', category: 'Core', default: true },
    { key: 'applications', label: 'Application Hub & Repositories', category: 'PaaS', default: true },
    { key: 'licenses', label: 'Tenant Licenses & Fleet Control', category: 'Fleet', default: true },
    { key: 'planTiers', label: 'Plan Tiers & Screen Permissions', category: 'SaaS', default: true },
    { key: 'billing', label: 'Master Invoices & Subscriptions', category: 'Billing', default: true },
    { key: 'quotes', label: 'Commercial Proposal Generator', category: 'Sales', default: true },
    { key: 'apiHub', label: 'API Credentials & OAuth Gateway', category: 'Security', default: true },
    { key: 'networkManager', label: 'Network & Domain Forwarding', category: 'Infrastructure', default: true },
    { key: 'notifications', label: 'System Notification Dispatcher', category: 'Communications', default: true },
    { key: 'reports', label: 'Global Tenant Analytics & Telemetry', category: 'Analytics', default: true },
    { key: 'settings', label: 'Master HQ System Settings', category: 'System', default: true }
  ]
};

// Aliases helper
const normalizeAppCode = (code = '') => {
  const c = String(code).toUpperCase().trim();
  if (c.includes('WA') || c.includes('WHATSAPP') || c.includes('INSTA')) return 'WA_INSTA_AUTOMATION';
  if (c.includes('TEXTILE') || c.includes('POS') || c.includes('TX')) return 'TEXTILE_POS';
  if (c.includes('CHALLAN') || c.includes('DELIVERY') || c.includes('DC')) return 'DELIVERY_CHALLAN';
  if (c.includes('RENIC') || c.includes('MASTER') || c.includes('HQ')) return 'RENIC_SOFT';
  return c || 'WA_INSTA_AUTOMATION';
};

// Helper to seed initial plan tiers
export const seedDefaultPlanTiers = async () => {
  const count = await dbHelper.countDocuments('PlanTier');
  if (count > 0) return;

  const defaultTiers = [
    // WA_INSTA_AUTOMATION Tiers
    {
      name: 'Starter Plan',
      code: 'WA_STARTER',
      appCode: 'WA_INSTA_AUTOMATION',
      price: 999,
      billingCycle: '1_MONTH',
      description: 'Essential WhatsApp messaging & broadcast campaigns for growing businesses.',
      allowedScreens: ['dashboard', 'conversations', 'customers', 'campaigns', 'campaignHistory', 'templates', 'quickReplies', 'settings'],
      maxUsers: 2,
      maxContacts: 5000,
      maxMonthlyMessages: 20000,
      isActive: true,
      badgeText: 'Basic'
    },
    {
      name: 'Pro Business Plan',
      code: 'WA_PRO',
      appCode: 'WA_INSTA_AUTOMATION',
      price: 2499,
      billingCycle: '1_MONTH',
      description: 'Full marketing automation with Visual Flow Studio, Catalog dispatch & Quotations.',
      allowedScreens: ['dashboard', 'conversations', 'customers', 'campaigns', 'campaignHistory', 'templates', 'catalog', 'quickReplies', 'workflows', 'responseRules', 'quotations', 'settings'],
      maxUsers: 5,
      maxContacts: 25000,
      maxMonthlyMessages: 100000,
      isActive: true,
      isPopular: true,
      badgeText: 'Most Popular'
    },
    {
      name: 'Enterprise AI Suite',
      code: 'WA_ENTERPRISE',
      appCode: 'WA_INSTA_AUTOMATION',
      price: 4999,
      billingCycle: '1_MONTH',
      description: 'Unlimited omnichannel power with AI Sales Agent, Meta Cloud API & high-throughput dispatch.',
      allowedScreens: ['dashboard', 'conversations', 'customers', 'campaigns', 'campaignHistory', 'templates', 'catalog', 'quickReplies', 'workflows', 'responseRules', 'aiFeatures', 'quotations', 'settings'],
      maxUsers: 20,
      maxContacts: 100000,
      maxMonthlyMessages: 500000,
      isActive: true,
      badgeText: 'Full Access'
    },

    // TEXTILE_POS Tiers
    {
      name: 'Retail Standard POS',
      code: 'TX_STANDARD',
      appCode: 'TEXTILE_POS',
      price: 1499,
      billingCycle: '1_MONTH',
      description: 'High-speed billing desk, barcode scanning, customer loyalty & basic stock management.',
      allowedScreens: ['dashboard', 'posBilling', 'inventory', 'customerOrders', 'customers', 'hsnSetup', 'expenses', 'printTemplates', 'reports', 'settings'],
      maxUsers: 3,
      maxProducts: 3000,
      maxFloors: 1,
      isActive: true,
      badgeText: 'Retail'
    },
    {
      name: 'Showroom Pro ERP',
      code: 'TX_PRO',
      appCode: 'TEXTILE_POS',
      price: 3499,
      billingCycle: '1_MONTH',
      description: 'Multi-floor stock transfer, vendor purchase inward, damage logs & role access controls.',
      allowedScreens: ['dashboard', 'posBilling', 'inventory', 'customerOrders', 'purchaseEntry', 'damageEntry', 'suppliers', 'customers', 'floors', 'hsnSetup', 'expenses', 'printTemplates', 'reports', 'roles', 'settings'],
      maxUsers: 10,
      maxProducts: 25000,
      maxFloors: 5,
      isActive: true,
      isPopular: true,
      badgeText: 'Recommended'
    },

    // DELIVERY_CHALLAN Tiers
    {
      name: 'Dispatch Express',
      code: 'DC_EXPRESS',
      appCode: 'DELIVERY_CHALLAN',
      price: 1299,
      billingCycle: '1_MONTH',
      description: 'Instant challan generation, returnable material tracking and automated vehicle PDF gatepass.',
      allowedScreens: ['dashboard', 'createChallan', 'challanList', 'returnTracking', 'vendors', 'packagingCategories', 'products', 'quotations', 'billing', 'settings'],
      maxUsers: 5,
      isActive: true,
      badgeText: 'Complete Suite'
    }
  ];

  for (const t of defaultTiers) {
    // Generate screenPermissions map
    const allScreens = APP_SCREENS_REGISTRY[t.appCode] || [];
    const screenPermissions = {};
    allScreens.forEach(s => {
      screenPermissions[s.key] = t.allowedScreens.includes(s.key);
    });
    t.screenPermissions = screenPermissions;
    await dbHelper.create('PlanTier', t);
  }
};

// Helper to get screens for an app dynamically from MongoDB or fallback to registry
export const getAppScreensDynamic = async (appCode) => {
  const cleanAppCode = normalizeAppCode(appCode);
  try {
    const appDoc = await Application.findOne({
      $or: [
        { appCode: cleanAppCode },
        { appCode: String(appCode).trim().toUpperCase() }
      ]
    });

    if (appDoc) {
      if (Array.isArray(appDoc.featureMappings) && appDoc.featureMappings.length > 0) {
        return appDoc.featureMappings.map((f) => ({
          key: f.technicalTarget,
          label: f.customDisplayName || f.technicalTarget,
          category: f.folderCategory || 'Core Modules',
          path: f.screenPath || '',
          default: f.defaultEnabled !== false
        }));
      }
      if (Array.isArray(appDoc.screens) && appDoc.screens.length > 0) {
        return appDoc.screens.map((s) => ({
          key: s.key,
          label: s.label,
          category: 'Core Modules',
          default: s.defaultEnabled !== false
        }));
      }
    }
  } catch (err) {
    console.error('Error fetching dynamic app screens:', err);
  }
  return APP_SCREENS_REGISTRY[cleanAppCode] || [];
};

// GET /api/plan-tiers (List with optional ?appCode=...)
router.get('/', async (req, res) => {
  try {
    await seedDefaultPlanTiers();
    const filter = {};
    if (req.query.appCode) {
      filter.appCode = normalizeAppCode(req.query.appCode);
    }
    const plans = await dbHelper.find('PlanTier', filter);
    res.json({ success: true, count: plans.length, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/plan-tiers/screens/:appCode (Get available screens registry for an app dynamically)
router.get('/screens/:appCode', async (req, res) => {
  try {
    const appKey = normalizeAppCode(req.params.appCode);
    const screens = await getAppScreensDynamic(appKey);
    res.json({
      success: true,
      appCode: appKey,
      screens
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/plan-tiers/:id
router.get('/:id', async (req, res) => {
  try {
    const plan = await dbHelper.findById('PlanTier', req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan Tier not found' });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/plan-tiers (Create New Plan Tier)
router.post('/', async (req, res) => {
  try {
    const {
      name, code, appCode, price, currency = 'INR', billingCycle = '1_MONTH',
      description = '', allowedScreens = [], allowedFeatures = [],
      maxUsers = 5, maxContacts = 10000, maxMonthlyMessages = 50000,
      maxProducts = 5000, maxFloors = 2, isActive = true, isPopular = false, badgeText = ''
    } = req.body;

    if (!name || !code || !appCode) {
      return res.status(400).json({ success: false, error: 'Name, Code, and Application are required fields.' });
    }

    const cleanAppCode = normalizeAppCode(appCode);
    const cleanCode = String(code).trim().toUpperCase();

    // Check duplicate code
    const existing = await dbHelper.findOne('PlanTier', { code: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, error: `Plan code '${cleanCode}' already exists.` });
    }

    // Build screenPermissions object map dynamically
    const appScreens = await getAppScreensDynamic(cleanAppCode);
    const screenPermissions = {};
    appScreens.forEach(s => {
      screenPermissions[s.key] = allowedScreens.includes(s.key);
    });

    const newPlan = await dbHelper.create('PlanTier', {
      name: name.trim(),
      code: cleanCode,
      appCode: cleanAppCode,
      price: Number(price) || 0,
      currency,
      billingCycle,
      description,
      allowedScreens,
      allowedFeatures,
      screenPermissions,
      maxUsers: Number(maxUsers) || 5,
      maxContacts: Number(maxContacts) || 10000,
      maxMonthlyMessages: Number(maxMonthlyMessages) || 50000,
      maxProducts: Number(maxProducts) || 5000,
      maxFloors: Number(maxFloors) || 2,
      isActive: Boolean(isActive),
      isPopular: Boolean(isPopular),
      badgeText: badgeText || ''
    });

    res.status(201).json({
      success: true,
      message: `Plan Tier '${name}' created successfully for ${cleanAppCode}!`,
      data: newPlan
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/plan-tiers/:id (Update Plan Tier)
router.put('/:id', async (req, res) => {
  try {
    const plan = await dbHelper.findById('PlanTier', req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan Tier not found' });

    const updates = { ...req.body };
    if (updates.appCode) updates.appCode = normalizeAppCode(updates.appCode);
    if (updates.code) updates.code = String(updates.code).trim().toUpperCase();

    // Rebuild screenPermissions if allowedScreens or appCode is updated
    const targetApp = updates.appCode || plan.appCode;
    const targetScreens = updates.allowedScreens || plan.allowedScreens || [];
    const appScreens = await getAppScreensDynamic(targetApp);
    const screenPermissions = {};
    appScreens.forEach(s => {
      screenPermissions[s.key] = targetScreens.includes(s.key);
    });
    updates.screenPermissions = screenPermissions;

    const updated = await dbHelper.findByIdAndUpdate('PlanTier', req.params.id, updates);
    res.json({
      success: true,
      message: `Plan Tier '${updated.name}' updated successfully!`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/plan-tiers/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await dbHelper.deleteById('PlanTier', req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Plan Tier not found' });
    res.json({
      success: true,
      message: 'Plan Tier deleted successfully',
      data: deleted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/plan-tiers/seed-defaults (Force reset/seed)
router.post('/seed-defaults', async (req, res) => {
  try {
    await seedDefaultPlanTiers();
    const plans = await dbHelper.find('PlanTier', {});
    res.json({ success: true, count: plans.length, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
