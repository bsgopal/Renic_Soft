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
    { label: 'Total Licenses', value: data?.totalClients ?? '—', icon: 'store', color: 'bg-lime-50 text-blue-600', to: '/licenses' },
    { label: 'Active Plans', value: data?.activeClients ?? '—', icon: 'check', color: 'bg-emerald-50 text-emerald-600', to: '/licenses' },
    { label: 'Quotations', value: data?.totalQuotes ?? '—', icon: 'quote', color: 'bg-violet-50 text-violet-600', to: '/quotes' },
    { label: 'Invoices', value: data?.totalBills ?? '—', icon: 'bill', color: 'bg-amber-50 text-amber-600', to: '/billing' },
    { label: 'Collected Revenue', value: data ? money(data.revenue) : '—', icon: 'bill', color: 'bg-emerald-50 text-emerald-600', to: '/billing' },
    { label: 'Outstanding', value: data ? money(data.pendingRevenue) : '—', icon: 'clock', color: 'bg-rose-50 text-rose-600', to: '/billing' }
  ];

  return (
    <div className="w-full space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Admin'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time overview of customer instances, revenue, and active platform services.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/licenses"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Icon name="plus" className="w-3.5 h-3.5" /> Launch Instance
          </Link>
          <Link
            to="/quotes"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <Icon name="quote" className="w-3.5 h-3.5" /> New Quote
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">
          <Icon name="refresh" className="w-6 h-6 animate-spin mx-auto text-[#65a30d] mb-2" />
          <p className="text-xs font-medium">Loading platform metrics...</p>
        </div>
      ) : (
        <>
          {/* Top Metric Cards (Spans Full Width) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map((c) => (
              <Link key={c.label} to={c.to} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-[#84cc16] hover:shadow-sm transition group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.color} group-hover:scale-105 transition`}>
                    <Icon name={c.icon} className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900 tracking-tight">{c.value}</div>
              </Link>
            ))}
          </div>

          {/* Bottom Split Activity Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent quotations */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="quote" className="w-3.5 h-3.5 text-violet-600" /> Recent Quotations
                </h3>
                <Link to="/quotes" className="text-xs text-[#65a30d] font-bold hover:underline">View all →</Link>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {data?.recentQuotes?.length ? data.recentQuotes.map((q) => (
                  <Link key={q._id} to={`/quotes`} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition">
                    <div>
                      <div className="font-bold text-[#65a30d] text-xs">{q.quoteNumber}</div>
                      <div className="text-[11px] text-slate-500">{q.customerName || 'Walk-in'} · {new Date(q.quoteDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{money(q.grandTotal)}</span>
                      <Badge value={q.status} />
                    </div>
                  </Link>
                )) : (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">No quotations yet. <Link to="/quotes" className="text-[#65a30d] font-bold">Create one →</Link></div>
                )}
              </div>
            </div>

            {/* Recent invoices */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="bill" className="w-3.5 h-3.5 text-emerald-600" /> Recent Invoices
                </h3>
                <Link to="/billing" className="text-xs text-[#65a30d] font-bold hover:underline">View all →</Link>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {data?.recentBills?.length ? data.recentBills.map((b) => (
                  <Link key={b._id} to={`/billing`} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition">
                    <div>
                      <div className="font-bold text-emerald-700 text-xs">{b.invoiceNumber}</div>
                      <div className="text-[11px] text-slate-500">{b.customerName || 'Walk-in'} · {new Date(b.invoiceDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{money(b.grandTotal)}</span>
                      <Badge value={b.status} />
                    </div>
                  </Link>
                )) : (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">No invoices yet. <Link to="/billing" className="text-[#65a30d] font-bold">Create one →</Link></div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
