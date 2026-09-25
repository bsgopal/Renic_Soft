import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gstNumber: { type: String, default: '' },
  address: { type: String, default: '' },
  contact: { type: String, default: '' },
  licenseKey: { type: String, unique: true },
  licenseStatus: {
    type: String,
    enum: ['trial', 'active', 'grace_period', 'locked', 'cancelled', 'pending_activation'],
    default: 'pending_activation'
  },
  licenseStart: { type: Date, default: Date.now },
  licenseEnd: { type: Date, required: true },
  planTier: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    default: 'basic'
  },
  maxFloors: { type: Number, default: 1 },
  maxUsers: { type: Number, default: 3 },
  maxProducts: { type: Number, default: 2000 },
  pendingOwnerName: { type: String, default: '' },
  pendingOwnerEmail: { type: String, default: '' },
  pendingOwnerMobile: { type: String, default: '' },
  pendingOwnerPassword: { type: String, default: '' },
  pendingOwnerRole: { type: String, default: 'admin' },
  activationOtp: { type: String, default: '' },
  activationOtpExpires: { type: Date },
  defaultRolesSeeded: { type: Boolean, default: false },
  telegramBotToken: { type: String, default: '' },
  telegramChatId: { type: String, default: '' },
  telegramReportTime: { type: String, default: '' },
  // Multi-Software & Product Tracking (Dynamic PaaS Catalog)
  softwareProduct: {
    type: String,
    trim: true,
    default: 'WA_INSTA_AUTOMATION'
  },

  // SaaS Dual-Slug & Routing
  customerCode: { type: String, sparse: true, uppercase: true, trim: true, index: true },
  shopSlug: { type: String, lowercase: true, trim: true, default: '' },
  fullSaaSDomain: { type: String, default: '' },
  databaseName: { type: String, default: '' }, // e.g. renic_tenant_saraswat-tx or renic_trial_sandbox

  // Trial Management
  isTrial: { type: Boolean, default: false },
  trialDays: { type: Number, default: 7 },
  expiryAlertSent: { type: Boolean, default: false },

  // Modular Stock & Billing Preferences
  stockConfig: {
    entryMode: { type: String, default: 'simple' }, // 'simple', 'matrix', 'meters'
    enableSizes: { type: Boolean, default: false },
    enableColors: { type: Boolean, default: false },
    enableMeters: { type: Boolean, default: false },
    enableBulkCsv: { type: Boolean, default: true }
  },
  billingConfig: {
    discountMode: { type: String, default: 'both' } // 'item_level', 'bill_level', 'both', 'none'
  },
  pricingConfig: {
    trackProfit: { type: Boolean, default: true },
    allowStaffProfitView: { type: Boolean, default: false }
  },

  // WhatsApp Bulk Dispatch Engine Control (Meta Official Cloud API vs Docker WAHA Web QR)
  whatsappSenderMode: {
    type: String,
    enum: ['META', 'DOCKER'],
    default: 'META'
  },
  dockerThrottleSeconds: {
    type: Number,
    default: 6
  },

  // Subdomain & Network Routing (Zero Port Exposure)
  subdomain: { type: String, default: '', lowercase: true, trim: true },
  customDomain: { type: String, default: '', lowercase: true, trim: true },
  targetHost: { type: String, default: 'hostinger-node-1' },
  assignedPort: { type: Number, default: 5000 },
  clientInstanceUrl: { type: String, default: '' },
  apiSecretKey: { type: String, default: '' },
  clientId: { type: String, default: '' },
  clientSecret: { type: String, default: '' },
  clientSecretHash: { type: String, default: '' },
  oauthTokenEndpoint: { type: String, default: '' },
  oauthEnforced: { type: Boolean, default: false },

  // 4-Tier URL Security & Exposure Protection Shield
  securitySettings: {
    emergencyLock: { type: Boolean, default: false },
    lockReason: { type: String, default: '' },
    requireShowroomIp: { type: Boolean, default: false },
    ipWhitelist: [{ type: String }],
    previousSlugs: [{
      slug: { type: String },
      rotatedAt: { type: Date, default: Date.now },
      reason: { type: String, default: 'URL Rotation / Security Refresh' }
    }]
  },

  // Billing Cycle & Multi-Duration (1, 3, 6 Months, 1 Year)
  billingCycle: {
    type: String,
    enum: ['1_MONTH', '3_MONTHS', '6_MONTHS', '1_YEAR'],
    default: '1_MONTH'
  },

  // Over-The-Air Screen-Gate Permissions (Dynamic Mixed Map)
  screenPermissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      dashboard: true,
      messages: true,
      campaigns: true,
      templates: true,
      catalog: true,
      workflows: true,
      responseRules: true,
      aiSalesAgent: false,
      settings: true,
      posBilling: true,
      inventory: true,
      customerOrders: true,
      customers: true,
      suppliers: true,
      purchaseOrders: true,
      damageEntry: true,
      floors: true,
      reports: true,
      expenses: true,
      hsnSetup: true
    }
  },

  // Dynamic Port Forwarding & PaaS Fleet Management
  portForwarding: {
    targetIp: { type: String, default: '127.0.0.1' },
    assignedPort: { type: Number, default: 5000 },
    publicWebUrl: { type: String, default: '' },
    connectionType: {
      type: String,
      enum: ['PORT_FORWARD_ROUTER', 'CLOUDFLARE_TUNNEL', 'LOCAL_LAN', 'DIRECT_SSL'],
      default: 'PORT_FORWARD_ROUTER'
    },
    status: { type: String, enum: ['online', 'offline', 'unknown'], default: 'unknown' },
    latencyMs: { type: Number, default: 0 },
    lastPingAt: { type: Date },
    lastHeartbeatAt: { type: Date },
    autoRelinkEnabled: { type: Boolean, default: true },
    offlineGraceHours: { type: Number, default: 24 },
    ipChangeHistory: [{
      previousIp: { type: String },
      newIp: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String, default: 'Platform Owner' },
      reason: { type: String, default: 'ISP Dynamic IP Change / Failover' }
    }]
  },

  // Legacy Feature Entitlement Matrix
  featurePermissions: {
    quickReplies: { type: Boolean, default: true },
    workflows: { type: Boolean, default: true },
    catalog: { type: Boolean, default: true },
    templates: { type: Boolean, default: true },
    responseRules: { type: Boolean, default: true },
    bulkBroadcast: { type: Boolean, default: true },
    aiAgent: { type: Boolean, default: false },
    metaCloudApi: { type: Boolean, default: true },
    exportReports: { type: Boolean, default: true }
  },

  // Usage Quotas & Limits
  limits: {
    maxContacts: { type: Number, default: 10000 },
    maxMonthlyMessages: { type: Number, default: 50000 },
    maxConcurrentSessions: { type: Number, default: 2 }
  },

  // Real-Time Fleet Health & Telemetry
  telemetry: {
    whatsappStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'qr_ready', 'unknown'],
      default: 'unknown'
    },
    monthlyMessagesSent: { type: Number, default: 0 },
    totalContacts: { type: Number, default: 0 },
    lastHeartbeat: { type: Date },
    appVersion: { type: String, default: '1.0.0' }
  },

  lastSyncStatus: {
    type: String,
    enum: ['synced', 'failed', 'pending'],
    default: 'pending'
  },
  lastSyncedAt: { type: Date }
}, { timestamps: true });

export default mongoose.models.Client || mongoose.model('Client', clientSchema);
