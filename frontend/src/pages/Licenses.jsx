import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { buildCustomerUrl, appSlugForProduct, appPortForProduct, backendPortForProduct } from '../utils/customerUrl.js';
import Modal from '../components/Modal.jsx';
import SplitDivider from '../components/SplitDivider.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const DEFAULT_SHOP = {
  name: '',
  customerCode: '',
  softwareProduct: 'WA_INSTA_AUTOMATION',
  subdomain: '',
  customDomain: '',
  fullSaaSDomain: '',
  gstNumber: '',
  address: '',
  contact: '',
  planTier: 'pro',
  billingCycle: '3_MONTHS',
  licenseDurationDays: 90,
  ownerEmail: '',
  ownerMobile: '',
  ownerPassword: '',
  activateImmediately: true,
  isTrial: false,
  trialDays: 7,
  solutionMode: '',
  solutionModes: [],
  businessType: '',
  customTerminology: {},
  stockConfig: {
    entryMode: 'simple',
    enableSizes: false,
    enableColors: false,
    enableMeters: false,
    enableBulkCsv: true
  },
  billingConfig: {
    discountMode: 'both'
  },
  pricingConfig: {
    trackProfit: true,
    allowStaffProfitView: false
  },
  oauthEnforced: true,
  clientId: '',
  clientSecret: '',
  screenPermissions: {},
  fieldConfig: {
    billing: {
      excelImport: { visible: true, required: false }
    },
    stockAdd: {
      supplier: { visible: true, required: true },
      category: { visible: true, required: true },
      subCategory: { visible: true, required: true },
      productName: { visible: true, required: true }
    },
    stockImport: {
      // 'perUnit'      → qty 10 mints 10 SKU IDs / 10 barcodes (one item = one barcode)
      // 'singleBarcode' → qty 10 keeps 1 SKU / 1 barcode holding 10 units
      barcodeMode: { value: 'perUnit' }
    }
  },
  branchConfig: {
    mode: 'SINGLE',
    maxBranches: 1,
    allowInterBranchTransfer: false
  },
  featurePermissions: {
    quickReplies: true,
    workflows: true,
    catalog: true,
    templates: true,
    responseRules: true,
    bulkBroadcast: true,
    aiAgent: false,
    metaCloudApi: true,
    exportReports: true,
    // Enterprise Pawn Broking Master Entitlements
    allowPartialRelease: false,
    allowRePledge: false,
    enableBlacklistShield: true,
    allowCustomPrintTemplates: true
  },
  whatsappSenderMode: 'META',
  dockerThrottleSeconds: 6
};

const WIZARD_SECTIONS = [
  { id: 'sec-identity', label: '1. Customer Profile', sub: 'Store Identity & Admin' },
  { id: 'sec-security', label: '2. Security & OAuth 2.0', sub: 'Machine Credentials' },
  { id: 'sec-routing', label: '3. App & Smart Routing', sub: 'Subdomain Routing' },
  { id: 'sec-screens', label: '4. Feature Governance', sub: '100% Pre-Selected SaaS' },
  { id: 'sec-deployment', label: '5. Engine & Diagnostic', sub: 'Pre-Flight & Launch' }
];

