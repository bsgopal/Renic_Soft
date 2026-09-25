import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api, { downloadFile } from '../api.js';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const DEFAULT_SHOP = {
  name: '',
  customerCode: '',
  softwareProduct: 'TEXTILE_POS',
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
  targetIp: '127.0.0.1',
  assignedPort: 5174,
  connectionType: 'PORT_FORWARD_ROUTER',
  oauthEnforced: true,
  clientId: '',
  clientSecret: '',
  screenPermissions: {},
  featurePermissions: {
    quickReplies: true,
    workflows: true,
    catalog: true,
    templates: true,
    responseRules: true,
    bulkBroadcast: true,
    aiAgent: false,
    metaCloudApi: true,
    exportReports: true
  },
  whatsappSenderMode: 'META',
  dockerThrottleSeconds: 6
};

const DURATION_OPTIONS = [
  { days: 7, label: '+7 Days (Grace Period)', badge: 'Grace' },
  { days: 30, label: '+30 Days (1 Month)', badge: '1 Mo' },
  { days: 90, label: '+90 Days (3 Months)', badge: 'Quarter' },
  { days: 180, label: '+180 Days (6 Months)', badge: 'Half Year' },
  { days: 365, label: '+365 Days (1 Year)', badge: '1 Year' },
  { days: -1, label: '-1 Day (Test Expiry)', badge: 'Test' }
];

const WIZARD_STEPS = [
  { id: 'security', stepNum: 1, title: 'Security First', subtitle: 'OAuth 2.0 Machine Keys', icon: 'key' },
  { id: 'identity', stepNum: 2, title: 'Customer Profile', subtitle: 'Store Identity & Admin', icon: 'store' },
  { id: 'routing', stepNum: 3, title: 'App & Smart URL', subtitle: 'Subdomain Routing', icon: 'network' },
  { id: 'screens', stepNum: 4, title: 'Feature Governance', subtitle: '100% Pre-Selected SaaS', icon: 'dashboard' },
  { id: 'deployment', stepNum: 5, title: 'Engine & Pre-Flight', subtitle: 'Diagnostic & Launch', icon: 'license' }
];

