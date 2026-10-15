import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { downloadFile } from '../api.js';
import Badge from '../components/Badge.jsx';
import SplitDivider from '../components/SplitDivider.jsx';
import QuotationDoc from '../components/QuotationDoc.jsx';
import { Icon } from '../components/icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSnackbar } from '../context/SnackbarContext.jsx';
import logo from '../assets/logo.png';

const emptyItem = () => ({ name: '', description: '', hsnCode: '', qty: 1, unit: 'pcs', rate: 0, gstPercent: 0, discountPercent: 0, amount: 0 });

const DEFAULT_FORM = {
  clientId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  customerAddress: '',
  customerGSTIN: '',
  validDate: '',
  notes: '',
  terms: '',
  status: 'draft',
  advanceDeposit: 0,
  items: [emptyItem()]
};

const line = (it) => {
  const qty = Number(it.qty) || 0;
  const rate = Number(it.rate) || 0;
  const base = qty * rate;
  const disc = (base * (Number(it.discountPercent) || 0)) / 100;
  const tax = ((base - disc) * (Number(it.gstPercent) || 0)) / 100;
  return { base, disc, tax, total: base - disc + tax };
};

const computeTotals = (items) => items.reduce(
  (acc, it) => {
    const l = line(it);
    return {
      subTotal: acc.subTotal + l.base,
      discountTotal: acc.discountTotal + l.disc,
      taxTotal: acc.taxTotal + l.tax,
      grandTotal: acc.grandTotal + l.total
    };
  },
  { subTotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 }
);

const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];
const in30d = () => new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

