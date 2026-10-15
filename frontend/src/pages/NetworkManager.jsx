import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api.js';
import { buildCustomerUrl, buildCustomerUrlForProduct } from '../utils/customerUrl.js';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import { CopyBtn } from './Licenses.jsx';
import SplitDivider from '../components/SplitDivider.jsx';

export default function NetworkManager() {
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [mappings, setMappings] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [detectedLanIp, setDetectedLanIp] = useState('192.168.1.19');

  // Selected Fleet Client for Right Column
  const [selectedFleetClient, setSelectedFleetClient] = useState(null);
  const [inspectorTab, setInspectorTab] = useState('urls'); // 'urls' | 'relink' | 'profile'
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

  // Forms
  const [fleetEditForm, setFleetEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Ping state
  const [urlPingResults, setUrlPingResults] = useState({});
  const [pingingUrlId, setPingingUrlId] = useState(null);
  const [autoPing, setAutoPing] = useState(true);

  const fetchDetectedIp = useCallback(async () => {
    try {
      const res = await api.get('/network/detect-ip');
      if (res.data?.serverLanIp) {
        setDetectedLanIp(res.data.serverLanIp);
      }
    } catch {
      // Keep default
    }
  }, []);

  const fetchApps = useCallback(async () => {
    try {
      const res = await api.get('/applications');
      setApps(res.data.applications || []);
    } catch {
      // Silent
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/network/mappings');
      const list = res.data.mappings || [];
      setMappings(list);
      // No auto-select: initial view is 1 column full width
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load network fleet', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedFleetClient, showSnackbar]);

  useEffect(() => {
    fetchMappings();
    fetchDetectedIp();
    fetchApps();
  }, [fetchMappings, fetchDetectedIp, fetchApps]);

  const handleSelectClient = (client, tab = 'urls') => {
    setSelectedFleetClient(client);
    setInspectorTab(tab);
    setFleetEditForm({
      _id: client._id,
      name: client.name || '',
      customerCode: client.customerCode || '',
      shopSlug: client.shopSlug || '',
      subdomain: (client.customerCode || '').toLowerCase(),
      softwareProduct: client.softwareProduct || 'TEXTILE_POS',
      planTier: client.planTier || 'basic',
      licenseStatus: client.licenseStatus || 'active',
      pendingOwnerName: client.pendingOwnerName || client.name || '',
      pendingOwnerMobile: client.pendingOwnerMobile || client.contact || '',
      pendingOwnerEmail: client.pendingOwnerEmail || '',
      screenPermissions: client.screenPermissions || {}
    });
  };

  const handlePingUrl = useCallback(async (clientId, urlToTest) => {
    try {
      setPingingUrlId(clientId);
      const res = await api.post('/network/ping-url', {
        clientId,
        url: urlToTest
      });

      if (res.data?.success) {
        setUrlPingResults(prev => ({
          ...prev,
          [clientId]: {
            ...res.data,
            timestamp: new Date()
          }
        }));
        showSnackbar(
          `⚡ URL Ping: HTTP ${res.data.httpStatus} (${res.data.latencyMs}ms) - ${res.data.speedRating}`,
          res.data.isOnline ? 'success' : 'warning'
        );
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'URL Ping failed', 'error');
    } finally {
      setPingingUrlId(null);
    }
  }, [showSnackbar]);

  const handleSaveFleetEdit = async (e) => {
    if (e) e.preventDefault();
    if (!fleetEditForm) return;
    try {
      setSavingEdit(true);
      const res = await api.put(`/clients/${fleetEditForm._id}`, fleetEditForm);
      showSnackbar(res.data.message || 'Client details updated successfully!', 'success');
      fetchMappings();
      setSelectedFleetClient(prev => ({ ...prev, ...fleetEditForm }));
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to update client', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleLock = async (client) => {
    const isLocked = client.securitySettings?.emergencyLock;
    const ok = await confirmDialog({
      title: isLocked ? `Unlock ${client.name}?` : `🚨 Emergency Freeze ${client.name}?`,
      message: isLocked
        ? 'This will immediately restore showroom terminal routing.'
        : 'This will instantly sever all public access, returning HTTP 423 to all callers.',
      confirmText: isLocked ? 'Restore Access' : 'Freeze Showroom',
      danger: !isLocked
    });
    if (!ok) return;

    try {
      await api.post(`/network/toggle-lock/${client._id}`, {
        lock: !isLocked,
        reason: isLocked ? 'Restored by Platform Owner' : 'Emergency killswitch activated'
      });
      showSnackbar(isLocked ? 'Showroom unlocked successfully' : 'Showroom access frozen', isLocked ? 'success' : 'warning');
      fetchMappings();
      if (selectedFleetClient && selectedFleetClient._id === client._id) {
        setSelectedFleetClient(prev => ({
          ...prev,
          securitySettings: { ...prev.securitySettings, emergencyLock: !isLocked }
        }));
      }
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to toggle lock', 'error');
    }
  };

  const handleShareWhatsApp = (client) => {
    const code = (client.customerCode || 'RENIC').toLowerCase();
    const publicUrl = buildCustomerUrl(client);
    const lanUrl = `http://${code}.${detectedLanIp}.sslip.io:5050`;

    const text = `🎉 *Welcome to ${client.name} Showroom Portal!*

Your secure enterprise terminal is active:
🌐 *Global Access:* ${publicUrl}
📶 *Local Wi-Fi:* ${lanUrl}

📱 *Mobile Login:* ${client.pendingOwnerMobile || client.contact || 'Registered Mobile'}
🔑 *Default Password:* password123 (Please change after first login)

_Powered by Renic Soft Cloud Gateway_`;

    navigator.clipboard.writeText(text);
    showSnackbar('📋 WhatsApp Onboarding message copied to clipboard!', 'success');
  };

  const filteredMappings = useMemo(() => {
    return mappings.filter(c => {
      const matchSearch =
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.customerCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        buildCustomerUrlForProduct(c).toLowerCase().includes(searchQuery);
      const matchFilter = selectedFilter === 'ALL' || c.softwareProduct === selectedFilter;
      return matchSearch && matchFilter;
    });
  }, [mappings, searchQuery, selectedFilter]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-[#f4f6f8] text-slate-800 flex-1">
      {/* ============ LEFT COLUMN: PORT FORWARDING FLEET (42% Width) ============ */}
      {!isPanelMaximized && (
        <div
          style={{ width: selectedFleetClient ? `${splitPercent}%` : '100%', transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white border-r border-slate-200 overflow-hidden flex-shrink-0 transition-[width] duration-300 ease-in-out"
        >
          {/* Top Control Bar */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search showroom, code, port..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">
                <Icon name="search" className="w-3.5 h-3.5" />
              </span>
            </div>

            <button
              onClick={() => fetchMappings()}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Refresh"
            >
              <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#65a30d]' : ''}`} />
            </button>
          </div>

          {/* Subheader */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
            <span className="font-bold text-slate-700">Fleet Router ({filteredMappings.length})</span>
            <span className="text-[11px] text-slate-400">Click row to open terminal</span>
          </div>

          {/* Table List */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-2 px-3">Showroom / Tenant</th>
                  <th className="py-2 px-2">App URL</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-2" />
                      <span>Loading fleet router...</span>
                    </td>
                  </tr>
                ) : filteredMappings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <p className="font-bold text-slate-600">No showroom routes found</p>
                    </td>
                  </tr>
                ) : (
                  filteredMappings.map((c) => {
                    const isSelected = selectedFleetClient?._id === c._id;
                    const isLocked = c.securitySettings?.emergencyLock;
                    const code = (c.customerCode || 'TENANT').toUpperCase();
                    // No per-customer port exists any more — show the canonical
                    // hostname this tenant is reached at instead.
                    const appUrl = buildCustomerUrlForProduct(c).replace(/^https?:\/\//, '') || '—';

                    return (
                      <tr
                        key={c._id}
                        onClick={() => handleSelectClient(c)}
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
                              {code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-[170px] mt-0.5">
                            {c.softwareProduct || 'TEXTILE_POS'}
                          </div>
                        </td>

                        {/* Canonical App URL (replaces the per-customer Port column) */}
                        <td
                          className="py-2.5 px-2 align-top font-mono font-bold text-slate-700 max-w-[170px] truncate"
                          title={appUrl}
                        >
                          {appUrl}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-2 align-top text-center">
                          <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            isLocked
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isLocked ? 'Frozen' : 'Active'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleToggleLock(c)}
                              className={`p-1 rounded transition ${isLocked ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                              title={isLocked ? "Unlock" : "Freeze"}
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
      {selectedFleetClient && !isPanelMaximized && (
        <SplitDivider isDragging={isDragging} onMouseDown={() => setIsDragging(true)} />
      )}

      {/* ============ RIGHT COLUMN: FLEET TERMINAL & ROUTER STUDIO ============ */}
      {selectedFleetClient && (
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
                    {selectedFleetClient.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-900 text-emerald-400">
                    {selectedFleetClient.customerCode}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-lime-50 text-lime-800 border border-lime-200 font-mono">
                    {buildCustomerUrlForProduct(selectedFleetClient).replace(/^https?:\/\//, '') || 'URL pending'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  App: <b className="text-slate-700">{selectedFleetClient.softwareProduct}</b> · Routed by Host header — no per-customer IP or port
                </p>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedFleetClient(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition shadow-xs"
                  title="Back to Fleet List"
                >
                  <Icon name="arrow-left" className="w-3.5 h-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(selectedFleetClient)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition"
                  title="Copy WhatsApp Onboarding Kit"
                >
                  <Icon name="whatsapp" className="w-3.5 h-3.5" /> Share Kit
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
                  onClick={() => setSelectedFleetClient(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title="Close"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Sub-tabs */}
          <div className="border-b border-slate-200 bg-white px-4 flex items-center gap-6 overflow-x-auto no-scrollbar flex-shrink-0 text-xs font-semibold">
            {[
              { id: 'urls', label: 'Live Clean URLs & Ping' },
              { id: 'profile', label: 'Profile & Credentials' }
            ].map((tab) => {
              const isActive = inspectorTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id)}
                  className={`py-2.5 transition relative whitespace-nowrap ${
                    isActive ? 'text-[#65a30d] font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#84cc16]" />}
                </button>
              );
            })}
          </div>

          {/* 3. Tab Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
            {inspectorTab === 'urls' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Active Reverse-Proxied Endpoints:</span>

                {[
                  {
                    title: 'Local Laptop (Zero Port / Clean DNS)',
                    badge: 'Direct Host',
                    url: `http://${(selectedFleetClient.customerCode || 'tenant').toLowerCase()}.lvh.me:5050`
                  },
                  {
                    title: 'Other Laptops & Mobile (Same Wi-Fi Network)',
                    badge: 'Wi-Fi LAN',
                    url: `http://${(selectedFleetClient.customerCode || 'tenant').toLowerCase()}.${detectedLanIp}.sslip.io:5050`
                  },
                  {
                    title: 'Customer Share URL',
                    badge: 'Share this',
                    url: buildCustomerUrl(selectedFleetClient)
                  },
                  {
                    title: 'Production Cloud SaaS Domain',
                    badge: 'Production',
                    url: selectedFleetClient.fullSaaSDomain || buildCustomerUrl(selectedFleetClient)
                  }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{item.title}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{item.badge}</span>
                    </div>
                    <div className="font-mono text-xs text-emerald-800 font-bold break-all p-2 bg-slate-50 rounded border border-slate-200">
                      {item.url}
                    </div>
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        onClick={() => handlePingUrl(selectedFleetClient._id, item.url)}
                        disabled={pingingUrlId === selectedFleetClient._id}
                        className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition"
                      >
                        ⚡ Ping
                      </button>
                      <CopyBtn text={item.url} label="Copy URL" />
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition"
                      >
                        Open ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'profile' && fleetEditForm && (
              <form onSubmit={handleSaveFleetEdit} className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs max-w-xl">
                <h4 className="text-xs font-bold text-slate-900 uppercase">Showroom Profile &amp; Contact</h4>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Store / Showroom Name</label>
                  <input
                    type="text"
                    value={fleetEditForm.name}
                    onChange={(e) => setFleetEditForm({ ...fleetEditForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Owner Contact Phone</label>
                    <input
                      type="text"
                      value={fleetEditForm.pendingOwnerMobile}
                      onChange={(e) => setFleetEditForm({ ...fleetEditForm, pendingOwnerMobile: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Owner Email</label>
                    <input
                      type="email"
                      value={fleetEditForm.pendingOwnerEmail}
                      onChange={(e) => setFleetEditForm({ ...fleetEditForm, pendingOwnerEmail: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-1.5 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded shadow-xs"
                  >
                    {savingEdit ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Permanent Sticky Action Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0 z-10">
            <span className="text-xs text-slate-500 font-bold truncate">
              {buildCustomerUrlForProduct(selectedFleetClient) || 'URL pending'}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedFleetClient(null)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}