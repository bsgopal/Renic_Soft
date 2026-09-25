import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const DEFAULT_NEW_APP = {
  name: '',
  appCode: '',
  urlSlug: '',
  category: 'Retail POS',
  defaultPort: 5180,
  description: '',
  githubUrl: '',
  localRepoPath: '',
  autoExtractAI: true
};

export default function ApplicationHub() {
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [apps, setApps] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Action states
  const [syncingId, setSyncingId] = useState(null);
  const [extractingId, setExtractingId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Register New App Modal
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState(DEFAULT_NEW_APP);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  // Edit App Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Feature Mappings Modal
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [selectedAppForFeatures, setSelectedAppForFeatures] = useState(null);
  const [featureMappingsList, setFeatureMappingsList] = useState([]);
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Customer Fleet Dialogue (opened on row click!)
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedAppForCustomers, setSelectedAppForCustomers] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [appsRes, clientsRes] = await Promise.all([
        api.get('/applications'),
        api.get('/clients').catch(() => ({ data: [] }))
      ]);
      setApps(appsRes.data.applications || []);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load applications', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Robust client matching helper
  const getAppAssignedClients = useCallback((app) => {
    if (!app || !clients) return [];
    const appCode = (app.appCode || '').trim().toUpperCase();
    const appSlug = (app.urlSlug || '').trim().toLowerCase();
    const appName = (app.name || '').trim().toLowerCase();
    const appId = String(app._id || '');

    return clients.filter(c => {
      const prod = (c.softwareProduct || '').trim().toUpperCase();
      if (prod && prod === appCode) return true;
      if (c.softwareProduct && c.softwareProduct.toLowerCase() === appSlug) return true;
      if (c.softwareProduct && c.softwareProduct.toLowerCase() === appName) return true;
      if (c.softwareProduct && String(c.softwareProduct) === appId) return true;
      if (Array.isArray(c.allowedApps)) {
        if (c.allowedApps.some(a => String(a).toUpperCase() === appCode || String(a).toLowerCase() === appSlug || String(a) === appId)) {
          return true;
        }
      }
      return false;
    });
  }, [clients]);

  // 1-Click Copy helper
  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    showSnackbar(`Copied ${label} to clipboard!`, 'success');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Row Click: Open Customers Dialogue directly
  const handleRowClick = (app) => {
    setSelectedAppForCustomers(app);
    setCustomerSearch('');
    setCustomerModalOpen(true);
  };

  // Handle Name Input change for auto-generation of Code & Slug
  const handleNameChange = (val) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
    const code = val.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
    setRegisterForm(prev => ({
      ...prev,
      name: val,
      appCode: prev.appCode === '' || prev.appCode === prev.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20) ? code : prev.appCode,
      urlSlug: prev.urlSlug === '' || prev.urlSlug === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) ? slug : prev.urlSlug
    }));
  };

  // Submit New App Registration
  const handleRegisterApp = async (e) => {
    e.preventDefault();
    if (!registerForm.name || !registerForm.appCode || !registerForm.defaultPort) {
      showSnackbar('Please provide App Name, Technical Code, and Default Port', 'warning');
      return;
    }

    try {
      setRegisterSubmitting(true);
      const res = await api.post('/applications', {
        name: registerForm.name,
        appCode: registerForm.appCode,
        urlSlug: registerForm.urlSlug || registerForm.appCode.toLowerCase(),
        category: registerForm.category,
        defaultPort: Number(registerForm.defaultPort),
        description: registerForm.description,
        githubUrl: registerForm.githubUrl || registerForm.localRepoPath
      });

      const createdApp = res.data.application;
      showSnackbar(`Application "${createdApp.name}" registered successfully!`, 'success');

      // Auto-extract routes if requested
      if (registerForm.autoExtractAI && (registerForm.githubUrl || registerForm.localRepoPath)) {
        try {
          await api.post('/applications/ai-extract', {
            appCode: createdApp.appCode,
            repoPath: registerForm.localRepoPath || registerForm.githubUrl
          });
          showSnackbar('AI auto-discovered routes and features for ' + createdApp.name, 'success');
        } catch {
          // ignore extraction error on creation
        }
      }

      setRegisterOpen(false);
      setRegisterForm(DEFAULT_NEW_APP);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to register application', 'error');
    } finally {
      setRegisterSubmitting(false);
    }
  };

  // Open Edit App Modal
  const handleOpenEdit = (app) => {
    setEditingApp(app);
    setEditForm({
      name: app.name,
      urlSlug: app.urlSlug || '',
      category: app.category || 'General',
      defaultPort: app.defaultPort || 5000,
      description: app.description || '',
      githubUrl: app.githubUrl || app.localRepoPath || ''
    });
    setEditOpen(true);
  };

  // Submit App Edit
  const handleUpdateApp = async (e) => {
    e.preventDefault();
    try {
      setEditSubmitting(true);
      await api.put(`/applications/${editingApp._id}`, editForm);
      showSnackbar(`Updated "${editForm.name}" successfully!`, 'success');
      setEditOpen(false);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update application', 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Delete App
  const handleDeleteApp = async (app) => {
    if (app.isSystem) {
      showSnackbar('Core system applications cannot be removed.', 'warning');
      return;
    }

    const assignedCount = getAppAssignedClients(app).length;
    const confirmed = await confirmDialog(
      `Are you sure you want to delete application "${app.name}" (${app.appCode})?${
        assignedCount > 0 ? ` WARNING: ${assignedCount} customer tenant(s) are currently assigned to this application!` : ''
      }`,
      { title: 'Confirm Delete Application', confirmText: 'Yes, Delete', isDestructive: true }
    );

    if (!confirmed) return;

    try {
      await api.delete(`/applications/${app._id}`);
      showSnackbar(`Application "${app.name}" deleted`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete application', 'error');
    }
  };

  // Hot Git Sync
  const handleSyncGit = async (app) => {
    try {
      setSyncingId(app._id);
      const res = await api.post(`/applications/${app._id}/git-sync`);
      showSnackbar(`Git Sync Complete: Commit ${res.data.commit?.hash || 'OK'}`, 'success');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Git pull failed', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  // Gemini AI Route & Feature Extraction
  const handleExtractAI = async (app) => {
    try {
      setExtractingId(app._id);
      const res = await api.post('/applications/ai-extract', {
        appCode: app.appCode,
        repoPath: app.localRepoPath || app.githubUrl
      });
      showSnackbar(
        `AI Extracted ${res.data.screensCount || 0} routes & ${res.data.featuresCount || 0} features!`,
        'success'
      );
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'AI route extraction failed', 'error');
    } finally {
      setExtractingId(null);
    }
  };

  // Open Feature Mappings Modal
  const handleOpenFeatureMappings = (app) => {
    setSelectedAppForFeatures(app);
    let mappings = [];
    if (app.featureMappings && app.featureMappings.length > 0) {
      mappings = JSON.parse(JSON.stringify(app.featureMappings));
    } else if (app.features && app.features.length > 0) {
      mappings = app.features.map(f => ({
        customDisplayName: f.label || f.key,
        folderCategory: 'General',
        technicalTarget: f.key,
        screenPath: `/${f.key}`,
        description: '',
        defaultEnabled: f.defaultEnabled !== false
      }));
    } else {
      mappings = [
        {
          customDisplayName: 'POS Counter Billing Desk',
          folderCategory: 'Billing & POS',
          technicalTarget: 'posBilling',
          screenPath: '/billing',
          description: 'Fast billing, barcode scanning, cash and UPI checkout',
          defaultEnabled: true
        },
        {
          customDisplayName: 'Real-Time Inventory & Stock Ledger',
          folderCategory: 'Inventory',
          technicalTarget: 'inventory',
          screenPath: '/inventory',
          description: 'Multi-rack stock levels, low-stock notifications',
          defaultEnabled: true
        }
      ];
    }
    setFeatureMappingsList(mappings);
    setFeaturesOpen(true);
  };

  // Add Row in Feature Mappings Editor
  const handleAddFeatureRow = () => {
    setFeatureMappingsList(prev => [
      ...prev,
      {
        customDisplayName: '',
        folderCategory: 'General',
        technicalTarget: '',
        screenPath: '',
        description: '',
        defaultEnabled: true
      }
    ]);
  };

  // Update Field in Feature Mapping Row
  const handleUpdateFeatureField = (index, field, value) => {
    setFeatureMappingsList(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Remove Row in Feature Mapping Editor
  const handleRemoveFeatureRow = (index) => {
    setFeatureMappingsList(prev => prev.filter((_, i) => i !== index));
  };

  // Save Feature Mappings to Backend
  const handleSaveFeatureMappings = async () => {
    if (!selectedAppForFeatures) return;
    const invalid = featureMappingsList.some(r => !r.customDisplayName?.trim() || !r.technicalTarget?.trim());
    if (invalid) {
      showSnackbar('Each row must have both a Customer Display Name and a Technical Target Key', 'warning');
      return;
    }

    try {
      setSavingFeatures(true);
      await api.put(`/applications/${selectedAppForFeatures._id}/feature-mappings`, {
        featureMappings: featureMappingsList
      });
      showSnackbar(`Saved ${featureMappingsList.length} feature mappings for ${selectedAppForFeatures.name}!`, 'success');
      setFeaturesOpen(false);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save feature mappings', 'error');
    } finally {
      setSavingFeatures(false);
    }
  };

  // Categories list for filter chips
  const categories = ['ALL', 'Retail POS', 'Marketing SaaS', 'Logistics', 'Enterprise ERP', 'Accounting & ERP', 'Healthcare', 'Custom', 'General'];

  // Filtered Apps
  const filteredApps = apps.filter(app => {
    const matchesSearch =
      !search ||
      app.name?.toLowerCase().includes(search.toLowerCase()) ||
      app.appCode?.toLowerCase().includes(search.toLowerCase()) ||
      app.urlSlug?.toLowerCase().includes(search.toLowerCase()) ||
      String(app.defaultPort).includes(search);

    const matchesCategory = categoryFilter === 'ALL' || app.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2">
              <span>Renic Master</span>
              <span>/</span>
              <span>PaaS Cloud</span>
              <span>/</span>
              <span>Software Applications</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Software Application Hub</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                PaaS Architecture
              </span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Register new software products, customize feature naming and technical mappings, synchronize latest Git commits, and view real-time customer fleet assignments.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => fetchData()}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
              title="Refresh applications"
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
              to="/licenses"
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1.5"
              title="View Customer Licenses & Fleet"
            >
              <Icon name="store" className="w-3.5 h-3.5 text-emerald-400" />
              <span>Customer Fleet</span>
            </Link>

            <button
              onClick={() => {
                setRegisterForm(DEFAULT_NEW_APP);
                setRegisterOpen(true);
              }}
              className="px-4 py-2 text-xs font-extrabold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 transition flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <Icon name="plus" className="w-4 h-4 text-slate-950 stroke-[3]" />
              Register New Application
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Registered Products</span>
            <span className="text-lg font-black text-white">{apps.length} PaaS Apps</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Connected Tenants</span>
            <span className="text-lg font-black text-emerald-400">{clients.length} Customers</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Auto-Discovered Modules</span>
            <span className="text-lg font-black text-cyan-400">
              {apps.reduce((acc, a) => acc + (a.featureMappings?.length || a.screens?.length || 0), 0)} Features
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Git Hot Sync</span>
            <span className="text-lg font-black text-indigo-400">Zero-Downtime</span>
          </div>
        </div>
      </div>

      {/* Filter, Search & View Toggle Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 md:w-72">
            <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by app name, code, port, or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle (Table / Grid) */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">View:</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View (Click any row to open Customer Fleet details)"
            >
              <Icon name="list" className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grid Cards View"
            >
              <Icon name="grid" className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200">
          <Icon name="refresh" className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm font-semibold">Loading PaaS Application Catalog...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <Icon name="store" className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="font-bold text-slate-700 text-base">No Applications Found</div>
          <p className="text-xs max-w-sm mx-auto text-slate-500">
            {search ? 'Try adjusting your search criteria.' : 'Click "Register New Application" to add your first software product.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ============ TABLE VIEW (DEFAULT) ============ */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Showing <strong>{filteredApps.length}</strong> Registered Applications</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-emerald-600 font-bold">💡 Tip:</span> Click anywhere on an application row to view subscribed customers, URLs & Target IPs.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-black text-[10px] tracking-wider select-none">
                  <th className="py-3.5 px-4 font-black">Application & Architecture</th>
                  <th className="py-3.5 px-3 font-black">Category & Port</th>
                  <th className="py-3.5 px-3 font-black">Subdomain Slug</th>
                  <th className="py-3.5 px-3 font-black">Git Branch & Status</th>
                  <th className="py-3.5 px-3 font-black text-center">Modules</th>
                  <th className="py-3.5 px-4 font-black text-center">Subscribed Customers</th>
                  <th className="py-3.5 px-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map((app) => {
                  const mappedCount = app.featureMappings?.length || app.screens?.length || 0;
                  const assignedClients = getAppAssignedClients(app);
                  const hasClients = assignedClients.length > 0;

                  return (
                    <tr
                      key={app._id || app.appCode}
                      onClick={() => handleRowClick(app)}
                      className="cursor-pointer hover:bg-emerald-50/40 transition-colors group"
                      title="Click row to inspect subscribed customer details, URLs & IPs"
                    >
                      {/* Column 1: Application Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs group-hover:bg-emerald-600 transition-colors">
                            {app.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-sm group-hover:text-emerald-950 transition-colors">
                                {app.name}
                              </span>
                              {app.isSystem ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                  Core System
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Custom PaaS
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {app.appCode}
                              </span>
                              {app.description && (
                                <span className="text-[11px] text-slate-500 truncate max-w-xs block">
                                  {app.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Category & Port */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {app.category || 'General'}
                          </span>
                          <div className="font-mono text-xs text-slate-700 font-semibold flex items-center gap-1">
                            <span className="text-slate-400">Port:</span>
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-bold">
                              :{app.defaultPort}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 3: URL Slug */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-xs">
                          <span className="text-brand-700 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            /{app.urlSlug || 'app'}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            *.{app.urlSlug || 'app'}.renic.store
                          </span>
                        </div>
                      </td>

                      {/* Column 4: Git Branch & Commit */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-xs space-y-0.5">
                          <div className="flex items-center gap-1 text-slate-800">
                            <Icon name="gitBranch" className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-bold text-emerald-700">
                              {app.gitBranch || (app.gitCommitInfo?.branch) || 'main'}
                            </span>
                          </div>
                          {app.gitCommitInfo?.hash ? (
                            <span className="text-[10px] text-slate-500 block truncate max-w-[140px]" title={app.gitCommitInfo.message}>
                              #{app.gitCommitInfo.hash}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                              {app.localRepoPath ? 'Local Linked' : 'Standard Repo'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Modules Count */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {mappedCount} modules
                        </span>
                      </td>

                      {/* Column 6: Subscribed Customers (KEY HIGHLIGHT) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          {hasClients ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs group-hover:shadow-xs group-hover:bg-emerald-200 transition-all">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              {assignedClients.length} {assignedClients.length === 1 ? 'Customer' : 'Customers'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              0 Customers
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-700 group-hover:text-emerald-800 mt-1 flex items-center gap-0.5">
                            Click for details ↗
                          </span>
                        </div>
                      </td>

                      {/* Column 7: Action Buttons (e.stopPropagation to prevent row click) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Map Features Button */}
                          <button
                            onClick={() => handleOpenFeatureMappings(app)}
                            className="px-2.5 py-1.5 text-xs font-extrabold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center gap-1"
                            title="Map Custom Display Names to Technical Routes"
                          >
                            <span>⚙️</span> Map
                          </button>

                          {/* Sync Git Button */}
                          <button
                            onClick={() => handleSyncGit(app)}
                            disabled={syncingId === app._id}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Pull latest Git commit"
                          >
                            <Icon name="refresh" className={`w-3.5 h-3.5 ${syncingId === app._id ? 'animate-spin text-emerald-500' : ''}`} />
                          </button>

                          {/* AI Extract Button */}
                          <button
                            onClick={() => handleExtractAI(app)}
                            disabled={extractingId === app._id}
                            className="p-1.5 rounded-xl border border-indigo-200 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition"
                            title="AI auto-extract routes & features"
                          >
                            <Icon name="search" className={`w-3.5 h-3.5 ${extractingId === app._id ? 'animate-spin' : ''}`} />
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(app)}
                            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Edit App Parameters"
                          >
                            <Icon name="edit" className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          {!app.isSystem && (
                            <button
                              onClick={() => handleDeleteApp(app)}
                              className="p-1.5 rounded-xl border border-rose-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                              title="Delete Application"
                            >
                              <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ============ GRID CARDS VIEW ============ */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredApps.map((app) => {
            const mappedCount = app.featureMappings?.length || app.screens?.length || 0;
            const assignedClients = getAppAssignedClients(app);

            return (
              <div
                key={app._id || app.appCode}
                onClick={() => handleRowClick(app)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between cursor-pointer group"
                title="Click card to inspect subscribed customer details, URLs & IPs"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-extrabold text-slate-900 text-base leading-tight group-hover:text-emerald-950 transition-colors">
                          {app.name}
                        </h2>
                        {app.isSystem ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                            Core System
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Custom PaaS
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {app.appCode}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Port: <strong>{app.defaultPort}</strong>
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-600 font-bold">
                          slug: <span className="text-brand-600">{app.urlSlug || 'app'}</span>
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                      {app.category || 'General'}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                    {app.description || 'No description configured.'}
                  </p>

                  {/* Git & Infrastructure Box */}
                  <div className="bg-slate-900 text-white rounded-xl p-3.5 mt-4 font-mono text-xs space-y-1.5 shadow-inner">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Git Branch:</span>
                      <span className="text-emerald-400 font-bold">
                        {app.gitBranch || (app.gitCommitInfo?.branch) || 'main'}
                      </span>
                    </div>

                    {app.gitCommitInfo?.hash ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Last Commit:</span>
                          <span className="text-cyan-300 font-bold">{app.gitCommitInfo.hash}</span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate mt-0.5 italic">
                          &quot;{app.gitCommitInfo.message}&quot;
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic truncate">
                        Repo: {app.localRepoPath || app.githubUrl || 'Local Workspace Linked'}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                      <span>Features Auto-Discovered:</span>
                      <span className="font-bold text-amber-400">{mappedCount} modules</span>
                    </div>
                  </div>

                  {/* Connected Customers Pill (Clickable) */}
                  <div className="flex items-center justify-between text-xs mt-3.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 group-hover:bg-emerald-50/60 transition-colors">
                    <span className="text-slate-600 font-medium">Assigned Customers:</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${assignedClients.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'} inline-block`} />
                      <span className="text-emerald-900 font-extrabold">{assignedClients.length} Showrooms running</span>
                      <span className="text-slate-400 font-normal">· Click to view ↗</span>
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div
                  className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    {/* AI Feature Discovery Button */}
                    <button
                      onClick={() => handleExtractAI(app)}
                      disabled={extractingId === app._id}
                      className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1"
                      title="Run AI route detection on repo"
                    >
                      <Icon name="search" className={`w-3.5 h-3.5 ${extractingId === app._id ? 'animate-spin text-indigo-600' : ''}`} />
                      {extractingId === app._id ? 'Analyzing...' : 'AI Extract'}
                    </button>

                    {/* Hot Git Sync Button */}
                    <button
                      onClick={() => handleSyncGit(app)}
                      disabled={syncingId === app._id}
                      className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition flex items-center gap-1 shadow-2xs"
                      title="Pull latest Git commit without restart"
                    >
                      <Icon name="refresh" className={`w-3.5 h-3.5 ${syncingId === app._id ? 'animate-spin text-emerald-400' : ''}`} />
                      {syncingId === app._id ? 'Syncing...' : 'Sync Git'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Feature Mappings Editor Button */}
                    <button
                      onClick={() => handleOpenFeatureMappings(app)}
                      className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center gap-1"
                      title="Map custom display names to technical targets"
                    >
                      <span>⚙️</span> Map Features ({mappedCount})
                    </button>

                    {/* Edit App Button */}
                    <button
                      onClick={() => handleOpenEdit(app)}
                      className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                      title="Edit Application Parameters"
                    >
                      <Icon name="edit" className="w-4 h-4" />
                    </button>

                    {/* Delete App Button */}
                    {!app.isSystem && (
                      <button
                        onClick={() => handleDeleteApp(app)}
                        className="p-1.5 rounded-xl border border-rose-200 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                        title="Delete Application"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============ DIALOGUE: SUBSCRIBED CUSTOMERS & FLEET (OPENED ON ROW CLICK) ============ */}
      {customerModalOpen && selectedAppForCustomers && (() => {
        const assignedCustomers = getAppAssignedClients(selectedAppForCustomers);
        const filteredCustomers = assignedCustomers.filter(c => {
          if (!customerSearch) return true;
          const q = customerSearch.toLowerCase();
          return (
            c.name?.toLowerCase().includes(q) ||
            c.customerCode?.toLowerCase().includes(q) ||
            c.pendingOwnerName?.toLowerCase().includes(q) ||
            c.pendingOwnerMobile?.includes(q) ||
            c.portForwarding?.targetIp?.includes(q) ||
            c.fullSaaSDomain?.toLowerCase().includes(q)
          );
        });

        return (
          <Modal
            open={customerModalOpen}
            onClose={() => setCustomerModalOpen(false)}
            title={
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 font-black">
                  <Icon name="store" className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{selectedAppForCustomers.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      {selectedAppForCustomers.appCode}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Fleet Overview: Subscribed Showroom Tenants, Production URLs & Network Target IPs
                  </p>
                </div>
              </div>
            }
            maxWidth="max-w-5xl"
            footer={
              <div className="flex items-center justify-between w-full">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Port: <strong>{selectedAppForCustomers.defaultPort}</strong></span>
                  <span>·</span>
                  <span>Slug: <strong>/{selectedAppForCustomers.urlSlug || 'app'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/licenses"
                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 shadow-xs"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" />
                    Provision New Customer Tenant
                  </Link>
                  <button
                    onClick={() => setCustomerModalOpen(false)}
                    className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Summary Header Inside Dialogue */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl">
                <div>
                  <div className="text-xs text-slate-400 font-medium">Active Fleet Deployment</div>
                  <div className="text-lg font-black text-white flex items-center gap-2">
                    <span>{assignedCustomers.length} {assignedCustomers.length === 1 ? 'Customer Showroom Subscribed' : 'Customer Showrooms Subscribed'}</span>
                    <span className="text-xs font-normal text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      100% Live Sync
                    </span>
                  </div>
                </div>

                {assignedCustomers.length > 2 && (
                  <div className="relative w-full sm:w-64">
                    <Icon name="search" className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter customers, URLs, IPs..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Customers List / Table */}
              {assignedCustomers.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                    <Icon name="store" className="w-6 h-6" />
                  </div>
                  <div className="font-extrabold text-slate-800 text-sm">
                    No Customers Assigned to {selectedAppForCustomers.name}
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    No customer showroom has been provisioned with this application code yet. You can launch the customer creation wizard and select <strong>{selectedAppForCustomers.name}</strong> in Step 3.
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/licenses"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      Provision First Customer with this Application
                    </Link>
                  </div>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No customers matched your filter &quot;{customerSearch}&quot;.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredCustomers.map((c) => {
                    const publicUrl = c.fullSaaSDomain || c.portForwarding?.publicWebUrl || (
                      `https://${(selectedAppForCustomers.urlSlug || 'app')}.${c.customerCode?.toLowerCase() || 'client'}.renic.store`
                    );
                    const targetIp = c.portForwarding?.targetIp || '127.0.0.1';
                    const targetPort = c.portForwarding?.assignedPort || c.assignedPort || selectedAppForCustomers.defaultPort;
                    const ipPortString = `${targetIp}:${targetPort}`;
                    const enabledScreensCount = Object.values(c.screenPermissions || {}).filter(Boolean).length;
                    const totalFeatures = selectedAppForCustomers.featureMappings?.length || 10;

                    return (
                      <div
                        key={c._id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all space-y-3"
                      >
                        {/* Row 1: Header - Customer Name, Code, Plan, Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-slate-900 text-sm">
                                  {c.name}
                                </h4>
                                <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {c.customerCode}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                  c.licenseStatus === 'active'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}>
                                  {c.licenseStatus || 'active'}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {c.planTier || 'enterprise'} Tier
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>Admin: <strong>{c.pendingOwnerName || 'Platform Admin'}</strong></span>
                                <span>·</span>
                                <span>Mobile: <strong>{c.pendingOwnerMobile || c.contact || 'N/A'}</strong></span>
                                {c.pendingOwnerEmail && (
                                  <>
                                    <span>·</span>
                                    <span>Email: <strong>{c.pendingOwnerEmail}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <Link
                              to="/licenses"
                              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1"
                              title="Configure in Customer Fleet"
                            >
                              <Icon name="edit" className="w-3.5 h-3.5" />
                              Configure Tenant
                            </Link>
                          </div>
                        </div>

                        {/* Row 2: Crucial Technical Details (URL, Target IP, Port, Connection) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                          {/* Dedicated Production / Public URL */}
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Icon name="store" className="w-3.5 h-3.5 text-emerald-600" />
                                Live Customer SaaS URL
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(publicUrl, `URL for ${c.name}`)}
                                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1"
                                >
                                  <Icon name="copy" className="w-3 h-3" />
                                  {copiedKey === `URL for ${c.name}` ? 'Copied!' : 'Copy URL'}
                                </button>
                                <a
                                  href={publicUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1"
                                  title="Open live client tenant web application"
                                >
                                  Open ↗
                                </a>
                              </div>
                            </div>
                            <div className="font-mono text-xs font-bold text-emerald-800 break-all bg-white p-2 rounded-lg border border-slate-200 select-all">
                              {publicUrl}
                            </div>
                          </div>

                          {/* Target IP, Port & Network Routing */}
                          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Icon name="network" className="w-3.5 h-3.5 text-sky-600" />
                                Network Routing (Target IP & Port)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(ipPortString, `IP:Port for ${c.name}`)}
                                className="px-2 py-0.5 text-[10px] font-bold rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-1"
                              >
                                <Icon name="copy" className="w-3 h-3" />
                                {copiedKey === `IP:Port for ${c.name}` ? 'Copied!' : 'Copy IP:Port'}
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-200">
                              <div className="font-mono text-xs">
                                <span className="text-slate-500 font-medium">Target IP: </span>
                                <strong className="text-slate-900">{targetIp}</strong>
                                <span className="text-slate-400 mx-1.5">:</span>
                                <span className="text-slate-500 font-medium">Port: </span>
                                <strong className="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                  {targetPort}
                                </strong>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                  {c.portForwarding?.connectionType || 'PORT_FORWARD_ROUTER'}
                                </span>
                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  {c.portForwarding?.status || 'online'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Security & Features Overview */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 bg-slate-50/50 px-3 py-2 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 font-mono">
                              <Icon name="key" className="w-3 h-3 text-slate-400" />
                              Client ID: <strong className="text-slate-800">{c.clientId || 'Generated on Provision'}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Zero-Trust OAuth Gate: <strong className={c.oauthEnforced ? 'text-emerald-700' : 'text-slate-700'}>
                                {c.oauthEnforced ? 'Enforced 🔒' : 'Permissive'}
                              </strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span>Feature Entitlement:</span>
                            <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {enabledScreensCount} / {totalFeatures} Modules Active
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ============ REGISTER NEW APPLICATION MODAL ============ */}
      {registerOpen && (
        <Modal
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          title="🚀 Register New PaaS Application"
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setRegisterOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegisterApp}
                disabled={registerSubmitting}
                className="px-5 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-md"
              >
                {registerSubmitting ? 'Registering...' : 'Register Application'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleRegisterApp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Application Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Renic Food Ordering Engine"
                  value={registerForm.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label">Technical App Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FOOD_ORDERING"
                  value={registerForm.appCode}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, appCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                  className="input text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">URL Subdomain Slug *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. food"
                  value={registerForm.urlSlug}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, urlSlug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                  className="input text-xs font-mono"
                />
              </div>

              <div>
                <label className="label">Local Port *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 5180"
                  value={registerForm.defaultPort}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, defaultPort: e.target.value }))}
                  className="input text-xs font-mono"
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  value={registerForm.category}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, category: e.target.value }))}
                  className="input text-xs"
                >
                  <option value="Retail POS">Retail POS</option>
                  <option value="Marketing SaaS">Marketing SaaS</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Accounting & ERP">Accounting & ERP</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Custom">Custom</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Git Repository Path or GitHub URL</label>
              <input
                type="text"
                placeholder="e.g. D:/Development/FoodEngine or https://github.com/renic/food-engine"
                value={registerForm.localRepoPath}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, localRepoPath: e.target.value }))}
                className="input text-xs font-mono"
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                rows={2}
                placeholder="Provide a clear summary of what this application does..."
                value={registerForm.description}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, description: e.target.value }))}
                className="input text-xs"
              />
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="autoExtractAI"
                checked={registerForm.autoExtractAI}
                onChange={(e) => setRegisterForm(prev => ({ ...prev, autoExtractAI: e.target.checked }))}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="autoExtractAI" className="text-xs text-emerald-950 font-medium cursor-pointer">
                <strong>Run AI Route & Feature Auto-Discovery</strong>
                <span className="block text-emerald-800 text-[11px] mt-0.5">
                  Automatically scans React router & Express endpoints in the repository to populate the feature mapping catalog.
                </span>
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* ============ EDIT APPLICATION MODAL ============ */}
      {editOpen && editingApp && (
        <Modal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title={`✏️ Edit Application: ${editingApp.name}`}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateApp}
                disabled={editSubmitting}
                className="px-5 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-md"
              >
                {editSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleUpdateApp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Application Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label">Technical App Code (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editingApp.appCode}
                  className="input text-xs font-mono uppercase bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">URL Subdomain Slug</label>
                <input
                  type="text"
                  value={editForm.urlSlug}
                  onChange={(e) => setEditForm(prev => ({ ...prev, urlSlug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                  className="input text-xs font-mono"
                />
              </div>

              <div>
                <label className="label">Local Port</label>
                <input
                  type="number"
                  value={editForm.defaultPort}
                  onChange={(e) => setEditForm(prev => ({ ...prev, defaultPort: e.target.value }))}
                  className="input text-xs font-mono"
                />
              </div>

              <div>
                <label className="label">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                  className="input text-xs"
                >
                  <option value="Retail POS">Retail POS</option>
                  <option value="Marketing SaaS">Marketing SaaS</option>
                  <option value="Logistics">Logistics</option>
                  <option value="Accounting & ERP">Accounting & ERP</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Custom">Custom</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Git Repository Path or GitHub URL</label>
              <input
                type="text"
                value={editForm.githubUrl}
                onChange={(e) => setEditForm(prev => ({ ...prev, githubUrl: e.target.value }))}
                className="input text-xs font-mono"
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="input text-xs"
              />
            </div>
          </form>
        </Modal>
      )}

      {/* ============ FEATURE MAPPINGS DRAWER / MODAL ============ */}
      {featuresOpen && selectedAppForFeatures && (
        <Modal
          open={featuresOpen}
          onClose={() => setFeaturesOpen(false)}
          title={`⚙️ Custom-to-Technical Feature Mappings: ${selectedAppForFeatures.name}`}
          maxWidth="max-w-5xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={handleAddFeatureRow}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-1.5"
              >
                <Icon name="plus" className="w-3.5 h-3.5" />
                Add Feature Row
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFeaturesOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveFeatureMappings}
                  disabled={savingFeatures}
                  className="px-5 py-2 text-xs font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 shadow-md"
                >
                  {savingFeatures ? 'Saving Mappings...' : `Save ${featureMappingsList.length} Feature Mappings`}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5">
              <span className="text-lg">💡</span>
              <div>
                <strong className="text-slate-900 block">1-to-1 Mapping Guidance:</strong>
                Configure the friendly display name that showroom customers see on their SaaS plan and screen menus, mapped directly to the technical route or permission gate in your React codebase.
              </div>
            </div>

            <div className="overflow-x-auto max-h-[60vh] border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 text-slate-600 uppercase font-black text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Customer Facing Display Name *</th>
                    <th className="py-2.5 px-3">Folder / Category</th>
                    <th className="py-2.5 px-3">Technical Target Key *</th>
                    <th className="py-2.5 px-3">Route / Screen Path</th>
                    <th className="py-2.5 px-3 text-center">Default (100%)</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {featureMappingsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No custom feature mappings created. Click &quot;Add Feature Row&quot; below.
                      </td>
                    </tr>
                  ) : (
                    featureMappingsList.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                          {idx + 1}
                        </td>

                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.customDisplayName}
                            onChange={(e) => handleUpdateFeatureField(idx, 'customDisplayName', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. POS Billing Desk"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.folderCategory}
                            onChange={(e) => handleUpdateFeatureField(idx, 'folderCategory', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Sales"
                          />
                        </td>

                        <td className="py-2 px-3 font-mono">
                          <input
                            type="text"
                            value={row.technicalTarget}
                            onChange={(e) => handleUpdateFeatureField(idx, 'technicalTarget', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono text-emerald-700 bg-emerald-50/50 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. posBilling"
                          />
                        </td>

                        <td className="py-2 px-3 font-mono">
                          <input
                            type="text"
                            value={row.screenPath}
                            onChange={(e) => handleUpdateFeatureField(idx, 'screenPath', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg font-mono text-slate-600 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. /billing"
                          />
                        </td>

                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.defaultEnabled !== false}
                            onChange={(e) => handleUpdateFeatureField(idx, 'defaultEnabled', e.target.checked)}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                        </td>

                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveFeatureRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Remove feature mapping"
                          >
                            <Icon name="x" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