export function CopyBtn({ text, label = 'Copy', className = '', showLabel = true }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition ${
        copied
          ? 'bg-emerald-600 text-white shadow-xs'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
      } ${className}`}
      title={copied ? "Copied to clipboard!" : "Copy to clipboard"}
    >
      <span>{copied ? '✓' : '📋'}</span>
      {showLabel && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  );
}

export default function Licenses() {
  const { user = null } = useAuth() || {};
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [clients, setClients] = useState([]);
  const [apps, setApps] = useState([]);
  // Applications a customer can actually be licensed to run. RENIC_SOFT (the
  // operator's own `hq` console) carries assignable:false in the registry, so
  // it is never offered as a product. Filtering on the flag rather than
  // hardcoding an appCode blocklist keeps this correct for every app that is
  // registered in Renic Soft after this code was written.
  const assignableApps = apps.filter((a) => a.assignable !== false);

  /**
   * Application slug resolution.
   *
   * Reads the Applications registry in Renic Soft rather than a hardcoded
   * product list, so registering a new application there (new appCode, new
   * name, new urlSlug) immediately makes it selectable here and resolves to
   * its correct URL slug — no code change required.
   */
  const appSlugFor = (appCode) => {
    const found = apps.find((a) => a.appCode === appCode);
    return String(found?.urlSlug || appSlugForProduct(appCode) || '').trim().toLowerCase();
  };
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [togglingLockId, setTogglingLockId] = useState(null);

  // Panel State (Two-Column Layout)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState('create'); // 'create' | 'edit'
  const [wizardForm, setWizardForm] = useState(DEFAULT_SHOP);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [showWizardSecret, setShowWizardSecret] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  // Split Panel & Anchor Navigation
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const [splitPercent, setSplitPercent] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent >= 20 && newPercent <= 80) {
        setSplitPercent(newPercent);
      }
    };
    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  const [activeTabSection, setActiveTabSection] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const detailScrollRef = useRef(null);

  // Smooth scroll to anchor section inside right object page
  const handleScrollToSection = (index, sectionId) => {
    setActiveTabSection(index);
    const element = document.getElementById(sectionId);
    if (element && detailScrollRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Auto-detect active section while scrolling right object panel
  const handlePanelScroll = () => {
    if (!detailScrollRef.current) return;
    const sections = [
      'sec-identity',
      'sec-security',
      'sec-routing',
      'sec-screens',
      'sec-deployment'
    ];
    const scrollPos = detailScrollRef.current.scrollTop + 140;
    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(sections[i]);
      if (el && el.offsetTop <= scrollPos) {
        setActiveTabSection(i);
        break;
      }
    }
  };

  // Pre-Flight Diagnostic State
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightResults, setPreflightResults] = useState(null);

  // OAuth Modal state
  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [oauthData, setOauthData] = useState(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);
  // The client secret is masked by default in the handover modal; only the
  // operator's explicit Reveal click unmasks it.
  const [revealSecret, setRevealSecret] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Convert Trial to Production Modal State
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [clientToConvert, setClientToConvert] = useState(null);
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertForm, setConvertForm] = useState({
    planTier: 'pro',
    billingCycle: '1_YEAR',
    subscriptionDays: 365,
    paymentReference: ''
  });

  const [availablePlanTiers, setAvailablePlanTiers] = useState([]);

  const fetchPlanTiers = useCallback(async () => {
    try {
      const res = await api.get('/plan-tiers');
      if (res.data?.success) {
        setAvailablePlanTiers(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load plan tiers:', err);
    }
  }, []);

  const fetchApps = useCallback(async () => {
    try {
      const res = await api.get('/applications');
      setApps(res.data.applications || []);
    } catch (err) {
      console.error('Failed to load application catalog:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/clients');
      const clientList = Array.isArray(res.data) ? res.data : [];
      setClients(clientList);
      // No auto-select so initial view starts as 1-column full width
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load licenses', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, wizardOpen, selectedClient]);

  useEffect(() => {
    fetchData();
    fetchApps();
    fetchPlanTiers();
  }, [fetchData, fetchApps, fetchPlanTiers]);

  // Helper to extract unified feature list for an app
  const getAppFeatures = useCallback((targetApp) => {
    if (!targetApp) return [];
    if (targetApp.featureMappings && targetApp.featureMappings.length > 0) {
      return targetApp.featureMappings.map(f => ({
        key: f.technicalTarget,
        label: f.customDisplayName || f.technicalTarget,
        category: f.folderCategory || 'Core Modules',
        path: f.screenPath || '',
        description: f.description || '',
        defaultEnabled: f.defaultEnabled !== false
      }));
    }
    if (targetApp.screens && targetApp.screens.length > 0) {
      return targetApp.screens.map(s => ({
        key: s.key,
        label: s.label,
        category: 'App Screen',
        path: s.path || `/${s.key}`,
        description: s.description || '',
        defaultEnabled: true
      }));
    }
    return [
      { key: 'dashboard', label: 'Executive Dashboard & Analytics', category: 'Analytics', defaultEnabled: true },
      { key: 'billing', label: 'POS Terminal & Instant Invoicing', category: 'Billing', defaultEnabled: true },
      { key: 'inventory', label: 'Live Inventory & Multi-Variant Stock', category: 'Stock', defaultEnabled: true },
      { key: 'customers', label: 'Customer Directory & Ledger (CRM)', category: 'CRM', defaultEnabled: true },
      { key: 'broadcast', label: 'Promotional WhatsApp Broadcasts', category: 'Marketing', defaultEnabled: true },
      { key: 'reports', label: 'Financial Audit & Tax Reports (GST)', category: 'Finance', defaultEnabled: true }
    ];
  }, []);

  // Pre-check 100% of features for a newly created client
  const initDefault100PercentPermissions = (targetApp) => {
    const features = getAppFeatures(targetApp);
    const perms = {};
    features.forEach(f => {
      perms[f.key] = true;
    });
    return perms;
  };

  // Auto-generate Subdomain & Keys on name change
  const handleNameChange = (nameVal) => {
    const slug = nameVal.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    const shortCode = nameVal.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12);

    setWizardForm(prev => {
      const updated = {
        ...prev,
        name: nameVal,
        subdomain: prev.subdomain || slug,
        customerCode: prev.customerCode || shortCode,
        ownerEmail: (!prev.ownerEmail || prev.ownerEmail.startsWith('admin@')) && slug ? `admin@${slug}.com` : prev.ownerEmail
      };
      if (!updated.clientId && shortCode) {
        const rand = Math.random().toString(36).substring(2, 8);
        updated.clientId = `renic_${shortCode}_${rand}`;
      }
      return updated;
    });
  };

  // Generate a random secure owner password
  const handleGenerateOwnerPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$';
    let pwd = 'Rnc@';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWizardForm(prev => ({ ...prev, ownerPassword: pwd }));
    showSnackbar('Generated new secure Admin Password', 'info');
  };

  // Generate high-entropy secret key based on Customer ID / Code
  const handleGenerateNewSecret = (customCode) => {
    const rawCode = customCode || wizardForm.customerCode || wizardForm.subdomain || 'client';
    const cleanCode = rawCode.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 15) || 'client';

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let randSecret = `rnc_sec_${cleanCode}_`;
    for (let i = 0; i < 28; i++) {
      randSecret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randId = `renic_${cleanCode}_${Math.random().toString(36).substring(2, 8)}`;

    setWizardForm(prev => ({
      ...prev,
      customerCode: cleanCode,
      clientId: randId,
      clientSecret: randSecret
    }));
    showSnackbar(`Generated OAuth 2.0 Credentials (Client ID: ${randId}) from Customer ID: ${cleanCode}`, 'success');
  };

  // Open Wizard in Create Mode
  const handleOpenCreateWizard = () => {
    const defaultApp = apps.find(a => a.appCode === 'WA_INSTA_AUTOMATION') || apps.find(a => a.assignable !== false) || apps[0] || { appCode: 'WA_INSTA_AUTOMATION', defaultPort: 5000 };
    const defaultMode = defaultApp.solutionModes?.[0];
    const defaultBt = defaultMode?.businessTypes?.[0];
    const defaultModes = defaultMode ? [defaultMode.modeKey] : [];

    const appFeatures = getAppFeatures(defaultApp);
    const defaultPerms = {};
    if (defaultMode?.defaultScreenKeys && defaultMode.defaultScreenKeys.length > 0) {
      appFeatures.forEach(f => {
        defaultPerms[f.key] = defaultMode.defaultScreenKeys.includes(f.key);
      });
    } else {
      appFeatures.forEach(f => { defaultPerms[f.key] = true; });
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let randSecret = 'rnc_sec_';
    for (let i = 0; i < 32; i++) {
      randSecret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const randPwd = `Renic@${Math.floor(1000 + Math.random() * 9000)}`;

    setWizardMode('create');
    setSelectedClient(null);
    setPreflightResults(null);
    setActiveTabSection(0);
    setWizardForm({
      ...DEFAULT_SHOP,
      softwareProduct: defaultApp.appCode,
      assignedPort: defaultApp.defaultPort || 5000,
      solutionModes: defaultModes,
      solutionMode: defaultModes.join(','),
      businessType: defaultBt?.typeKey || '',
      customTerminology: defaultBt || {},
      screenPermissions: defaultPerms,
      clientSecret: randSecret,
      clientId: `rnc_cli_tenant_${Math.random().toString(36).substring(2, 7)}`,
      ownerPassword: randPwd
    });
    setWizardOpen(true);
  };

  // Open Wizard in Edit Mode
  const handleOpenEditWizard = (clientObj) => {
    setSelectedClient(clientObj);
    setWizardMode('edit');
    setPreflightResults(null);
    setActiveTabSection(0);

    const targetApp = apps.find(a => a.appCode === clientObj.softwareProduct);
    const existingPerms = clientObj.screenPermissions || clientObj.featurePermissions || {};
    const defaultPerms = initDefault100PercentPermissions(targetApp);
    const mergedPerms = { ...defaultPerms, ...existingPerms };

    const selectedModes = Array.isArray(clientObj.solutionModes) && clientObj.solutionModes.length > 0
      ? clientObj.solutionModes
      : (clientObj.solutionMode ? clientObj.solutionMode.split(',').map(s => s.trim()).filter(Boolean) : []);

    setWizardForm({
      _id: clientObj._id || clientObj.id,
      name: clientObj.name || '',
      customerCode: clientObj.customerCode || clientObj.subdomain?.toUpperCase() || '',
      softwareProduct: clientObj.softwareProduct || 'WA_INSTA_AUTOMATION',
      solutionModes: selectedModes,
      solutionMode: clientObj.solutionMode || selectedModes.join(','),
      businessType: clientObj.businessType || '',
      customTerminology: clientObj.customTerminology || {},
      subdomain: clientObj.subdomain || '',
      customDomain: clientObj.customDomain || '',
      fullSaaSDomain: clientObj.fullSaaSDomain || '',
      gstNumber: clientObj.gstNumber || '',
      address: clientObj.address || '',
      contact: clientObj.contact || clientObj.pendingOwnerName || '',
      planTier: clientObj.planTier || 'pro',
      billingCycle: clientObj.billingCycle || '3_MONTHS',
      licenseDurationDays: 90,
      licenseStatus: clientObj.licenseStatus || 'active',
      ownerEmail: clientObj.ownerEmail || clientObj.pendingOwnerEmail || '',
      ownerMobile: clientObj.ownerMobile || clientObj.pendingOwnerMobile || '',
      pendingOwnerEmail: clientObj.pendingOwnerEmail || clientObj.ownerEmail || '',
      pendingOwnerMobile: clientObj.pendingOwnerMobile || clientObj.ownerMobile || '',
      ownerPassword: '',
      isTrial: clientObj.isTrial || false,
      trialDays: clientObj.trialDays || 7,
      databaseName: clientObj.databaseName || '',
      stockConfig: clientObj.stockConfig || DEFAULT_SHOP.stockConfig,
      billingConfig: clientObj.billingConfig || DEFAULT_SHOP.billingConfig,
      pricingConfig: clientObj.pricingConfig || DEFAULT_SHOP.pricingConfig,
      targetIp: clientObj.portForwarding?.targetIp || clientObj.targetIp || '127.0.0.1',
      assignedPort: clientObj.portForwarding?.assignedPort || clientObj.assignedPort || targetApp?.defaultPort || 5000,
      connectionType: clientObj.portForwarding?.connectionType || clientObj.connectionType || 'PORT_FORWARD_ROUTER',
      oauthEnforced: clientObj.oauthEnforced !== undefined ? clientObj.oauthEnforced : true,
      clientId: clientObj.clientId || '',
      clientSecret: clientObj.clientSecret || '',
      screenPermissions: mergedPerms,
      branchConfig: clientObj.branchConfig || DEFAULT_SHOP.branchConfig,
      featurePermissions: { ...DEFAULT_SHOP.featurePermissions, ...(clientObj.featurePermissions || {}) },
      whatsappSenderMode: clientObj.whatsappSenderMode || 'META',
      dockerThrottleSeconds: clientObj.dockerThrottleSeconds || 6
    });

    setWizardOpen(true);
  };

  // Automated Pre-Flight Check Probe
  const runPreflightCheck = async () => {
    try {
      setPreflightLoading(true);
      const res = await api.post('/licenses/preflight-check', {
        customerCode: wizardForm.customerCode,
        shopSlug: wizardForm.subdomain || wizardForm.customerCode,
        softwareProduct: wizardForm.softwareProduct,
        whatsappSenderMode: wizardForm.whatsappSenderMode,
        excludeId: wizardMode === 'edit' ? (wizardForm._id || selectedClient?._id) : undefined
      });
      setPreflightResults(res.data);
      if (res.data.passed) {
        showSnackbar('✓ Live Diagnostic Probe: 100% Passed! Ready to Route.', 'success');
      } else {
        const msg = !res.data.checks?.subdomainUnique 
          ? (res.data.checks?.subdomainMessage || 'Customer code already taken!')
          : (!res.data.checks?.frontendReachable 
            ? `Port ${res.data.checks?.frontendPort || ''} offline! Please start the frontend server.`
            : `Backend port ${res.data.checks?.backendPort || ''} offline! Please start the backend server.`);
        showSnackbar(`⚠️ Diagnostics Warning: ${msg}`, 'warning');
      }
    } catch (err) {
      const errMessage = err.response?.data?.message || err.message || 'Diagnostic connection failed';
      setPreflightResults({
        passed: false,
        ready: false,
        healthScore: 0,
        error: errMessage,
        checks: {
          subdomainUnique: false,
          frontendReachable: false,
          backendReachable: false,
          frontendMessage: `Diagnostic probe failed: ${errMessage}`,
          backendMessage: 'Diagnostic server error'
        }
      });
      showSnackbar(`❌ Diagnostic probe failed: ${errMessage}`, 'error');
    } finally {
      setPreflightLoading(false);
    }
  };

  // Submit Wizard Form
  const handleWizardSubmit = async (e) => {
    if (e) e.preventDefault();
    try {
      setWizardSubmitting(true);

      const slug = appSlugFor(wizardForm.softwareProduct);
      const smartUrl = buildCustomerUrl(wizardForm, slug);

      // `portForwarding` is intentionally NOT part of the payload any more: a
      // customer's target IP / assigned port / connection type are not
      // configurable — routing is by Host header (config/appPorts.js).
      const payload = {
        ...wizardForm,
        fullSaaSDomain: smartUrl
      };

      if (wizardMode === 'create') {
        // This used to POST to '/clients/wizard-onboard' — a route that does not
        // exist anywhere in the backend, so onboarding returned 404 every time.
        // The real create route is POST /clients, which expects exactly the
        // fields this payload already carries (name/ownerEmail/ownerMobile/
        // ownerPassword).
        const res = await api.post('/clients', payload);
        showSnackbar(`🚀 Instance Launched! Dedicated Portal: ${smartUrl}`, 'success');
        const created = res.data.client || {};
        setCreatedCreds({
          clientName: created.name || wizardForm.name,
          customerCode: created.customerCode || res.data.credentials?.customerCode || wizardForm.customerCode,
          hostingUrl: created.fullSaaSDomain || res.data.credentials?.hostingUrl || smartUrl,
          dbName: created.databaseName || `renic_tenant_${(wizardForm.customerCode || '').toLowerCase()}`,
          clientId: res.data.credentials?.clientId || wizardForm.clientId,
          clientSecret: res.data.credentials?.clientSecret || wizardForm.clientSecret,
          email: wizardForm.ownerEmail,
          password: wizardForm.ownerPassword,
          mobile: wizardForm.pendingOwnerMobile || wizardForm.ownerMobile
        });
      } else {
        await api.put(`/clients/${selectedClient._id}`, payload);
        showSnackbar(`Saved & Pushed OTA configuration for ${wizardForm.name}!`, 'success');
      }

      setWizardOpen(false);
      setSelectedClient(null);
      setIsPanelMaximized(false);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save customer instance', 'error');
    } finally {
      setWizardSubmitting(false);
    }
  };

  // Instant OTA Push Sync
  const handlePushSync = async (clientObj) => {
    try {
      setSyncingId(clientObj._id);
      const res = await api.post(`/sync/push/${clientObj._id}`);
      if (res.data.delivered) {
        showSnackbar(`⚡ Live OTA sync confirmed with ${clientObj.name}!`, 'success');
      } else {
        showSnackbar(`Saved locally. (${res.data.message})`, 'info');
      }
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Sync failed', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  // Toggle Customer Lock
  const handleToggleLock = async (c) => {
    const isLocked = Boolean(
      c.securitySettings?.emergencyLock ||
      ['locked', 'disabled', 'suspended', 'cancelled', 'inactive', 'revoked'].includes(c.licenseStatus)
    );
    const actionText = isLocked ? 'Unlock & Re-enable' : 'Disable & Lock';
    const ok = await confirmDialog({
      title: `${actionText} customer "${c.name}"?`,
      message: isLocked
        ? `This will restore web URL access for ${c.customerCode || c.subdomain}, re-enable routing, and unlock client terminals.`
        : `This will immediately shut down the customer's dedicated URL (${buildCustomerUrl(c).replace('https://', '')} / ${c.customerCode}) and return an authoritative 403 Portal Deactivated page. Client terminals will immediately be locked.`,
      confirmText: actionText,
      danger: !isLocked
    });
    if (!ok) return;

    try {
      setTogglingLockId(c._id);
      const res = await api.post(`/clients/${c._id}/toggle-lock`);
      showSnackbar(res.data.message || `Customer ${isLocked ? 'unlocked' : 'disabled'} successfully`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to toggle customer lock status', 'error');
    } finally {
      setTogglingLockId(null);
    }
  };

  // Delete Tenant
  const handleDelete = async (c) => {
    const isTrialClient = c.isTrial || c.licenseStatus === 'trial';
    const ok = await confirmDialog({
      title: `${isTrialClient ? 'Purge Trial Sandbox' : 'Delete Customer Instance'} "${c.name}"?`,
      message: `This will permanently delete this instance and drop its isolated database (${c.databaseName || 'renic_tenant_' + c.customerCode}). Their dedicated URL (${buildCustomerUrl(c).replace('https://', '')} / ${c.customerCode}) will immediately cease to exist. This action cannot be undone.`,
      confirmText: isTrialClient ? 'Purge Trial Sandbox' : 'Delete Instance',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/clients/${c._id}`);
      showSnackbar(`Customer "${c.name}" ${isTrialClient ? 'trial sandbox purged.' : 'deleted.'}`, 'success');
      if (selectedClient?._id === c._id) {
        setSelectedClient(null);
        setWizardOpen(false);
      }
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete instance', 'error');
    }
  };

  // 1-Click Convert Trial to Full Production
  const handleOpenConvertModal = (clientObj) => {
    setClientToConvert(clientObj);
    setConvertForm({
      planTier: clientObj.planTier || 'pro',
      billingCycle: '1_YEAR',
      subscriptionDays: 365,
      paymentReference: ''
    });
    setConvertModalOpen(true);
  };

  const handleConvertTrialSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!clientToConvert) return;
    try {
      setConvertSubmitting(true);
      const res = await api.post(`/clients/${clientToConvert._id}/convert-to-production`, convertForm);
      showSnackbar(`🎉 ${res.data.message || 'Client successfully upgraded to Dedicated Production!'}`, 'success');
      setConvertModalOpen(false);
      setClientToConvert(null);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to convert trial to production', 'error');
    } finally {
      setConvertSubmitting(false);
    }
  };

  // Open OAuth & Postman Kit
  const openOAuthModal = async (clientObj) => {
    try {
      setSelectedClient(clientObj);
      setOauthLoading(true);
      setOauthModalOpen(true);
      setShowSecret(false);
      const res = await api.get(`/licenses/${clientObj._id}/oauth-credentials`);
      setOauthData(res.data);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load OAuth credentials', 'error');
      setOauthModalOpen(false);
    } finally {
      setOauthLoading(false);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(c => {
    const matchesProduct = productFilter === 'ALL' || c.softwareProduct === productFilter;
    const isExpired = new Date(c.licenseEnd) < new Date();
    const daysLeft = Math.ceil((new Date(c.licenseEnd) - new Date()) / (24 * 3600 * 1000));

    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') matchesStatus = c.licenseStatus === 'active' && !isExpired;
    else if (statusFilter === 'EXPIRING') matchesStatus = !isExpired && daysLeft <= 7;
    else if (statusFilter === 'EXPIRED') matchesStatus = isExpired;
    else if (statusFilter === 'OAUTH_ENFORCED') matchesStatus = Boolean(c.oauthEnforced);

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      c.name.toLowerCase().includes(query) ||
      (c.customerCode || '').toLowerCase().includes(query) ||
      (c.contact || c.pendingOwnerMobile || '').includes(query) ||
      (c.portForwarding?.assignedPort ? String(c.portForwarding.assignedPort).includes(query) : false);

    return matchesProduct && matchesStatus && matchesSearch;
  });

  const currentWizardApp = apps.find(a => a.appCode === wizardForm.softwareProduct);
  const appFeaturesList = getAppFeatures(currentWizardApp);
  const smartAppSlug = appSlugFor(wizardForm.softwareProduct) || appSlugForProduct(wizardForm.softwareProduct) || 'pos';
  const computedSmartUrl = buildCustomerUrl(wizardForm, smartAppSlug);
  const currentWizardPort = currentWizardApp?.defaultPort || appPortForProduct(wizardForm.softwareProduct);
  const currentWizardBackendPort = backendPortForProduct(wizardForm.softwareProduct);
  const cleanCustomerCode = (wizardForm.customerCode || wizardForm.subdomain || 'client').toLowerCase();
  const knownFrontendBase = 
    smartAppSlug === 'pb' ? (import.meta.env.VITE_PAWN_BROKING_URL || 'https://<your-pawnbroking-frontend>.vercel.app') :
    smartAppSlug === 'billing' ? (import.meta.env.VITE_SIMPLE_BILLING_URL || 'https://<your-simple-billing-frontend>.vercel.app') :
    '';
  const cloudTenantUrl = wizardForm.fullSaaSDomain?.startsWith('http') && !wizardForm.fullSaaSDomain.includes('renictech.com') && !wizardForm.fullSaaSDomain.includes('lvh.me')
    ? wizardForm.fullSaaSDomain
    : (knownFrontendBase ? `${knownFrontendBase.replace(/\/+$/, '')}?tenant=${cleanCustomerCode}` : `https://<your-frontend>.vercel.app?tenant=${cleanCustomerCode}`);

  const localDevUrl = `http://localhost:${currentWizardPort}`;
  const localLvhUrl = `http://${smartAppSlug}.${cleanCustomerCode}.lvh.me:${currentWizardPort}`;
  const localGatewayUrl = `http://${smartAppSlug}.${cleanCustomerCode}.lvh.me:5050`;
  const cloudflareTunnelCmd = `cloudflared tunnel --url http://localhost:${currentWizardPort}`;

  const activeSolutionModesList = Array.isArray(wizardForm.solutionModes) && wizardForm.solutionModes.length > 0
    ? wizardForm.solutionModes
    : (wizardForm.solutionMode ? wizardForm.solutionMode.split(',').map(s => s.trim()).filter(Boolean) : []);

  const toggleSolutionMode = (modeKey) => {
    const currentModes = [...activeSolutionModesList];
    const exists = currentModes.includes(modeKey);
    let updatedModes;
    if (exists) {
      updatedModes = currentModes.filter(m => m !== modeKey);
    } else {
      updatedModes = [...currentModes, modeKey];
    }

    // Determine default screens for all currently selected modes
    const activeScreenKeys = new Set();
    updatedModes.forEach(mKey => {
      const modeObj = (currentWizardApp?.solutionModes || []).find(m => m.modeKey === mKey);
      if (modeObj?.defaultScreenKeys) {
        modeObj.defaultScreenKeys.forEach(k => activeScreenKeys.add(k));
      }
    });

    const newPerms = {};
    if (updatedModes.length > 0 && activeScreenKeys.size > 0) {
      appFeaturesList.forEach(f => {
        newPerms[f.key] = activeScreenKeys.has(f.key);
      });
    } else if (updatedModes.length === 0) {
      appFeaturesList.forEach(f => {
        newPerms[f.key] = false;
      });
    } else {
      appFeaturesList.forEach(f => {
        newPerms[f.key] = true;
      });
    }

    const apptMode = (currentWizardApp?.solutionModes || []).find(m => updatedModes.includes(m.modeKey) && m.businessTypes?.length > 0);
    const firstBt = apptMode?.businessTypes?.[0] || wizardForm.customTerminology || {};

    setWizardForm(prev => ({
      ...prev,
      solutionModes: updatedModes,
      solutionMode: updatedModes.join(','),
      businessType: apptMode ? (prev.businessType || firstBt.typeKey || '') : prev.businessType,
      customTerminology: apptMode ? (Object.keys(prev.customTerminology || {}).length ? prev.customTerminology : firstBt) : prev.customTerminology,
      screenPermissions: newPerms
    }));

    const modeNames = updatedModes.map(k => {
      const mObj = currentWizardApp?.solutionModes?.find(m => m.modeKey === k);
      return mObj?.displayName || mObj?.name || k;
    }).join(' + ');

    if (updatedModes.length > 0) {
      showSnackbar(`Selected: ${modeNames} (${activeScreenKeys.size} screens enabled)`, 'info');
    } else {
      showSnackbar('All solution modes deselected', 'warning');
    }
  };

  const resetToModeScreenDefaults = () => {
    const activeScreenKeys = new Set();
    activeSolutionModesList.forEach(mKey => {
      const modeObj = (currentWizardApp?.solutionModes || []).find(m => m.modeKey === mKey);
      if (modeObj?.defaultScreenKeys) {
        modeObj.defaultScreenKeys.forEach(k => activeScreenKeys.add(k));
      }
    });

    const newPerms = {};
    if (activeSolutionModesList.length > 0 && activeScreenKeys.size > 0) {
      appFeaturesList.forEach(f => {
        newPerms[f.key] = activeScreenKeys.has(f.key);
      });
    } else {
      appFeaturesList.forEach(f => {
        newPerms[f.key] = true;
      });
    }

    setWizardForm(prev => ({
      ...prev,
      screenPermissions: newPerms
    }));
    showSnackbar('Reset screen permissions to selected mode default(s)', 'info');
  };

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-[#f4f6f8] text-slate-800 flex-1">
      {/* ============ TWO-COLUMN MASTER-DETAIL LAYOUT ============ */}
      
      {/* ============ LEFT COLUMN: MASTER LIST TABLE (40-42% Width) ============ */}
      {!isPanelMaximized && (
        <div
          style={{ width: wizardOpen ? `${splitPercent}%` : '100%', transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white border-r border-slate-200 overflow-hidden flex-shrink-0 transition-[width] duration-300 ease-in-out"
        >
          {/* Top Control Bar for Left Column */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search customers or codes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">
                <Icon name="search" className="w-3.5 h-3.5" />
              </span>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Filters
            </button>

            <button
              onClick={() => fetchData()}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Refresh Fleet"
            >
              <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#65a30d]' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreateWizard}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-bold text-xs rounded-lg shadow-xs transition"
            >
              <Icon name="plus" className="w-3.5 h-3.5 stroke-[2.5]" /> Launch Instance
            </button>
          </div>

          {/* Optional Filter Pills Bar */}
          {showFilters && (
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-2 text-xs flex-wrap flex-shrink-0">
              <span className="font-bold text-slate-500 uppercase text-[10px]">App:</span>
              <button
                onClick={() => setProductFilter('ALL')}
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  productFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                All ({clients.length})
              </button>
              {assignableApps.map(a => (
                <button
                  key={a.appCode}
                  onClick={() => setProductFilter(a.appCode)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                    productFilter === a.appCode ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-700'
                  }`}
                >
                  {a.name}
                </button>
              ))}

              <div className="h-3 w-px bg-slate-300 mx-1" />

              <span className="font-bold text-slate-500 uppercase text-[10px]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-0.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="OAUTH_ENFORCED">OAuth Enforced</option>
                <option value="EXPIRING">Expiring Soon</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          )}

          {/* Table Header Sub-bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
            <span className="font-bold text-slate-700">
              Customer Instances ({filteredClients.length})
            </span>
            <span className="text-[11px] text-slate-400">
              Click row to edit instance
            </span>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-2 px-3">Customer / Software</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 hidden sm:table-cell">Expiry</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-2" />
                      <span>Loading customer instances...</span>
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <p className="font-bold text-slate-600">No instances found</p>
                      <p className="text-[11px] mt-0.5">Click &quot;Launch Instance&quot; to provision a new tenant.</p>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    const isExpired = new Date(c.licenseEnd) < new Date();
                    const daysLeft = Math.ceil((new Date(c.licenseEnd) - new Date()) / (24 * 3600 * 1000));
                    const code = c.customerCode || c.subdomain?.toUpperCase() || 'CLIENT';
                    const isSelected = selectedClient?._id === c._id && wizardOpen;
                    const appObj = apps.find(a => a.appCode === c.softwareProduct);
                    const isLockedOrDisabled = Boolean(
                      c.securitySettings?.emergencyLock ||
                      ['locked', 'disabled', 'suspended', 'cancelled', 'inactive', 'revoked'].includes(c.licenseStatus)
                    );

                    return (
                      <tr
                        key={c._id}
                        onClick={() => handleOpenEditWizard(c)}
                        className={`cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-lime-50/70 border-l-4 border-l-[#84cc16]'
                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Col 1: Customer Name & Code */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                              {code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-[170px] mt-0.5">
                            {appObj?.name || c.softwareProduct}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">
                            {buildCustomerUrl(c).replace('https://', '')}
                          </div>
                        </td>

                        {/* Col 2: Status */}
                        <td className="py-2.5 px-3 align-top">
                          {c.isTrial || c.licenseStatus === 'trial' ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                              🧪 Trial ({daysLeft > 0 ? `${daysLeft}d` : 'Ended'})
                            </span>
                          ) : (
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              isLockedOrDisabled
                                ? 'bg-rose-100 text-rose-800'
                                : isExpired
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isLockedOrDisabled ? 'Locked' : isExpired ? 'Expired' : 'Active'}
                            </span>
                          )}
                        </td>

                        {/* Col 3: Expiry */}
                        <td className="py-2.5 px-3 align-top hidden sm:table-cell">
                          <div className="text-[11px] text-slate-700 font-medium">
                            {new Date(c.licenseEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isExpired ? 'Expired' : `${daysLeft}d remaining`}
                          </div>
                        </td>

                        {/* Col 4: Row Actions */}
                        <td className="py-2.5 px-2 align-top text-right" onClick={e => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            {(c.isTrial || c.licenseStatus === 'trial') && (
                              <button
                                onClick={() => handleOpenConvertModal(c)}
                                className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded shadow-2xs transition"
                                title="Convert Trial to Dedicated Production"
                              >
                                ⭐ Upgrade
                              </button>
                            )}
                            <button
                              onClick={() => handlePushSync(c)}
                              disabled={syncingId === c._id}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                              title="OTA Push Sync"
                            >
                              <Icon name="refresh" className={`w-3.5 h-3.5 ${syncingId === c._id ? 'animate-spin text-emerald-600' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleToggleLock(c)}
                              disabled={togglingLockId === c._id}
                              className={`p-1 rounded transition ${isLockedOrDisabled ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                              title={isLockedOrDisabled ? "Unlock" : "Lock"}
                            >
                              <Icon name="key" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Draggable Resizer */}
      {wizardOpen && !isPanelMaximized && (
        <SplitDivider isDragging={isDragging} onMouseDown={() => setIsDragging(true)} />
      )}

      {/* ============ RIGHT COLUMN: OBJECT DETAIL & CONFIGURATION PAGE ============ */}
      {wizardOpen && (
        <div
          style={{ width: isPanelMaximized ? '100%' : `${100 - splitPercent}%`, transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white overflow-hidden h-full flex-1 animate-in fade-in slide-in-from-right-3 duration-300"
        >
          
          {/* 1. Header Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {wizardForm.name || 'New Customer Instance'}
                  </h2>
                  {wizardForm.customerCode && (
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-900 text-emerald-400">
                      {wizardForm.customerCode}
                    </span>
                  )}
                  {wizardForm.isTrial && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      🧪 Free Trial ({wizardForm.trialDays || 7}d Sandbox)
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-slate-500 font-medium">
                  <p>
                    Created: <span className="text-slate-800">{selectedClient ? new Date(selectedClient.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending Provision'}</span>
                    {selectedClient && (
                      <span className="ml-3">License End: <span className="text-slate-800">{new Date(selectedClient.licenseEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></span>
                    )}
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700">
                    Route: {computedSmartUrl}
                  </p>
                </div>
              </div>

              {/* Right Header Action Icons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {selectedClient && (selectedClient.isTrial || selectedClient.licenseStatus === 'trial') && (
                  <button
                    type="button"
                    onClick={() => handleOpenConvertModal(selectedClient)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs transition"
                    title="Convert Trial to Production"
                  >
                    ⭐ Convert to Production
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition shadow-xs"
                  title="Back to Instance List"
                >
                  <Icon name="arrow-left" className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedClient) openOAuthModal(selectedClient);
                    else handleGenerateNewSecret();
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                  title="Copy OAuth / API Kit"
                >
                  <Icon name="key" className="w-4 h-4" />
                </button>
                <CopyBtn text={computedSmartUrl} showLabel={false} className="!p-1.5" />
                <button
                  type="button"
                  onClick={() => setIsPanelMaximized(!isPanelMaximized)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                  title={isPanelMaximized ? "Restore Split View" : "Maximize Full View"}
                >
                  <Icon name="expand" className="w-4 h-4" />
                </button>
                {selectedClient && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedClient)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                    title="Delete Instance"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setWizardOpen(false);
                    setSelectedClient(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title="Close Studio"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Horizontal Anchor Tabs */}
          <div className="border-b border-slate-200 bg-white px-4 flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar flex-shrink-0 text-xs font-semibold">
            {WIZARD_SECTIONS.map((sec, idx) => {
              const isActive = activeTabSection === idx;
              return (
                <button
                  key={sec.id}
                  onClick={() => handleScrollToSection(idx, sec.id)}
                  className={`py-2.5 transition relative whitespace-nowrap ${
                    isActive
                      ? 'text-[#65a30d] font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sec.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#84cc16]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* 3. Scrollable Form Content */}
          <div
            ref={detailScrollRef}
            onScroll={handlePanelScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/60"
          >
            <form onSubmit={handleWizardSubmit} className="space-y-6 max-w-4xl">
              
              {/* SECTION 1: Customer Profile */}
              <div id="sec-identity" className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 scroll-mt-6">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="store" className="w-3.5 h-3.5 text-emerald-600" /> 1. Customer Profile &amp; Store Info
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Store Name *</label>
                    <input
                      type="text"
                      value={wizardForm.name}
                      onChange={e => handleNameChange(e.target.value)}
                      placeholder="e.g. Saraswathi Silks"
                      required
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer Code (Short Slug / ID) *</label>
                    <input
                      type="text"
                      value={wizardForm.customerCode}
                      onChange={e => setWizardForm({ ...wizardForm, customerCode: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                      placeholder="e.g. saraswat-tx or apx-wa01"
                      required
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold lowercase rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Owner Admin Email *</label>
                    <input
                      type="email"
                      value={wizardForm.ownerEmail || wizardForm.pendingOwnerEmail || ''}
                      onChange={e => setWizardForm({ ...wizardForm, ownerEmail: e.target.value, pendingOwnerEmail: e.target.value })}
                      placeholder="admin@store.com"
                      required
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Initial Admin Password *</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleGenerateOwnerPassword}
                          className="text-[10px] font-bold text-[#65a30d] hover:underline cursor-pointer"
                        >
                          ⚡ Auto-Generate
                        </button>
                        {wizardForm.ownerPassword && (
                          <CopyBtn text={wizardForm.ownerPassword} label="Copy" className="text-[10px] py-0.5 px-1.5" />
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={showOwnerPassword ? "text" : "password"}
                        value={wizardForm.ownerPassword || ''}
                        onChange={e => setWizardForm({ ...wizardForm, ownerPassword: e.target.value })}
                        placeholder={wizardMode === 'edit' ? '(Leave blank to keep unchanged)' : 'e.g. Renic@2026'}
                        required={wizardMode === 'create'}
                        className="w-full pl-3 pr-8 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
                        title={showOwnerPassword ? "Hide password" : "Show password"}
                      >
                        {showOwnerPassword ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Owner Contact Phone *</label>
                    <input
                      type="text"
                      value={wizardForm.ownerMobile || wizardForm.contact || ''}
                      onChange={e => setWizardForm({ ...wizardForm, ownerMobile: e.target.value, contact: e.target.value, pendingOwnerMobile: e.target.value })}
                      placeholder="9876543210"
                      required
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Plan Tier</label>
                      <Link to="/plan-tiers" className="text-[10px] font-bold text-[#65a30d] hover:underline">
                        + Manage Plans
                      </Link>
                    </div>
                    <select
                      value={wizardForm.planTier}
                      disabled={wizardForm.isTrial}
                      onChange={e => {
                        const tierVal = e.target.value;
                        const matchingTier = availablePlanTiers.find(p => p.code === tierVal || p.name === tierVal);
                        if (matchingTier) {
                          const perms = {};
                          if (matchingTier.screenPermissions && Object.keys(matchingTier.screenPermissions).length > 0) {
                            Object.assign(perms, matchingTier.screenPermissions);
                          } else if (Array.isArray(matchingTier.allowedScreens)) {
                            appFeaturesList.forEach(f => {
                              perms[f.key] = matchingTier.allowedScreens.includes(f.key);
                            });
                          }
                          setWizardForm({
                            ...wizardForm,
                            planTier: matchingTier.code,
                            billingCycle: matchingTier.billingCycle || wizardForm.billingCycle,
                            screenPermissions: perms
                          });
                        } else {
                          setWizardForm({ ...wizardForm, planTier: tierVal });
                        }
                      }}
                      className={`w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white ${wizardForm.isTrial ? 'opacity-60 bg-slate-100' : ''}`}
                    >
                      <option value="basic">Standard Basic Tier</option>
                      <option value="pro">Professional (Pro) Tier</option>
                      <option value="enterprise">Enterprise Tier</option>
                      {availablePlanTiers
                        .filter(p => !wizardForm.softwareProduct || p.appCode === wizardForm.softwareProduct)
                        .map(plan => (
                          <option key={plan._id || plan.code} value={plan.code}>
                            {plan.name} (₹{plan.price?.toLocaleString()} - {plan.allowedScreens?.length || 0} Screens)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {wizardForm.isTrial ? 'Trial Expiration' : 'License Duration'}
                    </label>
                    {wizardForm.isTrial ? (
                      <div className="w-full px-3 py-1.5 text-xs font-bold rounded border border-amber-300 bg-amber-50 text-amber-900 flex items-center justify-between">
                        <span>⏳ {wizardForm.trialDays || 7} Days Free Trial</span>
                      </div>
                    ) : (
                      <select
                        value={wizardForm.billingCycle}
                        onChange={e => {
                          const cycle = e.target.value;
                          const daysMap = {
                            '1_MONTH': 30,
                            '3_MONTHS': 90,
                            '6_MONTHS': 180,
                            '1_YEAR': 365,
                            'LIFETIME': 3650
                          };
                          setWizardForm({
                            ...wizardForm,
                            billingCycle: cycle,
                            licenseDurationDays: daysMap[cycle] || 90
                          });
                        }}
                        className="w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white"
                      >
                        <option value="1_MONTH">1 Month (Monthly)</option>
                        <option value="3_MONTHS">3 Months (Quarterly)</option>
                        <option value="6_MONTHS">6 Months (Half-Yearly)</option>
                        <option value="1_YEAR">1 Year (Annual)</option>
                        <option value="LIFETIME">Lifetime / Enterprise</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Free Trial Sandbox Provisioning Config */}
                <div className={`p-3.5 rounded-xl border transition ${
                  wizardForm.isTrial 
                    ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20' 
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isTrialToggle"
                        checked={Boolean(wizardForm.isTrial)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setWizardForm({
                            ...wizardForm,
                            isTrial: checked,
                            licenseStatus: checked ? 'trial' : 'active',
                            planTier: checked ? 'trial' : 'pro',
                            trialDays: checked ? (wizardForm.trialDays || 7) : 0,
                            licenseDurationDays: checked ? (wizardForm.trialDays || 7) : 90
                          });
                        }}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="isTrialToggle" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                        <span>🧪 Provision as Isolated Free Trial Customer</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-200/80 text-amber-900">
                          Sandbox Mode
                        </span>
                      </label>
                    </div>

                    {wizardForm.isTrial && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-600">Duration:</span>
                        {[3, 5, 7, 14, 30].map(days => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setWizardForm({
                              ...wizardForm,
                              trialDays: days,
                              licenseDurationDays: days
                            })}
                            className={`px-2 py-1 rounded text-xs font-bold transition ${
                              wizardForm.trialDays === days
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                            }`}
                          >
                            {days}d
                          </button>
                        ))}
                        <div className="flex items-center gap-1 ml-1">
                          <input
                            type="number"
                            min="1"
                            max="90"
                            value={wizardForm.trialDays || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              setWizardForm({ ...wizardForm, trialDays: val, licenseDurationDays: val });
                            }}
                            className="w-14 px-1.5 py-0.5 text-xs font-bold rounded border border-amber-300 bg-white text-center"
                            placeholder="Days"
                          />
                          <span className="text-[10px] text-amber-900 font-bold">days</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {wizardForm.isTrial && (
                    <div className="mt-2.5 pt-2 border-t border-amber-200/60 text-[11px] text-amber-900 space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        🛡️ <strong>Physical DB Isolation:</strong> Trial data will be stored in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">renic_trial_{(wizardForm.customerCode || 'client').toLowerCase()}</code>.
                      </p>
                      <p className="text-slate-600 text-[10px]">
                        It will NEVER mix with production data. Once the customer is satisfied, you can 1-click upgrade and clone it directly to production from this Master HQ dashboard.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: Security & OAuth 2.0 */}
              <div id="sec-security" className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 scroll-mt-6">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="key" className="w-3.5 h-3.5 text-[#65a30d]" /> 2. Security &amp; OAuth 2.0 Credentials
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleGenerateNewSecret()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
                  >
                    <Icon name="refresh" className="w-3.5 h-3.5" />
                    ⚡ Generate from Customer ID {wizardForm.customerCode ? `(${wizardForm.customerCode})` : ''}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      OAuth Client ID 
                      {wizardForm.customerCode && (
                        <span className="ml-1 text-[10px] text-emerald-600 font-normal">
                          (Derived from: {wizardForm.customerCode})
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={wizardForm.clientId}
                        onChange={e => setWizardForm({ ...wizardForm, clientId: e.target.value })}
                        placeholder="Click Generate or enter ID"
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-slate-50"
                      />
                      <CopyBtn text={wizardForm.clientId} showLabel={false} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">OAuth Client Secret</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type={showWizardSecret ? 'text' : 'password'}
                        value={wizardForm.clientSecret}
                        onChange={e => setWizardForm({ ...wizardForm, clientSecret: e.target.value })}
                        placeholder="Click Generate or enter Secret"
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWizardSecret(!showWizardSecret)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs text-slate-600 font-bold"
                      >
                        {showWizardSecret ? 'Hide' : 'Show'}
                      </button>
                      <CopyBtn text={wizardForm.clientSecret} showLabel={false} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Enforce Zero-Trust OAuth 2.0</span>
                    <p className="text-[11px] text-slate-500">Requires bearer token on all API and reverse-proxy requests</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardForm({ ...wizardForm, oauthEnforced: !wizardForm.oauthEnforced })}
                    className={`px-3 py-1 text-xs font-bold rounded transition ${
                      wizardForm.oauthEnforced ? 'bg-[#84cc16] text-[#0f172a]' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {wizardForm.oauthEnforced ? 'YES' : 'NO'}
                  </button>
                </div>
              </div>

              {/* SECTION 3: App & Smart Routing */}
              <div id="sec-routing" className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 scroll-mt-6">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="network" className="w-3.5 h-3.5 text-indigo-600" /> 3. Application &amp; Reverse Proxy Routing
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Software Product Application</label>
                    <select
                      value={wizardForm.softwareProduct}
                      onChange={e => {
                        const val = e.target.value;
                        const targetApp = apps.find(a => a.appCode === val);
                        const defaultMode = targetApp?.solutionModes?.[0];
                        const defaultBt = defaultMode?.businessTypes?.[0];
                        const defaultModes = defaultMode ? [defaultMode.modeKey] : [];
                        const appFeatures = getAppFeatures(targetApp);
                        const perms = {};
                        if (defaultMode?.defaultScreenKeys && defaultMode.defaultScreenKeys.length > 0) {
                          appFeatures.forEach(f => {
                            perms[f.key] = defaultMode.defaultScreenKeys.includes(f.key);
                          });
                        } else {
                          appFeatures.forEach(f => { perms[f.key] = true; });
                        }
                        setWizardForm({
                          ...wizardForm,
                          softwareProduct: val,
                          solutionModes: defaultModes,
                          solutionMode: defaultModes.join(','),
                          businessType: defaultBt?.typeKey || '',
                          customTerminology: defaultBt || {},
                          screenPermissions: perms
                        });
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white"
                    >
                      {assignableApps.length === 0 ? (
                        <option value="">Loading applications…</option>
                      ) : (
                        assignableApps.map((a) => (
                          <option key={a.appCode} value={a.appCode}>
                            {a.name || a.appCode}
                            {a.urlSlug ? ` (${a.urlSlug})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                </div>

                <div className="space-y-3">
                  {/* 0. Cloud / Vercel Production Tenant URL */}
                  <div className="p-3 bg-emerald-50/80 border border-emerald-300 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                        🚀 Vercel / Cloud URL (Give this to Client):
                      </span>
                      <span className="text-[10px] text-emerald-800 font-semibold px-2 py-0.5 bg-emerald-100 rounded-full">Share with Store</span>
                    </div>
                    <p className="text-[11px] text-emerald-900 leading-relaxed">
                      This is the live URL for your client. Opening this URL connects directly to their isolated database:
                    </p>
                    <div className="font-mono text-[11px] text-emerald-950 font-bold bg-white p-2 rounded border border-emerald-300 flex items-center justify-between gap-2">
                      <span className="truncate">{cloudTenantUrl}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CopyBtn text={cloudTenantUrl} label="Copy Client URL" />
                        {wizardForm.ownerMobile && (
                          <a
                            href={`https://wa.me/${String(wizardForm.ownerMobile).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello, your store software is active! Click here to login:\n${cloudTenantUrl}\n\nLogin Mobile: ${wizardForm.ownerMobile}\nPassword: 123456`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            WhatsApp 💬
                          </a>
                        )}
                        <a
                          href={cloudTenantUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                        >
                          Open ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* 1. Production VPS Route */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        🌐 Production Multi-Tenant VPS Route:
                      </span>
                      <span className="text-[10px] text-slate-400">Requires DNS wildcard (*.renictech.com)</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-900 font-bold bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
                      <span className="truncate">{computedSmartUrl}</span>
                      <div className="flex items-center gap-1.5">
                        <CopyBtn text={computedSmartUrl} label="Copy VPS Route" />
                        <a
                          href={computedSmartUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                        >
                          Open ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* 2. Localhost & lvh.me Development Loopback */}
                  <div className="p-3 bg-lime-50/70 border border-lime-200 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lime-900 flex items-center gap-1.5">
                        💻 Local Development &amp; Loopback URLs (Ready Now):
                      </span>
                      <span className="text-[10px] text-lime-700 font-semibold">Works immediately on 127.0.0.1</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="bg-white p-2 rounded border border-lime-200 flex flex-col justify-between">
                        <div className="mb-1.5">
                          <span className="text-[10px] text-slate-400 block font-sans">Direct Localhost:</span>
                          <span className="font-mono text-[11px] text-lime-950 font-bold truncate block">{localDevUrl}</span>
                        </div>
                        <a
                          href={localDevUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 text-center text-[11px] font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-2xs"
                        >
                          Open Direct 🚀
                        </a>
                      </div>

                      <div className="bg-white p-2 rounded border border-lime-200 flex flex-col justify-between">
                        <div className="mb-1.5">
                          <span className="text-[10px] text-slate-400 block font-sans">Tenant Direct URL:</span>
                          <span className="font-mono text-[11px] text-lime-950 font-bold truncate block">{localLvhUrl}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CopyBtn text={localLvhUrl} showLabel={false} className="!p-1" />
                          <a
                            href={localLvhUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-center px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                          >
                            Open ↗
                          </a>
                        </div>
                      </div>

                      <div className="bg-white p-2 rounded border border-lime-200 flex flex-col justify-between">
                        <div className="mb-1.5">
                          <span className="text-[10px] text-slate-400 block font-sans">Renic Soft Gateway (:5050):</span>
                          <span className="font-mono text-[11px] text-lime-950 font-bold truncate block">{localGatewayUrl}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CopyBtn text={localGatewayUrl} showLabel={false} className="!p-1" />
                          <a
                            href={localGatewayUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-center px-2 py-1 text-[11px] font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                          >
                            Gateway ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Cloudflare Tunnel Integration */}
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        ⚡ Cloudflare Tunnel (cloudflared installed):
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold">For public HTTPS testing</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Run this in PowerShell / Command Prompt to create an instant public HTTPS tunnel for this customer instance:
                    </p>
                    <div className="font-mono text-[11px] text-amber-950 font-bold bg-white p-2 rounded border border-amber-200 flex items-center justify-between">
                      <span className="truncate">{cloudflareTunnelCmd}</span>
                      <CopyBtn text={cloudflareTunnelCmd} label="Copy Command" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Feature Governance */}
              <div id="sec-screens" className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 scroll-mt-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Icon name="dashboard" className="w-3.5 h-3.5 text-amber-600" /> 4. Feature Governance &amp; Screen Toggles
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {appFeaturesList.filter(f => Boolean(wizardForm.screenPermissions?.[f.key])).length} of {appFeaturesList.length} screens enabled for this client
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetToModeScreenDefaults}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-2 py-1 rounded bg-indigo-50 border border-indigo-100"
                      title="Reset screens to match the selected Solution Mode(s)"
                    >
                      ↺ Mode Defaults
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allOff = {};
                        appFeaturesList.forEach(f => { allOff[f.key] = false; });
                        setWizardForm({ ...wizardForm, screenPermissions: allOff });
                      }}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:underline px-2 py-1 rounded bg-slate-100"
                    >
                      Deselect All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = {};
                        appFeaturesList.forEach(f => { allOn[f.key] = true; });
                        setWizardForm({ ...wizardForm, screenPermissions: allOn });
                      }}
                      className="text-[11px] font-bold text-[#65a30d] hover:underline px-2 py-1 rounded bg-lime-50 border border-lime-200"
                    >
                      Select All 100%
                    </button>
                  </div>
                </div>

                {/* Dynamic Solution Mode & Business Type Governance */}
                <div className="p-4 bg-gradient-to-r from-slate-50 via-emerald-50/20 to-lime-50/30 border border-slate-200 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="text-base">🏢</span> Solution Modes &amp; Operational Profiles:
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Select one or multiple operational modes (checkboxes). Screens below will automatically configure based on your selections.
                      </span>
                    </div>
                    <Link to="/application-hub" className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 flex-shrink-0">
                      ⚙️ Manage in Application Hub ↗
                    </Link>
                  </div>

                  {/* Mode Selection Checkbox Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {(currentWizardApp?.solutionModes || []).map((m) => {
                      const isChecked = activeSolutionModesList.includes(m.modeKey);
                      return (
                        <div
                          key={m.modeKey}
                          onClick={() => toggleSolutionMode(m.modeKey)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition select-none flex flex-col justify-between ${
                            isChecked
                              ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-2xs flex-shrink-0"
                                  style={{ backgroundColor: m.badgeColor || '#10b981' }}
                                >
                                  <Icon name={m.icon ? m.icon.toLowerCase() : 'box'} className="w-3.5 h-3.5" />
                                </span>
                                <div>
                                  <span className="font-bold text-slate-900 text-xs block leading-tight">
                                    {m.displayName || m.name || m.modeKey}
                                  </span>
                                  <span className="text-[10px] text-emerald-700 font-bold">
                                    {m.defaultScreenKeys?.length || 0} screens
                                  </span>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // Handled by outer container onClick
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer pointer-events-none mt-0.5 flex-shrink-0"
                              />
                            </div>
                            {m.description && (
                              <p className="text-[10px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                                {m.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(!currentWizardApp?.solutionModes || currentWizardApp.solutionModes.length === 0) && (
                    <p className="text-[11px] text-amber-600 font-medium">
                      ⚠️ No solution modes configured for this application yet. Manage them in Application Hub.
                    </p>
                  )}

                  {/* Industry Business Type Template Selection (if active mode has business types) */}
                  {(() => {
                    const availableBts = (currentWizardApp?.solutionModes || [])
                      .filter(m => activeSolutionModesList.includes(m.modeKey))
                      .flatMap(m => m.businessTypes || []);

                    if (availableBts.length === 0) return null;

                    return (
                      <div className="pt-3 border-t border-slate-200/70 space-y-3">
                        <div className="max-w-md">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Industry Business Type Template (Terminology &amp; Action Buttons)
                          </label>
                          <select
                            value={wizardForm.businessType || ''}
                            onChange={(e) => {
                              const btKey = e.target.value;
                              const selectedBt = availableBts.find(b => b.typeKey === btKey) || {};
                              setWizardForm({
                                ...wizardForm,
                                businessType: btKey,
                                customTerminology: selectedBt || {}
                              });
                              if (selectedBt.displayName) {
                                showSnackbar(`Applied terminology for "${selectedBt.displayName}"`, 'info');
                              }
                            }}
                            className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">-- Default / Generic Terminology --</option>
                            {availableBts.map(b => (
                              <option key={b.typeKey} value={b.typeKey}>
                                {b.displayName || b.name || b.typeKey}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Live Terminology & Custom Button Preview */}
                        {wizardForm.customTerminology && (wizardForm.customTerminology.displayName || wizardForm.customTerminology.staffLabel) && (
                          <div className="p-3 bg-white rounded-lg border border-emerald-200/80 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
                                <span>✨</span> Live Dynamic UI &amp; Action Button Text Preview:
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                                {wizardForm.customTerminology.displayName || wizardForm.businessType}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Add Service Button</span>
                                <span className="font-bold text-emerald-700 text-xs truncate block">
                                  ➕ {wizardForm.customTerminology.addServiceBtnText || `Add ${wizardForm.customTerminology.serviceLabel || 'Service'}`}
                                </span>
                              </div>

                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Add Staff Button</span>
                                <span className="font-bold text-indigo-700 text-xs truncate block">
                                  ➕ {wizardForm.customTerminology.addStaffBtnText || `Add ${wizardForm.customTerminology.staffLabel || 'Staff'}`}
                                </span>
                              </div>

                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase">Booking Action Button</span>
                                <span className="font-bold text-amber-700 text-xs truncate block">
                                  📅 {wizardForm.customTerminology.bookingActionLabel || 'New Walk-In Booking'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-[11px] text-slate-600 font-medium pt-1 border-t border-slate-100">
                              <span>Staff: <strong className="text-slate-900">{wizardForm.customTerminology.staffLabel || 'Doctor'}</strong></span>
                              <span>Service: <strong className="text-slate-900">{wizardForm.customTerminology.serviceLabel || 'Treatment'}</strong></span>
                              <span>Client: <strong className="text-slate-900">{wizardForm.customTerminology.clientLabel || 'Patient'}</strong></span>
                              <span>Slot: <strong className="text-slate-900">{wizardForm.customTerminology.defaultSlotDuration || 30} mins</strong></span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Screens Checklist Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {appFeaturesList.map((feat) => {
                    const isEnabled = Boolean(wizardForm.screenPermissions?.[feat.key]);
                    return (
                      <label
                        key={feat.key}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                          isEnabled
                            ? 'bg-lime-50/40 border-lime-300 font-bold text-slate-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <span className={`block ${isEnabled ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                            {feat.label}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{feat.key}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            setWizardForm({
                              ...wizardForm,
                              screenPermissions: {
                                ...wizardForm.screenPermissions,
                                [feat.key]: e.target.checked
                              }
                            });
                          }}
                          className="rounded text-[#65a30d] focus:ring-[#84cc16] w-4 h-4 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>

                {/* SECTION 4.1: Master Branch Topology & Enterprise Feature Entitlements (Master Level) */}
                <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-lime-400 uppercase tracking-wider flex items-center gap-2">
                        <span>🏛️</span> Master Branch Governance &amp; Enterprise Entitlements
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Strictly enforced by Renic Soft Master HQ over-the-air. Downstream client cannot self-enable.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-lime-500/20 text-lime-400 border border-lime-500/30">
                      MASTER GOVERNED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Branch Mode */}
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Branch Topology Mode</label>
                      <select
                        value={wizardForm.branchConfig?.mode || 'SINGLE'}
                        onChange={(e) => setWizardForm({
                          ...wizardForm,
                          branchConfig: {
                            ...(wizardForm.branchConfig || {}),
                            mode: e.target.value,
                            maxBranches: e.target.value === 'SINGLE' ? 1 : Math.max(2, wizardForm.branchConfig?.maxBranches || 3)
                          }
                        })}
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded bg-slate-900 text-white border border-slate-700 focus:outline-none focus:border-lime-500"
                      >
                        <option value="SINGLE">Single Branch (Main Showroom)</option>
                        <option value="MULTI">Multi-Branch Network (HQ + Branches)</option>
                      </select>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {wizardForm.branchConfig?.mode === 'MULTI' ? 'Wildcard HQ access + sandboxed sub-branch URLs' : 'Single store kiosk mode'}
                      </span>
                    </div>

                    {/* Max Branches Quota */}
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Max Branches Quota</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        disabled={wizardForm.branchConfig?.mode === 'SINGLE'}
                        value={wizardForm.branchConfig?.maxBranches || 1}
                        onChange={(e) => setWizardForm({
                          ...wizardForm,
                          branchConfig: {
                            ...(wizardForm.branchConfig || {}),
                            maxBranches: parseInt(e.target.value, 10) || 1
                          }
                        })}
                        className="w-full px-2.5 py-1.5 text-xs font-bold rounded bg-slate-900 text-white border border-slate-700 focus:outline-none focus:border-lime-500 disabled:opacity-50"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Licensed branch limit under single client ID
                      </span>
                    </div>

                    {/* Inter-Branch Gold Transfer */}
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700 flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-300 block">Inter-Branch Vault Transit</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Allow gold transfers between branches</span>
                      </div>
                      <button
                        type="button"
                        disabled={wizardForm.branchConfig?.mode === 'SINGLE'}
                        onClick={() => setWizardForm({
                          ...wizardForm,
                          branchConfig: {
                            ...(wizardForm.branchConfig || {}),
                            allowInterBranchTransfer: !wizardForm.branchConfig?.allowInterBranchTransfer
                          }
                        })}
                        className={`w-full py-1 text-xs font-bold rounded mt-2 transition ${
                          wizardForm.branchConfig?.allowInterBranchTransfer ? 'bg-lime-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                        } disabled:opacity-40`}
                      >
                        {wizardForm.branchConfig?.allowInterBranchTransfer ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                  </div>

                  {/* Master Feature Gates */}
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-bold text-slate-300 block mb-2">Licensed Advanced Desks:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {/* Partial Gold Release Gate */}
                      <label className="flex items-center justify-between p-2.5 rounded bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600">
                        <div>
                          <span className="font-bold text-white block">Partial Gold Release Desk</span>
                          <span className="text-[10px] text-slate-400">Release selected items on partial payment</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(wizardForm.featurePermissions?.allowPartialRelease)}
                          onChange={(e) => setWizardForm({
                            ...wizardForm,
                            featurePermissions: {
                              ...(wizardForm.featurePermissions || {}),
                              allowPartialRelease: e.target.checked
                            }
                          })}
                          className="w-4 h-4 rounded text-lime-500 focus:ring-lime-400 cursor-pointer ml-2"
                        />
                      </label>

                      {/* Re-Pledge Bank Refinance Gate */}
                      <label className="flex items-center justify-between p-2.5 rounded bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600">
                        <div>
                          <span className="font-bold text-white block">Bank Re-Pledge Desk</span>
                          <span className="text-[10px] text-slate-400">Overdraft &amp; bank custody tracking</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(wizardForm.featurePermissions?.allowRePledge)}
                          onChange={(e) => setWizardForm({
                            ...wizardForm,
                            featurePermissions: {
                              ...(wizardForm.featurePermissions || {}),
                              allowRePledge: e.target.checked
                            }
                          })}
                          className="w-4 h-4 rounded text-lime-500 focus:ring-lime-400 cursor-pointer ml-2"
                        />
                      </label>

                      {/* Anti-Fraud Blacklist Shield Gate */}
                      <label className="flex items-center justify-between p-2.5 rounded bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-600">
                        <div>
                          <span className="font-bold text-white block">Fraud &amp; Stolen Gold Shield</span>
                          <span className="text-[10px] text-slate-400">National pawn default blacklist</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(wizardForm.featurePermissions?.enableBlacklistShield)}
                          onChange={(e) => setWizardForm({
                            ...wizardForm,
                            featurePermissions: {
                              ...(wizardForm.featurePermissions || {}),
                              enableBlacklistShield: e.target.checked
                            }
                          })}
                          className="w-4 h-4 rounded text-lime-500 focus:ring-lime-400 cursor-pointer ml-2"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4B (TEXTILE_POS ONLY): Field-Level Visibility & Required Control */}
              {wizardForm.softwareProduct === 'TEXTILE_POS' && (
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="dashboard" className="w-3.5 h-3.5 text-amber-600" /> 4B. Field Visibility &amp; Required Control
                  </h3>
                  <p className="text-[11px] text-slate-500">Control which fields appear and which are required on POS screens. Changes apply per customer.</p>

                  {/* Stock Import — Barcode Strategy */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-slate-800 mb-1">Stock Import</h4>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Decide how barcodes are minted when an Excel/CSV row has a quantity.
                    </p>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Barcode Mode</label>
                    <select
                      value={wizardForm.fieldConfig?.stockImport?.barcodeMode?.value || 'perUnit'}
                      onChange={(e) =>
                        setWizardForm({
                          ...wizardForm,
                          fieldConfig: {
                            ...wizardForm.fieldConfig,
                            stockImport: {
                              ...wizardForm.fieldConfig?.stockImport,
                              barcodeMode: { value: e.target.value }
                            }
                          }
                        })
                      }
                      className="w-full sm:max-w-xs border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-lime-400 focus:border-lime-500"
                    >
                      <option value="perUnit">One item = one barcode (qty 10 → 10 SKUs)</option>
                      <option value="singleBarcode">Single barcode holds quantity (qty 10 → 1 SKU)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      Blank product name falls back to the generated SKU as the product name.
                    </p>
                  </div>

                  {[
                    {
                      screenKey: 'billing',
                      label: 'Billing Desk',
                      fields: [
                        { key: 'excelImport', label: 'Excel Import Button' }
                      ]
                    },
                    {
                      screenKey: 'stockAdd',
                      label: 'Add Stock (Manual)',
                      fields: [
                        { key: 'supplier', label: 'Supplier' },
                        { key: 'category', label: 'Fabric / Category' },
                        { key: 'subCategory', label: 'Sub Category' },
                        { key: 'productName', label: 'Product Name' }
                      ]
                    }
                  ].map((screen) => (
                    <div key={screen.screenKey} className="border border-slate-200 rounded-lg p-3">
                      <h4 className="text-xs font-bold text-slate-800 mb-2">{screen.label}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {screen.fields.map((field) => {
                          const cfg = wizardForm.fieldConfig?.[screen.screenKey]?.[field.key] || { visible: true, required: false };
                          return (
                            <div key={field.key} className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50">
                              <span className="text-xs font-bold text-slate-700">{field.label}</span>
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={cfg.visible !== false}
                                    onChange={(e) => {
                                      setWizardForm({
                                        ...wizardForm,
                                        fieldConfig: {
                                          ...wizardForm.fieldConfig,
                                          [screen.screenKey]: {
                                            ...wizardForm.fieldConfig?.[screen.screenKey],
                                            [field.key]: { ...cfg, visible: e.target.checked }
                                          }
                                        }
                                      });
                                    }}
                                    className="rounded text-[#65a30d] focus:ring-[#84cc16] w-3.5 h-3.5"
                                  />
                                  Visible
                                </label>
                                <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={cfg.required === true}
                                    onChange={(e) => {
                                      setWizardForm({
                                        ...wizardForm,
                                        fieldConfig: {
                                          ...wizardForm.fieldConfig,
                                          [screen.screenKey]: {
                                            ...wizardForm.fieldConfig?.[screen.screenKey],
                                            [field.key]: { ...cfg, required: e.target.checked }
                                          }
                                        }
                                      });
                                    }}
                                    className="rounded text-[#65a30d] focus:ring-[#84cc16] w-3.5 h-3.5"
                                  />
                                  Required
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SECTION 4B (WA_INSTA_AUTOMATION ONLY): WhatsApp Sender Engine & Throttle Governance */}
              {wizardForm.softwareProduct === 'WA_INSTA_AUTOMATION' && (
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="chat" className="w-3.5 h-3.5 text-emerald-600" /> 4B. WhatsApp Sender Engine &amp; Dispatch Governance
                  </h3>
                  <p className="text-[11px] text-slate-500">Centrally assign the WhatsApp engine transport and rate limiting for this client instance.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Sender Engine Mode</label>
                      <select
                        value={wizardForm.whatsappSenderMode || 'DOCKER'}
                        onChange={(e) => setWizardForm({ ...wizardForm, whatsappSenderMode: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-lime-400 focus:border-lime-500"
                      >
                        <option value="DOCKER">🐳 Docker WAHA (Local QR Session Engine)</option>
                        <option value="META">⚡ Official Meta WhatsApp Cloud API</option>
                      </select>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {wizardForm.whatsappSenderMode === 'DOCKER'
                          ? 'Client connects via WhatsApp Web QR scan on local container. Free outgoing messages.'
                          : 'Client connects using Meta Developer credentials (Graph API). Pay-per-conversation.'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Docker Broadcast Throttle Delay (Seconds)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={wizardForm.dockerThrottleSeconds || 6}
                        onChange={(e) => setWizardForm({ ...wizardForm, dockerThrottleSeconds: Number(e.target.value) || 6 })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-lime-400 focus:border-lime-500"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Pause duration between each outgoing bulk broadcast message to prevent WhatsApp bans.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 5: Engine & Diagnostics */}
              <div id="sec-deployment" className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 scroll-mt-6">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="license" className="w-3.5 h-3.5 text-teal-600" /> 5. Engine Health &amp; Pre-Flight Probe
                </h3>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Pre-Flight Diagnostic Verification</span>
                    <p className="text-[11px] text-slate-500">Probe port connectivity, database isolation, and routing</p>
                  </div>
                  <button
                    type="button"
                    onClick={runPreflightCheck}
                    disabled={preflightLoading}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition flex items-center gap-1"
                  >
                    <Icon name="refresh" className={`w-3.5 h-3.5 ${preflightLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    {preflightLoading ? 'Probing...' : 'Run Diagnostics'}
                  </button>
                </div>

                {preflightResults && (
                  <div className={`p-3.5 rounded-xl border space-y-3 ${
                    preflightResults.passed 
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                      : (preflightResults.checks?.frontendReachable || preflightResults.checks?.backendReachable)
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                        : 'bg-rose-50/80 border-rose-200 text-rose-950'
                  }`}>
                    {/* Header Banner */}
                    <div className="flex items-center justify-between pb-2 border-b border-black/5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          preflightResults.passed ? 'bg-emerald-500 animate-pulse' : (preflightResults.checks?.frontendReachable || preflightResults.checks?.backendReachable) ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        <span className="font-bold text-xs">
                          {preflightResults.passed 
                            ? 'All Diagnostic Probes Passed — Instance Healthy' 
                            : 'Pre-Flight Diagnostic Warnings Detected'}
                        </span>
                      </div>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        preflightResults.passed 
                          ? 'bg-emerald-600 text-white' 
                          : (preflightResults.checks?.frontendReachable || preflightResults.checks?.backendReachable)
                            ? 'bg-amber-600 text-white'
                            : 'bg-rose-600 text-white'
                      }`}>
                        {preflightResults.healthScore ? `${preflightResults.healthScore}% HEALTH` : (preflightResults.passed ? '100% HEALTH' : '0% HEALTH')}
                      </span>
                    </div>

                    {/* Detailed Probe Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Frontend Server Check */}
                      <div className="bg-white/80 p-2.5 rounded-lg border border-black/5 flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">
                          {preflightResults.checks?.frontendReachable ? '🟢' : '🔴'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold block text-slate-800">
                            Frontend Dev Server (Port {currentWizardPort})
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {preflightResults.checks?.frontendReachable 
                              ? `Active • ${preflightResults.checks?.frontendLatencyMs || 0}ms latency` 
                              : `Offline • Port ${currentWizardPort} refused connection`}
                          </span>
                        </div>
                      </div>

                      {/* Backend Server Check */}
                      <div className="bg-white/80 p-2.5 rounded-lg border border-black/5 flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">
                          {preflightResults.checks?.backendReachable ? '🟢' : '🔴'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold block text-slate-800">
                            Backend API Engine (Port {currentWizardBackendPort})
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {preflightResults.checks?.backendReachable 
                              ? `Operational • ${preflightResults.checks?.backendLatencyMs || 0}ms latency` 
                              : `Offline • Port ${currentWizardBackendPort} unreachable`}
                          </span>
                        </div>
                      </div>

                      {/* Subdomain Uniqueness */}
                      <div className="bg-white/80 p-2.5 rounded-lg border border-black/5 flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">
                          {preflightResults.checks?.subdomainUnique ? '🟢' : '🔴'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold block text-slate-800">
                            Customer Identifier [{cleanCustomerCode.toUpperCase()}]
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {preflightResults.checks?.subdomainUnique 
                              ? 'Unique & Available for Dedicated Routing' 
                              : (preflightResults.checks?.subdomainMessage || 'Conflict with existing customer')}
                          </span>
                        </div>
                      </div>

                      {/* Master Gateway Reverse Proxy */}
                      <div className="bg-white/80 p-2.5 rounded-lg border border-black/5 flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5">🟢</span>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold block text-slate-800">
                            Renic Soft Gateway (:5050)
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Multi-tenant reverse proxy online &amp; ready
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actionable Error Guidance */}
                    {!preflightResults.passed && (!preflightResults.checks?.frontendReachable || !preflightResults.checks?.backendReachable) && (
                      <div className="p-2 bg-amber-100/70 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-relaxed">
                        <strong>💡 How to resolve offline status:</strong> Make sure the target application dev server is running (e.g., in <code>d:\Development\{wizardForm.softwareProduct === 'SIMPLE_BILLING' ? 'Simple_Billing' : (wizardForm.softwareProduct === 'PAWN_BROKING' ? 'pawn_broking' : (wizardForm.softwareProduct === 'TEXTILE_POS' ? 'TextilePOS' : 'WA_INSTA_AUTOMATION'))}</code> run <code>npm run dev</code>).
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* 4. Action Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setWizardOpen(false)}
              className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleWizardSubmit}
              disabled={wizardSubmitting}
              className="px-5 py-1.5 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded shadow-xs transition flex items-center gap-1.5"
            >
              {wizardSubmitting ? (
                <>
                  <Icon name="refresh" className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Save & Push OTA'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============ NEW INSTANCE CREDENTIAL HANDOVER ============
          setCreatedCreds() was populated on create but never rendered, so the
          operator had no way to see the clientId/clientSecret/DB name that
          were actually provisioned. This modal is that missing handover. */}
      {createdCreds && (
        <Modal
          open
          onClose={() => { setCreatedCreds(null); setRevealSecret(false); }}
          title="Instance launched — credential handover"
          maxWidth="max-w-xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText([
                    `Customer: ${createdCreds.clientName || '-'} (${createdCreds.customerCode || '-'})`,
                    `Portal URL: ${createdCreds.hostingUrl || '-'}`,
                    `Database: ${createdCreds.dbName || '-'}`,
                    `Client ID: ${createdCreds.clientId || '-'}`,
                    `Client Secret: ${createdCreds.clientSecret || '-'}`,
                    `Admin Email: ${createdCreds.email || '-'}`,
                    `Initial Password: ${createdCreds.password || '-'}`,
                    `Owner Mobile: ${createdCreds.mobile || '-'}`
                  ].join('\n'));
                  showSnackbar('All credentials copied to clipboard', 'success');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition"
              >
                Copy everything
              </button>
              <button
                type="button"
                onClick={() => { setCreatedCreds(null); setRevealSecret(false); }}
                className="px-5 py-2 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded shadow-xs transition"
              >
                Done
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 leading-relaxed">
              Copy these now and hand them to the customer once. The secret and password are not
              retrievable from this screen after you close it.
            </div>

            <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {[
                ['Customer', createdCreds.clientName, false],
                ['Customer code', createdCreds.customerCode, false],
                ['Portal URL', createdCreds.hostingUrl, true],
                ['Database', createdCreds.dbName, true],
                ['Admin Email', createdCreds.email, true],
                ['Initial Password', createdCreds.password, true],
                ['Client ID', createdCreds.clientId, true],
                ['Owner mobile', createdCreds.mobile, false]
              ].map(([label, value, copyable]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="w-32 shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </dt>
                  <dd className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <span className="break-all text-right font-mono text-xs text-slate-800">{value || '—'}</span>
                    {copyable && <CopyBtn text={value || ''} showLabel={false} className="!p-1.5" />}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Client secret</div>
                  <div className="mt-1 break-all font-mono text-xs text-slate-800">
                    {revealSecret ? (createdCreds.clientSecret || '—') : '••••••••••••••••••••••••'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRevealSecret(v => !v)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
                  >
                    {revealSecret ? 'Hide' : 'Reveal'}
                  </button>
                  <CopyBtn text={createdCreds.clientSecret || ''} showLabel={false} className="!p-1.5" />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ============ CONVERT TRIAL TO PRODUCTION MODAL ============ */}
      {convertModalOpen && clientToConvert && (
        <Modal
          open={convertModalOpen}
          onClose={() => { setConvertModalOpen(false); setClientToConvert(null); }}
          title="⭐ Upgrade & Convert Trial to Dedicated Production"
          maxWidth="max-w-lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => { setConvertModalOpen(false); setClientToConvert(null); }}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConvertTrialSubmit}
                disabled={convertSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs transition flex items-center gap-1.5"
              >
                {convertSubmitting ? (
                  <>
                    <Icon name="refresh" className="w-3.5 h-3.5 animate-spin" /> Migrating Data...
                  </>
                ) : (
                  '🚀 Upgrade & Migrate to Production'
                )}
              </button>
            </>
          }
        >
          <form onSubmit={handleConvertTrialSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-amber-900 flex items-center justify-between">
                <span>Customer: {clientToConvert.name}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-amber-200 rounded font-bold">{clientToConvert.customerCode}</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Current Trial Sandbox: <code className="font-mono font-bold">{clientToConvert.databaseName || `renic_trial_${(clientToConvert.customerCode || '').toLowerCase()}`}</code>
              </p>
              <p className="text-[11px] text-emerald-800 font-medium">
                Target Production DB: <code className="font-mono font-bold">renic_tenant_{(clientToConvert.customerCode || '').toLowerCase()}</code>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Production Plan Tier *</label>
                <select
                  value={convertForm.planTier}
                  onChange={e => setConvertForm({ ...convertForm, planTier: e.target.value })}
                  required
                  className="w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white"
                >
                  <option value="basic">Standard Basic Tier</option>
                  <option value="pro">Professional (Pro) Tier</option>
                  <option value="enterprise">Enterprise Tier</option>
                  {availablePlanTiers
                    .filter(p => !clientToConvert.softwareProduct || p.appCode === clientToConvert.softwareProduct)
                    .map(plan => (
                      <option key={plan._id || plan.code} value={plan.code}>
                        {plan.name} (₹{plan.price?.toLocaleString()})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Billing Cycle *</label>
                <select
                  value={convertForm.billingCycle}
                  onChange={e => {
                    const cycle = e.target.value;
                    const daysMap = {
                      '1_MONTH': 30,
                      '3_MONTHS': 90,
                      '6_MONTHS': 180,
                      '1_YEAR': 365,
                      'LIFETIME': 3650
                    };
                    setConvertForm({
                      ...convertForm,
                      billingCycle: cycle,
                      subscriptionDays: daysMap[cycle] || 365
                    });
                  }}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white"
                >
                  <option value="1_MONTH">1 Month (Monthly)</option>
                  <option value="3_MONTHS">3 Months (Quarterly)</option>
                  <option value="6_MONTHS">6 Months (Half-Yearly)</option>
                  <option value="1_YEAR">1 Year (Annual)</option>
                  <option value="LIFETIME">Lifetime / Enterprise</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Subscription Days Active</label>
              <input
                type="number"
                min="1"
                max="3650"
                value={convertForm.subscriptionDays}
                onChange={e => setConvertForm({ ...convertForm, subscriptionDays: parseInt(e.target.value, 10) || 365 })}
                required
                className="w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Reference / Notes (Optional)</label>
              <input
                type="text"
                value={convertForm.paymentReference}
                onChange={e => setConvertForm({ ...convertForm, paymentReference: e.target.value })}
                placeholder="e.g. UPI / Bank Ref #981249712"
                className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300"
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-xs space-y-1">
              <p className="font-bold flex items-center gap-1">
                ✅ What happens during conversion:
              </p>
              <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-0.5">
                <li>All trial data (services, staff, appointments, campaigns, chats) will be deep-copied directly into dedicated production DB.</li>
                <li>Customer status upgraded to <strong>ACTIVE</strong> with clean production routing.</li>
                <li>Temporary trial sandbox <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded">renic_trial_*</code> will be safely dropped.</li>
                <li>Instant OTA configuration push broadcasted.</li>
              </ul>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
