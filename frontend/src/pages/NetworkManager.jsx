import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import Modal from '../components/Modal.jsx';

export default function NetworkManager() {
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [mappings, setMappings] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [detectedLanIp, setDetectedLanIp] = useState('192.168.1.19');

  // Inspector Modal State (Active on row click)
  const [selectedFleetClient, setSelectedFleetClient] = useState(null);
  const [inspectorTab, setInspectorTab] = useState('urls'); // 'urls' | 'relink' | 'profile' | 'screens'

  // Relink Form State
  const [relinkForm, setRelinkForm] = useState({ targetIp: '', assignedPort: '', reason: '' });
  const [relinkLoading, setRelinkLoading] = useState(false);

  // Client Edit Form State (Inside Inspector)
  const [fleetEditForm, setFleetEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Telemetry Ping States
  const [urlPingResults, setUrlPingResults] = useState({});
  const [pingingUrlId, setPingingUrlId] = useState(null);
  const [autoPing, setAutoPing] = useState(true);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const [pingingId, setPingingId] = useState(null);

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
      setMappings(res.data.mappings || []);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load network fleet', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    fetchMappings();
    fetchDetectedIp();
    fetchApps();
  }, [fetchMappings, fetchDetectedIp, fetchApps]);

  // Real-Time URL Ping Handler
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
        setLastHeartbeat(new Date());
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

  // Auto-Ping Heartbeat (Every 10s pulse)
  useEffect(() => {
    if (!autoPing || mappings.length === 0) return;

    const runAutoPing = async () => {
      const primaryClient = mappings[0];
      if (!primaryClient) return;

      const code = (primaryClient.customerCode || 'renic').toLowerCase();
      const url = `http://${code}.lvh.me:5050`;
      try {
        const res = await api.post('/network/ping-url', {
          clientId: primaryClient._id,
          url
        });
        if (res.data?.success) {
          setUrlPingResults(prev => ({
            ...prev,
            [primaryClient._id]: {
              ...res.data,
              timestamp: new Date()
            }
          }));
          setLastHeartbeat(new Date());
        }
      } catch {
        // Silent pulse
      }
    };

    runAutoPing();
    const timer = setInterval(runAutoPing, 10000);
    return () => clearInterval(timer);
  }, [autoPing, mappings]);

  // Open Inspector on Row Click
  const openInspector = (client, defaultTab = 'urls') => {
    setSelectedFleetClient(client);
    setInspectorTab(defaultTab);
    setRelinkForm({
      targetIp: client.portForwarding?.targetIp || '127.0.0.1',
      assignedPort: client.portForwarding?.assignedPort || 5174,
      reason: ''
    });
    setFleetEditForm({
      _id: client._id,
      name: client.name || '',
      customerCode: client.customerCode || '',
      shopSlug: client.shopSlug || '',
      subdomain: (client.customerCode || '').toLowerCase(),
      softwareProduct: client.softwareProduct || 'TEXTILE_POS',
      planTier: client.planTier || 'basic',
      licenseStatus: client.licenseStatus || 'active',
      targetIp: client.portForwarding?.targetIp || '127.0.0.1',
      assignedPort: client.portForwarding?.assignedPort || 5174,
      connectionType: client.portForwarding?.connectionType || 'PORT_FORWARD_ROUTER',
      pendingOwnerName: client.pendingOwnerName || client.name || '',
      pendingOwnerMobile: client.pendingOwnerMobile || client.contact || '',
      pendingOwnerEmail: client.pendingOwnerEmail || '',
      pendingOwnerPassword: '',
      screenPermissions: client.screenPermissions || {}
    });
  };

  // 1-Click WhatsApp Onboarding Share
  const handleShareWhatsApp = (client) => {
    const code = (client.customerCode || 'RENIC').toLowerCase();
    const publicUrl = `https://today-anticipated-earning-centres.trycloudflare.com/${code}`;
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

  // Save Relink
  const handleRelinkSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFleetClient) return;
    try {
      setRelinkLoading(true);
      const res = await api.put(`/network/relink/${selectedFleetClient._id}`, relinkForm);
      showSnackbar(res.data.message || 'IP Relinked successfully!', 'success');
      fetchMappings();
      setSelectedFleetClient(prev => ({
        ...prev,
        portForwarding: { ...prev.portForwarding, targetIp: relinkForm.targetIp, assignedPort: Number(relinkForm.assignedPort) }
      }));
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Relink failed', 'error');
    } finally {
      setRelinkLoading(false);
    }
  };

  // Save Fleet Edit Profile
  const handleSaveFleetEdit = async (e) => {
    e.preventDefault();
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

  // Toggle Emergency Lock
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
      showSnackbar(err.response?.data?.message || 'Lock toggle failed', 'error');
    }
  };

  // Filter mappings
  const filteredMappings = mappings.filter(m => {
    const matchesFilter = selectedFilter === 'ALL' ||
      (selectedFilter === 'ONLINE' && m.portForwarding?.status === 'online') ||
      (selectedFilter === 'OFFLINE' && m.portForwarding?.status !== 'online') ||
      (selectedFilter === 'TEXTILE' && m.softwareProduct === 'TEXTILE_POS') ||
      (selectedFilter === 'WA' && m.softwareProduct === 'WA_INSTA_AUTOMATION');

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ||
      m.name.toLowerCase().includes(query) ||
      (m.customerCode || '').toLowerCase().includes(query) ||
      (m.portForwarding?.targetIp || '').includes(query);

    return matchesFilter && matchesSearch;
  });

  const selectedApp = apps.find(a => a.appCode === selectedFleetClient?.softwareProduct);

  return (
    <div className="space-y-5">
      {/* Header & Global Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>PaaS Fleet Router & Network Console</span>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              High-Density Fleet
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time port forwarding, Cloudflare edge tunneling, zero-IP confidential proxying, and live showroom telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchMappings}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Fleet
          </button>
        </div>
      </div>

      {/* Telemetry Status Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {autoPing ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-500"></span>
            )}
          </span>
          <div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <span>CLOUD REVERSE PROXY ROUTING ACTIVE</span>
              <span className="px-2 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                GATEWAY :5050
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {lastHeartbeat ? (
                <>Last auto-pulse: <strong className="text-emerald-300">{lastHeartbeat.toLocaleTimeString()}</strong> · All tenant paths zero-IP reverse proxied</>
              ) : (
                'Live continuous ping telemetry active · Zero raw IP exposed'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition">
            <input
              type="checkbox"
              checked={autoPing}
              onChange={e => setAutoPing(e.target.checked)}
              className="rounded text-emerald-500 focus:ring-emerald-400"
            />
            <span>Auto-Pulse (10s)</span>
          </label>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {[
            { key: 'ALL', label: `All Fleets (${mappings.length})` },
            { key: 'ONLINE', label: '🟢 Online' },
            { key: 'OFFLINE', label: '🔴 Offline' },
            { key: 'TEXTILE', label: 'TextilePOS' },
            { key: 'WA', label: 'WhatsApp' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setSelectedFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                selectedFilter === f.key
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search code, showroom name, or IP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>
      </div>

      {/* ============ High-Density Enterprise Fleet Table ============ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="table-responsive">
          <table className="table w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="th py-3.5 px-4">Showroom / Client</th>
                <th className="th py-3.5 px-4">Software Product</th>
                <th className="th py-3.5 px-4">Primary Access URL</th>
                <th className="th py-3.5 px-4">Node Target Route</th>
                <th className="th py-3.5 px-4 text-center">Telemetry Status</th>
                <th className="th py-3.5 px-4 text-center">Status & Tier</th>
                <th className="th py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr><td colSpan={7} className="td text-center py-12 text-slate-400">Loading network routing mappings...</td></tr>
              ) : filteredMappings.length === 0 ? (
                <tr><td colSpan={7} className="td text-center py-12 text-slate-400">No matching fleet terminals found.</td></tr>
              ) : filteredMappings.map((client) => {
                const isLocked = client.securitySettings?.emergencyLock;
                const isOnline = client.portForwarding?.status === 'online';
                const code = client.customerCode || 'RENIC';
                const pingResult = urlPingResults[client._id];
                const latency = pingResult?.latencyMs || client.portForwarding?.latencyMs || 0;

                return (
                  <tr
                    key={client._id}
                    onClick={() => openInspector(client)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* Showroom / Client */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-xs font-mono">
                          {code.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                            {client.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              {code}
                            </span>
                            {isLocked && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 rounded animate-pulse">
                                LOCKED
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Software Product */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                        {client.softwareProduct === 'TEXTILE_POS' ? 'TextilePOS Plus' : client.softwareProduct === 'WA_INSTA_AUTOMATION' ? 'WhatsApp SaaS' : client.softwareProduct}
                      </span>
                    </td>

                    {/* Primary URL */}
                    <td className="py-3.5 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
                          http://{code.toLowerCase()}.lvh.me:5050
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`http://${code.toLowerCase()}.lvh.me:5050`);
                            showSnackbar('Copied URL to clipboard');
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded transition"
                          title="Copy Local URL"
                        >
                          <Icon name="copy" className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={`http://${code.toLowerCase()}.lvh.me:5050`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded transition"
                          title="Open Store Link"
                        >
                          <Icon name="external-link" className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>

                    {/* Node Target */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      <div>
                        {client.portForwarding?.targetIp || '127.0.0.1'}:{client.portForwarding?.assignedPort || 5000}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans font-medium uppercase mt-0.5">
                        {client.portForwarding?.connectionType || 'PORT_FORWARD'}
                      </div>
                    </td>

                    {/* Telemetry Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                        isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        {isOnline ? `Online (${latency}ms)` : 'Offline'}
                      </span>
                    </td>

                    {/* Status & Tier */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-slate-900 uppercase text-[11px]">
                        {client.planTier || 'PRO'}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                        {client.licenseStatus?.replace('_', ' ') || 'Active'}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openInspector(client)}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition shadow-2xs"
                          title="Inspect Working URLs & Node"
                        >
                          🔍 Inspect
                        </button>
                        <button
                          onClick={() => handleShareWhatsApp(client)}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                          title="Copy WhatsApp Onboarding Message"
                        >
                          📲
                        </button>
                        <button
                          onClick={() => handleToggleLock(client)}
                          className={`p-1.5 rounded-lg border transition ${
                            isLocked ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          }`}
                          title={isLocked ? 'Unlock Showroom' : 'Emergency Freeze'}
                        >
                          {isLocked ? '🔓' : '🚨'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ Fleet Inspector Popup Modal (Row-Click Drawer) ============ */}
      {selectedFleetClient && (
        <Modal
          open={!!selectedFleetClient}
          onClose={() => setSelectedFleetClient(null)}
          title={`Fleet Terminal: ${selectedFleetClient.name}`}
          maxWidth="max-w-3xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => handleShareWhatsApp(selectedFleetClient)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 flex items-center gap-1.5 shadow-2xs"
              >
                <span>📲</span> Copy WhatsApp Onboarding Link
              </button>
              <button className="btn-outline !px-4" onClick={() => setSelectedFleetClient(null)}>
                Close Console
              </button>
            </div>
          }
        >
          {/* Header Badge Strip */}
          <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between gap-3 mb-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                {selectedFleetClient.customerCode}
              </span>
              <span className="text-sm font-bold text-white">{selectedFleetClient.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Port {selectedFleetClient.portForwarding?.assignedPort || 5174}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                ● Live Edge Proxy
              </span>
            </div>
          </div>

          {/* Modal Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4 text-xs font-bold">
            {[
              { key: 'urls', label: '🌐 Live Clean URLs' },
              { key: 'relink', label: '⚡ Node Routing & IP Relink' },
              { key: 'profile', label: '👤 Profile & Credentials' },
              { key: 'screens', label: '📱 Screen-Gate Permissions' }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setInspectorTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  inspectorTab === tab.key
                    ? 'bg-slate-900 text-emerald-400 shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Live Working URLs */}
          {inspectorTab === 'urls' && (
            <div className="space-y-3.5">
              <div className="text-xs text-slate-500">
                Zero raw IP exposure. All URLs are automatically resolved and reverse-proxied by Renic_Soft:
              </div>

              {[
                {
                  label: 'Local Laptop (Zero Port / Clean DNS)',
                  url: `http://${(selectedFleetClient.customerCode || 'renic').toLowerCase()}.lvh.me:5050`,
                  badge: 'Direct Host'
                },
                {
                  label: 'Other Laptops & Mobile (Same Wi-Fi Network)',
                  url: `http://${(selectedFleetClient.customerCode || 'renic').toLowerCase()}.${detectedLanIp}.sslip.io:5050`,
                  badge: 'Wi-Fi LAN'
                },
                {
                  label: 'Worldwide Cloudflare Tunnel (Encrypted Edge - No Router Port Needed)',
                  url: `https://today-anticipated-earning-centres.trycloudflare.com/${(selectedFleetClient.customerCode || 'renic').toLowerCase()}`,
                  badge: 'Global HTTPS'
                },
                {
                  label: 'Production Cloud Domain',
                  url: `https://${(selectedFleetClient.customerCode || 'renic').toLowerCase()}.dm.renicsoft.com`,
                  badge: 'Production'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{item.label}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-200 text-slate-700 font-bold">
                        {item.badge}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-emerald-700 font-bold mt-1 break-all">
                      {item.url}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePingUrl(selectedFleetClient._id, item.url)}
                      disabled={pingingUrlId !== null}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition"
                    >
                      ⚡ Ping
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(item.url);
                        showSnackbar('Copied URL to clipboard');
                      }}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
                    >
                      📋 Copy
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-2xs"
                    >
                      🚀 Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Node Routing & IP Relink */}
          {inspectorTab === 'relink' && (
            <form onSubmit={handleRelinkSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Internal Terminal Target IP</label>
                  <input
                    type="text"
                    required
                    value={relinkForm.targetIp}
                    onChange={e => setRelinkForm({ ...relinkForm, targetIp: e.target.value })}
                    className="input font-mono"
                    placeholder="127.0.0.1 or 192.168.1.19"
                  />
                </div>

                <div>
                  <label className="label">Forwarded Port Number</label>
                  <input
                    type="number"
                    required
                    value={relinkForm.assignedPort}
                    onChange={e => setRelinkForm({ ...relinkForm, assignedPort: e.target.value })}
                    className="input font-mono font-bold"
                    placeholder="5174"
                  />
                </div>
              </div>

              <div>
                <label className="label">Change Reason (Audit History)</label>
                <input
                  type="text"
                  placeholder="e.g. Configured local showroom terminal"
                  value={relinkForm.reason}
                  onChange={e => setRelinkForm({ ...relinkForm, reason: e.target.value })}
                  className="input"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={relinkLoading}
                  className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 font-bold"
                >
                  {relinkLoading ? 'Verifying & Saving...' : '💾 Save & Verify Relink'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Client Profile & Credentials */}
          {inspectorTab === 'profile' && fleetEditForm && (
            <form onSubmit={handleSaveFleetEdit} className="space-y-3.5">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Client / Showroom Name</label>
                  <input
                    className="input font-bold"
                    value={fleetEditForm.name}
                    onChange={e => setFleetEditForm({ ...fleetEditForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Customer Code / URL ID</label>
                  <input
                    className="input font-mono font-bold uppercase text-emerald-700"
                    value={fleetEditForm.customerCode}
                    onChange={e => setFleetEditForm({ ...fleetEditForm, customerCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Admin Mobile (Username)</label>
                  <input
                    className="input font-semibold"
                    value={fleetEditForm.pendingOwnerMobile}
                    onChange={e => setFleetEditForm({ ...fleetEditForm, pendingOwnerMobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Admin Email</label>
                  <input
                    className="input"
                    type="email"
                    value={fleetEditForm.pendingOwnerEmail}
                    onChange={e => setFleetEditForm({ ...fleetEditForm, pendingOwnerEmail: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Reset Admin Password (Leave blank to keep unchanged)</label>
                <input
                  type="password"
                  placeholder="Enter new password to reset..."
                  className="input"
                  value={fleetEditForm.pendingOwnerPassword}
                  onChange={e => setFleetEditForm({ ...fleetEditForm, pendingOwnerPassword: e.target.value })}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 font-bold"
                >
                  {savingEdit ? 'Updating...' : '💾 Update Client Profile'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 4: Screen-Gate Permissions */}
          {inspectorTab === 'screens' && fleetEditForm && (
            <form onSubmit={handleSaveFleetEdit} className="space-y-4">
              <div className="text-xs text-slate-500">
                Grant or restrict screen modules for <strong>{selectedFleetClient.name}</strong> over-the-air:
              </div>

              {selectedApp?.screens && selectedApp.screens.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
                  {selectedApp.screens.map(scr => (
                    <label key={scr.key} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                        checked={fleetEditForm.screenPermissions[scr.key] !== false}
                        onChange={e => setFleetEditForm({
                          ...fleetEditForm,
                          screenPermissions: { ...fleetEditForm.screenPermissions, [scr.key]: e.target.checked }
                        })}
                      />
                      <span>{scr.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 text-slate-400 text-xs text-center rounded-xl">
                  All standard screens enabled for this application.
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 font-bold"
                >
                  {savingEdit ? 'Saving Permissions...' : '💾 Save Screen Permissions'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
