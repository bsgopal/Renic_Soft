import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const severityStyles = {
  critical: { chip: 'bg-rose-100 text-rose-700 ring-rose-200 animate-pulse', icon: 'shield', ring: 'border-l-rose-600 bg-rose-50/30' },
  error: { chip: 'bg-red-50 text-red-600 ring-red-100', icon: 'x', ring: 'border-l-red-500' },
  warning: { chip: 'bg-amber-50 text-amber-600 ring-amber-100', icon: 'clock', ring: 'border-l-amber-500' },
  info: { chip: 'bg-sky-50 text-sky-600 ring-sky-100', icon: 'bell', ring: 'border-l-brand-500' }
};

const GROUP_LABELS = {
  security_alert: '🚨 Critical Security Alerts',
  license_expired: 'Expired Licenses',
  license_expiring: 'Licenses Expiring Soon',
  license_locked: 'Blocked Licenses',
  payment_unpaid: 'Unpaid Invoices',
  quote_expired: 'Expired Quotations',
  quote_expiring: 'Quotations Expiring Soon',
  app_sync: '🚀 App Sync & PaaS Events',
  payment_received: '✅ Paid Invoices & Revenue',
  store_live: '🏢 Active Stores & Fleet'
};

export default function Notifications() {
  const navigate = useNavigate();
  const { showSnackbar = () => {} } = useSnackbar() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const getReadNotifIds = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem('renic_soft_read_notifs') || '[]'));
    } catch {
      return new Set();
    }
  };

  const markAllAsRead = (list) => {
    try {
      const readIds = getReadNotifIds();
      (list || []).forEach((n, idx) => {
        const id = n.entityId ? String(n.entityId) : `${n.type}-${n.title}-${idx}`;
        readIds.add(id);
      });
      localStorage.setItem('renic_soft_read_notifs', JSON.stringify(Array.from(readIds).slice(-200)));
      showSnackbar('All notifications marked as read', 'success');
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    api.get('/notifications')
      .then((res) => {
        setData(res.data);
        markAllAsRead(res.data?.notifications);
      })
      .catch(() => showSnackbar('Failed to load notifications', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = {};
  (data?.notifications || []).forEach((n) => {
    if (!grouped[n.type]) grouped[n.type] = [];
    grouped[n.type].push(n);
  });

  const totalByGroup = Object.keys(GROUP_LABELS).map((type) => ({
    type,
    label: GROUP_LABELS[type],
    count: (data?.notifications || []).filter((n) => n.type === type).length
  })).filter((g) => g.count > 0);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading notifications...</div>;
  if (!data?.notifications?.length) return (
    <div className="max-w-3xl mx-auto text-center py-24">
      <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4">
        <Icon name="check" className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-semibold text-ink">All caught up!</h2>
      <p className="text-sm text-gray-500 mt-1.5">No notifications or events recorded right now.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink">Notifications & System Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.securityAlerts > 0 && (
              <span className="text-rose-600 font-semibold mr-1">
                🚨 {data.securityAlerts} critical security alert{data.securityAlerts > 1 ? 's' : ''} ·
              </span>
            )}
            {data.expiredLicenses || 0} expired · {data.expiringLicenses || 0} expiring licenses · {data.unpaidInvoices || 0} unpaid invoices
          </p>
        </div>
        <button
          onClick={() => markAllAsRead(data?.notifications)}
          className="btn btn-outline text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Icon name="check" className="w-4 h-4 text-emerald-600" />
          Mark All as Read
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {totalByGroup.map((g) => (
          <div key={g.type} className={`card p-4 ${g.type === 'security_alert' ? 'border-rose-300 bg-rose-50/20' : ''}`}>
            <div className={`text-2xl font-semibold ${g.type === 'security_alert' ? 'text-rose-600' : 'text-ink'}`}>{g.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{g.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className={`card overflow-hidden ${type === 'security_alert' ? 'border-rose-300 shadow-md ring-1 ring-rose-200' : ''}`}>
            <div className={`px-5 py-3 border-b flex items-center justify-between ${type === 'security_alert' ? 'bg-rose-50/80 border-rose-200 text-rose-800' : 'bg-gray-50 border-gray-100 text-ink'}`}>
              <h3 className="text-sm font-semibold">{GROUP_LABELS[type] || type}</h3>
              <span className={`badge ring-1 ${type === 'security_alert' ? 'bg-rose-100 text-rose-700 ring-rose-300 font-bold' : 'bg-white text-gray-500 ring-gray-200'}`}>{items.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((n, i) => {
                const s = severityStyles[n.severity] || severityStyles.info;
                return (
                  <button
                    key={i}
                    onClick={() => n.link && navigate(n.link)}
                    className={`w-full text-left flex items-start gap-3.5 px-5 py-4 hover:bg-gray-50 border-l-4 transition-colors ${s.ring}`}
                  >
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${s.chip}`}>
                      <Icon name={s.icon} className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${n.severity === 'critical' ? 'text-rose-950 font-bold' : 'text-ink'}`}>{n.title}</span>
                      <span className="block text-xs text-gray-600 mt-0.5 leading-relaxed">{n.message}</span>
                      {n.timestamp && (
                        <span className="block text-[11px] text-gray-400 mt-1 font-mono">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {new Date(n.timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}