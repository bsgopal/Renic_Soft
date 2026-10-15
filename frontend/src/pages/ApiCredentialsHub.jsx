import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api.js';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import SplitDivider from '../components/SplitDivider.jsx';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import { CopyBtn } from './Licenses.jsx';

export default function ApiCredentialsHub() {
  const { showSnackbar = () => {}, confirmDialog } = useSnackbar() || {};
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('ALL');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
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
      if (selectedCustomer) {
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
    const ok = await confirmDialog({
      title: 'Regenerate API Credentials',
      message: `Are you sure you want to regenerate Client ID & Secret for ${customerCode}? Old API tokens will stop working immediately.`,
      confirmText: 'Regenerate Credentials',
      danger: true
    });
    if (!ok) return;
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

  const handleGetToken = async (client) => {
    try {
      setTokenLoading(true);
      const res = await api.post('/v1/oauth/token', {
        grant_type: 'client_credentials',
        client_id: client.clientId,
        client_secret: client.clientSecret
      });
      setGeneratedToken(res.data);
      showSnackbar('Bearer Token generated successfully!', 'success');
    } catch (err) {
      showSnackbar(err.response?.data?.error_description || 'Failed to issue token', 'error');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleShareWhatsApp = (client) => {
    const mobile = (client.mobile || client.contact || '').replace(/[^0-9]/g, '');
    const text = `*🔑 Renic API & OAuth 2.0 Credentials*
*Customer:* ${client.name} (${client.customerCode})

*Dedicated Portal:* ${client.hostingUrl}
*OAuth Token Endpoint:* ${client.tokenEndpoint}

*Client ID:* ${client.clientId}
*Client Secret:* ${client.clientSecret || '<CONFIDENTIAL>'}

*Status:* Active & Enforced`;

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

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
                            (c.customerCode || '').toLowerCase().includes(search.toLowerCase());
      const matchesProd = productFilter === 'ALL' || c.softwareProduct === productFilter;
      return matchesSearch && matchesProd;
    });
  }, [clients, search, productFilter]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-[#f4f6f8] text-slate-800 flex-1">
      {/* ============ LEFT COLUMN: TENANT SELECTOR (42% Width) ============ */}
      {!isPanelMaximized && (
        <div
          style={{ width: selectedCustomer ? `${splitPercent}%` : '100%', transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white border-r border-slate-200 overflow-hidden flex-shrink-0 transition-[width] duration-300 ease-in-out"
        >
          {/* Top Control Bar */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search tenant or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">
                <Icon name="search" className="w-3.5 h-3.5" />
              </span>
            </div>

            <button
              onClick={fetchClients}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Refresh"
            >
              <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#65a30d]' : ''}`} />
            </button>
          </div>

          {/* Subheader */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
            <span className="font-bold text-slate-700">API Tenants ({filteredClients.length})</span>
            <span className="text-[11px] text-slate-400">Click row to view OAuth credentials</span>
          </div>

          {/* List Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-2 px-3">Customer / Software</th>
                  <th className="py-2 px-3">OAuth Status</th>
                  <th className="py-2 px-2 text-right">Kit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-2" />
                      <span>Loading API tenants...</span>
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      <p className="font-bold text-slate-600">No tenants found</p>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c) => {
                    const isSelected = selectedCustomer?.customerCode === c.customerCode;
                    return (
                      <tr
                        key={c.customerCode || c._id}
                        onClick={() => setSelectedCustomer(c)}
                        className={`cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-lime-50/70 border-l-4 border-l-[#84cc16]'
                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Name & Code */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{c.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                              {c.customerCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate max-w-[180px]">
                            {c.softwareProduct || 'TEXTILE_POS'}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 align-top">
                          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            c.oauthEnforced
                              ? 'bg-lime-100 text-lime-900 border border-lime-300'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {c.oauthEnforced ? 'OAuth Enforced' : 'Active'}
                          </span>
                        </td>

                        {/* Copy Kit */}
                        <td className="py-2.5 px-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleCopyIntegrationKit(c)}
                            className="p-1 text-slate-400 hover:text-[#65a30d] hover:bg-lime-50 rounded transition"
                            title="Copy JSON Kit"
                          >
                            <Icon name="copy" className="w-3.5 h-3.5" />
                          </button>
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
      {selectedCustomer && !isPanelMaximized && (
        <SplitDivider isDragging={isDragging} onMouseDown={() => setIsDragging(true)} />
      )}

      {/* ============ RIGHT COLUMN: OAUTH CREDENTIALS & API CONSOLE ============ */}
      {selectedCustomer && (
        <div
          style={{ width: isPanelMaximized ? '100%' : `${100 - splitPercent}%`, transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white overflow-hidden h-full flex-1 animate-in fade-in slide-in-from-right-3 duration-300"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {selectedCustomer.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-900 text-emerald-400">
                    {selectedCustomer.customerCode}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-lime-50 text-lime-800 border border-lime-200">
                    {selectedCustomer.softwareProduct || 'TEXTILE_POS'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Isolated DB: <b className="text-slate-800 font-bold">{selectedCustomer.databaseName || `renic_tenant_${selectedCustomer.customerCode?.toLowerCase()}`}</b>
                </p>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition shadow-xs"
                  title="Back to Customer List"
                >
                  <Icon name="arrow-left" className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedCustomer)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition"
                >
                  <Icon name="edit" className="w-3.5 h-3.5" /> Edit URLs
                </button>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(selectedCustomer)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition"
                >
                  <Icon name="whatsapp" className="w-3.5 h-3.5" /> Share
                </button>
                <button
                  type="button"
                  onClick={() => setIsPanelMaximized(!isPanelMaximized)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title={isPanelMaximized ? "Restore Split View" : "Maximize Full View"}
                >
                  <Icon name="expand" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title="Close Studio"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Credentials Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/60">
            {/* SaaS URL Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-600 block uppercase">Dedicated SaaS Hosting URL</span>
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs font-bold text-[#65a30d]">
                <span className="truncate pr-2">{selectedCustomer.hostingUrl}</span>
                <CopyBtn text={selectedCustomer.hostingUrl} label="Copy URL" />
              </div>
            </div>

            {/* OAuth Credentials Card */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="key" className="w-3.5 h-3.5 text-lime-700" /> OAuth 2.0 Machine Keys
                </h3>
                <button
                  type="button"
                  onClick={() => handleRegenerateCredentials(selectedCustomer.customerCode)}
                  disabled={regenerating}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  {regenerating ? 'Regenerating...' : 'Regenerate Keys'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Client ID</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={selectedCustomer.clientId || ''}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 rounded border border-slate-300"
                  />
                  <CopyBtn text={selectedCustomer.clientId} label="Copy" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Client Secret</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    readOnly
                    value={selectedCustomer.clientSecret || ''}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 rounded border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded text-slate-700"
                  >
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                  <CopyBtn text={selectedCustomer.clientSecret} label="Copy" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Token Endpoint (RFC 6749)</label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={selectedCustomer.tokenEndpoint || `${window.location.origin}/api/v1/oauth/token`}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 rounded border border-slate-300 text-slate-600"
                  />
                  <CopyBtn text={selectedCustomer.tokenEndpoint || `${window.location.origin}/api/v1/oauth/token`} label="Copy" />
                </div>
              </div>
            </div>

            {/* Test Bearer Token */}
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase">Live Token Generator &amp; Probe</h3>
                <button
                  onClick={() => handleGetToken(selectedCustomer)}
                  disabled={tokenLoading}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition flex items-center gap-1"
                >
                  <Icon name="refresh" className={`w-3 h-3 ${tokenLoading ? 'animate-spin' : ''}`} />
                  {tokenLoading ? 'Issuing...' : 'Generate Live Token'}
                </button>
              </div>

              {generatedToken && (
                <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg overflow-x-auto space-y-1">
                  <div>Access Token: <span className="text-white break-all">{generatedToken.access_token}</span></div>
                  <div className="text-slate-400 text-[11px]">Expires in: {generatedToken.expires_in}s · Token Type: {generatedToken.token_type}</div>
                </div>
              )}
            </div>
          </div>

          {/* Permanent Sticky Action Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0 z-10">
            <span className="text-xs text-slate-500 font-bold">
              Client ID: <b className="text-slate-900 font-mono">{selectedCustomer.clientId || 'N/A'}</b>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
              >
                Close Panel
              </button>
              <button
                type="button"
                onClick={() => handleOpenEdit(selectedCustomer)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded shadow-xs transition"
              >
                Edit SaaS Routes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit URLs Modal */}
      {editOpen && (
        <Modal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          title={`Edit API & SaaS Routes: ${selectedCustomer?.name}`}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2 w-full">
              <button className="btn-secondary !px-4" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="btn-primary !px-5" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Routes'}
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Customer / Store Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="input font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Dedicated Hosting URL</label>
              <input
                type="text"
                value={editForm.hostingUrl}
                onChange={(e) => setEditForm({ ...editForm, hostingUrl: e.target.value })}
                className="input font-mono font-bold"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}