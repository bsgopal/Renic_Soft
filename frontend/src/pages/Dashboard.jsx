import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import Badge from '../components/Badge.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/summary')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total Licenses', value: data?.totalClients ?? '—', icon: 'store', color: 'bg-brand-50 text-brand-500', to: '/licenses' },
    { label: 'Active Plans', value: data?.activeClients ?? '—', icon: 'check', color: 'bg-emerald-50 text-emerald-600', to: '/licenses' },
    { label: 'Quotations', value: data?.totalQuotes ?? '—', icon: 'quote', color: 'bg-violet-50 text-violet-600', to: '/quotes' },
    { label: 'Invoices', value: data?.totalBills ?? '—', icon: 'bill', color: 'bg-amber-50 text-amber-600', to: '/billing' },
    { label: 'Collected Revenue', value: data ? money(data.revenue) : '—', icon: 'bill', color: 'bg-emerald-50 text-emerald-600', to: '/billing' },
    { label: 'Outstanding', value: data ? money(data.pendingRevenue) : '—', icon: 'clock', color: 'bg-red-50 text-red-600', to: '/billing' }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here's what's happening across your Renic Soft platform.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cards.map((c) => (
              <Link key={c.label} to={c.to} className="card p-5 flex items-center gap-4 hover:shadow-cardhover transition-shadow">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${c.color}`}>
                  <Icon name={c.icon} className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.label}</div>
                  <div className="text-xl font-semibold text-ink">{c.value}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mt-8">
            {/* Recent quotations */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-ink">Recent Quotations</h3>
                <Link to="/quotes" className="text-sm text-brand-600 font-medium hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {data?.recentQuotes?.length ? data.recentQuotes.map((q) => (
                  <Link key={q._id} to={`/quotes/${q._id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-sm text-brand-600">{q.quoteNumber}</div>
                      <div className="text-xs text-gray-500">{q.customerName || 'Walk-in'} · {new Date(q.quoteDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{money(q.grandTotal)}</span>
                      <Badge value={q.status} />
                    </div>
                  </Link>
                )) : (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">No quotations yet. <Link to="/quotes" className="text-brand-600">Create one →</Link></div>
                )}
              </div>
            </div>

            {/* Recent invoices */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-ink">Recent Invoices</h3>
                <Link to="/billing" className="text-sm text-brand-600 font-medium hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {data?.recentBills?.length ? data.recentBills.map((b) => (
                  <Link key={b._id} to={`/billing/${b._id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-sm text-brand-600">{b.invoiceNumber}</div>
                      <div className="text-xs text-gray-500">{b.customerName || 'Walk-in'} · {new Date(b.invoiceDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{money(b.grandTotal)}</span>
                      <Badge value={b.status} />
                    </div>
                  </Link>
                )) : (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">No invoices yet. <Link to="/billing" className="text-brand-600">Create one →</Link></div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}