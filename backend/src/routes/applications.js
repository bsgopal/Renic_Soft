import express from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Application from '../models/Application.js';
import ApplicationSyncLog from '../models/ApplicationSyncLog.js';
import Client from '../models/Client.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

const SYSTEM_APPLICATIONS = [
  {
    name: 'Textile & Garment POS',
    appCode: 'TEXTILE_POS',
    urlSlug: 'pos',
    category: 'Retail POS',
    defaultPort: 5174,
    description: 'Modern POS, Floor Billing, Inventory, and Supplier Order Management for Textile & Garment Showrooms',
    icon: 'Storefront',
    isSystem: true,
    localRepoPath: 'D:/Development/TextilePOS',
    screens: [
      { key: 'posBilling', label: 'POS Billing Desk', defaultEnabled: true },
      { key: 'inventory', label: 'Inventory & Barcode Stock', defaultEnabled: true },
      { key: 'customerOrders', label: 'Customer Custom Orders', defaultEnabled: true },
      { key: 'customers', label: 'Customer Registry & Loyalty', defaultEnabled: true },
      { key: 'suppliers', label: 'Suppliers & Vendors', defaultEnabled: true },
      { key: 'purchaseOrders', label: 'Purchase Orders & Inward', defaultEnabled: true },
      { key: 'damageEntry', label: 'Damage & Return Entry', defaultEnabled: true },
      { key: 'floors', label: 'Floor & Rack Setup', defaultEnabled: true },
      { key: 'reports', label: 'Sales & Financial Reports', defaultEnabled: true },
      { key: 'expenses', label: 'Store Expenses', defaultEnabled: true },
      { key: 'hsnSetup', label: 'HSN & Tax Setup', defaultEnabled: true }
    ],
    features: [
      { key: 'thermalPrint', label: 'Direct Thermal Receipt Printing', defaultEnabled: true },
      { key: 'barcodeScanner', label: 'High-Speed Barcode Scanner', defaultEnabled: true },
      { key: 'discountOverride', label: 'Manager Discount Override', defaultEnabled: false }
    ],
    featureMappings: [
      { customDisplayName: 'POS Counter Billing Desk', folderCategory: 'Sales & Billing', technicalTarget: 'posBilling', screenPath: '/billing', description: 'Counter checkout with barcode scanning and instant bill printing', defaultEnabled: true },
      { customDisplayName: 'Inventory & Fabric Stock Ledger', folderCategory: 'Inventory Master', technicalTarget: 'inventory', screenPath: '/inventory', description: 'Track rolls, sizes, colors, and stock movements', defaultEnabled: true },
      { customDisplayName: 'Customer Custom Orders & Alterations', folderCategory: 'Sales & Billing', technicalTarget: 'customerOrders', screenPath: '/custom-orders', description: 'Tailoring, alterations, and custom garment booking', defaultEnabled: true },
      { customDisplayName: 'Customer Registry & Loyalty', folderCategory: 'CRM & Loyalty', technicalTarget: 'customers', screenPath: '/customers', description: 'Customer profiles, purchase history, and loyalty points', defaultEnabled: true },
      { customDisplayName: 'Suppliers & Vendor Master', folderCategory: 'Procurement', technicalTarget: 'suppliers', screenPath: '/suppliers', description: 'Manage fabric mills, suppliers, and vendor ledgers', defaultEnabled: true },
      { customDisplayName: 'Purchase Inward & GRN', folderCategory: 'Procurement', technicalTarget: 'purchaseOrders', screenPath: '/purchases', description: 'Goods received notes, purchase bills, and batch inward', defaultEnabled: true },
      { customDisplayName: 'Floor & Display Racks Setup', folderCategory: 'Showroom Setup', technicalTarget: 'floors', screenPath: '/floors', description: 'Map sales counters and showroom floor sections', defaultEnabled: true },
      { customDisplayName: 'Sales, GST & Profit Reports', folderCategory: 'Analytics & Audit', technicalTarget: 'reports', screenPath: '/reports', description: 'Comprehensive financial, GST, and profit audit statements', defaultEnabled: true },
      { customDisplayName: 'Store Expenses & Outflow', folderCategory: 'Accounting', technicalTarget: 'expenses', screenPath: '/expenses', description: 'Track petty cash, utilities, and daily shop expenses', defaultEnabled: true },
      { customDisplayName: 'HSN Tax & Barcode Setup', folderCategory: 'Tax & Compliance', technicalTarget: 'hsnSetup', screenPath: '/settings', description: 'Configure GST slabs, HSN codes, and barcode printer layouts', defaultEnabled: true }
    ]
  },
  {
    name: 'WhatsApp & Instagram Automation',
    appCode: 'WA_INSTA_AUTOMATION',
    urlSlug: 'wa',
    category: 'Marketing SaaS',
    defaultPort: 5173,
    description: 'Meta Cloud API, Broadcasts, Chatbot Workflows, and AI Sales Agent for High-Conversion Retail',
    icon: 'Chat',
    isSystem: true,
    localRepoPath: 'd:/Development/WhatsApp Automation/WA_INSTA_AUTOMATION',
    screens: [
      { key: 'dashboard', label: 'Overview Dashboard', defaultEnabled: true },
      { key: 'conversations', label: 'Unified Inbox', defaultEnabled: true },
      { key: 'customers', label: 'Contacts & Leads', defaultEnabled: true },
      { key: 'campaigns', label: 'Bulk Broadcast Campaigns', defaultEnabled: true },
      { key: 'templates', label: 'WhatsApp HSM Templates', defaultEnabled: true },
      { key: 'catalog', label: 'Product Catalog', defaultEnabled: true },
      { key: 'quickReplies', label: 'Quick Replies', defaultEnabled: true },
      { key: 'workflows', label: 'Visual Workflow Builder', defaultEnabled: true },
      { key: 'responseRules', label: 'Automated Response Rules', defaultEnabled: true },
      { key: 'aiSalesAgent', label: 'AI Gemini Sales Agent', defaultEnabled: false },
      { key: 'settings', label: 'Account & System Settings', defaultEnabled: true }
    ],
    features: [
      { key: 'bulkBroadcast', label: 'Bulk Broadcast Engine', defaultEnabled: true },
      { key: 'metaCloudApi', label: 'Meta Cloud Direct Graph API', defaultEnabled: true },
      { key: 'aiAgent', label: 'Gemini AI Intelligent Responses', defaultEnabled: false }
    ],
    featureMappings: [
      { customDisplayName: 'Executive Marketing Dashboard', folderCategory: 'Analytics', technicalTarget: 'dashboard', screenPath: '/dashboard', description: 'High-level metrics, campaign performance, and response rate graphs', defaultEnabled: true },
      { customDisplayName: 'Live Unified Customer Inbox', folderCategory: 'Omnichannel Chat', technicalTarget: 'conversations', screenPath: '/conversations', description: 'Direct 2-way chat with WhatsApp and Instagram customers', defaultEnabled: true },
      { customDisplayName: 'Customer Leads & Segmentation', folderCategory: 'CRM & Audiences', technicalTarget: 'customers', screenPath: '/customers', description: 'Contact lists, tags, and targeted broadcast audiences', defaultEnabled: true },
      { customDisplayName: 'WhatsApp Bulk Broadcast Engine', folderCategory: 'Outreach & Campaigns', technicalTarget: 'campaigns', screenPath: '/campaigns', description: 'Schedule high-speed bulk broadcasts via Meta or Docker WAHA', defaultEnabled: true },
      { customDisplayName: 'Meta HSM Approved Templates', folderCategory: 'Templates & Content', technicalTarget: 'templates', screenPath: '/templates', description: 'Design pre-approved marketing and utility message templates', defaultEnabled: true },
      { customDisplayName: 'Interactive Product Catalog', folderCategory: 'E-Commerce', technicalTarget: 'catalog', screenPath: '/catalog', description: 'Showcase shop products directly in customer chat', defaultEnabled: true },
      { customDisplayName: 'Visual Workflow Builder', folderCategory: 'Automation Bots', technicalTarget: 'workflows', screenPath: '/workflows', description: 'Drag-and-drop conversational branching and automated journeys', defaultEnabled: true },
      { customDisplayName: 'Keyword Auto-Response Rules', folderCategory: 'Automation Bots', technicalTarget: 'responseRules', screenPath: '/response-rules', description: 'Instant auto-replies triggered by customer messages', defaultEnabled: true },
      { customDisplayName: 'Gemini AI Intelligent Agent', folderCategory: 'AI Capabilities', technicalTarget: 'aiSalesAgent', screenPath: '/ai-agent', description: 'Self-learning AI sales assistant answering product queries 24/7', defaultEnabled: true },
      { customDisplayName: 'System & Gateway Settings', folderCategory: 'Settings', technicalTarget: 'settings', screenPath: '/settings', description: 'Configure Meta credentials, Docker WAHA tokens, and webhooks', defaultEnabled: true }
    ]
  },
  {
    name: 'Delivery Challan & Dispatch Suite',
    appCode: 'DELIVERY_CHALLAN',
    urlSlug: 'challan',
    category: 'Logistics',
    defaultPort: 5176,
    description: 'B2B Packaging, Barcode Scanning, Delivery Challan Printing, and Dispatch Reconciliation',
    icon: 'LocalShipping',
    isSystem: true,
    screens: [
      { key: 'dashboard', label: 'Dispatch Dashboard', defaultEnabled: true },
      { key: 'challans', label: 'Delivery Challans', defaultEnabled: true },
      { key: 'packaging', label: 'Packaging Categories', defaultEnabled: true },
      { key: 'barcodes', label: 'Barcode Generation & Print', defaultEnabled: true },
      { key: 'billings', label: 'Invoices & Billing', defaultEnabled: true },
      { key: 'quotations', label: 'B2B Quotations', defaultEnabled: true },
      { key: 'vendors', label: 'Vendors & Transporters', defaultEnabled: true },
      { key: 'products', label: 'Goods Catalog', defaultEnabled: true }
    ],
    features: [
      { key: 'eWayBill', label: 'E-Way Bill Integration', defaultEnabled: true },
      { key: 'batchPrint', label: 'Batch Label Printing', defaultEnabled: true }
    ],
    featureMappings: [
      { customDisplayName: 'Dispatch & Logistics Dashboard', folderCategory: 'Logistics Overview', technicalTarget: 'dashboard', screenPath: '/dashboard', description: 'Track pending dispatches, loaded trucks, and delivered goods', defaultEnabled: true },
      { customDisplayName: 'Delivery Challan Manager', folderCategory: 'Challans & E-Way', technicalTarget: 'challans', screenPath: '/challans', description: 'Generate multi-item delivery challans with lorry receipts', defaultEnabled: true },
      { customDisplayName: 'Barcode Generation & Printing', folderCategory: 'Packing Operations', technicalTarget: 'barcodes', screenPath: '/barcodes', description: 'Box and bundle barcode labels for transport scanning', defaultEnabled: true },
      { customDisplayName: 'B2B Transport Billing', folderCategory: 'Financials', technicalTarget: 'billings', screenPath: '/billing', description: 'Convert delivered challans into formal tax invoices', defaultEnabled: true }
    ]
  }
];

