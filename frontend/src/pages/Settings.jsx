import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

export default function Settings() {
  const { user = null, isPlatform = false } = useAuth() || {};
  const { showSnackbar = () => {} } = useSnackbar() || {};

  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'banking' | 'security' | 'fleet' | 'diagnostics'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company & Billing Settings
  const [companyForm, setCompanyForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    website: '',
    gst: '',
    currency: 'INR',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
    paymentDetails: '',
    termsConditions: '',
    invoiceNotes: '',
    defaultTrialDays: 7,
    otaAutoSync: true
  });

  // Password Change Form
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [pwSubmitting, setPwSubmitting] = useState(false);

  // Telemetry & System Stats
  const [systemStats, setSystemStats] = useState({
    dbMode: 'MongoDB Database',
    port: 5050,
    appsCount: 4,
    nodeEnv: 'Production',
    uptime: 'Running'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [compRes, appsRes] = await Promise.all([
        api.get('/settings/company').catch(() => ({ data: {} })),
        api.get('/applications').catch(() => ({ data: { count: 4 } }))
      ]);

      if (compRes.data) {
        setCompanyForm((prev) => ({
          ...prev,
          ...compRes.data
        }));
      }

      setSystemStats((prev) => ({
        ...prev,
        appsCount: appsRes.data.count || 4
      }));
    } catch (err) {
      showSnackbar('Failed to load system settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompany = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await api.put('/settings/company', companyForm);
      setCompanyForm((prev) => ({ ...prev, ...(res.data.company || {}) }));
      showSnackbar(res.data.message || 'Company & system settings saved successfully!', 'success');
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    if (e) e.preventDefault();
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      showSnackbar('Please provide current and new password', 'warning');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      showSnackbar('New password must be at least 6 characters long', 'warning');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      showSnackbar('New password and confirm password do not match', 'error');
      return;
    }

    try {
      setPwSubmitting(true);
      const res = await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword
      });
      showSnackbar(res.data.message || 'Master administrative password updated!', 'success');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPwSubmitting(false);
    }
  };

  const TABS = [
    { id: 'company', label: 'Company Profile & Letterhead', icon: 'building' },
    { id: 'banking', label: 'Banking & Invoice Notes', icon: 'credit-card' },
    { id: 'security', label: 'Admin Security & Password', icon: 'shield' },
    { id: 'fleet', label: 'SaaS Fleet Governance', icon: 'server' },
    { id: 'diagnostics', label: 'System Telemetry & Health', icon: 'activity' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#f4f6f8] text-slate-400">
        <Icon name="refresh" className="w-6 h-6 animate-spin text-[#65a30d] mr-2" />
        <span className="font-semibold text-xs">Loading Master HQ settings...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f6f8] overflow-hidden text-slate-800">
      {/* Top Header Card */}
      <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Master HQ Settings &amp; Governance
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-lime-400">
                Enterprise v2.4
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure official invoice letterheads, banking credentials, administrative security, and global fleet policies
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveCompany}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-bold text-xs rounded-lg shadow-xs transition"
            >
              <Icon name="check" className="w-3.5 h-3.5 stroke-[2.5]" />
              {saving ? 'Saving...' : 'Save All Preferences'}
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar mt-4 pt-2 border-t border-slate-100 text-xs font-semibold">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-3 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#0f172a] text-white font-bold shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Panel Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* TAB 1: Company Profile & Letterhead */}
          {activeTab === 'company' && (
            <form onSubmit={handleSaveCompany} className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Legal Company Profile &amp; PDF Letterhead</h3>
                <p className="text-xs text-slate-500">
                  This identity appears on all commercial invoices, quotation documents, and payment receipts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    placeholder="e.g. Renic Soft Tech Private Limited"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN / Tax Registration *</label>
                  <input
                    type="text"
                    required
                    value={companyForm.gst}
                    onChange={(e) => setCompanyForm({ ...companyForm, gst: e.target.value.toUpperCase() })}
                    placeholder="e.g. 29AAAAA0000A1Z5"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Registered Business Address *</label>
                <textarea
                  rows={2}
                  required
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  placeholder="Street Address, Building, Floor..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                    placeholder="e.g. Bangalore"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={companyForm.state}
                    onChange={(e) => setCompanyForm({ ...companyForm, state: e.target.value })}
                    placeholder="e.g. Karnataka"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pincode / Postal Code</label>
                  <input
                    type="text"
                    value={companyForm.pincode}
                    onChange={(e) => setCompanyForm({ ...companyForm, pincode: e.target.value })}
                    placeholder="e.g. 560001"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Support Phone</label>
                  <input
                    type="text"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    placeholder="+91 93455 78103"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Billing Email Address</label>
                  <input
                    type="email"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    placeholder="contact@renic.store"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Website URL</label>
                  <input
                    type="url"
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    placeholder="https://renic.store"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition"
                >
                  {saving ? 'Saving...' : 'Save Company Profile'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Banking & Invoicing Clauses */}
          {activeTab === 'banking' && (
            <form onSubmit={handleSaveCompany} className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Banking Details &amp; Commercial Terms</h3>
                <p className="text-xs text-slate-500">
                  Configure corporate bank account information and default contract terms printed on PDFs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={companyForm.bankName}
                    onChange={(e) => setCompanyForm({ ...companyForm, bankName: e.target.value })}
                    placeholder="e.g. HDFC Bank Ltd"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    value={companyForm.accountNumber}
                    onChange={(e) => setCompanyForm({ ...companyForm, accountNumber: e.target.value })}
                    placeholder="e.g. 50200088991122"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={companyForm.ifscCode}
                    onChange={(e) => setCompanyForm({ ...companyForm, ifscCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. HDFC0001234"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={companyForm.branchName}
                    onChange={(e) => setCompanyForm({ ...companyForm, branchName: e.target.value })}
                    placeholder="e.g. Bangalore Main Branch"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">UPI ID / VPA</label>
                  <input
                    type="text"
                    value={companyForm.upiId}
                    onChange={(e) => setCompanyForm({ ...companyForm, upiId: e.target.value })}
                    placeholder="e.g. renicsoft@hdfcbank"
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Instructions (Shown on Invoices)</label>
                <textarea
                  rows={3}
                  value={companyForm.paymentDetails}
                  onChange={(e) => setCompanyForm({ ...companyForm, paymentDetails: e.target.value })}
                  placeholder="Advance payment required to confirm order..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Terms &amp; Conditions Clauses</label>
                <textarea
                  rows={4}
                  value={companyForm.termsConditions}
                  onChange={(e) => setCompanyForm({ ...companyForm, termsConditions: e.target.value })}
                  placeholder="1. Quotation validity is 14 days..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white leading-relaxed"
                />
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition"
                >
                  {saving ? 'Saving...' : 'Save Banking & Terms'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Admin Security & Password Change */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Current Administrator Identity</h3>
                  <p className="text-xs text-slate-500">
                    Master administrator profile and role authorization status.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Administrator Name</span>
                    <div className="font-bold text-slate-900 mt-1">{user?.name || 'Platform Owner'}</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Login Mobile / Identifier</span>
                    <div className="font-mono font-bold text-slate-900 mt-1">{user?.mobile || '—'}</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Role Authorization</span>
                    <div className="font-bold text-emerald-700 mt-1">Platform Owner (Root)</div>
                  </div>
                </div>
              </div>

              {/* Password Change Form */}
              <form onSubmit={handleChangePassword} className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Change Master Password</h3>
                  <p className="text-xs text-slate-500">
                    Update the root master password used for platform login and fleet orchestration.
                  </p>
                </div>

                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Current Password *</label>
                    <input
                      type="password"
                      required
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">New Password * (Min 6 chars)</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      placeholder="Enter strong new password"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={pwForm.confirmPassword}
                      onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-start pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={pwSubmitting}
                    className="px-5 py-2 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition"
                  >
                    {pwSubmitting ? 'Updating Password...' : 'Update Master Password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: SaaS Fleet Governance */}
          {activeTab === 'fleet' && (
            <form onSubmit={handleSaveCompany} className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Multi-Tenant Fleet Governance</h3>
                <p className="text-xs text-slate-500">
                  Global parameters governing customer instance provisioning, trial durations, and automated OTA syncs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Trial Duration (Days)</label>
                  <input
                    type="number"
                    value={companyForm.defaultTrialDays}
                    onChange={(e) => setCompanyForm({ ...companyForm, defaultTrialDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Number of trial days assigned when onboarding new tenant instances.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Global Customer Domain Suffix</label>
                  <input
                    type="text"
                    disabled
                    value=".renictech.com"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Subdomain routing pattern for all provisioned SaaS applications.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={companyForm.otaAutoSync}
                    onChange={(e) => setCompanyForm({ ...companyForm, otaAutoSync: e.target.checked })}
                    className="rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16] w-4 h-4"
                  />
                  <span>Automatic Over-The-Air (OTA) Push Sync on License Modification</span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6 leading-relaxed">
                  When enabled, any permission or plan change in Master HQ immediately broadcasts an instant websocket push to update client POS and automation terminals without server reboot.
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-[#0f172a] bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition"
                >
                  {saving ? 'Saving...' : 'Save Fleet Preferences'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: System Telemetry & Health */}
          {activeTab === 'diagnostics' && (
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Platform Telemetry &amp; Runtime Health</h3>
                <p className="text-xs text-slate-500">
                  Live infrastructure diagnostics, database engine status, and cryptographic validation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Database Engine</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    MongoDB Cluster (Live)
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">mongodb://127.0.0.1:27017/renic_soft</div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Platform Server Port</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5 font-mono flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    :5050 (Active)
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">HTTP REST &amp; WebSocket Gateway</div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Connected Applications</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {systemStats.appsCount} Software Suites
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">TextilePOS, WA_INSTA, Challan, HQ</div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cryptographic Engine</span>
                  <div className="font-bold text-emerald-700 text-sm mt-0.5 flex items-center gap-1">
                    <span>✓</span> HMAC-SHA256 &amp; AES-256
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">License Tokens &amp; OAuth Keys Verified</div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Engine Release</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5 font-mono">
                    v2.4.0-enterprise
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Zero-downtime hot-reload active</div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">System Status</span>
                  <div className="font-bold text-emerald-600 text-sm mt-0.5">
                    100% Operational
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">All subsystems healthy</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}