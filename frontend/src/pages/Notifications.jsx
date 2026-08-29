import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const severityStyles = {
  error: { chip: 'bg-red-50 text-red-600 ring-red-100', icon: 'x', ring: 'border-l-red-500' },
  warning: { chip: 'bg-amber-50 text-amber-600 ring-amber-100', icon: 'clock', ring: 'border-l-amber-500' },
  info: { chip: 'bg-sky-50 text-sky-600 ring-sky-100', icon: 'bell', ring: 'border-l-brand-500' }
};

const GROUP_LABELS = {
  license_expired: 'Expired Licenses',
  license_expiring: 'Licenses Expiring Soon',
  license_locked: 'Blocked Licenses',
  payment_unpaid: 'Unpaid Invoices',
  quote_expired: 'Expired Quotations',
  quote_expiring: 'Quotations Expiring Soon'
};

export default function Notifications() {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications')
      .then((res) => setData(res.data))
      .catch(() => showSnackbar('Failed to load notifications', 'error'))
      .finally(() => setLoading(false));
  }, [showSnackbar]);

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
      <p className="text-sm text-gray-500 mt-1.5">No expiring licenses, pending payments or expiring quotations right now.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold text-ink">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.expiredLicenses} expired · {data.expiringLicenses} expiring licenses · {data.unpaidInvoices} unpaid invoices
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {totalByGroup.map((g) => (
          <div key={g.type} className="card p-4">
            <div className="text-2xl font-semibold text-ink">{g.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{g.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{GROUP_LABELS[type] || type}</h3>
              <span className="badge bg-white text-gray-500 ring-1 ring-gray-200">{items.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((n, i) => {
                const s = severityStyles[n.severity] || severityStyles.info;
                return (
                  <button
                    key={i}
                    onClick={() => n.link && navigate(n.link)}
                    className={`w-full text-left flex items-start gap-3.5 px-5 py-4 hover:bg-gray-50 border-l-4 ${s.ring}`}
                  >
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${s.chip}`}>
                      <Icon name={s.icon} className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{n.title}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{n.message}</span>
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