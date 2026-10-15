import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    badge: 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse font-bold',
    icon: 'shield',
    iconColor: 'text-rose-600',
    rowBorder: 'border-l-4 border-l-rose-600 bg-rose-50/20'
  },
  error: {
    label: 'High',
    badge: 'bg-red-50 text-red-700 border-red-200 font-semibold',
    icon: 'x',
    iconColor: 'text-red-600',
    rowBorder: 'border-l-4 border-l-red-500'
  },
  warning: {
    label: 'Warning',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
    icon: 'clock',
    iconColor: 'text-amber-600',
    rowBorder: 'border-l-4 border-l-amber-500'
  },
  info: {
    label: 'Info',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 font-medium',
    icon: 'bell',
    iconColor: 'text-sky-600',
    rowBorder: 'border-l-4 border-l-[#84cc16]'
  }
};

const TYPE_CONFIG = {
  security_alert: { label: 'Security Alert', icon: 'shield', badge: 'bg-rose-100 text-rose-800' },
  license_expired: { label: 'License Expired', icon: 'key', badge: 'bg-red-100 text-red-800' },
  license_expiring: { label: 'License Expiring', icon: 'clock', badge: 'bg-amber-100 text-amber-800' },
  license_locked: { label: 'License Locked', icon: 'lock', badge: 'bg-slate-100 text-slate-800' },
  payment_unpaid: { label: 'Invoice Due', icon: 'dollar-sign', badge: 'bg-orange-100 text-orange-800' },
  quote_expired: { label: 'Quote Expired', icon: 'file-text', badge: 'bg-slate-100 text-slate-700' },
  quote_expiring: { label: 'Quote Expiring', icon: 'file-text', badge: 'bg-blue-100 text-blue-800' },
  app_sync: { label: 'App Sync / PaaS', icon: 'refresh', badge: 'bg-lime-100 text-lime-900' },
  payment_received: { label: 'Payment Received', icon: 'check', badge: 'bg-emerald-100 text-emerald-800' },
  store_live: { label: 'Active Fleet Store', icon: 'storefront', badge: 'bg-indigo-100 text-indigo-800' }
};

