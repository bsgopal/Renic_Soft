import React, { useState, useEffect, useCallback } from 'react';
import api, { downloadFile } from '../api.js';
import Modal from '../components/Modal.jsx';
import Badge from '../components/Badge.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const DEFAULT_SHOP = {
  name: '',
  gstNumber: '',
  address: '',
  contact: '',
  planTier: 'basic',
  licenseDurationDays: 30,
  ownerEmail: '',
  ownerMobile: '',
  ownerPassword: ''
};

const DEFAULT_RENEWAL = {
  durationDays: 30,
  planTier: 'basic',
  licenseStatus: 'active'
};

const TIER_INFO = {
  basic: 'Basic Tier (1 floor, 3 users, 2K products)',
  pro: 'Pro Tier (3 floors, 10 users, 10K products)',
  enterprise: 'Enterprise Tier (Unlimited scale)'
};

export default function Licenses() {
  const { user } = useAuth();
  const { showSnackbar, confirmDialog } = useSnackbar();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newShop, setNewShop] = useState(DEFAULT_SHOP);
  const [renewal, setRenewal] = useState(DEFAULT_RENEWAL);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/clients');
      setClients(res.data);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load licenses', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const metrics = {
    total: clients.length,
    active: clients.filter((c) => c.licenseStatus === 'active').length,
    locked: clients.filter((c) => c.licenseStatus === 'locked' || c.licenseStatus === 'cancelled').length,
    expiring: clients.filter((c) => {
      const end = new Date(c.licenseEnd);
      const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      return new Date(c.licenseEnd) > new Date() && end < soon;
    }).length
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/clients', newShop);
      showSnackbar(res.data.message || 'License generated successfully');
      setOnboardOpen(false);
      setNewShop(DEFAULT_SHOP);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Error creating license', 'error');
    }
  };

  const openRenewModal = (clientObj) => {
    setSelectedClient(clientObj);
    setRenewal({
      durationDays: 30,
      planTier: clientObj.planTier || 'basic',
      licenseStatus: clientObj.licenseStatus || 'active'
    });
    setRenewOpen(true);
  };

  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/clients/${selectedClient._id}/renew`, renewal);
      showSnackbar(`Subscription updated for ${selectedClient.name}`);
      setRenewOpen(false);
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update license', 'error');
    }
  };

  const handleDelete = async (c) => {
    const ok = await confirmDialog({
      title: `Delete license for "${c.name}"?`,
      message: 'This will permanently remove the license and its encrypted key. This action cannot be undone.',
      confirmText: 'Delete License',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/clients/${c._id}`);
      showSnackbar('License deleted successfully');
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete license', 'error');
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key).then(() => showSnackbar('License key copied to clipboard'));
  };

  const handleExport = async (format) => {
    try {
      await downloadFile(`/export/licenses?format=${format}`, `licenses-${Date.now()}.${format}`);
      showSnackbar(`License list exported as ${format.toUpperCase()}`);
    } catch (err) {
      showSnackbar('Export failed. Please try again.', 'error');
    }
  };

  const MetricCard = ({ icon, label, value, color }) => (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
        <Icon name={icon} className="w-6 h-6" />
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-semibold text-ink">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink">Licenses</h1>
          <p className="text-sm text-gray-500 mt-1">Generate, activate, renew and manage store licenses</p>
        </div>
        {user?.role === 'platform_owner' && (
          <div className="flex gap-2">
            <button className="btn-outline px-4 py-2.5" onClick={() => handleExport('pdf')}>
              <Icon name="print" className="w-4 h-4" /> PDF
            </button>
            <button className="btn-outline px-4 py-2.5" onClick={() => handleExport('xlsx')}>
              <Icon name="bill" className="w-4 h-4" /> Excel
            </button>
            <button className="btn-primary px-5 py-2.5" onClick={() => setOnboardOpen(true)}>
              <Icon name="plus" className="w-4 h-4" /> Generate License
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard icon="store" label="Total Licenses" value={metrics.total} color="bg-brand-50 text-brand-500" />
        <MetricCard icon="check" label="Active Plans" value={metrics.active} color="bg-emerald-50 text-emerald-600" />
        <MetricCard icon="clock" label="Expiring Soon" value={metrics.expiring} color="bg-amber-50 text-amber-600" />
        <MetricCard icon="lock" label="Locked Plans" value={metrics.locked} color="bg-red-50 text-red-600" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Business Name</th>
                <th className="th">License Activation Key</th>
                <th className="th">Plan Tier</th>
                <th className="th">License Expires</th>
                <th className="th">Status</th>
                <th className="th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="td text-center py-10 text-gray-400">Loading licenses...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={6} className="td text-center py-10 text-gray-400">No licenses yet. Click "Generate License" to create one.</td></tr>
              ) : clients.map((c) => (
                <tr key={c._id} className="hover:bg-gray-50/60">
                  <td className="td">
                    <div className="font-semibold text-ink">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      GSTIN: {c.gstNumber || 'None'} · {c.contact || 'N/A'}
                    </div>
                  </td>
                  <td className="td">
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs text-emerald-700 font-semibold max-w-[200px] truncate bg-emerald-50 rounded-lg px-2 py-1">{c.licenseKey}</code>
                      <button onClick={() => copyKey(c.licenseKey)} className="p-1 text-gray-400 hover:text-brand-500" title="Copy key">
                        <Icon name="copy" className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="td">
                    <span className="badge bg-brand-50 text-brand-600 ring-1 ring-brand-100 font-semibold uppercase">{c.planTier}</span>
                  </td>
                  <td className="td">
                    <div className="text-gray-700">{new Date(c.licenseEnd).toLocaleDateString()}</div>
                    <div className={`text-xs ${new Date(c.licenseEnd) < new Date() ? 'text-red-600' : 'text-gray-400'}`}>
                      {new Date(c.licenseEnd) < new Date() ? 'Expired' : `${Math.ceil((new Date(c.licenseEnd) - new Date()) / (24 * 3600 * 1000))} days left`}
                    </div>
                  </td>
                  <td className="td"><Badge value={c.licenseStatus} /></td>
                  <td className="td text-center">
                    <div className="inline-flex gap-1">
                      {user?.role === 'platform_owner' && (
                        <button className="btn-outline !px-3 !py-1.5 !text-xs" onClick={() => openRenewModal(c)}>
                          <Icon name="edit" className="w-3.5 h-3.5" /> Manage
                        </button>
                      )}
                      {user?.role === 'platform_owner' && (
                        <button className="btn-outline !px-3 !py-1.5 !text-xs text-red-600 hover:bg-red-50" onClick={() => handleDelete(c)}>
                          <Icon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ Generate Shop License Dialog (TextilePOS exact fields) ============ */}
      <Modal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        title="Generate New Store License Key"
        footer={
          <>
            <button className="btn-outline" onClick={() => setOnboardOpen(false)}>Cancel</button>
            <button type="submit" form="licenseForm" className="btn-primary">Generate Key</button>
          </>
        }
      >
        <form id="licenseForm" onSubmit={handleOnboardSubmit} className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-brand-600 mb-3">Store Information</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Shop / Business Name *</label>
                <input className="input" value={newShop.name} onChange={(e) => setNewShop({ ...newShop, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">GST Registration Number</label>
                <input className="input" value={newShop.gstNumber} onChange={(e) => setNewShop({ ...newShop, gstNumber: e.target.value })} />
              </div>
              <div>
                <label className="label">Business Address</label>
                <input className="input" value={newShop.address} onChange={(e) => setNewShop({ ...newShop, address: e.target.value })} />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <h4 className="text-sm font-semibold text-brand-600 mb-3">Primary Administrator Profile</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Owner / Contact Name *</label>
                <input className="input" value={newShop.contact} onChange={(e) => setNewShop({ ...newShop, contact: e.target.value })} required />
              </div>
              <div>
                <label className="label">Owner Email Address *</label>
                <input className="input" type="email" value={newShop.ownerEmail} onChange={(e) => setNewShop({ ...newShop, ownerEmail: e.target.value })} placeholder="Details will be emailed here" required />
              </div>
              <div>
                <label className="label">Owner Mobile Number *</label>
                <input className="input" value={newShop.ownerMobile} onChange={(e) => setNewShop({ ...newShop, ownerMobile: e.target.value })} placeholder="Username for login" required />
              </div>
              <div>
                <label className="label">Owner Password *</label>
                <input className="input" value={newShop.ownerPassword} onChange={(e) => setNewShop({ ...newShop, ownerPassword: e.target.value })} placeholder="Initial login password" required />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <h4 className="text-sm font-semibold text-brand-600 mb-3">Subscription Details</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Subscription Tier</label>
                <select className="input" value={newShop.planTier} onChange={(e) => setNewShop({ ...newShop, planTier: e.target.value })}>
                  {Object.entries(TIER_INFO).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">License Expiry Period</label>
                <select className="input" value={newShop.licenseDurationDays} onChange={(e) => setNewShop({ ...newShop, licenseDurationDays: parseInt(e.target.value) })}>
                  <option value={1}>1 Day (Demo/Trial)</option>
                  <option value={7}>1 Week</option>
                  <option value={30}>1 Month</option>
                  <option value={90}>3 Months</option>
                  <option value={180}>6 Months</option>
                  <option value={300}>1 Year</option>
                </select>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ============ Manage Subscription Dialog ============ */}
      <Modal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        title={`Manage License: ${selectedClient?.name || ''}`}
        maxWidth="max-w-md"
        footer={
          <>
            <button className="btn-outline" onClick={() => setRenewOpen(false)}>Cancel</button>
            <button type="submit" form="renewForm" className="btn-primary">Update Subscription</button>
          </>
        }
      >
        <form id="renewForm" onSubmit={handleRenewSubmit} className="space-y-4">
          <div>
            <label className="label">Add Duration (Days)</label>
            <input
              className="input" type="number" min={1}
              value={renewal.durationDays}
              onChange={(e) => setRenewal({ ...renewal, durationDays: parseInt(e.target.value) })}
              required
            />
          </div>
          <div>
            <label className="label">Upgrade / Downgrade Plan</label>
            <select className="input" value={renewal.planTier} onChange={(e) => setRenewal({ ...renewal, planTier: e.target.value })}>
              <option value="basic">Basic Tier</option>
              <option value="pro">Pro Tier</option>
              <option value="enterprise">Enterprise Tier</option>
            </select>
          </div>
          <div>
            <label className="label">License Status</label>
            <select className="input" value={renewal.licenseStatus} onChange={(e) => setRenewal({ ...renewal, licenseStatus: e.target.value })}>
              <option value="active">Active</option>
              <option value="grace_period">Grace Period</option>
              <option value="locked">Locked</option>
              <option value="cancelled">Cancelled</option>
              <option value="pending_activation">Pending Activation</option>
              <option value="trial">Trial</option>
            </select>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600">
            Current expiry: <strong>{selectedClient ? new Date(selectedClient.licenseEnd).toLocaleDateString() : '-'}</strong>
          </div>
        </form>
      </Modal>
    </div>
  );
}