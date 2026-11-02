import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { downloadFile } from '../api.js';
import Badge from '../components/Badge.jsx';
import { Icon } from '../components/icons.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TABS = [
  { key: 'pending', label: 'Pending Amount', icon: 'clock', color: 'bg-amber-50 text-amber-600' },
  { key: 'paid', label: 'Fully Paid', icon: 'check', color: 'bg-emerald-50 text-emerald-600' },
  { key: 'unpaid', label: 'Not Paid', icon: 'x', color: 'bg-red-50 text-red-600' },
  { key: 'all', label: 'All Invoices', icon: 'bill', color: 'bg-brand-50 text-brand-500' }
];

export default function Reports() {
  const navigate = useNavigate();
  const { showSnackbar = () => {} } = useSnackbar() || {};
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/bills');
      setBills(res.data);
    } catch (err) {
      showSnackbar('Failed to load invoices', 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const lists = useMemo(() => {
    const pending = bills.filter((b) => (b.balanceDue || 0) > 0 && b.status !== 'Cancelled');
    const paid = bills.filter((b) => b.status === 'Paid');
    const unpaid = bills.filter((b) => (b.amountPaid || 0) === 0 && b.status !== 'Paid' && b.status !== 'Cancelled');
    return { pending, paid, unpaid, all: bills };
  }, [bills]);

  const active = lists[tab] || [];

  const filtered = useMemo(() => active.filter((b) => {
    const q = String(b.invoiceNumber || '').toLowerCase() + String(b.customerName || '').toLowerCase();
    return q.includes(search.toLowerCase());
  }), [active, search]);

  const totals = useMemo(() => {
    const grand = filtered.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const paidAmt = filtered.reduce((s, b) => s + (b.amountPaid || 0), 0);
    const bal = filtered.reduce((s, b) => s + (b.balanceDue || 0), 0);
    return { grand, paidAmt, bal, count: filtered.length };
  }, [filtered]);

  const handleExport = async (format) => {
    try {
      setExporting(format);
      await downloadFile(`/export/bills?filter=${tab}&format=${format}`, `billing-${tab}-${Date.now()}.${format}`);
      showSnackbar(`${label}${format.toUpperCase()} exported successfully`, 'success');
    } catch (err) {
      showSnackbar('Export failed. Please try again.', 'error');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="w-full space-y-2 pb-8">
      {/* Compact Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#0f172a] text-[#84cc16] flex items-center justify-center font-bold flex-shrink-0">
            <Icon name="bill" className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm font-black text-slate-900 tracking-tight">
              Payment &amp; Billing Reports
            </h1>
            <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
              • Financial audit, pending settlements &amp; payment records
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs transition"
            onClick={() => handleExport('pdf')}
            disabled={!!exporting}
          >
            <Icon name="print" className="w-3 h-3 text-slate-500" />
            {exporting === 'pdf' ? 'Generating...' : 'Export PDF'}
          </button>
          <button
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition"
            onClick={() => handleExport('xlsx')}
            disabled={!!exporting}
          >
            <Icon name="bill" className="w-3 h-3 text-white" />
            {exporting === 'xlsx' ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Compact 4 Status KPI Tabs Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TABS.map((t) => {
          const listCount = lists[t.key]?.length || 0;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-left rounded-lg border transition-all flex items-center justify-between gap-2 shadow-2xs ${
                isActive
                  ? 'bg-white border-[#84cc16] ring-1 ring-[#84cc16]/50 shadow-xs'
                  : 'bg-white border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.label}</div>
                <div className="text-base font-black text-slate-900 font-mono">{listCount}</div>
              </div>
              <div className={`w-7 h-7 rounded-md flex items-center justify-center border text-xs ${t.color}`}>
                <Icon name={t.icon} className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Compact Filter & Real-time Summary Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" className="w-3.5 h-3.5" />
          </span>
          <input
            className="w-full pl-8 pr-3 py-1 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#84cc16]"
            placeholder="Search invoice #, customer name, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-[11px] px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 font-semibold flex-wrap">
          <span>Records: <b className="text-slate-900">{totals.count}</b></span>
          <span className="text-slate-300">|</span>
          <span>Billed: <b className="text-slate-900">{money(totals.grand)}</b></span>
          <span className="text-slate-300">|</span>
          <span>Collected: <b className="text-emerald-700 font-bold">{money(totals.paidAmt)}</b></span>
          <span className="text-slate-300">|</span>
          <span>Due: <b className="text-amber-700 font-bold">{money(totals.bal)}</b></span>
        </div>
      </div>

      {/* Dense Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th className="px-3.5 py-2">Invoice #</th>
                <th className="px-3.5 py-2">Customer</th>
                <th className="px-3.5 py-2">Date</th>
                <th className="px-3.5 py-2 text-right">Total</th>
                <th className="px-3.5 py-2 text-right">Paid</th>
                <th className="px-3.5 py-2 text-right">Balance Due</th>
                <th className="px-3.5 py-2">Method</th>
                <th className="px-3.5 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#65a30d]" />
                    Loading report invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 font-medium">
                    No invoices matching this filter category.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr
                    key={b._id}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                    onClick={() => navigate(`/billing/${b._id}`)}
                  >
                    <td className="px-3.5 py-2 font-mono font-bold text-[#65a30d] text-xs">{b.invoiceNumber}</td>
                    <td className="px-3.5 py-2">
                      <div className="font-bold text-slate-900 text-xs">{b.customerName || 'Walk-in'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{b.customerPhone || '—'}</div>
                    </td>
                    <td className="px-3.5 py-2 text-slate-600 text-[11px]">{new Date(b.invoiceDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="px-3.5 py-2 text-right font-black text-slate-900 font-mono">{money(b.grandTotal)}</td>
                    <td className="px-3.5 py-2 text-right font-bold text-emerald-700 font-mono">{money(b.amountPaid)}</td>
                    <td className="px-3.5 py-2 text-right font-black text-amber-700 font-mono">{money(b.balanceDue)}</td>
                    <td className="px-3.5 py-2 font-semibold text-slate-700 text-[11px]">{b.paymentMethod || 'Cash'}</td>
                    <td className="px-3.5 py-2 text-center"><Badge value={b.status} /></td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/billing/${b._id}`)}
                        className="p-1 text-slate-500 hover:text-[#65a30d] hover:bg-slate-100 rounded transition"
                        title="View Full Invoice"
                      >
                        <Icon name="eye" className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}