export default function Notifications() {
  const navigate = useNavigate();
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionInProgress, setActionInProgress] = useState(false);

  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/notifications');
      setData(res.data);
    } catch (err) {
      if (!silent) {
        showSnackbar(err.response?.data?.message || 'Failed to load notifications', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(true), 8000);
    const onFocus = () => fetchNotifications(true);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const notificationsList = data?.notifications || [];

  // Filtered List
  const filteredList = useMemo(() => {
    return notificationsList.filter((n) => {
      if (severityFilter !== 'ALL' && n.severity !== severityFilter) return false;
      if (typeFilter !== 'ALL' && n.type !== typeFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = (n.title || '').toLowerCase().includes(query);
        const msgMatch = (n.message || '').toLowerCase().includes(query);
        const typeMatch = (n.type || '').toLowerCase().includes(query);
        if (!titleMatch && !msgMatch && !typeMatch) return false;
      }
      return true;
    });
  }, [notificationsList, severityFilter, typeFilter, searchQuery]);

  // Single Delete
  const handleDeleteNotification = async (notif) => {
    try {
      setActionInProgress(true);
      const notifId = notif.id || `notif_${notif.entityId || notif.title}`;
      await api.delete(`/notifications/${encodeURIComponent(notifId)}`);
      showSnackbar('Notification removed', 'success');
      setData((prev) => {
        if (!prev) return prev;
        const updatedList = prev.notifications.filter((item) => item.id !== notif.id && item !== notif);
        return { ...prev, notifications: updatedList };
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(notif.id);
        return next;
      });
    } catch (err) {
      showSnackbar(err.response?.data?.error || err.response?.data?.message || 'Failed to delete notification', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Bulk Delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirmDialog({
      title: `Delete ${selectedIds.size} Notification(s)?`,
      message: 'Are you sure you want to dismiss and delete the selected notifications?',
      confirmText: 'Delete Selected',
      danger: true
    });
    if (!ok) return;

    try {
      setActionInProgress(true);
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(
        idsToDelete.map((id) => api.delete(`/notifications/${encodeURIComponent(id)}`).catch(() => {}))
      );
      showSnackbar(`Deleted ${idsToDelete.length} notifications`, 'success');
      setSelectedIds(new Set());
      fetchNotifications();
    } catch (err) {
      showSnackbar('Error deleting notifications', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Clear All Notifications
  const handleClearAll = async () => {
    const ok = await confirmDialog({
      title: 'Clear All Notifications?',
      message: 'This will dismiss and clear all active notifications and security alert logs.',
      confirmText: 'Clear All',
      danger: true
    });
    if (!ok) return;

    try {
      setActionInProgress(true);
      await api.delete('/notifications/clear/all');
      showSnackbar('All notifications cleared successfully', 'success');
      setSelectedIds(new Set());
      setData({
        notifications: [],
        unreadCount: 0,
        securityAlerts: 0,
        expiredLicenses: 0,
        expiringLicenses: 0,
        unpaidInvoices: 0
      });
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to clear all notifications', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Select / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredList.map((n, idx) => n.id || `notif_${idx}`));
      setSelectedIds(allIds);
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f4f6f8] overflow-hidden text-slate-800">
      {/* Top Header Card */}
      <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Notifications &amp; System Events
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-lime-400">
                {notificationsList.length} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live audit alerts, OAuth security monitors, license lifecycle, and PaaS dispatch telemetry
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchNotifications}
              disabled={loading || actionInProgress}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              title="Refresh Notifications"
            >
              <Icon name="refresh" className={`w-4 h-4 ${loading ? 'animate-spin text-[#65a30d]' : ''}`} />
            </button>

            {notificationsList.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={actionInProgress}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition"
              >
                <Icon name="trash" className="w-3.5 h-3.5 text-rose-600" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Quick Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <div className={`p-2.5 rounded-lg border text-xs ${data?.securityAlerts > 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Security Alerts</div>
            <div className={`text-lg font-bold mt-0.5 ${data?.securityAlerts > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {data?.securityAlerts || 0}
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expired Licenses</div>
            <div className="text-lg font-bold mt-0.5 text-slate-800">
              {data?.expiredLicenses || 0}
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expiring (7-30d)</div>
            <div className="text-lg font-bold mt-0.5 text-amber-600">
              {data?.expiringLicenses || 0}
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unpaid Invoices</div>
            <div className="text-lg font-bold mt-0.5 text-slate-800">
              {data?.unpaidInvoices || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search notifications, codes, titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
            />
            <span className="absolute left-2.5 top-2 text-slate-400">
              <Icon name="search" className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 text-xs focus:outline-none focus:border-[#84cc16]"
          >
            <option value="ALL">All Severities</option>
            <option value="critical">🚨 Critical</option>
            <option value="error">High / Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info / Success</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-700 text-xs focus:outline-none focus:border-[#84cc16]"
          >
            <option value="ALL">All Event Types</option>
            <option value="security_alert">Security Alerts</option>
            <option value="license_expired">Expired Licenses</option>
            <option value="license_expiring">Expiring Licenses</option>
            <option value="license_locked">Locked Licenses</option>
            <option value="payment_unpaid">Unpaid Invoices</option>
            <option value="quote_expiring">Expiring Quotes</option>
            <option value="app_sync">App Syncs</option>
          </select>

          {/* Bulk Delete Button when items selected */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={actionInProgress}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
            >
              <Icon name="trash" className="w-3.5 h-3.5" />
              Delete Selected ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredList.length > 0 && selectedIds.size === filteredList.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16] cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 w-28">Severity</th>
                <th className="py-2.5 px-3 w-36">Category</th>
                <th className="py-2.5 px-3">Notification Event &amp; Details</th>
                <th className="py-2.5 px-3 w-40">Timestamp</th>
                <th className="py-2.5 px-3 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Icon name="refresh" className="w-6 h-6 animate-spin mx-auto text-[#65a30d] mb-2" />
                    <span className="font-semibold">Loading system notifications...</span>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                      <Icon name="check" className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700 text-sm">All caught up!</p>
                    <p className="text-xs text-slate-400 mt-1">No notifications matching current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((n, idx) => {
                  const id = n.id || `notif_${idx}`;
                  const isSelected = selectedIds.has(id);
                  const sev = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.info;
                  const typ = TYPE_CONFIG[n.type] || { label: n.type || 'Event', badge: 'bg-slate-100 text-slate-700' };

                  return (
                    <tr
                      key={id}
                      className={`transition ${sev.rowBorder} ${
                        isSelected ? 'bg-lime-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="py-3 px-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(id)}
                          className="rounded border-slate-300 text-[#84cc16] focus:ring-[#84cc16] cursor-pointer"
                        />
                      </td>

                      {/* Severity Badge */}
                      <td className="py-3 px-3 align-top">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${sev.badge}`}>
                          <Icon name={sev.icon} className={`w-3 h-3 ${sev.iconColor}`} />
                          {sev.label}
                        </span>
                      </td>

                      {/* Category Type */}
                      <td className="py-3 px-3 align-top">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${typ.badge}`}>
                          {typ.label}
                        </span>
                      </td>

                      {/* Notification Title & Details */}
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900 text-xs">
                          {n.title}
                        </div>
                        <div className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                          {n.message}
                        </div>
                        {n.link && (
                          <button
                            onClick={() => navigate(n.link)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#65a30d] hover:text-[#4d7c0f] hover:underline mt-1.5"
                          >
                            <span>Open Resource</span>
                            <Icon name="arrow-right" className="w-3 h-3" />
                          </button>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-3 align-top text-slate-500 text-[11px]">
                        {n.timestamp ? (
                          <>
                            <div className="font-medium text-slate-700">
                              {new Date(n.timestamp).toLocaleDateString()}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Delete / Action buttons */}
                      <td className="py-3 px-3 align-top text-right">
                        <div className="inline-flex items-center gap-1">
                          {n.link && (
                            <button
                              onClick={() => navigate(n.link)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                              title="Go to screen"
                            >
                              <Icon name="external-link" className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteNotification(n)}
                            disabled={actionInProgress}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete notification"
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
    </div>
  );
}