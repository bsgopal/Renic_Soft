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
    <div className="w-full flex-1 flex flex-col p-4 sm:p-6 space-y-4 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Icon name="bill" className="w-6 h-6 text-[#65a30d]" />
            Payment &amp; Billing Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit pending balances, fully paid settlements, and revenue summaries with instant export options.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-xs transition"
            onClick={() => handleExport('pdf')}
            disabled={!!exporting}
          >
            <Icon name="print" className="w-4 h-4 text-slate-500" />
            {exporting === 'pdf' ? 'Generating PDF...' : 'Export PDF'}
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
            onClick={() => handleExport('xlsx')}
            disabled={!!exporting}
          >
            <Icon name="bill" className="w-4 h-4 text-white" />
            {exporting === 'xlsx' ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* 4 Status KPI Metric Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {TABS.map((t) => {
          const listCount = lists[t.key]?.length || 0;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`p-4 text-left rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                isActive
                  ? 'bg-white border-[#84cc16] ring-2 ring-[#84cc16]/30 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.label}</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{listCount}</div>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${t.color}`}>
                <Icon name={t.icon} className="w-5 h-5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and Real-time Summary Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <input
            className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#84cc16]"
            placeholder="Filter by invoice #, customer name, or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 text-xs px-3.5 py-2 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 font-semibold flex-wrap">
          <span>Records: <b className="text-slate-900">{totals.count}</b></span>
          <span className="text-slate-300">|</span>
          <span>Billed: <b className="text-slate-900">{money(totals.grand)}</b></span>
          <span className="text-slate-300">|</span>
          <span>Collected: <b className="text-emerald-700 font-bold">{money(totals.paidAmt)}</b></span>
          <span className="text-slate-300">|</span>
          <span>Outstanding: <b className="text-amber-700 font-bold">{money(totals.bal)}</b></span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="px-4 py-3">INVOICE #</th>
                <th className="px-4 py-3">CUSTOMER</th>
                <th className="px-4 py-3">DATE</th>
                <th className="px-4 py-3 text-right">TOTAL (INR)</th>
                <th className="px-4 py-3 text-right">PAID (INR)</th>
                <th className="px-4 py-3 text-right">BALANCE DUE</th>
                <th className="px-4 py-3">METHOD</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <Icon name="refresh" className="w-6 h-6 animate-spin mx-auto mb-2 text-[#65a30d]" />
                    Loading report invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">
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
                    <td className="px-4 py-3 font-mono font-bold text-[#65a30d]">{b.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{b.customerName || 'Walk-in Customer'}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.customerPhone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{new Date(b.invoiceDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{money(b.grandTotal)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{money(b.amountPaid)}</td>
                    <td className="px-4 py-3 text-right font-black text-amber-700">{money(b.balanceDue)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{b.paymentMethod || 'Cash'}</td>
                    <td className="px-4 py-3"><Badge value={b.status} /></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/billing/${b._id}`)}
                        className="p-1.5 text-slate-500 hover:text-[#65a30d] hover:bg-slate-100 rounded-lg transition"
                        title="View Full Invoice"
                      >
                        <Icon name="eye" className="w-4 h-4" />
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