import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const BILLING_CYCLES = [
  { value: '1_MONTH', label: 'Monthly (30 Days)' },
  { value: '3_MONTHS', label: 'Quarterly (90 Days)' },
  { value: '6_MONTHS', label: 'Half-Yearly (180 Days)' },
  { value: '1_YEAR', label: 'Yearly (365 Days)' },
  { value: 'LIFETIME', label: 'Lifetime License' }
];

const DEFAULT_TIER_FORM = {
  name: '',
  code: '',
  appCode: '',
  price: 1999,
  currency: 'INR',
  billingCycle: '1_MONTH',
  description: '',
  allowedScreens: [],
  maxUsers: 5,
  maxContacts: 10000,
  maxMonthlyMessages: 50000,
  maxProducts: 5000,
  maxFloors: 2,
  isActive: true,
  isPopular: false,
  badgeText: ''
};

export default function PlanTiers() {
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [plans, setPlans] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppFilter, setSelectedAppFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_TIER_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Available Screens for the currently selected App in modal
  const [availableScreens, setAvailableScreens] = useState([]);
  const [screensLoading, setScreensLoading] = useState(false);

  // Fetch Applications List Dynamically
  const fetchApps = useCallback(async () => {
    try {
      const res = await api.get('/applications');
      const appList = res.data.applications || [];
      setApps(appList);
      return appList;
    } catch (err) {
      console.error('Failed to load apps:', err);
      return [];
    }
  }, []);

  // Fetch Plan Tiers
  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/plan-tiers');
      if (res.data?.success) {
        setPlans(res.data.data || []);
      }
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to load plan tiers', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchApps();
    fetchPlans();
  }, [fetchApps, fetchPlans]);

  // Load available screens whenever the modal's appCode changes
  const fetchScreensForApp = useCallback(async (appCode) => {
    if (!appCode) {
      setAvailableScreens([]);
      return;
    }
    try {
      setScreensLoading(true);
      const res = await api.get(`/plan-tiers/screens/${appCode}`);
      if (res.data?.success) {
        setAvailableScreens(res.data.screens || []);
      }
    } catch (err) {
      console.error('Failed to load screens for app:', err);
      setAvailableScreens([]);
    } finally {
      setScreensLoading(false);
    }
  }, []);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    const initialApp = (selectedAppFilter !== 'ALL' ? selectedAppFilter : apps[0]?.appCode) || 'WA_INSTA_AUTOMATION';
    setFormData({
      ...DEFAULT_TIER_FORM,
      appCode: initialApp,
      allowedScreens: []
    });
    fetchScreensForApp(initialApp);
    setModalOpen(true);
  };

  const handleOpenEditModal = (plan) => {
    setModalMode('edit');
    setEditingId(plan._id);
    const targetApp = plan.appCode || 'WA_INSTA_AUTOMATION';
    setFormData({
      name: plan.name || '',
      code: plan.code || '',
      appCode: targetApp,
      price: plan.price || 0,
      currency: plan.currency || 'INR',
      billingCycle: plan.billingCycle || '1_MONTH',
      description: plan.description || '',
      allowedScreens: Array.isArray(plan.allowedScreens) ? plan.allowedScreens : [],
      maxUsers: plan.maxUsers || 5,
      maxContacts: plan.maxContacts || 10000,
      maxMonthlyMessages: plan.maxMonthlyMessages || 50000,
      maxProducts: plan.maxProducts || 5000,
      maxFloors: plan.maxFloors || 2,
      isActive: plan.isActive !== false,
      isPopular: Boolean(plan.isPopular),
      badgeText: plan.badgeText || ''
    });
    fetchScreensForApp(targetApp);
    setModalOpen(true);
  };

  const handleAppChangeInModal = (newAppCode) => {
    setFormData((prev) => ({
      ...prev,
      appCode: newAppCode,
      allowedScreens: [] // reset screens when app changes
    }));
    fetchScreensForApp(newAppCode);
  };

  const toggleScreenSelection = (screenKey) => {
    setFormData((prev) => {
      const current = prev.allowedScreens || [];
      const updated = current.includes(screenKey)
        ? current.filter((k) => k !== screenKey)
        : [...current, screenKey];
      return { ...prev, allowedScreens: updated };
    });
  };

  const handleSelectAllScreens = () => {
    const allKeys = availableScreens.map((s) => s.key);
    setFormData((prev) => ({ ...prev, allowedScreens: allKeys }));
  };

  const handleClearAllScreens = () => {
    setFormData((prev) => ({ ...prev, allowedScreens: [] }));
  };

  const handleSubmitForm = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      showSnackbar('Plan name and unique plan code are required.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (modalMode === 'create') {
        const res = await api.post('/plan-tiers', formData);
        if (res.data?.success) {
          showSnackbar(res.data.message || 'Plan Tier created successfully!', 'success');
          setModalOpen(false);
          fetchPlans();
        }
      } else {
        const res = await api.put(`/plan-tiers/${editingId}`, formData);
        if (res.data?.success) {
          showSnackbar(res.data.message || 'Plan Tier updated successfully!', 'success');
          setModalOpen(false);
          fetchPlans();
        }
      }
    } catch (err) {
      showSnackbar(err.response?.data?.error || err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (plan) => {
    const confirmed = await confirmDialog({
      title: `Delete Plan Tier "${plan.name}"?`,
      message: `Are you sure you want to delete '${plan.name}' (${plan.code})? This will not affect active client licenses but will remove this tier from available choices.`,
      confirmText: 'Delete Plan',
      danger: true
    });
    if (!confirmed) return;

    try {
      const res = await api.delete(`/plan-tiers/${plan._id}`);
      if (res.data?.success) {
        showSnackbar('Plan Tier deleted successfully', 'success');
        fetchPlans();
      }
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to delete plan', 'error');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setLoading(true);
      const res = await api.post('/plan-tiers/seed-defaults');
      if (res.data?.success) {
        showSnackbar('Default plan tiers seeded successfully!', 'success');
        fetchPlans();
      }
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to seed plan tiers', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (selectedAppFilter !== 'ALL' && p.appCode !== selectedAppFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.appCode && p.appCode.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [plans, selectedAppFilter, searchQuery]);

  // Group available screens by category
  const screensByCategory = useMemo(() => {
    return availableScreens.reduce((acc, screen) => {
      const cat = screen.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(screen);
      return acc;
    }, {});
  }, [availableScreens]);

  const getAppName = (appCode) => {
    const found = apps.find((a) => a.appCode === appCode);
    return found ? found.name : appCode;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f6f8] overflow-hidden text-slate-800">
      {/* Top Header Card */}
      <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Plan Tiers &amp; Screen Permissions
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-lime-400">
                {plans.length} Tiers
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage subscription packages, pricing slabs, allowed screen modules, and tenant limits
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSeedDefaults}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
              title="Reset default tiers"
            >
              <Icon name="refresh" className="w-3.5 h-3.5 inline mr-1" /> Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-bold text-xs rounded-lg shadow-xs transition"
            >
              <Icon name="plus" className="w-3.5 h-3.5 stroke-[2.5]" /> Create Plan Tier
            </button>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search plans by name, code, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
            />
            <span className="absolute left-2.5 top-2 text-slate-400">
              <Icon name="search" className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* App Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedAppFilter('ALL')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition whitespace-nowrap ${
              selectedAppFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            All Apps ({plans.length})
          </button>
          {apps.map((app) => {
            const count = plans.filter((p) => p.appCode === app.appCode).length;
            return (
              <button
                key={app.appCode}
                type="button"
                onClick={() => setSelectedAppFilter(app.appCode)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                  selectedAppFilter === app.appCode
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {app.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table Layout */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="py-2.5 px-3">Plan Name &amp; Code</th>
                <th className="py-2.5 px-3">Target Application</th>
                <th className="py-2.5 px-3">Price / Cycle</th>
                <th className="py-2.5 px-3">Allowed Screens</th>
                <th className="py-2.5 px-3">Limits &amp; Quotas</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Icon name="refresh" className="w-6 h-6 animate-spin mx-auto text-[#65a30d] mb-2" />
                    <span className="font-semibold">Loading plan tiers...</span>
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <p className="font-bold text-slate-700 text-sm">No plan tiers found</p>
                    <p className="text-xs text-slate-400 mt-1">Click &quot;Create Plan Tier&quot; to define a new pricing package.</p>
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const allowedCount = Array.isArray(plan.allowedScreens) ? plan.allowedScreens.length : 0;
                  const isPopular = Boolean(plan.isPopular || plan.badgeText);

                  return (
                    <tr
                      key={plan._id}
                      className={`hover:bg-slate-50/80 transition ${
                        isPopular ? 'border-l-4 border-l-[#84cc16]' : 'border-l-4 border-l-transparent'
                      }`}
                    >
                      {/* Plan Name & Code */}
                      <td className="py-3 px-3 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">{plan.name}</span>
                          {plan.badgeText && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#84cc16]/20 text-[#0f172a] border border-[#84cc16]/40">
                              {plan.badgeText}
                            </span>
                          )}
                          {plan.isPopular && !plan.badgeText && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 font-bold mt-0.5">
                          {plan.code}
                        </div>
                        {plan.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs line-clamp-1">
                            {plan.description}
                          </div>
                        )}
                      </td>

                      {/* Application */}
                      <td className="py-3 px-3 align-top">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                          {getAppName(plan.appCode)}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {plan.appCode}
                        </div>
                      </td>

                      {/* Price & Cycle */}
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900 text-xs">
                          ₹{Number(plan.price).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          / {plan.billingCycle?.replace('_', ' ').toLowerCase() || 'month'}
                        </div>
                      </td>

                      {/* Screens Allowed */}
                      <td className="py-3 px-3 align-top">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                            {allowedCount} Screen{allowedCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(plan.allowedScreens || []).slice(0, 4).map((scr) => (
                            <span
                              key={scr}
                              className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600"
                            >
                              {scr}
                            </span>
                          ))}
                          {(plan.allowedScreens || []).length > 4 && (
                            <span className="text-[9px] font-bold text-slate-400">
                              +{(plan.allowedScreens || []).length - 4} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Limits / Quotas */}
                      <td className="py-3 px-3 align-top text-[11px] text-slate-600">
                        <div><b className="text-slate-800">{plan.maxUsers || 5}</b> Users</div>
                        {plan.maxContacts ? <div><b className="text-slate-800">{(plan.maxContacts).toLocaleString()}</b> Contacts</div> : null}
                        {plan.maxProducts ? <div><b className="text-slate-800">{(plan.maxProducts).toLocaleString()}</b> Products</div> : null}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 align-top">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            plan.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td className="py-3 px-3 align-top text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(plan)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Plan Tier"
                          >
                            <Icon name="edit" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlan(plan)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Plan Tier"
                          >
                            <Icon name="trash" className="w-3.5 h-3.5" />
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

      {/* ── CREATE / EDIT PLAN TIER MODAL ── */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modalMode === 'create' ? 'Create New Application Plan Tier' : `Edit Plan Tier (${formData.code})`}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
            {/* 1. App & Basic Identity */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                1. Target Application &amp; Tier Details
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Application *
                  </label>
                  <select
                    value={formData.appCode}
                    onChange={(e) => handleAppChangeInModal(e.target.value)}
                    disabled={modalMode === 'edit'}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#84cc16]"
                  >
                    {apps.map((app) => (
                      <option key={app.appCode} value={app.appCode}>{app.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pro Business Plan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unique Plan Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit'}
                    placeholder="e.g. WA_PRO"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price (INR) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    {BILLING_CYCLES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Badge Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Most Popular"
                    value={formData.badgeText}
                    onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plan Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Summary of what is included in this tier..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
            </div>

            {/* 2. Allowed Dynamic Screens for this App */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    2. Allowed Screen Modules ({formData.allowedScreens?.length || 0} / {availableScreens.length} Selected)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Only selected screens will be enabled for customer instances subscribed to this plan.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSelectAllScreens}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllScreens}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {screensLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-1" />
                  <span>Loading screens for {formData.appCode}...</span>
                </div>
              ) : availableScreens.length === 0 ? (
                <div className="p-6 text-center bg-white rounded-lg border border-slate-200 text-slate-400">
                  No screens mapped for this application yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {Object.entries(screensByCategory).map(([category, screensList]) => (
                    <div key={category} className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-700 block mb-2 text-[11px] uppercase tracking-wider text-[#65a30d]">
                        {category}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {screensList.map((screen) => {
                          const isChecked = (formData.allowedScreens || []).includes(screen.key);
                          return (
                            <label
                              key={screen.key}
                              className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                                isChecked
                                  ? 'bg-lime-50/70 border-[#84cc16]'
                                  : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleScreenSelection(screen.key)}
                                className="mt-0.5 rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16]"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 block leading-tight">{screen.label}</span>
                                <span className="text-[10px] font-mono text-slate-400">{screen.key}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Quotas & Limits */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                3. Tenant Limits &amp; Quotas
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Users</label>
                  <input
                    type="number"
                    value={formData.maxUsers}
                    onChange={(e) => setFormData({ ...formData, maxUsers: Number(e.target.value) })}
                    className="w-full px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Contacts</label>
                  <input
                    type="number"
                    value={formData.maxContacts}
                    onChange={(e) => setFormData({ ...formData, maxContacts: Number(e.target.value) })}
                    className="w-full px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Monthly Msgs</label>
                  <input
                    type="number"
                    value={formData.maxMonthlyMessages}
                    onChange={(e) => setFormData({ ...formData, maxMonthlyMessages: Number(e.target.value) })}
                    className="w-full px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Products/Items</label>
                  <input
                    type="number"
                    value={formData.maxProducts}
                    onChange={(e) => setFormData({ ...formData, maxProducts: Number(e.target.value) })}
                    className="w-full px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16]"
                  />
                  <span>Active Tier</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.isPopular}
                    onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                    className="rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16]"
                  />
                  <span>Mark as Popular / Featured</span>
                </label>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-1.5 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition"
              >
                {submitting ? 'Saving...' : modalMode === 'create' ? 'Create Plan Tier' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