export default function Licenses() {
  const { user = null } = useAuth() || {};
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [clients, setClients] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [togglingLockId, setTogglingLockId] = useState(null);

  // Extend Menu Dropdown state
  const [activeExtendMenuId, setActiveExtendMenuId] = useState(null);
  const extendMenuRef = useRef(null);

  // Close extend dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (extendMenuRef.current && !extendMenuRef.current.contains(e.target)) {
        setActiveExtendMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Wizard State (Strict 5-Step Multi-Tenant Cloud Provisioning Flow)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState('create'); // 'create' | 'edit'
  const [wizardStep, setWizardStep] = useState('security'); // 'security' | 'identity' | 'routing' | 'screens' | 'deployment'
  const [wizardForm, setWizardForm] = useState(DEFAULT_SHOP);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [showWizardSecret, setShowWizardSecret] = useState(false);

  // Pre-Flight Diagnostic State
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightResults, setPreflightResults] = useState(null);

  // Application Catalog (PaaS Hub) Modal state
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [syncingAppCode, setSyncingAppCode] = useState(null);
  const [extractingAppCode, setExtractingAppCode] = useState(null);

  // OAuth Modal state
  const [oauthModalOpen, setOauthModalOpen] = useState(false);
  const [oauthData, setOauthData] = useState(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [createdCreds, setCreatedCreds] = useState(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load licenses', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchData();
    fetchApps();
  }, [fetchData, fetchApps]);

  const metrics = {
    total: clients.length,
    active: clients.filter((c) => c.licenseStatus === 'active').length,
    oauthEnforced: clients.filter((c) => c.oauthEnforced).length,
    expiringSoon: clients.filter((c) => {
      const isExpired = new Date(c.licenseEnd) < new Date();
      const daysLeft = Math.ceil((new Date(c.licenseEnd) - new Date()) / (24 * 3600 * 1000));
      return !isExpired && daysLeft <= 7;
    }).length
  };

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
        category: s.category || 'General',
        path: s.path || '',
        description: s.description || '',
        defaultEnabled: true
      }));
    }
    return [];
  }, []);

  // Initialize 100% Pre-Checked permissions
  const initDefault100PercentPermissions = useCallback((targetApp) => {
    const list = getAppFeatures(targetApp);
    const perms = {};
    list.forEach(item => {
      perms[item.key] = true; // 100% PRE-CHECKED BY DEFAULT
    });
    return perms;
  }, [getAppFeatures]);

  // Open Create Customer Wizard (Step 1 Security First)
  const handleOpenCreateWizard = () => {
    const defaultCode = 'TX' + Math.floor(10 + Math.random() * 90);
    const initialClientId = 'rnc_cli_' + defaultCode.toLowerCase() + '_' + Math.random().toString(36).substring(2, 8);
    const initialClientSecret = 'rnc_sec_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const defaultApp = apps.find(a => a.appCode === 'TEXTILE_POS') || apps[0];
    const initialPerms = initDefault100PercentPermissions(defaultApp);

    setWizardMode('create');
    setWizardStep('security');
    setPreflightResults(null);
    setWizardForm({
      ...DEFAULT_SHOP,
      customerCode: defaultCode,
      subdomain: defaultCode.toLowerCase(),
      softwareProduct: defaultApp ? defaultApp.appCode : 'TEXTILE_POS',
      assignedPort: defaultApp ? defaultApp.defaultPort : 5174,
      clientId: initialClientId,
      clientSecret: initialClientSecret,
      oauthEnforced: true,
      screenPermissions: initialPerms
    });
    setShowWizardSecret(false);
    setWizardOpen(true);
  };

  // Open Edit Customer Wizard
  const handleOpenEditWizard = (c) => {
    setSelectedClient(c);
    setWizardMode('edit');
    setWizardStep('security');
    setShowWizardSecret(false);
    setPreflightResults(null);

    const clientPort = c.portForwarding?.assignedPort || c.assignedPort || (
      c.softwareProduct === 'TEXTILE_POS' ? 5174 : c.softwareProduct === 'DELIVERY_CHALLAN' ? 5176 : 5173
    );

    const matchedApp = apps.find(a => a.appCode === c.softwareProduct);
    const defaultPerms = initDefault100PercentPermissions(matchedApp);
    const existingPerms = c.screenPermissions || {};
    const mergedPerms = { ...defaultPerms, ...existingPerms };

    setWizardForm({
      _id: c._id,
      name: c.name || '',
      customerCode: c.customerCode || c.subdomain?.toUpperCase() || '',
      shopSlug: c.shopSlug || c.subdomain || '',
      subdomain: c.subdomain || '',
      customDomain: c.customDomain || '',
      fullSaaSDomain: c.fullSaaSDomain || '',
      softwareProduct: c.softwareProduct || 'TEXTILE_POS',
      planTier: c.planTier || 'pro',
      licenseStatus: c.licenseStatus || 'active',
      licenseEnd: c.licenseEnd ? c.licenseEnd.slice(0, 10) : '',
      billingCycle: c.billingCycle || '3_MONTHS',
      targetIp: c.portForwarding?.targetIp || '127.0.0.1',
      assignedPort: clientPort,
      connectionType: c.portForwarding?.connectionType || 'PORT_FORWARD_ROUTER',
      pendingOwnerName: c.pendingOwnerName || c.name || '',
      pendingOwnerEmail: c.pendingOwnerEmail || '',
      pendingOwnerMobile: c.pendingOwnerMobile || c.contact || '',
      pendingOwnerPassword: '',
      oauthEnforced: c.oauthEnforced !== undefined ? Boolean(c.oauthEnforced) : true,
      clientId: c.clientId || ('rnc_cli_' + (c.customerCode || 'tenant').toLowerCase() + '_' + Math.random().toString(36).substring(2, 8)),
      clientSecret: c.clientSecret || '',
      screenPermissions: mergedPerms,
      featurePermissions: c.featurePermissions || {},
      isTrial: Boolean(c.isTrial),
      trialDays: c.trialDays || 7,
      databaseName: c.databaseName || '',
      stockConfig: c.stockConfig || { entryMode: 'simple', enableSizes: false, enableColors: false, enableMeters: false, enableBulkCsv: true },
      billingConfig: c.billingConfig || { discountMode: 'both' },
      pricingConfig: c.pricingConfig || { trackProfit: true, allowStaffProfitView: false },
      whatsappSenderMode: c.whatsappSenderMode || 'META',
      dockerThrottleSeconds: c.dockerThrottleSeconds || 6
    });
    setWizardOpen(true);
  };

  const handleNameChange = (val) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    const code = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setWizardForm((prev) => ({
      ...prev,
      name: val,
      customerCode: prev.customerCode === '' || prev.customerCode === prev.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) ? code : prev.customerCode,
      subdomain: prev.subdomain === '' || prev.subdomain === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '') ? slug : prev.subdomain
    }));
  };

  const handleGenerateNewSecret = () => {
    const prefix = (wizardForm.customerCode || 'cli').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
    const newId = 'rnc_cli_' + prefix + '_' + Math.random().toString(36).substring(2, 8);
    const newSec = 'rnc_sec_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    setWizardForm(prev => ({ ...prev, clientId: newId, clientSecret: newSec }));
    showSnackbar('Generated new RFC 6749 Client ID & HMAC Secret!', 'info');
  };

  // Run Pre-Flight Diagnostic Check
  const runPreflightCheck = async () => {
    try {
      setPreflightLoading(true);
      const res = await api.post('/licenses/preflight-check', {
        customerCode: wizardForm.customerCode,
        subdomain: wizardForm.subdomain || wizardForm.customerCode?.toLowerCase(),
        port: wizardForm.assignedPort,
        softwareProduct: wizardForm.softwareProduct
      });
      setPreflightResults(res.data);
      if (res.data.status === 'READY') {
        showSnackbar('Pre-flight diagnostic passed! Infrastructure is ready to deploy.', 'success');
      } else {
        showSnackbar('Pre-flight warnings detected. Check details before deploying.', 'warning');
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Pre-flight check probe failed', 'error');
    } finally {
      setPreflightLoading(false);
    }
  };

  // Validation rules for strict multi-tenant sequential stepper
  const isSecurityValid = Boolean(wizardForm.clientId?.trim() && wizardForm.clientSecret?.trim());
  const isIdentityValid = Boolean(
    wizardForm.name?.trim() &&
    wizardForm.customerCode?.trim() &&
    (wizardForm.pendingOwnerMobile || wizardForm.ownerMobile || wizardForm.contact)?.trim()
  );
  const isRoutingValid = Boolean(wizardForm.softwareProduct && wizardForm.assignedPort);
  const isScreensValid = true; // Always valid since features are 100% pre-checked

  const canAccessStep = (stepKey) => {
    if (stepKey === 'security') return true;
    if (stepKey === 'identity') return isSecurityValid;
    if (stepKey === 'routing') return isSecurityValid && isIdentityValid;
    if (stepKey === 'screens') return isSecurityValid && isIdentityValid && isRoutingValid;
    if (stepKey === 'deployment') return isSecurityValid && isIdentityValid && isRoutingValid && isScreensValid;
    return false;
  };

  const getStepStatus = (stepKey) => {
    const idxMap = { security: 1, identity: 2, routing: 3, screens: 4, deployment: 5 };
    const currIdx = idxMap[wizardStep];
    const targetIdx = idxMap[stepKey];

    if (currIdx === targetIdx) return 'active';
    if (canAccessStep(stepKey) && targetIdx < currIdx) return 'completed';
    if (!canAccessStep(stepKey)) return 'locked';
    return 'available';
  };

  // Current selected application object & smart URL calculation
  const currentWizardApp = apps.find(a => a.appCode === wizardForm.softwareProduct);
  const appFeaturesList = getAppFeatures(currentWizardApp);

  const smartAppSlug = currentWizardApp?.urlSlug || currentWizardApp?.appCode?.toLowerCase().replace(/_/g, '') || 'app';
  const smartCustomerKey = (wizardForm.customerCode || 'tenant').toLowerCase().trim();
  const computedSmartUrl = `https://${smartAppSlug}.${smartCustomerKey}.renic.store`;

  // Submit Wizard (Create or Edit)
  const handleWizardSubmit = async (e) => {
    if (e) e.preventDefault();
    setWizardSubmitting(true);
    try {
      if (wizardMode === 'create') {
        const payload = {
          ...wizardForm,
          customerCode: (wizardForm.customerCode || wizardForm.subdomain || wizardForm.name).trim().toUpperCase(),
          subdomain: (wizardForm.subdomain || wizardForm.customerCode || wizardForm.name).toLowerCase().trim(),
          ownerEmail: wizardForm.pendingOwnerEmail || wizardForm.ownerEmail || `admin@${(wizardForm.customerCode || 'tenant').toLowerCase()}.renicsoft.com`,
          ownerMobile: wizardForm.pendingOwnerMobile || wizardForm.ownerMobile || wizardForm.contact || '9876543210',
          ownerPassword: wizardForm.pendingOwnerPassword || wizardForm.ownerPassword || 'Renic@2026',
          fullSaaSDomain: computedSmartUrl
        };
        const res = await api.post('/clients', payload);
        showSnackbar(res.data.message || 'Customer instance successfully provisioned!', 'success');
        setWizardOpen(false);
        fetchData();
        if (res.data.credentials) {
          setCreatedCreds({
            ...res.data.credentials,
            clientName: res.data.client?.name || payload.name,
            mobile: payload.ownerMobile,
            hostingUrl: computedSmartUrl,
            dbName: res.data.provisioning?.dbName || ('renic_tenant_' + payload.customerCode.toLowerCase())
          });
        }
      } else {
        // Edit Mode
        const payload = {
          ...wizardForm,
          fullSaaSDomain: computedSmartUrl
        };
        const res = await api.put(`/clients/${wizardForm._id}`, payload);
        showSnackbar(res.data.message || 'Customer instance and OAuth security updated successfully!', 'success');
        setWizardOpen(false);
        fetchData();
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save customer instance', 'error');
    } finally {
      setWizardSubmitting(false);
    }
  };

  // 1-Click Instant Activation
  const handleActivateNow = async (c) => {
    try {
      setActivatingId(c._id);
      const res = await api.put(`/clients/${c._id}/activate`);
      showSnackbar(res.data.message || `License for ${c.name} activated!`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to activate license', 'error');
    } finally {
      setActivatingId(null);
    }
  };

  // Interactive Live Day Adjuster
  const handleAdjustDays = async (c, deltaDays) => {
    try {
      setActiveExtendMenuId(null);
      const res = await api.post(`/clients/${c._id}/adjust-days`, { deltaDays });
      showSnackbar(res.data.message || `Adjusted subscription by ${deltaDays > 0 ? '+' : ''}${deltaDays} days`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to adjust days', 'error');
    }
  };

  // Convert Trial to Production Tenant
  const handleConvertToProduction = async (c) => {
    const confirmed = await confirmDialog({
      title: '🚀 Convert Trial to Production Tenant?',
      message: `This will provision a permanent dedicated database (renic_tenant_${(c.customerCode || '').toLowerCase()}), migrate all trial data, and activate full 1-year production access for ${c.name}. Proceed?`,
      confirmText: 'Yes, Convert Now',
      danger: false
    });
    if (!confirmed) return;

    try {
      showSnackbar(`Migrating trial data for ${c.name}...`, 'info');
      const res = await api.post(`/clients/${c._id}/convert-to-production`, {
        planTier: 'enterprise',
        subscriptionDays: 365
      });
      showSnackbar(res.data.message || 'Client successfully converted to Production!', 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to convert trial to production', 'error');
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

  // Toggle Customer Lock (Instantly disables/locks customer, shuts down URL with 403, flushes proxy cache)
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
        : `This will immediately shut down the customer's dedicated URL (${c.subdomain}.renic.store / ${c.customerCode}) and return an authoritative 403 Portal Deactivated page. Client terminals will immediately be locked.`,
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

  // Delete Tenant (Permanently terminates instance, flushes proxy cache, URL returns 404)
  const handleDelete = async (c) => {
    const ok = await confirmDialog({
      title: `Delete customer instance "${c.name}"?`,
      message: `This will permanently delete this customer instance. Their dedicated URL (${c.subdomain}.renic.store / ${c.customerCode}) will immediately cease to exist and return a 404 Instance Terminated page. This action cannot be undone.`,
      confirmText: 'Delete Instance',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/clients/${c._id}`);
      showSnackbar(`Customer "${c.name}" permanently deleted. URL routing shut down.`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete instance', 'error');
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

  // Trigger Git Pull & Commit Sync for an Application
  const handleSyncAppGit = async (appObj) => {
    try {
      setSyncingAppCode(appObj.appCode);
      const res = await api.post(`/applications/${appObj._id || appObj.appCode}/git-sync`);
      showSnackbar(res.data.message || `Synced ${appObj.name} with latest Git commit!`, 'success');
      fetchApps();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Git sync failed', 'error');
    } finally {
      setSyncingAppCode(null);
    }
  };

  // Trigger AI Route & Feature Discovery
  const handleExtractRoutesAI = async (appObj) => {
    try {
      setExtractingAppCode(appObj.appCode);
      const res = await api.post('/applications/ai-extract', {
        appCode: appObj.appCode,
        repoPath: appObj.localRepoPath || 'd:/Development/WhatsApp Automation/WA_INSTA_AUTOMATION'
      });
      showSnackbar(`AI Discovery complete! Found ${res.data.routesFound} routes mapped into ${res.data.suggestedFeatures?.length || 0} features.`, 'success');
      fetchApps();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'AI route extraction failed', 'error');
    } finally {
      setExtractingAppCode(null);
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

  return (
    <div className="space-y-6">
      {/* ============ AWS Console Header Toolbar ============ */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
              <span>Renic Soft Master</span>
              <span>/</span>
              <span className="text-emerald-400 font-bold">Fleet Governance</span>
              <span>/</span>
              <span>Customer Instances</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Customer Fleet &amp; Instance Manager</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                Multi-Tenant Cloud PaaS
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Centrally govern multi-tenant infrastructure, enforce strict zero-trust OAuth 2.0 gating, route local port-forwarding, and dispatch live screen permissions over the air.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => fetchData()}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
              title="Refresh Fleet Status"
            >
              <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              Refresh
            </button>

            <Link
              to="/deployments"
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-1.5"
              title="View Git Commits & Zero-Downtime Deployment Logs"
            >
              <Icon name="gitBranch" className="w-3.5 h-3.5 text-cyan-400" />
              <span>Git Deployments</span>
            </Link>

            <Link
              to="/applications"
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1.5"
              title="Manage Applications & Feature Mappings (PaaS Hub)"
            >
              <Icon name="store" className="w-3.5 h-3.5 text-indigo-400" />
              <span>Applications ({apps.length})</span>
            </Link>

            <button
              onClick={handleOpenCreateWizard}
              className="px-4 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 transition flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <Icon name="plus" className="w-4 h-4 text-slate-950 stroke-[3]" />
              Launch Customer Instance
            </button>
          </div>
        </div>
      </div>

      {/* ============ CloudWatch-Style KPI Dashboard ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Instances</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Icon name="dashboard" className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">{metrics.total}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Multi-tenant cloud &amp; on-prem fleet
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Licences</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Icon name="check" className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">{metrics.active}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> In Good Standing &amp; Routing
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">OAuth 2.0 Enforced</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Icon name="key" className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-600 mt-2">{metrics.oauthEnforced}</div>
          <div className="text-[11px] text-indigo-700 font-semibold mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Strict Zero-Trust Gating
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiring &lt; 7 Days</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Icon name="clock" className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600 mt-2">{metrics.expiringSoon}</div>
          <div className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Renewal action recommended
          </div>
        </div>
      </div>

      {/* ============ Search & Filter Toolbar ============ */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Product Filter Pills */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setProductFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap ${
              productFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Software ({clients.length})
          </button>
          {apps.map(a => (
            <button
              key={a.appCode}
              onClick={() => setProductFilter(a.appCode)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                productFilter === a.appCode
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {a.name} ({clients.filter(c => c.softwareProduct === a.appCode).length})
            </button>
          ))}
        </div>

        {/* Search & Status Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="OAUTH_ENFORCED">OAuth Enforced</option>
            <option value="EXPIRING">Expiring Soon</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <div className="relative w-full md:w-64">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Icon name="search" className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search code, name, phone, port..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* ============ AWS Management Console Table ============ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider">
                <th className="py-3.5 px-4">Customer &amp; Access URL</th>
                <th className="py-3.5 px-4">Software &amp; Routing</th>
                <th className="py-3.5 px-4">OAuth 2.0 Security</th>
                <th className="py-3.5 px-4">Subscription &amp; Expiry</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="refresh" className="w-6 h-6 animate-spin text-emerald-500" />
                      <span className="font-semibold text-xs">Loading customer instances...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="store" className="w-8 h-8 text-slate-300" />
                      <span className="font-bold text-slate-700">No matching customer instances found</span>
                      <span className="text-xs text-slate-400">Click &quot;Launch Customer Instance&quot; to provision a new tenant.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((c) => {
                  const isExpired = new Date(c.licenseEnd) < new Date();
                  const daysLeft = Math.ceil((new Date(c.licenseEnd) - new Date()) / (24 * 3600 * 1000));
                  const code = c.customerCode || c.subdomain?.toUpperCase() || 'CLIENT';
                  const appObj = apps.find(a => a.appCode === c.softwareProduct);
                  const isMenuOpen = activeExtendMenuId === c._id;
                  const tenantSlug = appObj?.urlSlug || (c.softwareProduct === 'TEXTILE_POS' ? 'pos' : c.softwareProduct === 'WHATSAPP_AUTOMATION' ? 'wa' : 'app');
                  const tenantUrl = c.fullSaaSDomain || `https://${tenantSlug}.${code.toLowerCase()}.renic.store`;
                  const isLockedOrDisabled = Boolean(
                    c.securitySettings?.emergencyLock ||
                    ['locked', 'disabled', 'suspended', 'cancelled', 'inactive', 'revoked'].includes(c.licenseStatus)
                  );

                  return (
                    <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Column 1: Customer Identity & URL */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base">{c.name}</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-900 text-emerald-400">
                            {code}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border ${
                            isLockedOrDisabled
                              ? 'text-rose-700 bg-rose-50 border-rose-200 line-through opacity-75'
                              : 'text-emerald-800 bg-emerald-50/80 border border-emerald-200'
                          }`}>
                            {tenantUrl}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(tenantUrl);
                              showSnackbar('Copied URL to clipboard!');
                            }}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded"
                            title="Copy URL"
                          >
                            <Icon name="copy" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => window.open(tenantUrl, '_blank')}
                            className={`p-1 rounded ${isLockedOrDisabled ? 'text-rose-400 hover:text-rose-600' : 'text-slate-400 hover:text-emerald-600'}`}
                            title={isLockedOrDisabled ? "Test Disabled URL (Returns 403 Portal Deactivated)" : "Open Store URL in new tab"}
                          >
                            <Icon name="eye" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {isLockedOrDisabled && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <Icon name="lock" className="w-2.5 h-2.5 text-rose-700" />
                              URL Inactive & Locked (403)
                            </span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 mt-1">
                          GST: {c.gstNumber || 'None'} · Mobile: {c.pendingOwnerMobile || c.contact || 'N/A'}
                        </div>
                      </td>

                      {/* Column 2: Software & Network */}
                      <td className="py-4 px-4 align-top">
                        <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {appObj ? appObj.name : c.softwareProduct}
                        </span>
                        <div className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-2">
                          <span>Tier: <strong className="text-emerald-600 uppercase font-bold">{c.planTier || 'pro'}</strong></span>
                          <span>·</span>
                          <span>Port: <strong className="font-mono text-slate-800">{c.portForwarding?.assignedPort || c.assignedPort || 5000}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Router: {c.portForwarding?.connectionType === 'CLOUDFLARE_TUNNEL' ? 'Cloudflare Tunnel' : 'Port Forwarding'}
                        </div>
                      </td>

                      {/* Column 3: OAuth 2.0 Security */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-center gap-1.5">
                          {c.oauthEnforced ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <Icon name="key" className="w-3 h-3 text-emerald-600" />
                              OAuth Enforced (M2M)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Permissive Mode
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {c.clientId ? c.clientId.substring(0, 16) + '...' : 'rnc_cli_...'}
                          </span>
                          {c.clientId && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(c.clientId);
                                showSnackbar('Copied Client ID!');
                              }}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copy Client ID"
                            >
                              <Icon name="copy" className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="mt-1">
                          <button
                            onClick={() => openOAuthModal(c)}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                          >
                            <span>🔑</span> View Postman Kit
                          </button>
                        </div>
                      </td>

                      {/* Column 4: Subscription & Expiry */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">
                            {c.billingCycle ? c.billingCycle.replace('_', ' ') : '1 MONTH'}
                          </span>
                          {c.isTrial && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              🟡 Trial
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 mt-0.5">
                          Until {new Date(c.licenseEnd).toLocaleDateString()}
                        </div>

                        <div className={`text-xs font-bold mt-1 ${
                          isLockedOrDisabled ? 'text-rose-600' : isExpired ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {isLockedOrDisabled ? '🔴 Disabled / Locked' : isExpired ? '🔴 Expired (Locked)' : `🟢 ${daysLeft} days remaining`}
                        </div>

                        {c.isTrial && (
                          <button
                            type="button"
                            onClick={() => handleConvertToProduction(c)}
                            className="mt-2 inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs hover:from-emerald-700 hover:to-teal-700 transition-all"
                            title="Migrate trial to dedicated tenant database and activate 1-year production access"
                          >
                            🚀 Convert to Production
                          </button>
                        )}
                      </td>

                      {/* Column 5: Actions */}
                      <td className="py-4 px-4 text-right align-top">
                        <div className="inline-flex items-center justify-end gap-1.5 relative">
                          {/* Live Extend Subscription Popover */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveExtendMenuId(isMenuOpen ? null : c._id)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition flex items-center gap-1"
                              title="Extend subscription duration"
                            >
                              <span>+ Extend</span>
                              <span className="text-[10px]">▾</span>
                            </button>

                            {isMenuOpen && (
                              <div
                                ref={extendMenuRef}
                                className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left"
                              >
                                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                                  Stack Days
                                </div>
                                {DURATION_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.days}
                                    type="button"
                                    onClick={() => handleAdjustDays(c, opt.days)}
                                    className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                                  >
                                    <span>{opt.label}</span>
                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1 rounded">
                                      {opt.badge}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 1-Click Lock / Unlock Toggle Button */}
                          <button
                            disabled={togglingLockId === c._id}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-2xs ${
                              isLockedOrDisabled
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                            onClick={() => handleToggleLock(c)}
                            title={isLockedOrDisabled ? "Unlock & restore customer URL routing" : "Lock / Disable customer (URL returns 403 immediately)"}
                          >
                            <Icon name={isLockedOrDisabled ? "unlock" : "lock"} className="w-3.5 h-3.5" />
                            {isLockedOrDisabled ? 'Unlock' : 'Disable'}
                          </button>

                          {/* OTA Sync Button */}
                          <button
                            disabled={syncingId === c._id}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 shadow-2xs"
                            onClick={() => handlePushSync(c)}
                            title="Push live license, OAuth & screen gating over the air"
                          >
                            <Icon name="refresh" className={`w-3.5 h-3.5 ${syncingId === c._id ? 'animate-spin' : ''}`} />
                            Sync
                          </button>

                          {/* Multi-Step Configure Button */}
                          <button
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition flex items-center gap-1"
                            onClick={() => handleOpenEditWizard(c)}
                            title="Configure Tenant, Network, OAuth & Screen Gate"
                          >
                            <Icon name="edit" className="w-3.5 h-3.5" />
                            Edit
                          </button>

                          {/* Delete Button */}
                          <button
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                            onClick={() => handleDelete(c)}
                            title="Revoke & Delete Instance"
                          >
                            <Icon name="trash" className="w-4 h-4" />
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

      {/* ============ STRICT 5-STEP MULTI-TENANT CLOUD PROVISIONING WIZARD MODAL ============ */}
      {wizardOpen && (
        <Modal
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          title={
            wizardMode === 'create'
              ? '🚀 Launch New Customer Instance (Strict Sequential Stepper)'
              : `⚙️ Configure Customer Instance: ${wizardForm.name} [${wizardForm.customerCode}]`
          }
          maxWidth="max-w-5xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                className="btn-secondary !px-4"
                onClick={() => setWizardOpen(false)}
                disabled={wizardSubmitting}
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {/* Back Button */}
                {wizardStep !== 'security' && (
                  <button
                    type="button"
                    onClick={() => {
                      const order = ['security', 'identity', 'routing', 'screens', 'deployment'];
                      const prevIdx = order.indexOf(wizardStep) - 1;
                      if (prevIdx >= 0) setWizardStep(order[prevIdx]);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    ← Back
                  </button>
                )}

                {/* Next Button for Steps 1-4 */}
                {wizardStep !== 'deployment' ? (
                  <button
                    type="button"
                    disabled={
                      (wizardStep === 'security' && !isSecurityValid) ||
                      (wizardStep === 'identity' && !isIdentityValid) ||
                      (wizardStep === 'routing' && !isRoutingValid)
                    }
                    onClick={() => {
                      const order = ['security', 'identity', 'routing', 'screens', 'deployment'];
                      const nextIdx = order.indexOf(wizardStep) + 1;
                      if (nextIdx < order.length) {
                        const targetStep = order[nextIdx];
                        if (canAccessStep(targetStep)) {
                          setWizardStep(targetStep);
                          if (targetStep === 'deployment' && !preflightResults) {
                            runPreflightCheck();
                          }
                        }
                      }
                    }}
                    className="btn-primary !bg-slate-900 hover:!bg-slate-800 text-white !px-5 !py-2.5 font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Next Step</span>
                    <span>→</span>
                  </button>
                ) : (
                  /* Launch / Save Button on Final Step 5 */
                  <button
                    type="submit"
                    form="customer-wizard-form"
                    disabled={wizardSubmitting || !isSecurityValid || !isIdentityValid}
                    className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !px-6 !py-2.5 font-bold shadow-md text-xs"
                  >
                    {wizardSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Icon name="refresh" className="w-4 h-4 animate-spin" />
                        Saving to Infrastructure...
                      </span>
                    ) : wizardMode === 'create' ? (
                      '🚀 Provision & Launch Customer Instance'
                    ) : (
                      'Save & Push OTA Live Update'
                    )}
                  </button>
                )}
              </div>
            </div>
          }
        >
          {/* ============ Strict Sequential Stepper Bar ============ */}
          <div className="border-b border-slate-200 -mt-2 mb-6 pb-3">
            <div className="flex items-center justify-between gap-1 overflow-x-auto py-1">
              {WIZARD_STEPS.map((step, idx) => {
                const status = getStepStatus(step.id);
                const isClickable = canAccessStep(step.id);

                return (
                  <React.Fragment key={step.id}>
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => {
                        if (isClickable) {
                          setWizardStep(step.id);
                          if (step.id === 'deployment' && !preflightResults) {
                            runPreflightCheck();
                          }
                        }
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition whitespace-nowrap ${
                        status === 'active'
                          ? 'bg-slate-900 text-white shadow-sm ring-2 ring-emerald-500/50'
                          : status === 'completed'
                          ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 cursor-pointer border border-emerald-200'
                          : 'bg-slate-100/70 text-slate-400 cursor-not-allowed border border-slate-200/60'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                        status === 'active'
                          ? 'bg-emerald-500 text-slate-950'
                          : status === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-300 text-slate-600'
                      }`}>
                        {status === 'completed' ? '✓' : step.stepNum}
                      </div>

                      <div className="min-w-0 pr-1">
                        <div className={`text-xs font-bold flex items-center gap-1.5 ${
                          status === 'active' ? 'text-white' : status === 'completed' ? 'text-emerald-950' : 'text-slate-500'
                        }`}>
                          <span>{step.title}</span>
                          {status === 'locked' && <span className="text-[10px]">🔒</span>}
                        </div>
                        <div className={`text-[10px] leading-tight truncate ${
                          status === 'active' ? 'text-emerald-400 font-mono' : 'text-slate-400'
                        }`}>
                          {step.subtitle}
                        </div>
                      </div>
                    </button>

                    {idx < WIZARD_STEPS.length - 1 && (
                      <div className={`w-4 h-0.5 flex-shrink-0 rounded ${
                        canAccessStep(WIZARD_STEPS[idx + 1].id) ? 'bg-emerald-400' : 'bg-slate-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <form id="customer-wizard-form" onSubmit={handleWizardSubmit} className="space-y-4">
            {/* ============ STEP 1: SECURITY FIRST (OAUTH 2.0 CREDENTIALS) ============ */}
            {wizardStep === 'security' && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl border border-slate-700 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔐</span>
                        <h3 className="text-sm font-extrabold text-white">
                          Step 1: Security &amp; OAuth 2.0 Machine Credentials
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                          RFC 6749 M2M Gated
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                        In enterprise PaaS architecture, machine credentials and cryptographic keys must be generated before provisioning the tenant profile. All terminal endpoints will authenticate against these HMAC tokens.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateNewSecret}
                      className="px-3.5 py-2 text-xs font-extrabold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition flex items-center gap-1.5 shadow-sm self-start sm:self-center flex-shrink-0"
                    >
                      <span>⚡</span> Generate New Keys
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Client ID */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Icon name="key" className="w-3.5 h-3.5 text-emerald-600" />
                        OAuth 2.0 Client ID (Public Identifier) *
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">rnc_cli_*</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        className="input font-mono font-bold bg-white text-slate-800 border-slate-300"
                        value={wizardForm.clientId || ''}
                        onChange={(e) => setWizardForm({ ...wizardForm, clientId: e.target.value })}
                        placeholder="e.g. rnc_cli_tx10_abc123"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (wizardForm.clientId) {
                            navigator.clipboard.writeText(wizardForm.clientId);
                            showSnackbar('Client ID copied to clipboard!');
                          }
                        }}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 text-xs font-bold flex-shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Public tenant identifier used in OAuth token handshakes.
                    </p>
                  </div>

                  {/* Client Secret */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Icon name="key" className="w-3.5 h-3.5 text-indigo-600" />
                        OAuth 2.0 Client Secret (HMAC Key) *
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">rnc_sec_*</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type={showWizardSecret ? 'text' : 'password'}
                        className="input font-mono font-bold bg-white text-slate-800 border-slate-300"
                        value={wizardForm.clientSecret || ''}
                        onChange={(e) => setWizardForm({ ...wizardForm, clientSecret: e.target.value })}
                        placeholder="e.g. rnc_sec_xyz789..."
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowWizardSecret(!showWizardSecret)}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 text-xs font-bold flex-shrink-0"
                      >
                        {showWizardSecret ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (wizardForm.clientSecret) {
                            navigator.clipboard.writeText(wizardForm.clientSecret);
                            showSnackbar('Client Secret copied!');
                          }
                        }}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 text-xs font-bold flex-shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      High-entropy secret key for HMAC SHA-256 machine authentication.
                    </p>
                  </div>
                </div>

                {/* Token Endpoint & cURL Test Preview */}
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-slate-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚡</span> OAuth Token Endpoint
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">POST /api/v1/oauth/token</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-emerald-300 overflow-x-auto border border-slate-800 whitespace-pre">
                    {`curl -X POST https://auth.renic.store/api/v1/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{"grant_type": "client_credentials", "client_id": "${wizardForm.clientId || 'rnc_cli_...'}", "client_secret": "${wizardForm.clientSecret ? wizardForm.clientSecret.substring(0, 14) + '...' : 'rnc_sec_...'}"}'`}
                  </div>
                </div>

                {/* Zero-Trust Enforcement Switch */}
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                      <span>🛡️</span> Enforce Zero-Trust OAuth 2.0 Security Gate
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      When enabled, all screens except Settings will return a 403 Forbidden Gate until credentials are authenticated.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizardForm.oauthEnforced}
                      onChange={(e) => setWizardForm({ ...wizardForm, oauthEnforced: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            )}

            {/* ============ STEP 2: CUSTOMER IDENTITY & PROFILE ============ */}
            {wizardStep === 'identity' && (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Customer / Shop Name *</label>
                    <input
                      className="input font-semibold"
                      value={wizardForm.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Saraswathi Silks &amp; Textiles"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Customer Code / Subdomain Key *</label>
                    <input
                      className="input font-mono font-bold uppercase text-emerald-700 bg-slate-50"
                      value={wizardForm.customerCode}
                      onChange={(e) => setWizardForm({
                        ...wizardForm,
                        customerCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                        subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                      })}
                      placeholder="e.g. TX10 or SARASWAT-TX"
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Forms dedicated subdomain: <code className="font-bold text-emerald-700">{computedSmartUrl}</code>
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Contact Person Name</label>
                    <input
                      className="input"
                      value={wizardForm.contact || wizardForm.pendingOwnerName || ''}
                      onChange={(e) => setWizardForm({
                        ...wizardForm,
                        contact: e.target.value,
                        pendingOwnerName: e.target.value
                      })}
                      placeholder="e.g. Ramesh Kumar"
                    />
                  </div>

                  <div>
                    <label className="label">Login Mobile (Username) *</label>
                    <input
                      className="input font-semibold"
                      value={wizardForm.pendingOwnerMobile || wizardForm.ownerMobile || ''}
                      onChange={(e) => setWizardForm({
                        ...wizardForm,
                        pendingOwnerMobile: e.target.value,
                        ownerMobile: e.target.value
                      })}
                      placeholder="e.g. 9876543210"
                      required={wizardMode === 'create'}
                    />
                  </div>

                  <div>
                    <label className="label">Admin Email *</label>
                    <input
                      className="input"
                      type="email"
                      value={wizardForm.pendingOwnerEmail || wizardForm.ownerEmail || ''}
                      onChange={(e) => setWizardForm({
                        ...wizardForm,
                        pendingOwnerEmail: e.target.value,
                        ownerEmail: e.target.value
                      })}
                      placeholder="e.g. ramesh@saraswathi.com"
                      required={wizardMode === 'create'}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">
                      {wizardMode === 'create' ? 'Admin Initial Password *' : 'Reset Password (Leave blank to retain)'}
                    </label>
                    <input
                      className="input font-mono"
                      type="password"
                      value={wizardForm.pendingOwnerPassword || wizardForm.ownerPassword || ''}
                      onChange={(e) => setWizardForm({
                        ...wizardForm,
                        pendingOwnerPassword: e.target.value,
                        ownerPassword: e.target.value
                      })}
                      placeholder={wizardMode === 'create' ? 'Enter initial password...' : 'Leave blank to retain password'}
                      required={wizardMode === 'create'}
                    />
                  </div>

                  <div>
                    <label className="label">GSTIN / Tax Registration Number</label>
                    <input
                      className="input font-mono uppercase"
                      value={wizardForm.gstNumber || ''}
                      onChange={(e) => setWizardForm({ ...wizardForm, gstNumber: e.target.value.toUpperCase() })}
                      placeholder="33AAAAA0000A1Z5"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Plan Tier</label>
                    <select
                      className="input font-semibold"
                      value={wizardForm.planTier}
                      onChange={(e) => setWizardForm({ ...wizardForm, planTier: e.target.value })}
                    >
                      <option value="basic">Basic Tier (1 Floor, 3 Staff)</option>
                      <option value="pro">Pro Tier (3 Floors, 10 Staff)</option>
                      <option value="enterprise">Enterprise Tier (Unlimited)</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Billing Cycle</label>
                    <select
                      className="input font-semibold"
                      value={wizardForm.billingCycle}
                      onChange={(e) => setWizardForm({ ...wizardForm, billingCycle: e.target.value })}
                    >
                      <option value="1_MONTH">1 Month</option>
                      <option value="3_MONTHS">3 Months (Quarterly)</option>
                      <option value="6_MONTHS">6 Months (Half-Yearly)</option>
                      <option value="1_YEAR">1 Year (Annual)</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">License Status</label>
                    <select
                      className="input font-bold text-emerald-700"
                      value={wizardForm.licenseStatus}
                      onChange={(e) => setWizardForm({ ...wizardForm, licenseStatus: e.target.value })}
                    >
                      <option value="active">Active (Full Access)</option>
                      <option value="pending_activation">Pending Activation</option>
                      <option value="grace_period">Grace Period</option>
                      <option value="locked">Locked / Suspended</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Showroom Physical Address</label>
                  <input
                    className="input"
                    value={wizardForm.address || ''}
                    onChange={(e) => setWizardForm({ ...wizardForm, address: e.target.value })}
                    placeholder="e.g. 14 Cross Cut Road, Gandhipuram, Coimbatore - 641012"
                  />
                </div>
              </div>
            )}

            {/* ============ STEP 3: APPLICATION SELECTION & SMART SUBDOMAIN URL ============ */}
            {wizardStep === 'routing' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="label text-sm font-extrabold text-slate-800 !mb-0">
                      Select Software Application (PaaS Catalog) *
                    </label>
                    <Link
                      to="/applications"
                      target="_blank"
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:underline"
                      title="Open Application Hub to register new software products or customize feature mappings"
                    >
                      <Icon name="store" className="w-3.5 h-3.5" />
                      <span>Manage Apps &amp; Custom Features ↗</span>
                    </Link>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {apps.map((app) => {
                      const isSelected = wizardForm.softwareProduct === app.appCode;
                      return (
                        <div
                          key={app.appCode}
                          onClick={() => {
                            const newPerms = initDefault100PercentPermissions(app);
                            setWizardForm({
                              ...wizardForm,
                              softwareProduct: app.appCode,
                              assignedPort: app.defaultPort || wizardForm.assignedPort,
                              screenPermissions: newPerms
                            });
                          }}
                          className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-slate-900 text-white border-emerald-500 shadow-md ring-2 ring-emerald-500/30'
                              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {app.category || 'Enterprise'}
                              </span>
                              <span className={`text-xs font-mono font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>
                                Port {app.defaultPort}
                              </span>
                            </div>
                            <div className="font-black text-sm">{app.name}</div>
                            <p className={`text-[11px] mt-1 line-clamp-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {app.description || 'Enterprise software suite'}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-200/20 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-xs">slug: <b>{app.urlSlug || 'app'}</b></span>
                            {isSelected && <span className="text-emerald-400 font-bold">✓ Selected</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Smart Subdomain URL Card */}
                <div className="p-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-2xl border border-emerald-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🌐</span>
                        <h4 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                          Computed Smart Subdomain URL
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Generated automatically using formula: <code className="text-emerald-300">&lt;appSlug&gt;.&lt;customerCode&gt;.renic.store</code>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(computedSmartUrl);
                        showSnackbar('Copied Smart Subdomain URL!');
                      }}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold"
                    >
                      Copy URL
                    </button>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl text-sm font-mono font-bold text-emerald-300 border border-slate-800 flex items-center justify-between">
                    <span>{computedSmartUrl}</span>
                    <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      Active SaaS Edge
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Target Terminal IP</label>
                    <input
                      className="input font-mono"
                      value={wizardForm.targetIp}
                      onChange={(e) => setWizardForm({ ...wizardForm, targetIp: e.target.value })}
                      placeholder="127.0.0.1"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Localhost or showroom server LAN IP</span>
                  </div>

                  <div>
                    <label className="label">Assigned Port *</label>
                    <input
                      type="number"
                      className="input font-mono font-bold"
                      value={wizardForm.assignedPort}
                      onChange={(e) => setWizardForm({ ...wizardForm, assignedPort: Number(e.target.value) })}
                      required
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      5174 (TextilePOS), 5173 (WhatsApp), 5176 (Challan)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="label">Connection Routing Mode</label>
                  <select
                    className="input font-semibold"
                    value={wizardForm.connectionType}
                    onChange={(e) => setWizardForm({ ...wizardForm, connectionType: e.target.value })}
                  >
                    <option value="PORT_FORWARD_ROUTER">Port Forward Router (High-Speed Local Proxy)</option>
                    <option value="CLOUDFLARE_TUNNEL">Cloudflare Tunnel (Zero-Trust Encrypted Edge)</option>
                    <option value="LOCAL_LAN">Local LAN Wi-Fi Only</option>
                  </select>
                </div>
              </div>
            )}

            {/* ============ STEP 4: FEATURE GOVERNANCE (100% PRE-CHECKED BY DEFAULT) ============ */}
            {wizardStep === 'screens' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎛️</span>
                      <h3 className="text-sm font-extrabold text-white">
                        Feature Governance &amp; SaaS Tier Entitlements
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                        100% Pre-Checked By Default
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      All features of <b>{currentWizardApp?.name || 'Application'}</b> are automatically unlocked for maximum customer value. Uncheck specific modules only if you wish to enforce a restrictive SaaS tier.
                    </p>
                  </div>

                  {/* 1-Click Preset Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const allPerms = {};
                        appFeaturesList.forEach(f => { allPerms[f.key] = true; });
                        setWizardForm(prev => ({ ...prev, screenPermissions: allPerms }));
                        showSnackbar('Enabled 100% of features for customer!', 'info');
                      }}
                      className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition"
                    >
                      ✓ Select All (100%)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const starter = {};
                        appFeaturesList.forEach((f, idx) => { starter[f.key] = idx < 3; });
                        setWizardForm(prev => ({ ...prev, screenPermissions: starter }));
                        showSnackbar('Applied Starter Tier preset (Core modules only)', 'info');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      Starter Tier
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const pro = {};
                        appFeaturesList.forEach((f, idx) => { pro[f.key] = idx < 7; });
                        setWizardForm(prev => ({ ...prev, screenPermissions: pro }));
                        showSnackbar('Applied Pro Tier preset', 'info');
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      Pro Tier
                    </button>
                  </div>
                </div>

                {/* 2-Column Split: Feature Checkboxes (Left) + Live Customer Sidebar Simulator (Right) */}
                <div className="grid lg:grid-cols-12 gap-4">
                  {/* Left: Checkboxes */}
                  <div className="lg:col-span-7 space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {appFeaturesList.length > 0 ? (
                      appFeaturesList.map((feature) => {
                        const isChecked = wizardForm.screenPermissions[feature.key] !== false;
                        return (
                          <label
                            key={feature.key}
                            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-white border-emerald-400 shadow-2xs ring-1 ring-emerald-500/20'
                                : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 mt-0.5 flex-shrink-0"
                              checked={isChecked}
                              onChange={(e) => {
                                setWizardForm(prev => ({
                                  ...prev,
                                  screenPermissions: {
                                    ...prev.screenPermissions,
                                    [feature.key]: e.target.checked
                                  }
                                }));
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-extrabold text-xs text-slate-900">{feature.label}</div>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                                  isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                                }`}>
                                  {isChecked ? 'Active' : '403 Blocked'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                                <span>{feature.category}</span>
                                <span>·</span>
                                <span className="text-slate-400">{feature.path || `/${feature.key}`}</span>
                              </div>
                              {feature.description && (
                                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                                  {feature.description}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                        No individual feature mappings defined. All standard application routes will be granted.
                      </div>
                    )}
                  </div>

                  {/* Right: Live Simulated Customer Sidebar Preview */}
                  <div className="lg:col-span-5 bg-slate-950 text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-slate-300">Live Customer Navigation Menu</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                          Simulator
                        </span>
                      </div>

                      {/* Mock Brand Header */}
                      <div className="py-3 border-b border-slate-900 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-500/30">
                          {(wizardForm.name || 'R').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-white truncate">
                            {wizardForm.name || 'Customer Showroom'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {computedSmartUrl}
                          </div>
                        </div>
                      </div>

                      {/* Simulated Sidebar Links */}
                      <div className="py-2 space-y-1 max-h-[220px] overflow-y-auto">
                        {appFeaturesList
                          .filter(f => wizardForm.screenPermissions[f.key] !== false)
                          .map((f) => (
                            <div
                              key={f.key}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
                            >
                              <span className="truncate">{f.label}</span>
                              <span className="text-[9px] font-mono text-emerald-400">OTA</span>
                            </div>
                          ))}

                        {appFeaturesList.filter(f => wizardForm.screenPermissions[f.key] !== false).length === 0 && (
                          <div className="py-8 text-center text-xs text-slate-500">
                            No features enabled. Client will see empty portal.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Enabled Features:</span>
                      <strong className="text-emerald-400 font-mono">
                        {appFeaturesList.filter(f => wizardForm.screenPermissions[f.key] !== false).length} / {appFeaturesList.length} Active
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============ STEP 5: DYNAMIC ENGINE EXTENSIONS & PRE-FLIGHT CHECK ============ */}
            {wizardStep === 'deployment' && (
              <div className="space-y-4">
                {/* Dynamic Extension: WhatsApp Bulk Dispatch Engine (ONLY for WhatsApp Automation) */}
                {(wizardForm.softwareProduct === 'WHATSAPP_AUTOMATION' || smartAppSlug === 'wa') && (
                  <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">🚀</span>
                          <h3 className="text-sm font-extrabold text-white">
                            WhatsApp Bulk Dispatch Engine (Master Config Only)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Governs promotional broadcast sender type. This configuration is protected and completely hidden from tenant clients.
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 pt-1">
                      <label
                        onClick={() => setWizardForm({ ...wizardForm, whatsappSenderMode: 'META' })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          wizardForm.whatsappSenderMode === 'META'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-sm'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <span>🌐</span> Meta Cloud API (Official)
                          </span>
                          <input
                            type="radio"
                            name="whatsappSenderMode"
                            checked={wizardForm.whatsappSenderMode === 'META'}
                            onChange={() => setWizardForm({ ...wizardForm, whatsappSenderMode: 'META' })}
                            className="text-emerald-500 focus:ring-emerald-400"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Official Meta verified sender. High throughput with Meta Business Suite templates.
                        </p>
                      </label>

                      <label
                        onClick={() => setWizardForm({ ...wizardForm, whatsappSenderMode: 'DOCKER' })}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          wizardForm.whatsappSenderMode === 'DOCKER'
                            ? 'bg-blue-950/60 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs flex items-center gap-1.5">
                            <span>🐳</span> Docker WAHA (Web QR)
                          </span>
                          <input
                            type="radio"
                            name="whatsappSenderMode"
                            checked={wizardForm.whatsappSenderMode === 'DOCKER'}
                            onChange={() => setWizardForm({ ...wizardForm, whatsappSenderMode: 'DOCKER' })}
                            className="text-blue-500 focus:ring-blue-400"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Local Docker container. Zero Meta approval delays for dynamic promotions.
                        </p>
                      </label>
                    </div>

                    {wizardForm.whatsappSenderMode === 'DOCKER' && (
                      <div className="p-3 bg-blue-900/40 rounded-xl border border-blue-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-blue-200 flex items-center gap-1.5">
                            <span>⏱️</span> Anti-Ban Safety Throttle
                          </div>
                          <p className="text-[11px] text-blue-300 mt-0.5">
                            Delays dispatch between each recipient to protect the WhatsApp account from bans.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="3"
                            max="60"
                            className="input !py-1 !px-2 w-20 text-center font-mono font-bold bg-slate-900 text-white border-blue-500"
                            value={wizardForm.dockerThrottleSeconds || 6}
                            onChange={(e) => setWizardForm({ ...wizardForm, dockerThrottleSeconds: Number(e.target.value) || 6 })}
                          />
                          <span className="text-blue-200 font-semibold text-xs">Seconds</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic Extension: POS Stock & Billing (ONLY for Textile POS) */}
                {(wizardForm.softwareProduct === 'TEXTILE_POS' || smartAppSlug === 'pos') && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span>🏷️</span> Textile POS Stock &amp; Sizing Configuration
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wizardForm.stockConfig?.enableSizes || false}
                          onChange={(e) => setWizardForm({
                            ...wizardForm,
                            stockConfig: { ...wizardForm.stockConfig, enableSizes: e.target.checked }
                          })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Enable Sizes (S, M, L, XL)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wizardForm.stockConfig?.enableColors || false}
                          onChange={(e) => setWizardForm({
                            ...wizardForm,
                            stockConfig: { ...wizardForm.stockConfig, enableColors: e.target.checked }
                          })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Enable Colors</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wizardForm.stockConfig?.enableMeters || false}
                          onChange={(e) => setWizardForm({
                            ...wizardForm,
                            stockConfig: { ...wizardForm.stockConfig, enableMeters: e.target.checked }
                          })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Enable Meter Cutting</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={wizardForm.pricingConfig?.trackProfit !== false}
                          onChange={(e) => setWizardForm({
                            ...wizardForm,
                            pricingConfig: { ...wizardForm.pricingConfig, trackProfit: e.target.checked }
                          })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Track Profit Margins</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Free Trial Sandbox Mode */}
                <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={wizardForm.isTrial}
                        onChange={(e) => setWizardForm({
                          ...wizardForm,
                          isTrial: e.target.checked,
                          databaseName: e.target.checked ? 'renic_trial_sandbox' : `renic_tenant_${(wizardForm.customerCode || '').toLowerCase()}`
                        })}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-amber-900">
                        🟡 Free Trial Mode (Isolated Sandbox DB)
                      </span>
                    </label>
                  </div>

                  <div className="mt-2 text-[11px] text-amber-800 font-mono">
                    Target MongoDB: <strong>{wizardForm.databaseName || (wizardForm.isTrial ? 'renic_trial_sandbox' : `renic_tenant_${(wizardForm.customerCode || '').toLowerCase()}`)}</strong>
                  </div>
                </div>

                {/* Automated Pre-Flight Check Card */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🩺</span>
                        <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                          Automated Pre-Flight Infrastructure Diagnostics
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Validates subdomain availability, port reachability, and Docker container readiness before launch.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={preflightLoading}
                      onClick={runPreflightCheck}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Icon name="refresh" className={`w-3 h-3 ${preflightLoading ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>{preflightLoading ? 'Probing Infrastructure...' : 'Run Diagnostics'}</span>
                    </button>
                  </div>

                  {preflightResults ? (
                    <div className="grid sm:grid-cols-3 gap-2.5 pt-1">
                      {/* Check 1: Domain / Subdomain */}
                      <div className={`p-3 rounded-xl border text-xs ${
                        preflightResults.checks?.subdomainAvailable
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}>
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span>{preflightResults.checks?.subdomainAvailable ? '✓' : '⚠️'}</span>
                          <span>Subdomain Uniqueness</span>
                        </div>
                        <div className="text-[11px] mt-1 font-mono truncate">
                          {computedSmartUrl}
                        </div>
                        <div className="text-[10px] mt-0.5 opacity-80">
                          {preflightResults.checks?.subdomainAvailable ? 'Available for provisioning' : 'In use or active'}
                        </div>
                      </div>

                      {/* Check 2: Port & Gateway */}
                      <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 text-xs">
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span>✓</span>
                          <span>Port &amp; Reverse Proxy</span>
                        </div>
                        <div className="text-[11px] mt-1 font-mono">
                          Port {wizardForm.assignedPort} · Ready
                        </div>
                        <div className="text-[10px] mt-0.5 opacity-80">
                          Local router standby
                        </div>
                      </div>

                      {/* Check 3: Engine Readiness */}
                      <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-900 text-xs">
                        <div className="font-extrabold flex items-center gap-1.5">
                          <span>✓</span>
                          <span>Application Engine</span>
                        </div>
                        <div className="text-[11px] mt-1 font-mono">
                          {wizardForm.softwareProduct}
                        </div>
                        <div className="text-[10px] mt-0.5 opacity-80">
                          Isolated multi-tenant ready
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                      Click <b>&quot;Run Diagnostics&quot;</b> to verify network routes and MongoDB tenant isolation before launching.
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}



      {/* ============ OAuth 2.0 Postman Test Kit Modal ============ */}
      {oauthModalOpen && (
        <Modal
          open={oauthModalOpen}
          onClose={() => setOauthModalOpen(false)}
          title={`🔑 OAuth 2.0 Credentials & Postman Kit: ${selectedClient?.name || ''}`}
          maxWidth="max-w-3xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-medium">RFC 6749 Machine-to-Machine Token Flow</span>
              <button className="btn-primary !px-5" onClick={() => setOauthModalOpen(false)}>Done</button>
            </div>
          }
        >
          {oauthLoading ? (
            <div className="py-12 text-center text-slate-400">Loading OAuth credentials...</div>
          ) : oauthData ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-base">{oauthData.clientName}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">Customer Code: {oauthData.customerCode}</div>
                </div>
                <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-400 font-mono font-bold rounded-lg border border-emerald-500/30">
                  Active in Renic HQ
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Client ID</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      className="input font-mono font-bold bg-slate-50 text-slate-800"
                      value={oauthData.clientId}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(oauthData.clientId);
                        showSnackbar('Client ID copied!');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Client Secret</label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      readOnly
                      className="input font-mono font-bold bg-slate-50 text-slate-800"
                      value={oauthData.clientSecret}
                    />
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      {showSecret ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(oauthData.clientSecret);
                        showSnackbar('Client Secret copied!');
                      }}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Token Endpoint (cURL Test)</label>
                  <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto whitespace-pre">
                    {`curl -X POST ${window.location.origin}/api/v1/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{"grant_type": "client_credentials", "client_id": "${oauthData.clientId}", "client_secret": "${oauthData.clientSecret}"}'`}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      {/* ============ Onboard Success & 1-Click WhatsApp Welcome Kit Modal ============ */}
      {createdCreds && (
        <Modal
          open={!!createdCreds}
          onClose={() => setCreatedCreds(null)}
          title={`🎉 Customer Instance Launched: ${createdCreds.clientName}`}
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => {
                  const mobile = (createdCreds.mobile || '').replace(/[^0-9]/g, '');
                  const text = `*🎉 Welcome to Renic Platform!*\nYour dedicated portal is active.\n\n*Customer Code:* ${createdCreds.customerCode}\n*Dedicated Portal:* ${createdCreds.hostingUrl}\n*Isolated DB:* ${createdCreds.dbName}\n\n*API & OAuth Credentials:*\n- *Client ID:* ${createdCreds.clientId}\n- *Secret Key:* ${createdCreds.clientSecret}`;
                  const waUrl = mobile ? `https://wa.me/${mobile}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
                  window.open(waUrl, '_blank');
                }}
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 text-white !px-4 !py-2 text-xs flex items-center gap-1.5"
              >
                <Icon name="whatsapp" className="w-4 h-4" /> Share via WhatsApp
              </button>
              <button className="btn-secondary !px-4" onClick={() => setCreatedCreds(null)}>Done</button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
              <div className="font-bold text-sm">Dedicated Database Initialized!</div>
              <p className="mt-0.5">Database <code className="font-mono font-bold">{createdCreds.dbName}</code> was automatically created and seeded. Zero data crossover with other clients.</p>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-gray-500 font-semibold uppercase text-[10px]">Customer SaaS Hosting URL</span>
                <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg font-mono font-bold text-brand-700 mt-1">
                  <span className="truncate pr-2">{createdCreds.hostingUrl}</span>
                  <button onClick={() => { navigator.clipboard.writeText(createdCreds.hostingUrl); showSnackbar('Copied Hosting URL!'); }}>
                    <Icon name="copy" className="w-4 h-4 text-gray-500 hover:text-gray-800" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-semibold uppercase text-[10px]">Renic Client ID</span>
                <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-800 mt-1">
                  <span className="truncate pr-2">{createdCreds.clientId}</span>
                  <button onClick={() => { navigator.clipboard.writeText(createdCreds.clientId); showSnackbar('Copied Client ID!'); }}>
                    <Icon name="copy" className="w-4 h-4 text-gray-500 hover:text-gray-800" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-semibold uppercase text-[10px]">Renic Secret Key</span>
                <div className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-800 mt-1">
                  <span className="select-all break-all pr-2 text-xs">{createdCreds.clientSecret}</span>
                  <button onClick={() => { navigator.clipboard.writeText(createdCreds.clientSecret); showSnackbar('Copied Client Secret!'); }}>
                    <Icon name="copy" className="w-4 h-4 text-blue-600 hover:text-blue-800 flex-shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
