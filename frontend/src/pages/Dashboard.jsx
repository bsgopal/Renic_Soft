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
    <div className="w-full space-y-2.5 pb-8">
      {/* Compact Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0f172a] text-[#84cc16] flex items-center justify-center font-bold flex-shrink-0">
            <Icon name="dashboard" className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                HQ Dashboard
              </h1>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                • Welcome back, {user?.name?.split(' ')[0] || 'Admin'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link
            to="/licenses"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#84cc16] hover:bg-[#72b012] text-[#0f172a] text-xs font-bold rounded-lg shadow-2xs transition"
          >
            <Icon name="plus" className="w-3 h-3 stroke-[2.5]" /> Launch Instance
          </Link>
          <Link
            to="/quotes"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
          >
            <Icon name="quote" className="w-3 h-3" /> New Quote
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">
          <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-1.5" />
          <p className="text-xs font-medium">Loading platform metrics...</p>
        </div>
      ) : (
        <>
          {/* Top Metric Cards (Compact Enterprise Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {cards.map((c) => (
              <Link key={c.label} to={c.to} className="bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs hover:border-[#84cc16] hover:shadow-xs transition group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${c.color} group-hover:scale-105 transition`}>
                    <Icon name={c.icon} className="w-3 h-3" />
                  </div>
                </div>
                <div className="text-base font-black text-slate-900 tracking-tight font-mono">{c.value}</div>
              </Link>
            ))}
          </div>

          {/* Bottom Split Activity Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {/* Recent quotations */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50/70">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="quote" className="w-3 h-3 text-violet-600" /> Recent Quotations
                </h3>
                <Link to="/quotes" className="text-[11px] text-[#65a30d] font-bold hover:underline">View all →</Link>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {data?.recentQuotes?.length ? data.recentQuotes.map((q) => (
                  <Link key={q._id} to={`/quotes`} className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 transition">
                    <div>
                      <div className="font-bold text-[#65a30d] text-xs">{q.quoteNumber}</div>
                      <div className="text-[10px] text-slate-400">{q.customerName || 'Walk-in'} · {new Date(q.quoteDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono text-xs">{money(q.grandTotal)}</span>
                      <Badge value={q.status} />
                    </div>
                  </Link>
                )) : (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">No quotations yet. <Link to="/quotes" className="text-[#65a30d] font-bold">Create one →</Link></div>
                )}
              </div>
            </div>

            {/* Recent invoices */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50/70">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="bill" className="w-3 h-3 text-emerald-600" /> Recent Invoices
                </h3>
                <Link to="/billing" className="text-[11px] text-[#65a30d] font-bold hover:underline">View all →</Link>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {data?.recentBills?.length ? data.recentBills.map((b) => (
                  <Link key={b._id} to={`/billing`} className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 transition">
                    <div>
                      <div className="font-bold text-emerald-700 text-xs">{b.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">{b.customerName || 'Walk-in'} · {new Date(b.invoiceDate).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono text-xs">{money(b.grandTotal)}</span>
                      <Badge value={b.status} />
                    </div>
                  </Link>
                )) : (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">No invoices yet. <Link to="/billing" className="text-[#65a30d] font-bold">Create one →</Link></div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
