import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

export default function ApiCredentialsHub() {
  const { showSnackbar = () => {} } = useSnackbar() || {};
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    hostingUrl: '',
    oauthTokenEndpoint: '',
    clientId: '',
    clientSecret: ''
  });

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/oauth/clients-summary');
      const list = res.data.clients || [];
      setClients(list);
      if (list.length > 0 && !selectedCustomer) {
        setSelectedCustomer(list[0]);
      } else if (selectedCustomer) {
        const updated = list.find(c => c.customerCode === selectedCustomer.customerCode);
        if (updated) setSelectedCustomer(updated);
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to fetch API clients', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar, selectedCustomer]);

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showSnackbar(`Copied ${label} to clipboard!`, 'success');
  };

  const handleOpenEdit = (client) => {
    if (!client) return;
    setEditForm({
      name: client.name || '',
      hostingUrl: client.hostingUrl || '',
      oauthTokenEndpoint: client.oauthTokenEndpoint || client.tokenEndpoint || '',
      clientId: client.clientId || '',
      clientSecret: client.clientSecret || ''
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      setSavingEdit(true);
      const res = await api.put(`/v1/oauth/credentials/${selectedCustomer.customerCode}`, editForm);
      showSnackbar(res.data.message || 'Credentials & URLs updated successfully!', 'success');
      setEditOpen(false);
      fetchClients();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update credentials', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRegenerateCredentials = async (customerCode) => {
    if (!window.confirm(`Are you sure you want to regenerate Client ID & Secret for ${customerCode}? Old API tokens will stop working.`)) {
      return;
    }
    try {
      setRegenerating(true);
      const res = await api.post('/v1/oauth/credentials/generate', { customerCode });
      showSnackbar(res.data.message || 'New credentials generated!', 'success');
      fetchClients();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Error regenerating credentials', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleEnforcement = async (customerCode) => {
    try {
      const res = await api.post(`/v1/oauth/toggle-enforcement/${customerCode}`);
      showSnackbar(res.data.message, 'success');
      fetchClients();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to toggle OAuth enforcement', 'error');
    }
  };

  const handleTestOAuthToken = async (client) => {
    if (!client.clientId || !client.clientSecret) {
      showSnackbar('Client ID or Secret is missing for this tenant', 'warning');
      return;
    }
    try {
      setTokenLoading(true);
      const res = await api.post('/v1/oauth/token', {
        grant_type: 'client_credentials',
        client_id: client.clientId,
        client_secret: client.clientSecret
      });
      setGeneratedToken(res.data);
      showSnackbar('OAuth 2.0 Bearer token successfully generated!', 'success');
    } catch (err) {
      showSnackbar(err.response?.data?.error_description || 'OAuth token exchange failed', 'error');
      setGeneratedToken(null);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleShareWhatsApp = (client) => {
    const mobile = (client.contactMobile || '').replace(/[^0-9]/g, '');
    const text = `*🎉 Welcome to Renic Platform!*
Your dedicated multi-tenant software is ready.

*Customer Code:* ${client.customerCode}
*Software:* ${client.softwareProduct}
*Dedicated Hosting URL:* ${client.hostingUrl}

*API Security Credentials:*
- *Client ID:* ${client.clientId || 'Generated on portal'}
- *OAuth Token URL:* ${client.tokenEndpoint}

_Zero crossover database isolation enabled._`;

    const encoded = encodeURIComponent(text);
    const waUrl = mobile ? `https://wa.me/${mobile}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyIntegrationKit = (client) => {
    const kit = {
      tenant_code: client.customerCode,
      software_product: client.softwareProduct,
      hosting_url: client.hostingUrl,
      oauth_token_url: client.tokenEndpoint,
      client_id: client.clientId,
      client_secret: client.clientSecret || '<CONFIDENTIAL_SECRET>'
    };
    navigator.clipboard.writeText(JSON.stringify(kit, null, 2));
    showSnackbar('Integration Kit copied in JSON format!', 'success');
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.customerCode?.toLowerCase().includes(search.toLowerCase());
    const matchesProd = productFilter === 'ALL' || c.softwareProduct === productFilter;
    return matchesSearch && matchesProd;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">API Credentials & OAuth Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enterprise Client IDs, HMAC Secret Keys, OAuth 2.0 Bearer Tokens & Dedicated Hosting URLs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchClients}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            <Icon name="refresh" className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Overview Metric Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Icon name="key" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">{clients.length}</div>
            <div className="text-xs text-gray-500 font-medium">Provisioned Tenants</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Icon name="check" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">
              {clients.filter(c => c.clientId).length}
            </div>
            <div className="text-xs text-gray-500 font-medium">Active OAuth Client IDs</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Icon name="network" className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-ink">
              {clients.filter(c => c.hostingUrl).length}
            </div>
            <div className="text-xs text-gray-500 font-medium">Dedicated SaaS URLs</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Selector, Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Client List (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="font-semibold text-ink text-sm">Select Tenant</h3>
            <span className="text-xs text-gray-400">{filteredClients.length} registered</span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Icon name="search" className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="px-2 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none text-gray-700 bg-white"
            >
              <option value="ALL">All Apps</option>
              <option value="WA_INSTA_AUTOMATION">WA/Insta</option>
              <option value="TEXTILE_POS">Textile POS</option>
            </select>
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading tenants...</div>
            ) : filteredClients.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No tenants found</div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedCustomer?.customerCode === client.customerCode;
                return (
                  <div
                    key={client.id}
                    onClick={() => {
                      setSelectedCustomer(client);
                      setGeneratedToken(null);
                      setShowSecret(false);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-ink">{client.name}</div>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {client.customerCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                      <span className="truncate max-w-[150px]">{client.softwareProduct}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        client.clientId ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {client.clientId ? 'OAuth Enabled' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Credentials & OAuth Hub Details (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedCustomer ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              {/* Tenant Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-ink">{selectedCustomer.name}</h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand-100 text-brand-700 font-bold">
                      {selectedCustomer.customerCode}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Software: <span className="font-semibold text-gray-700">{selectedCustomer.softwareProduct}</span> · Isolated DB: <code className="text-brand-600 font-mono">renic_tenant_{selectedCustomer.customerCode.toLowerCase()}</code>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(selectedCustomer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Icon name="edit" className="w-4 h-4" /> Edit URLs
                  </button>
                  <button
                    onClick={() => handleShareWhatsApp(selectedCustomer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors shadow-sm"
                  >
                    <Icon name="whatsapp" className="w-4 h-4" /> Share WhatsApp
                  </button>
                  <button
                    onClick={() => handleCopyIntegrationKit(selectedCustomer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors"
                  >
                    <Icon name="copy" className="w-4 h-4" /> Copy Kit
                  </button>
                </div>
              </div>

              {/* Dedicated SaaS Hosting URL */}
              <div className="bg-gradient-to-r from-brand-50/60 to-indigo-50/60 border border-brand-100/80 rounded-2xl p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-brand-800 uppercase tracking-wider">
                    Dedicated Customer SaaS Hosting URL
                  </div>
                  <button
                    onClick={() => handleOpenEdit(selectedCustomer)}
                    className="text-xs text-brand-700 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" /> Edit Domain
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-mono text-sm text-brand-900 font-semibold break-all">
                    {selectedCustomer.hostingUrl}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(selectedCustomer.hostingUrl, 'Hosting URL')}
                      className="shrink-0 p-1.5 hover:bg-brand-100/60 rounded-lg text-brand-700 transition-colors"
                      title="Copy Hosting URL"
                    >
                      <Icon name="copy" className="w-4 h-4" />
                    </button>
                    <a
                      href={selectedCustomer.hostingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 p-1.5 hover:bg-brand-100/60 rounded-lg text-brand-700 transition-colors"
                      title="Open in new tab"
                    >
                      <Icon name="eye" className="w-4 h-4" />
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-brand-600">
                  Customers and staff access this portal directly with isolated database routing.
                </p>
              </div>

              {/* OAuth Security Enforcement Toggle Banner */}
              <div className={`p-4 rounded-2xl border transition-all ${selectedCustomer.oauthEnforced ? 'bg-emerald-50/80 border-emerald-200 shadow-2xs' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                        🛡️ Mandatory OAuth Security Enforcement
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedCustomer.oauthEnforced ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {selectedCustomer.oauthEnforced ? 'ENFORCED (Active)' : 'OPTIONAL (Permissive)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {selectedCustomer.oauthEnforced 
                        ? 'Client application screens (Delivery Challan, TextilePOS) are locked until the user enters this authorized Client ID & Secret in their Settings screen.' 
                        : 'Screens are accessible without OAuth check. Click Enforce to mandate Client ID & Secret verification in the client application Settings.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleEnforcement(selectedCustomer.customerCode)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition shadow-2xs whitespace-nowrap self-start sm:self-center ${
                      selectedCustomer.oauthEnforced
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {selectedCustomer.oauthEnforced ? 'Disable Enforcement' : 'Enforce OAuth Security'}
                  </button>
                </div>
              </div>

              {/* Credential Fields */}
              <div className="space-y-4">
                {/* Client ID */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Renic Client ID (OAuth Public Identifier)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={selectedCustomer.clientId || 'Not Generated'}
                      className="w-full font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopy(selectedCustomer.clientId, 'Client ID')}
                      disabled={!selectedCustomer.clientId}
                      className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-40"
                    >
                      <Icon name="copy" className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Client Secret */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Renic Secret Key (HMAC Cryptographic Secret)
                    </label>
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                    >
                      <Icon name="eye" className="w-3.5 h-3.5" /> {showSecret ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      readOnly
                      value={selectedCustomer.clientSecret || '••••••••••••••••••••••••••••••••'}
                      className="w-full font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopy(selectedCustomer.clientSecret, 'Client Secret')}
                      disabled={!selectedCustomer.clientSecret}
                      className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-40"
                    >
                      <Icon name="copy" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRegenerateCredentials(selectedCustomer.customerCode)}
                      disabled={regenerating}
                      className="px-3 py-2.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-xl transition-colors whitespace-nowrap"
                    >
                      {regenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </div>
                </div>

                {/* OAuth Token Endpoint */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      OAuth 2.0 Token Endpoint URL
                    </label>
                    <button
                      onClick={() => handleOpenEdit(selectedCustomer)}
                      className="text-xs text-brand-700 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Icon name="edit" className="w-3.5 h-3.5" /> Edit API URL
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={selectedCustomer.tokenEndpoint}
                      className="w-full font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopy(selectedCustomer.tokenEndpoint, 'OAuth Token URL')}
                      className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
                      title="Copy OAuth Token URL"
                    >
                      <Icon name="copy" className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Defaults to localhost in local dev mode. Click <strong>Edit API URL</strong> to point to your live Hostinger VPS domain (e.g. <code>https://api.yourdomain.com/api/v1/oauth/token</code>).
                  </p>
                </div>
              </div>

              {/* OAuth Live Test Console */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">OAuth 2.0 Live Token Generator</h4>
                    <p className="text-xs text-gray-500">Test client credentials exchange and issue a signed Bearer token.</p>
                  </div>
                  <button
                    onClick={() => handleTestOAuthToken(selectedCustomer)}
                    disabled={tokenLoading || !selectedCustomer.clientId}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Icon name="key" className="w-4 h-4" /> {tokenLoading ? 'Exchanging...' : 'Generate Live Token'}
                  </button>
                </div>

                {generatedToken && (
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                      <span className="text-emerald-400 font-semibold">200 OK — Token Valid (Expires in 24h)</span>
                      <button
                        onClick={() => handleCopy(generatedToken.access_token, 'Bearer Token')}
                        className="text-xs text-slate-300 hover:text-white flex items-center gap-1"
                      >
                        <Icon name="copy" className="w-3 h-3" /> Copy Bearer Token
                      </button>
                    </div>
                    <div className="overflow-x-auto max-h-32 pr-1 break-all text-[11px] text-slate-300">
                      Bearer {generatedToken.access_token}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
              Select a tenant from the left to view and manage API credentials.
            </div>
          )}
        </div>
      </div>

      {/* ============ Edit Credentials & URLs Modal ============ */}
      {selectedCustomer && (
        <Modal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title={`Edit URLs & Credentials: ${selectedCustomer?.name || ''} [${selectedCustomer?.customerCode}]`}
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                className="btn-secondary !px-4"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="btn-primary !px-5"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Customer / Shop Name
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Dedicated Customer SaaS Hosting URL
              </label>
              <input
                type="text"
                placeholder="e.g. https://ss01.yourdomain.com or https://saraswathi.yourdomain.com"
                value={editForm.hostingUrl}
                onChange={(e) => setEditForm({ ...editForm, hostingUrl: e.target.value })}
                className="w-full font-mono px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                For production: <code>https://&lt;subdomain&gt;.yourdomain.com</code> or custom shop domain.
                <br />For local testing: <code>http://ss01.lvh.me:5173</code> (automatically routes to 127.0.0.1 without setup).
              </p>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                OAuth 2.0 Token Endpoint URL
              </label>
              <input
                type="text"
                placeholder="e.g. https://api.yourdomain.com/api/v1/oauth/token"
                value={editForm.oauthTokenEndpoint}
                onChange={(e) => setEditForm({ ...editForm, oauthTokenEndpoint: e.target.value })}
                className="w-full font-mono px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Enter your live VPS or public gateway URL here to replace <code>http://localhost:5050</code>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Renic Client ID</label>
                <input
                  type="text"
                  value={editForm.clientId}
                  onChange={(e) => setEditForm({ ...editForm, clientId: e.target.value })}
                  className="w-full font-mono px-3 py-2 border border-gray-200 rounded-xl focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Renic Secret Key</label>
                <input
                  type="text"
                  value={editForm.clientSecret}
                  onChange={(e) => setEditForm({ ...editForm, clientSecret: e.target.value })}
                  className="w-full font-mono px-3 py-2 border border-gray-200 rounded-xl focus:outline-none"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
