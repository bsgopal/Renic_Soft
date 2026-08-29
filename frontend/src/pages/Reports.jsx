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
  const { showSnackbar } = useSnackbar();
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
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-ink">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Pending, fully paid and unpaid invoice lists with export options</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline px-4 py-2.5" onClick={() => handleExport('pdf')} disabled={!!exporting}>
            <Icon name="print" className="w-4 h-4" /> {exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
          </button>
          <button className="btn-primary px-4 py-2.5" onClick={() => handleExport('xlsx')} disabled={!!exporting}>
            <Icon name="bill" className="w-4 h-4" /> {exporting === 'xlsx' ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {TABS.map((t) => {
          const listCount = lists[t.key]?.length || 0;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`card p-5 text-left transition-all ${isActive ? 'ring-2 ring-brand-500 shadow-cardhover' : 'hover:shadow-cardhover'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${t.color}`}>
                <Icon name={t.icon} className="w-5 h-5" />
              </div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t.label}</div>
              <div className="text-xl font-semibold text-ink">{listCount}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="search" className="w-4 h-4" /></span>
          <input className="input !pl-10" placeholder="Search by invoice # or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 text-xs px-3 py-2 bg-white rounded-lg border border-gray-200 text-gray-500">
          <span><b>{totals.count}</b> inv</span>
          <span>· Total <b className="text-ink">{money(totals.grand)}</b></span>
          <span>· Collected <b className="text-emerald-600">{money(totals.paidAmt)}</b></span>
          <span>· Balance <b className="text-amber-600">{money(totals.bal)}</b></span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="th">Invoice #</th>
                <th className="th">Customer</th>
                <th className="th">Date</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Balance</th>
                <th className="th">Method</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="td text-center py-10 text-gray-400">Loading invoices...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="td text-center py-10 text-gray-400">No invoices in this category.</td></tr>
              ) : filtered.map((b) => (
                <tr key={b._id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => navigate(`/billing/${b._id}`)}>
                  <td className="td font-semibold text-brand-600">{b.invoiceNumber}</td>
                  <td className="td">
                    <div className="font-medium">{b.customerName || 'Walk-in Customer'}</div>
                    <div className="text-xs text-gray-400">{b.customerPhone || ''}</div>
                  </td>
                  <td className="td text-xs text-gray-500">{new Date(b.invoiceDate).toLocaleDateString()}</td>
                  <td className="td text-right font-semibold">{money(b.grandTotal)}</td>
                  <td className="td text-right text-emerald-600">{money(b.amountPaid)}</td>
                  <td className="td text-right font-medium text-amber-600">{money(b.balanceDue)}</td>
                  <td className="td text-xs">{b.paymentMethod}</td>
                  <td className="td"><Badge value={b.status} /></td>
                  <td className="td text-right"><Icon name="eye" className="w-4 h-4 inline text-gray-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}