export default function Quotes() {
  const navigate = useNavigate();
  const { isPlatform = false, client } = useAuth() || {};
  const { showSnackbar = () => {}, confirmDialog = async () => true } = useSnackbar() || {};
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Two-Column Layout States
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [mode, setMode] = useState(''); // '' | 'create' | 'edit'
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);
  const [splitPercent, setSplitPercent] = useState(30);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      if (newPercent >= 20 && newPercent <= 80) {
        setSplitPercent(newPercent);
      }
    };
    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/quotes');
      const list = Array.isArray(res.data) ? res.data : [];
      setQuotes(list);
      // No auto-select: initial view is 1 column full width
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedQuote, mode, showSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (isPlatform) api.get('/clients').then((res) => setClients(res.data)).catch(() => {});
  }, [isPlatform]);

  const setItem = (idx, key, value) => {
    const items = form.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    const totals = computeTotals(items);
    setForm({ ...form, items, ...totals });
  };

  const addItem = () => {
    const items = [...form.items, emptyItem()];
    setForm({ ...form, items, ...computeTotals(items) });
  };

  const removeItem = (idx) => {
    const items = form.items.filter((_, i) => i !== idx);
    setForm({ ...form, items, ...computeTotals(items) });
  };

  const openCreate = () => {
    setMode('create');
    setEditingId(null);
    setSelectedQuote(null);
    const newItems = [emptyItem()];
    setForm({
      ...DEFAULT_FORM,
      validDate: in30d(),
      items: newItems,
      ...computeTotals(newItems)
    });
  };

  const openView = (q) => {
    setSelectedQuote(q);
    setMode('view');
    setEditingId(q._id);
    const items = q.items?.length ? q.items.map(it => ({ ...it })) : [emptyItem()];
    setForm({
      clientId: q.clientId || '',
      customerName: q.customerName || '',
      customerPhone: q.customerPhone || '',
      customerEmail: q.customerEmail || '',
      customerAddress: q.customerAddress || '',
      customerGSTIN: q.customerGSTIN || '',
      validDate: q.validUntil ? q.validUntil.split('T')[0] : in30d(),
      notes: q.notes || '',
      terms: q.terms || '',
      status: q.status,
      advanceDeposit: q.advanceDeposit || 0,
      items,
      ...computeTotals(items)
    });
  };

  const openEdit = (q) => {
    setSelectedQuote(q);
    setMode('edit');
    setEditingId(q._id);
    const items = q.items?.length ? q.items.map(it => ({ ...it })) : [emptyItem()];
    setForm({
      clientId: q.clientId || '',
      customerName: q.customerName || '',
      customerPhone: q.customerPhone || '',
      customerEmail: q.customerEmail || '',
      customerAddress: q.customerAddress || '',
      customerGSTIN: q.customerGSTIN || '',
      validDate: q.validUntil ? q.validUntil.split('T')[0] : in30d(),
      notes: q.notes || '',
      terms: q.terms || '',
      status: q.status,
      advanceDeposit: q.advanceDeposit || 0,
      items,
      ...computeTotals(items)
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!form.items.length) {
      showSnackbar('Add at least one item', 'error');
      return;
    }
    const cleanItems = form.items.map((it) => {
      const l = line(it);
      return {
        name: it.name,
        description: it.description || '',
        hsnCode: it.hsnCode || '',
        qty: Number(it.qty) || 0,
        unit: it.unit || 'pcs',
        rate: Number(it.rate) || 0,
        gstPercent: Number(it.gstPercent) || 0,
        discountPercent: Number(it.discountPercent) || 0,
        amount: l.total
      };
    });

    const totals = computeTotals(cleanItems);
    const payload = {
      clientId: form.clientId || undefined,
      customerName: form.customerName || undefined,
      customerPhone: form.customerPhone || undefined,
      customerEmail: form.customerEmail || undefined,
      customerAddress: form.customerAddress || undefined,
      customerGSTIN: form.customerGSTIN || undefined,
      validUntil: form.validDate || undefined,
      notes: form.notes,
      terms: form.terms,
      status: form.status,
      advanceDeposit: Number(form.advanceDeposit) || 0,
      items: cleanItems,
      ...totals
    };

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/quotes/${editingId}`, payload);
        showSnackbar('Quotation updated successfully', 'success');
      } else {
        const res = await api.post('/quotes', payload);
        showSnackbar('Quotation created successfully', 'success');
        if (res.data?._id) setEditingId(res.data._id);
      }
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to save quotation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToInvoice = async (id) => {
    const ok = await confirmDialog({
      title: 'Convert Quotation to Invoice?',
      message: 'This will create an official invoice pre-populated with these line items.',
      confirmText: 'Convert Now'
    });
    if (!ok) return;
    try {
      const res = await api.post(`/quotes/${id}/convert`);
      showSnackbar('Quotation converted to Invoice!', 'success');
      navigate(`/billing?fromQuote=${id}&invoiceId=${res.data?.invoiceId || ''}`);
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to convert', 'error');
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirmDialog({
      title: 'Delete Quotation?',
      message: 'Are you sure you want to delete this quotation permanently?',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/quotes/${id}`);
      showSnackbar('Quotation deleted', 'success');
      if (editingId === id) {
        setMode('');
        setSelectedQuote(null);
      }
      fetchData();
    } catch (err) {
      showSnackbar(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const handleWhatsApp = async (q) => {
    const raw = String(q.customerPhone || '').replace(/[^\d]/g, '');
    if (raw.length < 10) {
      showSnackbar('Add a customer phone number to send via WhatsApp', 'error');
      return;
    }
    let num = raw;
    if (num.startsWith('0')) num = num.slice(1);
    if (num.length === 10) num = '91' + num;
    try {
      showSnackbar('Generating PDF...', 'info');
      await downloadFile(`/export/quotes/${q._id}/pdf`, `${q.quoteNumber || 'quotation'}.pdf`);
      showSnackbar('PDF ready. Opening WhatsApp...', 'success');
      window.open(`https://wa.me/${num}`, '_blank');
    } catch (err) {
      showSnackbar('Failed to generate PDF. Please try again.', 'error');
    }
  };

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      const matchSearch =
        (q.quoteNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (q.customerPhone || '').includes(search);
      const matchStatus = !statusFilter || q.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quotes, search, statusFilter]);

  const currentTotals = computeTotals(form.items || []);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-[#f4f6f8] text-slate-800 flex-1">
      {/* ============ LEFT COLUMN: QUOTATIONS LIST TABLE (42% Width) ============ */}
      {!isPanelMaximized && (
        <div style={{ width: mode ? `${splitPercent}%` : '100%', transition: isDragging ? 'none' : 'width 200ms ease' }} className="flex flex-col bg-white border-r border-slate-200 overflow-hidden flex-shrink-0">
          {/* Top Control Bar */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search quote # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16] bg-white font-medium"
              />
              <span className="absolute left-2.5 top-2 text-slate-400">
                <Icon name="search" className="w-3.5 h-3.5" />
              </span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
            >
              <option value="">All Status</option>
              {['draft', 'sent', 'accepted', 'converted', 'rejected', 'expired'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] font-bold text-xs rounded-lg shadow-xs transition"
            >
              <Icon name="plus" className="w-3.5 h-3.5 stroke-[2.5]" /> New Quotation
            </button>
          </div>

          {/* Subheader */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs flex-shrink-0">
            <span className="font-bold text-slate-700">Quotations ({filtered.length})</span>
            <span className="text-[11px] text-slate-400">Click row to open quotation studio</span>
          </div>

          {/* Quotations List */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100/70 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <tr>
                  <th className="py-2 px-3">Quote # / Customer</th>
                  <th className="py-2 px-2 text-right">Amount</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Icon name="refresh" className="w-5 h-5 animate-spin mx-auto text-[#65a30d] mb-2" />
                      <span>Loading quotations...</span>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <p className="font-bold text-slate-600">No quotations found</p>
                      <button onClick={openCreate} className="mt-2 text-xs font-bold text-[#65a30d] hover:underline">
                        + Create your first quotation
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((q) => {
                    const isSelected = selectedQuote?._id === q._id && mode;
                    return (
                      <tr
                        key={q._id}
                        onClick={() => openView(q)}
                        className={`cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-lime-50/70 border-l-4 border-l-[#84cc16]'
                            : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Quote # & Customer */}
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span className="text-[#65a30d]">{q.quoteNumber}</span>
                          </div>
                          <div className="text-[11px] text-slate-700 font-medium truncate max-w-[170px] mt-0.5">
                            {q.customerName || 'Walk-in Customer'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(q.quoteDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-2 align-top text-right font-black text-slate-900">
                          {money(q.grandTotal)}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 align-top">
                          <Badge value={q.status} />
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-2 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleWhatsApp(q)}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                              title="Send WhatsApp"
                            >
                              <Icon name="whatsapp" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(q)}
                              className="p-1 text-slate-400 hover:text-[#65a30d] hover:bg-lime-50 rounded transition"
                              title="Edit Quotation"
                            >
                              <Icon name="edit" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(q._id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Delete"
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
      )}

      {/* Draggable Resizer */}
      {Boolean(mode) && !isPanelMaximized && (
        <SplitDivider isDragging={isDragging} onMouseDown={() => setIsDragging(true)} />
      )}

      {/* ============ RIGHT COLUMN: QUOTATION STUDIO & EDITOR ============ */}
      {Boolean(mode) && (
        <div
          style={{ width: isPanelMaximized ? '100%' : `${100 - splitPercent}%`, transition: isDragging ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          className="flex flex-col bg-white overflow-hidden h-full flex-1 flex-shrink-0 animate-in fade-in slide-in-from-right-3 duration-300"
        >
          
          {/* 1. Header Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {mode === 'create' ? 'New Quotation' : (selectedQuote?.quoteNumber || 'Quotation Details')}
                  </h2>
                  <Badge value={mode === 'view' ? selectedQuote?.status : form.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Grand Total: <b className="text-slate-900 font-black">{money(mode === 'view' ? selectedQuote?.grandTotal : currentTotals.grandTotal)}</b> · Items: <b className="text-slate-700">{mode === 'view' ? (selectedQuote?.items?.length || 0) : form.items.length}</b>
                </p>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMode('')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition shadow-xs"
                  title="Back to Quotations List"
                >
                  <Icon name="arrow-left" className="w-3.5 h-3.5" /> Back
                </button>
                {mode === 'view' && selectedQuote && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(selectedQuote)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#84cc16] hover:bg-[#65a30d] text-[#0f172a] text-xs font-bold rounded-lg transition shadow-xs"
                    >
                      <Icon name="edit" className="w-3.5 h-3.5" /> Edit Quotation
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConvertToInvoice(selectedQuote._id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition"
                      title="Convert to Invoice"
                    >
                      <Icon name="bill" className="w-3.5 h-3.5" /> Convert to Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/quotes/${selectedQuote._id}`)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      title="Full Screen / Print View"
                    >
                      <Icon name="eye" className="w-4 h-4" />
                    </button>
                  </>
                )}
                {mode !== 'view' && editingId && (
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
                  >
                    <Icon name="eye" className="w-3.5 h-3.5" /> View Mode
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPanelMaximized(!isPanelMaximized)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title={isPanelMaximized ? "Restore Split View" : "Maximize Full View"}
                >
                  <Icon name="expand" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode('')}
                  className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                  title="Close"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Scrollable Body: View Document OR Edit Form */}
          {mode === 'view' && selectedQuote ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
              <QuotationDoc quote={selectedQuote} company={client} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/60">
              <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
              
              {/* Customer Information Card */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon name="store" className="w-3.5 h-3.5 text-[#65a30d]" /> Customer Profile &amp; Dates
                </h3>

                {isPlatform && clients.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Tenant Customer (Optional)</label>
                    <select
                      value={form.clientId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        const c = clients.find((x) => x._id === cid);
                        setForm({
                          ...form,
                          clientId: cid,
                          customerName: c ? c.name : form.customerName,
                          customerPhone: c ? (c.contact || c.pendingOwnerMobile || '') : form.customerPhone,
                          customerEmail: c ? (c.ownerEmail || '') : form.customerEmail,
                          customerAddress: c ? (c.address || '') : form.customerAddress,
                          customerGSTIN: c ? (c.gstNumber || '') : form.customerGSTIN
                        });
                      }}
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white"
                    >
                      <option value="">-- Direct / Walk-in Customer --</option>
                      {clients.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.customerCode || c.subdomain})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Company Name *</label>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      placeholder="e.g. Ramesh Traders"
                      required
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Customer Phone (WhatsApp)</label>
                    <input
                      type="text"
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN (Optional)</label>
                    <input
                      type="text"
                      value={form.customerGSTIN}
                      onChange={(e) => setForm({ ...form, customerGSTIN: e.target.value.toUpperCase() })}
                      placeholder="33AAAAA0000A1Z5"
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Valid Until Date</label>
                    <input
                      type="date"
                      value={form.validDate}
                      onChange={(e) => setForm({ ...form, validDate: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-medium rounded border border-slate-300 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Quotation Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Line Items Card */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Icon name="bill" className="w-3.5 h-3.5 text-emerald-600" /> Line Items &amp; Pricing
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-lime-50 text-[#65a30d] hover:bg-lime-100 rounded-lg text-xs font-bold transition"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" /> Add Line Item
                  </button>
                </div>

                {/* Column Headers */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 bg-slate-100/90 rounded-lg text-[10px] font-black text-slate-700 uppercase tracking-wider border border-slate-200">
                  <div className="sm:col-span-5">Product / Service Description</div>
                  <div className="sm:col-span-2 text-center">Qty</div>
                  <div className="sm:col-span-2 text-right">Unit Rate (₹)</div>
                  <div className="sm:col-span-1 text-center">GST %</div>
                  <div className="sm:col-span-2 text-right">Line Total (₹)</div>
                </div>

                <div className="space-y-2.5">
                  {form.items.map((it, idx) => {
                    const l = line(it);
                    return (
                      <div key={idx} className="p-3 bg-slate-50/90 rounded-lg border border-slate-200 text-xs space-y-2 hover:border-slate-300 transition">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-800 text-[11px] bg-slate-200/70 px-2 py-0.5 rounded">
                            Line #{idx + 1}
                          </span>
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold px-2 py-0.5 hover:bg-rose-50 rounded transition"
                            >
                              ✕ Remove Item
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-5">
                            <label className="block sm:hidden text-[10px] font-bold text-slate-500 mb-0.5">Product / Service *</label>
                            <input
                              type="text"
                              placeholder="Product / Service Description *"
                              value={it.name}
                              onChange={(e) => setItem(idx, 'name', e.target.value)}
                              required
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white focus:outline-none focus:border-[#84cc16]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block sm:hidden text-[10px] font-bold text-slate-500 mb-0.5">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={it.qty}
                              onChange={(e) => setItem(idx, 'qty', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white text-center focus:outline-none focus:border-[#84cc16]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block sm:hidden text-[10px] font-bold text-slate-500 mb-0.5">Unit Rate (₹)</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Rate (₹)"
                              value={it.rate}
                              onChange={(e) => setItem(idx, 'rate', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white text-right focus:outline-none focus:border-[#84cc16]"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block sm:hidden text-[10px] font-bold text-slate-500 mb-0.5">GST %</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="GST%"
                              value={it.gstPercent}
                              onChange={(e) => setItem(idx, 'gstPercent', e.target.value)}
                              className="w-full px-1.5 py-1.5 text-xs font-bold rounded border border-slate-300 bg-white text-center focus:outline-none focus:border-[#84cc16]"
                            />
                          </div>
                          <div className="sm:col-span-2 flex items-center justify-between sm:justify-end font-black text-slate-900 text-xs pt-1 sm:pt-0">
                            <span className="sm:hidden text-slate-500 font-medium">Total:</span>
                            <span className="text-emerald-700 font-extrabold">{money(l.total)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Calculation Summary */}
                <div className="p-3 bg-slate-100 rounded-lg space-y-1 text-xs text-right">
                  <div>Subtotal: <b className="text-slate-800">{money(currentTotals.subTotal)}</b></div>
                  {currentTotals.discountTotal > 0 && <div>Discount: <b className="text-emerald-700">-{money(currentTotals.discountTotal)}</b></div>}
                  <div>GST Tax: <b className="text-slate-800">+{money(currentTotals.taxTotal)}</b></div>
                  <div className="text-sm font-black text-slate-900 pt-1 border-t border-slate-300">
                    Grand Total: {money(currentTotals.grandTotal)}
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Notes &amp; Payment Terms
                </h3>
                <textarea
                  rows={2}
                  placeholder="Terms, delivery time, or bank account details..."
                  value={form.terms || form.notes}
                  onChange={(e) => setForm({ ...form, terms: e.target.value, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#84cc16]"
                />
              </div>
              </form>
            </div>
          )}

          {/* 3. Action Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="text-xs text-slate-600 font-medium">
              Grand Total: <b className="text-slate-900 font-black">{money(mode === 'view' ? selectedQuote?.grandTotal : currentTotals.grandTotal)}</b>
            </div>

            <div className="flex items-center gap-2">
              {mode === 'view' && selectedQuote ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleWhatsApp(selectedQuote)}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition flex items-center gap-1.5"
                  >
                    <Icon name="whatsapp" className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConvertToInvoice(selectedQuote._id)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                  >
                    <Icon name="bill" className="w-3.5 h-3.5" /> Convert to Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(selectedQuote)}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition flex items-center gap-1.5"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" /> Edit Quotation
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => selectedQuote ? setMode('view') : setMode('')}
                    className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-5 py-1.5 text-xs font-bold text-white bg-[#84cc16] hover:bg-[#65a30d] rounded-lg shadow-xs transition flex items-center gap-1.5"
                  >
                    {saving ? (
                      <>
                        <Icon name="refresh" className="w-3.5 h-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      'Save Quotation'
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}