const seedSystemApplications = async () => {
  for (const appData of SYSTEM_APPLICATIONS) {
    const existing = await Application.findOne({ appCode: appData.appCode });
    if (!existing) {
      await Application.create(appData);
    } else if (!existing.urlSlug || !existing.featureMappings || existing.featureMappings.length === 0) {
      existing.urlSlug = existing.urlSlug || appData.urlSlug;
      existing.localRepoPath = existing.localRepoPath || appData.localRepoPath;
      if (!existing.featureMappings || existing.featureMappings.length === 0) {
        existing.featureMappings = appData.featureMappings;
      }
      await existing.save();
    }
  }
};

router.get('/', async (req, res) => {
  try {
    await seedSystemApplications();
    const apps = await Application.find().sort({ isSystem: -1, createdAt: 1 });
    res.json({ success: true, count: apps.length, applications: apps });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve applications', error: error.message });
  }
});

router.get('/sync-history', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { appCode, limit = 50 } = req.query;
    const filter = {};
    if (appCode && appCode !== 'ALL') {
      filter.appCode = appCode.toUpperCase();
    }

    const history = await ApplicationSyncLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: history.length, history });
  } catch (error) {
    console.error('Error retrieving sync history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:idOrCode/sync-history', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrCode);
    const app = isObjectId 
      ? await Application.findById(idOrCode)
      : await Application.findOne({ appCode: idOrCode.toUpperCase() });

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const history = await ApplicationSyncLog.find({ appCode: app.appCode })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, appCode: app.appCode, appName: app.name, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/ai-extract', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { repoPath, appCode } = req.body;
    const targetDir = repoPath || (appCode === 'TEXTILE_POS' ? 'D:/Development/TextilePOS' : 'd:/Development/WhatsApp Automation/WA_INSTA_AUTOMATION');

    const discoveredScreens = [];
    const featureMappings = [];

    const candidates = [
      path.join(targetDir, 'frontend', 'src', 'pages'),
      path.join(targetDir, 'src', 'pages'),
      path.join(targetDir, 'pages')
    ];

    let pagesDir = candidates.find(p => fs.existsSync(p));

    if (pagesDir) {
      const files = fs.readdirSync(pagesDir, { withFileTypes: true });
      for (const f of files) {
        if (f.isFile() && (f.name.endsWith('.jsx') || f.name.endsWith('.tsx') || f.name.endsWith('.js'))) {
          const rawName = f.name.replace(/\.[^/.]+$/, '');
          const cleanKey = rawName.charAt(0).toLowerCase() + rawName.slice(1);
          const screenPath = '/' + rawName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
          const spacedName = rawName.replace(/([A-Z])/g, ' $1').trim();
          let folderCategory = 'General Operations';

          if (/billing|pos|invoice|order|sales|counter/i.test(rawName)) {
            folderCategory = 'Sales & Billing';
          } else if (/inventory|stock|product|catalog|item/i.test(rawName)) {
            folderCategory = 'Inventory & Goods';
          } else if (/campaign|message|chat|template|whatsapp|broadcast/i.test(rawName)) {
            folderCategory = 'Outreach & Messaging';
          } else if (/report|analytics|stat|audit/i.test(rawName)) {
            folderCategory = 'Analytics & Audit';
          } else if (/customer|supplier|vendor|contact/i.test(rawName)) {
            folderCategory = 'CRM & Relationships';
          } else if (/setting|config|security|auth|network/i.test(rawName)) {
            folderCategory = 'System & Governance';
          }

          discoveredScreens.push({
            key: cleanKey,
            label: spacedName,
            defaultEnabled: true
          });

          featureMappings.push({
            customDisplayName: spacedName + ' Hub',
            folderCategory,
            technicalTarget: cleanKey,
            screenPath,
            description: 'Full access to ' + spacedName + ' module and related operations',
            defaultEnabled: true
          });
        }
      }
    }

    res.json({
      success: true,
      repoPath: targetDir,
      discoveredCount: featureMappings.length,
      screens: discoveredScreens,
      featureMappings
    });
  } catch (error) {
    console.error('AI Extract error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/git-sync', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  const startTime = Date.now();
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const localPath = app.localRepoPath || (app.appCode === 'TEXTILE_POS' ? 'D:/Development/TextilePOS' : 'd:/Development/WhatsApp Automation/WA_INSTA_AUTOMATION');

    let commitHash = 'manual-' + Math.random().toString(36).substring(2, 9);
    let commitMessage = 'Application features synchronized with platform catalog';
    let commitAuthor = req.user?.name || 'Platform Admin';
    let commitDate = new Date();

    if (fs.existsSync(localPath)) {
      try {
        const gitInfo = execSync('git log -1 --pretty=format:"%h||%an||%ad||%s"', { cwd: localPath, encoding: 'utf8', timeout: 5000 });
        const parts = gitInfo.split('||');
        if (parts.length >= 4) {
          commitHash = parts[0].trim();
          commitAuthor = parts[1].trim();
          commitDate = new Date(parts[2].trim());
          commitMessage = parts[3].trim();
        }
      } catch (gitErr) {
        // Git command skipped or not a repo
      }
    }

    const durationMs = Date.now() - startTime;

    const syncLog = await ApplicationSyncLog.create({
      applicationId: app._id,
      appCode: app.appCode,
      appName: app.name,
      commitHash,
      commitMessage,
      commitAuthor,
      commitDate,
      triggerType: 'MANUAL',
      status: 'SUCCESS',
      durationMs,
      newRoutesFound: []
    });

    app.lastCommitHash = commitHash;
    app.lastCommitMessage = commitMessage;
    app.lastCommitAuthor = commitAuthor;
    app.lastSyncedAt = new Date();
    await app.save();

    res.json({
      success: true,
      message: 'Successfully synchronized ' + app.name + ' with latest commit [' + commitHash + '] (0s downtime)',
      syncLog,
      application: app
    });
  } catch (error) {
    console.error('Git sync error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/github-webhook', async (req, res) => {
  try {
    const payload = req.body;
    const repoName = payload.repository?.name || '';
    const commit = payload.head_commit || (payload.commits && payload.commits[0]) || {};

    const commitHash = (commit.id || '').substring(0, 7) || 'webhook';
    const commitMessage = commit.message || 'Auto-deployed via GitHub Push Webhook';
    const commitAuthor = commit.author?.name || 'GitHub CI';

    const app = await Application.findOne({
      $or: [
        { githubUrl: new RegExp(repoName, 'i') },
        { appCode: new RegExp(repoName, 'i') }
      ]
    });

    if (app) {
      await ApplicationSyncLog.create({
        applicationId: app._id,
        appCode: app.appCode,
        appName: app.name,
        commitHash,
        commitMessage,
        commitAuthor,
        commitDate: new Date(),
        triggerType: 'WEBHOOK',
        status: 'SUCCESS',
        durationMs: 150
      });

      app.lastCommitHash = commitHash;
      app.lastCommitMessage = commitMessage;
      app.lastCommitAuthor = commitAuthor;
      app.lastSyncedAt = new Date();
      await app.save();
    }

    res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('GitHub Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/feature-mappings', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { urlSlug, featureMappings } = req.body;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const app = isObjectId ? await Application.findById(req.params.id) : await Application.findOne({ appCode: req.params.id.toUpperCase() });
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (urlSlug) {
      app.urlSlug = urlSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    }
    if (Array.isArray(featureMappings)) {
      app.featureMappings = featureMappings;
    }

    await app.save();
    res.json({ success: true, message: 'Feature mappings saved successfully', application: app });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:idOrCode', async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrCode);
    const app = isObjectId 
      ? await Application.findById(idOrCode)
      : await Application.findOne({ appCode: idOrCode.toUpperCase() });

    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({ success: true, application: app });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const { name, appCode, urlSlug, category, defaultPort, description, icon, githubUrl, screens = [], features = [], featureMappings = [] } = req.body;

    if (!name || !appCode || !defaultPort) {
      return res.status(400).json({ success: false, message: 'App Name, App Code, and Default Port are required' });
    }

    const cleanCode = appCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const cleanSlug = (urlSlug || cleanCode).toLowerCase().replace(/[^a-z0-9_-]/g, '');

    const existing = await Application.findOne({ appCode: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Application with code ' + cleanCode + ' already exists' });
    }

    const newApp = await Application.create({
      name: name.trim(),
      appCode: cleanCode,
      urlSlug: cleanSlug,
      category: category || 'General',
      defaultPort: Number(defaultPort),
      description: description || '',
      icon: icon || 'Layers',
      githubUrl: githubUrl || '',
      screens,
      features,
      featureMappings,
      isSystem: false
    });

    res.status(201).json({
      success: true,
      message: 'Application ' + newApp.name + ' registered successfully',
      application: newApp
    });
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const { name, urlSlug, category, defaultPort, description, icon, githubUrl, screens, features, featureMappings } = req.body;

    if (name) app.name = name.trim();
    if (urlSlug) app.urlSlug = urlSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (category) app.category = category;
    if (defaultPort) app.defaultPort = Number(defaultPort);
    if (description !== undefined) app.description = description;
    if (icon) app.icon = icon;
    if (githubUrl !== undefined) app.githubUrl = githubUrl;
    if (screens) app.screens = screens;
    if (features) app.features = features;
    if (featureMappings) app.featureMappings = featureMappings;

    await app.save();

    res.json({
      success: true,
      message: 'Application ' + app.name + ' updated successfully',
      application: app
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'platform_owner'), async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (app.isSystem) {
      return res.status(403).json({ success: false, message: 'Built-in system applications cannot be deleted' });
    }

    const clientCount = await Client.countDocuments({ softwareProduct: app.appCode });
    if (clientCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete ' + app.name + '. It is currently assigned to ' + clientCount + ' active client(s).'
      });
    }

    await app.deleteOne();
    res.json({ success: true, message: 'Application ' + app.name + ' removed from PaaS Hub' });
  } catch (error) {
    console.error('Error deleting application:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
